import React, { useState, useEffect } from 'react';
import {
  Search,
  Eye,
  Coins,
  Ban,
  CheckCircle,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  LockOpen,
  Copy,
  Users,
  Send,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, ConfirmDialogOptions, LangCode, UserItem } from '../types';
import { buildCsvContent, formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface UsersViewProps {
  currentAdmin: AdminUser | null;
  onOpenDetails: (user: UserItem, initialTab?: 'overview' | 'games' | 'purchases' | 'edit' | 'notify') => void;
  onOpenAdjustCurrency: (user: UserItem) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const UsersView: React.FC<UsersViewProps> = ({
  currentAdmin,
  onOpenDetails,
  onOpenAdjustCurrency,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'bot' | 'banned' | 'locked'>('all');
  const [sortBy, setSortBy] = useState('join_date');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canWriteUsers = hasAdminPermission(currentAdmin, 'users:write');
  const canWriteEconomy = hasAdminPermission(currentAdmin, 'economy:write');
  const canSendNotice = hasAdminPermission(currentAdmin, 'notifications:write');

  const fetchUsers = async (overrides?: {
    page?: number;
    search?: string;
    filter_type?: 'all' | 'real' | 'bot' | 'banned' | 'locked';
    sort_by?: string;
  }) => {
    const reqPage = overrides?.page ?? page;
    const reqSearch = overrides?.search !== undefined ? overrides.search : appliedSearch;
    const reqFilter = overrides?.filter_type ?? filterType;
    const reqSort = overrides?.sort_by ?? sortBy;

    setLoading(true);
    try {
      const res = await ApiService.listUsers({
        page: reqPage,
        limit: 20,
        search: reqSearch || undefined,
        filter_type: reqFilter,
        sort_by: reqSort,
        sort_order: -1,
      });
      setUsers(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
      setSelectedIds([]);
    } catch (err: any) {
      onNotify(err.message || 'خطا در دریافت لیست کاربران', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, filterType, sortBy, appliedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setPage(1);
    setAppliedSearch('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u._id));
    }
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      onNotify(lang === 'fa' ? `شناسه ${id} کپی شد.` : `Copied ID ${id}.`, 'info');
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleToggleBan = (user: UserItem) => {
    const nextActive = !user.is_active;
    onConfirm({
      title: nextActive
        ? lang === 'fa' ? 'رفع مسدودی بازیکن' : 'Unban Player'
        : lang === 'fa' ? 'مسدود کردن بازیکن' : 'Ban Player',
      message:
        lang === 'fa'
          ? `آیا از ${nextActive ? 'رفع مسدودی' : 'مسدود کردن'} حساب «${user.username || user._id}» اطمینان دارید؟`
          : `Are you sure you want to ${nextActive ? 'unban' : 'ban'} "${user.username || user._id}"?`,
      variant: nextActive ? 'primary' : 'danger',
      confirmLabel: nextActive
        ? lang === 'fa' ? 'رفع مسدودی' : 'Unban'
        : lang === 'fa' ? 'مسدود کردن' : 'Ban',
      onConfirm: async () => {
        try {
          await ApiService.toggleBan(user._id, nextActive, 'Admin action');
          onNotify(
            lang === 'fa'
              ? `وضعیت حساب ${user.username || user._id} تغییر یافت.`
              : `Updated status for ${user.username || user._id}.`,
            'success'
          );
          fetchUsers();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleResetLocks = async (user: UserItem) => {
    try {
      await ApiService.resetUserLocks(user._id);
      onNotify(
        lang === 'fa'
          ? `قفل بازی ${user.username || user._id} پاک شد.`
          : `Cleared match locks for ${user.username || user._id}.`,
        'success'
      );
      fetchUsers();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleBulkUnlock = () => {
    if (selectedIds.length === 0) return;
    onConfirm({
      title: lang === 'fa' ? 'رفع قفل گروهی بازیکنان' : 'Bulk Release Player Locks',
      message:
        lang === 'fa'
          ? `قفل بازی برای ${selectedIds.length} بازیکن انتخاب‌شده پاک می‌شود. ادامه می‌دهید؟`
          : `Clear open game locks for ${selectedIds.length} selected players?`,
      variant: 'warning',
      confirmLabel: lang === 'fa' ? 'رفع قفل' : 'Release Locks',
      onConfirm: async () => {
        try {
          const res = await ApiService.bulkResetLocks(selectedIds);
          onNotify(
            lang === 'fa'
              ? `قفل ${res.modified_count} بازیکن پاک شد.`
              : `Cleared locks for ${res.modified_count} players.`,
            'success'
          );
          fetchUsers();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleDeleteUser = (user: UserItem) => {
    onConfirm({
      title: lang === 'fa' ? 'حذف دائمی حساب بازیکن' : 'Permanently Delete Player',
      message:
        lang === 'fa'
          ? `حساب «${user.username || user._id}» به صورت دائمی حذف خواهد شد و این عملیات قابل بازگشت نیست.`
          : `Account "${user.username || user._id}" will be permanently deleted. This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'حذف دائمی' : 'Delete Forever',
      onConfirm: async () => {
        try {
          await ApiService.deleteUser(user._id);
          onNotify(lang === 'fa' ? 'حساب کاربر حذف شد.' : 'User account deleted.', 'success');
          fetchUsers();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleExportCSV = () => {
    const targetList = selectedIds.length > 0 ? users.filter((u) => selectedIds.includes(u._id)) : users;
    const headers = ['ID', 'Username', 'Phone', 'Coins', 'Score', 'XP', 'Status', 'OpenGameID'];
    const rows = targetList.map((u) => [
      u._id,
      u.username || '',
      u.phone || '',
      u.coin || 0,
      u.score || 0,
      u.xp || 0,
      u.is_active === false ? 'Banned' : 'Active',
      u.open_game_id || u.open_pre_game_id || '',
    ]);
    const csv = buildCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kafehfekr_players_p${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify(lang === 'fa' ? 'فایل CSV آماده و دانلود شد.' : 'CSV exported.', 'success');
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'مدیریت بازیکنان' : 'Player Directory'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `مجموع نتایج: ${formatNumber(total, lang)} بازیکن — جستجو، فیلتر قفل‌شده‌ها و مدیریت دارایی`
              : `${formatNumber(total, lang)} matching players — inspect profiles, balances, and locks`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV} disabled={users.length === 0}>
            <Download size={15} />
            <span>{lang === 'fa' ? 'خروجی CSV' : 'Export CSV'}</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fetchUsers()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} className="search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="input-field"
            placeholder={lang === 'fa' ? 'جستجوی نام کاربری، شناسه یا شماره...' : 'Search username, ID, or phone...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={lang === 'fa' ? 'جستجوی بازیکن' : 'Search players'}
          />
          {(searchInput || appliedSearch) && (
            <button
              type="button"
              className="search-clear"
              onClick={handleClearSearch}
              aria-label={lang === 'fa' ? 'پاک کردن جستجو' : 'Clear search'}
            >
              <X size={14} />
            </button>
          )}
        </form>

        <div className="toolbar-group">
          <div className="segmented" role="tablist">
            {(
              [
                ['all', 'همه', 'All'],
                ['real', 'واقعی', 'Real'],
                ['locked', 'گیرکرده', 'Locked'],
                ['banned', 'مسدود', 'Banned'],
                ['bot', 'ربات', 'Bots'],
              ] as const
            ).map(([key, fa, en]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filterType === key}
                className={`segmented-btn ${filterType === key ? 'active' : ''}`}
                onClick={() => {
                  setFilterType(key);
                  setPage(1);
                }}
              >
                {lang === 'fa' ? fa : en}
              </button>
            ))}
          </div>

          <select
            className="select-field"
            style={{ width: 'auto', minWidth: 150 }}
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            aria-label={lang === 'fa' ? 'مرتب‌سازی' : 'Sort players'}
          >
            <option value="join_date">{lang === 'fa' ? 'جدیدترین عضویت' : 'Newest Joined'}</option>
            <option value="score">{lang === 'fa' ? 'بیشترین امتیاز' : 'Highest Score'}</option>
            <option value="coin">{lang === 'fa' ? 'بیشترین سکه' : 'Highest Coins'}</option>
            <option value="xp">{lang === 'fa' ? 'بیشترین XP' : 'Highest XP'}</option>
            <option value="last_time_played">{lang === 'fa' ? 'آخرین فعالیت' : 'Last Active'}</option>
          </select>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-bar">
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {formatNumber(selectedIds.length, lang)}{' '}
            {lang === 'fa' ? 'بازیکن انتخاب شده است' : 'players selected'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canWriteUsers && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleBulkUnlock}>
                <LockOpen size={14} />
                <span>{lang === 'fa' ? 'رفع قفل انتخاب‌شده‌ها' : 'Clear Selected Locks'}</span>
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={14} />
              <span>{lang === 'fa' ? 'خروجی CSV انتخابی' : 'Export Selected'}</span>
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
              {lang === 'fa' ? 'لغو انتخاب' : 'Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedIds.length === users.length}
                  onChange={toggleSelectAll}
                  aria-label={lang === 'fa' ? 'انتخاب همه' : 'Select all'}
                />
              </th>
              <th>{lang === 'fa' ? 'بازیکن' : 'Player'}</th>
              <th>{lang === 'fa' ? 'شماره تماس' : 'Phone'}</th>
              <th>{lang === 'fa' ? 'سکه' : 'Coins'}</th>
              <th>{lang === 'fa' ? 'امتیاز / XP' : 'Score / XP'}</th>
              <th>{lang === 'fa' ? 'وضعیت' : 'Status'}</th>
              <th style={{ width: 170 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  <td colSpan={7}>
                    <div className="skeleton" style={{ width: '100%', height: 18 }} />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Users size={26} />
                    <span>{lang === 'fa' ? 'هیچ بازیکنی با این فیلتر یافت نشد.' : 'No players match your filter.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isBot = u._id.startsWith('bot_') || u._id.startsWith('test_bot');
                const isLocked = Boolean(u.open_game_id || u.open_pre_game_id);
                const isSelected = selectedIds.includes(u._id);
                return (
                  <tr key={u._id} className={isSelected ? 'row-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(u._id)}
                        aria-label={`Select ${u.username || u._id}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" className="link-btn" onClick={() => onOpenDetails(u)}>
                            {u.username || (lang === 'fa' ? 'بدون نام' : 'Unnamed')}
                          </button>
                          {isBot && <span className="tag violet">BOT</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="mono text-muted" style={{ fontSize: 11.5 }}>{u._id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(u._id)}
                            title={lang === 'fa' ? 'کپی شناسه' : 'Copy ID'}
                            aria-label={`Copy ID ${u._id}`}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              padding: 2,
                            }}
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="mono text-secondary">{u.phone || '—'}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      {formatNumber(u.coin, lang)}
                    </td>
                    <td>
                      <div className="mono">
                        <span className="text-emerald" style={{ fontWeight: 600 }}>
                          {formatNumber(u.score, lang)}
                        </span>
                        <span className="meta-sep" style={{ margin: '0 6px' }}>·</span>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {formatNumber(u.xp, lang)} XP
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span className={`status-label ${u.is_active === false ? 'crimson' : 'emerald'}`}>
                          <span className={`status-dot ${u.is_active === false ? 'offline' : 'online'}`} />
                          {u.is_active === false
                            ? lang === 'fa' ? 'مسدود' : 'Banned'
                            : lang === 'fa' ? 'فعال' : 'Active'}
                        </span>
                        {isLocked && (
                          <span className="status-label amber" style={{ fontSize: 11.5 }}>
                            {lang === 'fa' ? 'قفل بازی فعال' : 'Locked in match'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon sm"
                          onClick={() => onOpenDetails(u)}
                          title={lang === 'fa' ? 'جزئیات و ویرایش' : 'Details & Edit'}
                          aria-label={`Inspect ${u.username || u._id}`}
                        >
                          <Eye size={14} />
                        </button>
                        {canSendNotice && (
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => onOpenDetails(u, 'notify')}
                            title={lang === 'fa' ? 'ارسال پیام / اعلان مستقیم' : 'Send Direct Message'}
                            aria-label={`Send direct message to ${u.username || u._id}`}
                          >
                            <Send size={14} className="text-accent" />
                          </button>
                        )}
                        {canWriteEconomy && (
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => onOpenAdjustCurrency(u)}
                            title={lang === 'fa' ? 'تغییر سکه / امتیاز' : 'Adjust Currency'}
                            aria-label={`Adjust currency for ${u.username || u._id}`}
                          >
                            <Coins size={14} className="text-accent" />
                          </button>
                        )}
                        {canWriteUsers && isLocked && (
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => handleResetLocks(u)}
                            title={lang === 'fa' ? 'رفع قفل بازی' : 'Clear Match Lock'}
                            aria-label={`Clear lock for ${u.username || u._id}`}
                          >
                            <LockOpen size={14} className="text-amber" />
                          </button>
                        )}
                        {canWriteUsers && (
                          <button
                            type="button"
                            className={`btn-icon sm ${u.is_active === false ? '' : 'danger'}`}
                            onClick={() => handleToggleBan(u)}
                            title={
                              u.is_active === false
                                ? lang === 'fa' ? 'رفع مسدودی' : 'Unban'
                                : lang === 'fa' ? 'مسدود کردن' : 'Ban'
                            }
                            aria-label={`${u.is_active === false ? 'Unban' : 'Ban'} ${u.username || u._id}`}
                          >
                            {u.is_active === false ? (
                              <CheckCircle size={14} className="text-emerald" />
                            ) : (
                              <Ban size={14} />
                            )}
                          </button>
                        )}
                        {canWriteUsers && (
                          <button
                            type="button"
                            className="btn-icon sm danger"
                            onClick={() => handleDeleteUser(u)}
                            title={lang === 'fa' ? 'حذف حساب' : 'Delete Account'}
                            aria-label={`Delete ${u.username || u._id}`}
                          >
                            <Trash2 size={14} />
                          </button>
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
                ? `صفحه ${formatNumber(page, lang)} از ${formatNumber(totalPages, lang)} (کل: ${formatNumber(total, lang)})`
                : `Page ${page} of ${totalPages} (${total} total)`}
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
