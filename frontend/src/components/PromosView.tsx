import React, { useEffect, useState } from 'react';
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  Copy,
  Users,
  X,
  Power,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  AdminUser,
  ConfirmDialogOptions,
  LangCode,
  PromoCodeItem,
  PromoRedemptionItem,
} from '../types';
import { formatDateTime, formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface PromosViewProps {
  currentAdmin: AdminUser | null;
  onInspectUserById: (userId: string) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

function generateRandomPromoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KAFEH-${suffix}`;
}

export const PromosView: React.FC<PromosViewProps> = ({
  currentAdmin,
  onInspectUserById,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCodeItem | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [rewardCoin, setRewardCoin] = useState(500);
  const [rewardXp, setRewardXp] = useState(0);
  const [maxUses, setMaxUses] = useState(100);
  const [perUserLimit, setPerUserLimit] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Redemptions modal state
  const [redemptionPromo, setRedemptionPromo] = useState<PromoCodeItem | null>(null);
  const [redemptions, setRedemptions] = useState<PromoRedemptionItem[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  const canWrite = hasAdminPermission(currentAdmin, 'economy:write');

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listPromos({
        page,
        limit: 20,
        search: appliedSearch || undefined,
        status_filter: statusFilter,
      });
      setPromos(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message || 'خطا در دریافت کدهای هدیه', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, [page, appliedSearch, statusFilter]);

  const openCreateModal = () => {
    setEditingPromo(null);
    setCode(generateRandomPromoCode());
    setTitle('');
    setRewardCoin(500);
    setRewardXp(0);
    setMaxUses(100);
    setPerUserLimit(1);
    setExpiresAt('');
    setIsActive(true);
    setEditorOpen(true);
  };

  const openEditModal = (p: PromoCodeItem) => {
    setEditingPromo(p);
    setCode(p.code);
    setTitle(p.title || '');
    setRewardCoin(p.reward_coin || 0);
    setRewardXp(p.reward_xp || 0);
    setMaxUses(p.max_uses || 0);
    setPerUserLimit(p.per_user_limit || 1);
    setExpiresAt(p.expires_at ? p.expires_at.slice(0, 16) : '');
    setIsActive(Boolean(p.is_active));
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rewardCoin <= 0 && rewardXp <= 0) {
      onNotify(
        lang === 'fa' ? 'حداقل مقدار سکه یا XP باید بزرگ‌تر از صفر باشد.' : 'Either coin or XP reward must be > 0.',
        'error'
      );
      return;
    }
    setSaving(true);
    try {
      const isoExpiry = expiresAt ? new Date(expiresAt).toISOString() : null;
      if (editingPromo) {
        await ApiService.updatePromo(editingPromo._id, {
          title: title.trim() || editingPromo.code,
          reward_coin: Math.max(0, Number(rewardCoin) || 0),
          reward_xp: Math.max(0, Number(rewardXp) || 0),
          max_uses: Math.max(0, Number(maxUses) || 0),
          per_user_limit: Math.max(1, Number(perUserLimit) || 1),
          expires_at: isoExpiry,
          is_active: isActive,
        });
        onNotify(lang === 'fa' ? 'کد هدیه بروزرسانی شد.' : 'Promo code updated.', 'success');
      } else {
        await ApiService.createPromo({
          code: code.trim().toUpperCase(),
          title: title.trim() || code.trim().toUpperCase(),
          reward_coin: Math.max(0, Number(rewardCoin) || 0),
          reward_xp: Math.max(0, Number(rewardXp) || 0),
          max_uses: Math.max(0, Number(maxUses) || 0),
          per_user_limit: Math.max(1, Number(perUserLimit) || 1),
          expires_at: isoExpiry,
          is_active: isActive,
        });
        onNotify(lang === 'fa' ? 'کد هدیه جدید ساخته شد.' : 'Promo code created.', 'success');
      }
      setEditorOpen(false);
      fetchPromos();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: PromoCodeItem) => {
    try {
      await ApiService.updatePromo(p._id, { is_active: !p.is_active });
      onNotify(
        lang === 'fa'
          ? `کد ${p.code} ${!p.is_active ? 'فعال' : 'غیرفعال'} شد.`
          : `Promo ${p.code} ${!p.is_active ? 'activated' : 'disabled'}.`,
        'success'
      );
      fetchPromos();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDelete = (p: PromoCodeItem) => {
    onConfirm({
      title: lang === 'fa' ? 'حذف کد هدیه' : 'Delete Promo Code',
      message:
        lang === 'fa'
          ? `آیا از حذف کد هدیه «${p.code}» اطمینان دارید؟`
          : `Permanently delete promo code "${p.code}"?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'حذف کد' : 'Delete',
      onConfirm: async () => {
        try {
          await ApiService.deletePromo(p._id);
          onNotify(lang === 'fa' ? 'کد هدیه حذف شد.' : 'Promo deleted.', 'success');
          fetchPromos();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleOpenRedemptions = async (p: PromoCodeItem) => {
    setRedemptionPromo(p);
    setRedemptions([]);
    setLoadingRedemptions(true);
    try {
      const res = await ApiService.getPromoRedemptions(p._id, 60);
      setRedemptions(res.items || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const handleCopy = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      onNotify(lang === 'fa' ? `کد ${val} کپی شد.` : `Copied ${val}`, 'info');
    } catch {
      // ignore
    }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'کدهای هدیه و کمپین‌ها' : 'Promo & Gift Codes'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `${formatNumber(total, lang)} کد ثبت‌شده — قابل استفاده توسط بازیکنان در مسیر POST /redeem-promo`
              : `${formatNumber(total, lang)} campaigns — redeemable by players via POST /redeem-promo`}
          </p>
        </div>
        <div className="header-actions">
          {canWrite && (
            <button type="button" className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={15} />
              <span>{lang === 'fa' ? 'ایجاد کد هدیه' : 'Create Promo Code'}</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={fetchPromos} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="toolbar">
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchInput.trim());
          }}
        >
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="input-field"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={lang === 'fa' ? 'جستجوی کد یا عنوان کمپین...' : 'Search code or campaign title...'}
          />
          {(searchInput || appliedSearch) && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
                setPage(1);
              }}
            >
              <X size={14} />
            </button>
          )}
        </form>

        <div className="segmented">
          {(
            [
              ['all', 'همه', 'All'],
              ['active', 'فعال', 'Active'],
              ['inactive', 'غیرفعال', 'Inactive'],
            ] as const
          ).map(([val, fa, en]) => (
            <button
              key={val}
              type="button"
              className={`segmented-btn ${statusFilter === val ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              {lang === 'fa' ? fa : en}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{lang === 'fa' ? 'کد و عنوان' : 'Code & Title'}</th>
              <th>{lang === 'fa' ? 'پاداش' : 'Rewards'}</th>
              <th>{lang === 'fa' ? 'میزان مصرف' : 'Usage'}</th>
              <th>{lang === 'fa' ? 'انقضا' : 'Expires'}</th>
              <th>{lang === 'fa' ? 'وضعیت' : 'Status'}</th>
              <th style={{ width: 155 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6}><div className="skeleton" style={{ height: 20 }} /></td>
                </tr>
              ))
            ) : promos.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <Ticket size={26} />
                    <span>{lang === 'fa' ? 'هنوز کد هدیه‌ای ایجاد نشده است.' : 'No promo codes yet.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              promos.map((p) => {
                const pct = p.max_uses > 0 ? Math.min(100, Math.round((p.used_count / p.max_uses) * 100)) : 0;
                const tone = !p.is_active
                  ? 'muted'
                  : p.is_expired || p.is_exhausted
                  ? 'crimson'
                  : 'emerald';
                const statusText = !p.is_active
                  ? lang === 'fa' ? 'غیرفعال' : 'Inactive'
                  : p.is_expired
                  ? lang === 'fa' ? 'منقضی' : 'Expired'
                  : p.is_exhausted
                  ? lang === 'fa' ? 'تکمیل ظرفیت' : 'Exhausted'
                  : lang === 'fa' ? 'فعال' : 'Active';

                return (
                  <tr key={p._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="tag accent mono" style={{ fontWeight: 700 }}>{p.code}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(p.code)}
                          title={lang === 'fa' ? 'کپی کد' : 'Copy Code'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="text-secondary" style={{ fontSize: 12, marginTop: 3 }}>{p.title || '—'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.reward_coin > 0 && (
                          <span className="tag accent mono">
                            +{formatNumber(p.reward_coin, lang)} {lang === 'fa' ? 'سکه' : 'Coins'}
                          </span>
                        )}
                        {p.reward_xp > 0 && (
                          <span className="tag sapphire mono">
                            +{formatNumber(p.reward_xp, lang)} XP
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ minWidth: 135 }}>
                      <div className="mono" style={{ fontSize: 12, marginBottom: 4 }}>
                        {formatNumber(p.used_count, lang)} / {p.max_uses > 0 ? formatNumber(p.max_uses, lang) : '∞'}
                      </div>
                      {p.max_uses > 0 && (
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="mono text-secondary" style={{ fontSize: 12 }}>
                      {p.expires_at ? formatDateTime(p.expires_at, lang) : lang === 'fa' ? 'بدون انقضا' : 'Never'}
                    </td>
                    <td>
                      <span className={`status-label ${tone}`}>
                        <span className={`status-dot ${tone === 'emerald' ? 'online' : 'offline'}`} />
                        {statusText}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon sm"
                          onClick={() => handleOpenRedemptions(p)}
                          title={lang === 'fa' ? 'لیست استفاده‌کنندگان' : 'Redemption History'}
                        >
                          <Users size={14} className="text-sapphire" />
                        </button>
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              className="btn-icon sm"
                              onClick={() => handleToggleActive(p)}
                              title={p.is_active ? (lang === 'fa' ? 'غیرفعال کردن' : 'Disable') : (lang === 'fa' ? 'فعال کردن' : 'Enable')}
                            >
                              <Power size={14} className={p.is_active ? 'text-emerald' : 'text-muted'} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon sm"
                              onClick={() => openEditModal(p)}
                              title={lang === 'fa' ? 'ویرایش' : 'Edit'}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon sm danger"
                              onClick={() => handleDelete(p)}
                              title={lang === 'fa' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <span>
              {lang === 'fa'
                ? `صفحه ${formatNumber(page, lang)} از ${formatNumber(totalPages, lang)}`
                : `Page ${page} of ${totalPages}`}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {lang === 'fa' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span>{lang === 'fa' ? 'قبلی' : 'Prev'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>{lang === 'fa' ? 'بعدی' : 'Next'}</span>
                {lang === 'fa' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Promo Modal */}
      {editorOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !saving && setEditorOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Ticket size={17} className="text-accent" />
                <span>
                  {editingPromo
                    ? lang === 'fa' ? 'ویرایش کد هدیه' : 'Edit Promo Code'
                    : lang === 'fa' ? 'ساخت کد هدیه جدید' : 'Create Promo Code'}
                </span>
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'کد هدیه (لاتین)' : 'Code'}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="input-field mono"
                        value={code}
                        disabled={Boolean(editingPromo)}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        style={{ direction: 'ltr', textAlign: 'left' }}
                        required
                      />
                      {!editingPromo && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCode(generateRandomPromoCode())}
                          title={lang === 'fa' ? 'تولید کد تصادفی' : 'Randomize'}
                        >
                          <Sparkles size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'عنوان کمپین' : 'Campaign Title'}</label>
                    <input
                      type="text"
                      className="input-field"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={lang === 'fa' ? 'مثلاً هدیه نوروزی' : 'e.g. Weekend Gift'}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'پاداش سکه' : 'Coin Reward'}</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field mono"
                      value={rewardCoin}
                      onChange={(e) => setRewardCoin(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'پاداش XP' : 'XP Reward'}</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field mono"
                      value={rewardXp}
                      onChange={(e) => setRewardXp(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">
                      {lang === 'fa' ? 'سقف کل مصرف (۰ = نامحدود)' : 'Max Total Uses (0 = unlimited)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="input-field mono"
                      value={maxUses}
                      onChange={(e) => setMaxUses(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'سقف مصرف هر بازیکن' : 'Per-User Limit'}</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field mono"
                      value={perUserLimit}
                      onChange={(e) => setPerUserLimit(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">
                    {lang === 'fa' ? 'تاریخ انقضا (اختیاری)' : 'Expiration Date (Optional)'}
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field mono"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>{lang === 'fa' ? 'کد هدیه بلافاصله فعال باشد' : 'Code is active immediately'}</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? lang === 'fa' ? 'در حال ذخیره...' : 'Saving...'
                    : lang === 'fa' ? 'ذخیره کد' : 'Save Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemptions Modal */}
      {redemptionPromo && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setRedemptionPromo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Users size={17} className="text-sapphire" />
                <span>
                  {lang === 'fa' ? 'تاریخچه مصرف کد' : 'Redemptions for'}{' '}
                  <span className="mono text-accent">{redemptionPromo.code}</span>
                </span>
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setRedemptionPromo(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {loadingRedemptions ? (
                <div className="skeleton" style={{ height: 60 }} />
              ) : redemptions.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 12px' }}>
                  <span>{lang === 'fa' ? 'هنوز هیچ بازیکنی از این کد استفاده نکرده است.' : 'No redemptions recorded yet.'}</span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'fa' ? 'بازیکن' : 'Player'}</th>
                        <th>{lang === 'fa' ? 'پاداش' : 'Granted'}</th>
                        <th>{lang === 'fa' ? 'زمان' : 'Redeemed At'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((r) => (
                        <tr key={r._id}>
                          <td>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => {
                                setRedemptionPromo(null);
                                onInspectUserById(r.user_id);
                              }}
                            >
                              {r.username || r.user_id}
                            </button>
                          </td>
                          <td className="mono">
                            {r.reward_coin > 0 && <span className="text-accent">+{formatNumber(r.reward_coin, lang)} 🪙 </span>}
                            {r.reward_xp > 0 && <span className="text-sapphire">+{formatNumber(r.reward_xp, lang)} XP</span>}
                          </td>
                          <td className="mono text-secondary" style={{ fontSize: 12 }}>
                            {formatDateTime(r.redeemed_at, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setRedemptionPromo(null)}>
                {lang === 'fa' ? 'بستن' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
