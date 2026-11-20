import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Eye,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  Trophy,
  Users,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, ClanItem, ConfirmDialogOptions, LangCode } from '../types';
import { formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface ClansViewProps {
  currentAdmin: AdminUser | null;
  onOpenClanDetails: (clanId: string) => void;
  onInspectUserById: (userId: string) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const ClansView: React.FC<ClansViewProps> = ({
  currentAdmin,
  onOpenClanDetails,
  onInspectUserById,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [clans, setClans] = useState<ClanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const canManageClans = hasAdminPermission(currentAdmin, 'clans:manage');

  const fetchClans = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getClans({
        page,
        limit: 20,
        search: appliedSearch || undefined,
      });
      setClans(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClans();
  }, [page, appliedSearch]);

  const handleDisband = (clan: ClanItem) => {
    onConfirm({
      title: lang === 'fa' ? 'انحلال کامل کلن' : 'Disband Clan',
      message:
        lang === 'fa'
          ? `کلن «${clan.name}» و تمامی عضویت‌های آن حذف خواهد شد. این عمل غیرقابل بازگشت است.`
          : `Clan "${clan.name}" and all memberships will be permanently removed. Continue?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'انحلال کلن' : 'Disband Clan',
      onConfirm: async () => {
        try {
          await ApiService.disbandClan(clan._id);
          onNotify(lang === 'fa' ? 'کلن با موفقیت منحل شد.' : 'Clan disbanded.', 'success');
          fetchClans();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'کلن‌ها و اتحادها' : 'Clans & Alliances'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `${formatNumber(total, lang)} کلن ثبت‌شده — ویرایش مشخصات، مدیریت اعضا و نظارت`
              : `${formatNumber(total, lang)} registered clans — edit details, manage rosters, and moderate`}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchClans} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
        </button>
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
            placeholder={lang === 'fa' ? 'جستجوی نام، تگ یا شناسه کلن...' : 'Search clan name, tag, or ID...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={lang === 'fa' ? 'جستجوی کلن' : 'Search clans'}
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
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{lang === 'fa' ? 'کلن' : 'Clan'}</th>
              <th>{lang === 'fa' ? 'رهبر کلن' : 'Leader'}</th>
              <th>{lang === 'fa' ? 'سطح' : 'Level'}</th>
              <th>{lang === 'fa' ? 'امتیاز کلن' : 'Trophies'}</th>
              <th>{lang === 'fa' ? 'اعضا' : 'Members'}</th>
              <th style={{ width: 110 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6}><div className="skeleton" style={{ height: 18 }} /></td>
                </tr>
              ))
            ) : clans.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <Shield size={26} />
                    <span>{lang === 'fa' ? 'کلنی یافت نشد.' : 'No clans found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              clans.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <button type="button" className="link-btn" onClick={() => onOpenClanDetails(c._id)}>
                          {c.name}
                        </button>
                        {c.tag && <span className="tag accent mono">[{c.tag}]</span>}
                      </div>
                      <span className="mono text-muted" style={{ fontSize: 11.5 }}>{c._id}</span>
                    </div>
                  </td>
                  <td>
                    {c.owner_id ? (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: 13 }}
                        onClick={() => onInspectUserById(c.owner_id)}
                      >
                        {c.owner_name || c.owner_id}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>Lv.{c.level || 1}</td>
                  <td>
                    <span className="mono text-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                      <Trophy size={13} />
                      {formatNumber(c.trophies, lang)}
                    </span>
                  </td>
                  <td className="mono text-secondary">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Users size={13} />
                      {formatNumber(c.member_count || 0, lang)}
                      {c.max_members ? ` / ${formatNumber(c.max_members, lang)}` : ''}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-icon sm"
                        onClick={() => onOpenClanDetails(c._id)}
                        title={lang === 'fa' ? 'جزئیات و ویرایش' : 'Details & Edit'}
                        aria-label={`Inspect clan ${c.name}`}
                      >
                        <Eye size={14} />
                      </button>
                      {canManageClans && (
                        <button
                          type="button"
                          className="btn-icon sm danger"
                          onClick={() => handleDisband(c)}
                          title={lang === 'fa' ? 'انحلال کلن' : 'Disband Clan'}
                          aria-label={`Disband clan ${c.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
    </div>
  );
};
