import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Coins,
  Trophy,
  Zap,
  Lock,
  Unlock,
  Eye,
  Trash2,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Download,
} from 'lucide-react';
import { UserItem, UserFullDetails } from '../types';
import { ApiService } from '../services/api';

interface UsersViewProps {
  onOpenDetails: (user: UserItem) => void;
  onOpenAdjustCurrency: (user: UserItem) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const UsersView: React.FC<UsersViewProps> = ({
  onOpenDetails,
  onOpenAdjustCurrency,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('join_date');
  const [sortOrder, setSortOrder] = useState(-1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listUsers({
        page,
        limit,
        search: search.trim() || undefined,
        filter_type: filterType,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setUsers(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, filterType, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleBan = async (user: UserItem) => {
    const newStatus = !user.is_active;
    const confirmMsg = newStatus
      ? (isFa ? `آیا از فعال‌سازی حساب ${user.username || user._id} اطمینان دارید؟` : `Unban user ${user.username}?`)
      : (isFa ? `آیا از مسدودسازی (بن کردن) حساب ${user.username || user._id} اطمینان دارید؟` : `Ban user ${user.username}?`);

    if (!window.confirm(confirmMsg)) return;

    try {
      await ApiService.toggleBan(user._id, newStatus, 'تغییر وضعیت توسط مدیر');
      onNotify(isFa ? `وضعیت کاربر تغییر یافت.` : `User status updated.`, 'success');
      setUsers(users.map((u) => (u._id === user._id ? { ...u, is_active: newStatus } : u)));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleResetLocks = async (user: UserItem) => {
    try {
      await ApiService.resetUserLocks(user._id);
      onNotify(isFa ? `قفل‌های بازی کاربر (${user._id}) با موفقیت پاک شد.` : `Game locks cleared for ${user._id}.`, 'success');
      setUsers(users.map((u) => (u._id === user._id ? { ...u, open_game_id: '', open_pre_game_id: '' } : u)));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!window.confirm(isFa ? `هشدار: آیا از حذف دائمی کاربر ${user.username || user._id} مطمئنید؟ این عملیات غیرقابل بازگشت است.` : `Permanently delete user ${user.username}?`)) {
      return;
    }
    try {
      await ApiService.deleteUser(user._id);
      onNotify(isFa ? `کاربر حذف شد.` : `User deleted.`, 'success');
      fetchUsers();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleExportCsv = () => {
    if (users.length === 0) return;
    const headers = ['User ID', 'Username', 'Phone', 'Coins', 'Score', 'XP', 'Status', 'Join Date'];
    const rows = users.map((u) => [
      `"${u._id}"`,
      `"${u.username || ''}"`,
      `"${u.phone || ''}"`,
      u.coin ?? 0,
      u.score ?? 0,
      u.xp ?? 0,
      u.is_active !== false ? 'Active' : 'Banned',
      `"${u.join_date ? new Date(u.join_date).toLocaleDateString() : ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kafefekr_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify(isFa ? 'فایل خروجی CSV با موفقیت دانلود شد.' : 'Users CSV exported.', 'success');
  };

  return (
    <div className="page-container">
      {/* Header & Search */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar">
              <Search size={16} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={isFa ? 'جستجو با نام کاربری، شماره تلفن یا شناسه...' : 'Search by username, phone, ID...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <span>{isFa ? 'جستجو' : 'Search'}</span>
            </button>
            {search && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  fetchUsers();
                }}
              >
                {isFa ? 'پاک کردن' : 'Clear'}
              </button>
            )}
          </form>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isFa ? 'فیلتر:' : 'Filter:'}
            </span>
            {[
              { id: 'all', label: isFa ? 'همه' : 'All' },
              { id: 'real', label: isFa ? 'واقعی' : 'Real' },
              { id: 'bot', label: isFa ? 'ربات‌ها' : 'Bots' },
              { id: 'banned', label: isFa ? 'مسدودشده' : 'Banned' },
            ].map((f) => (
              <button
                key={f.id}
                className={`btn ${filterType === f.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => {
                  setFilterType(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}

            {/* Sort Dropdown */}
            <select
              className="input-field"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="join_date">{isFa ? 'تاریخ عضویت' : 'Join Date'}</option>
              <option value="score">{isFa ? 'بیشترین امتیاز (Score)' : 'Score'}</option>
              <option value="coin">{isFa ? 'بیشترین سکه (Coin)' : 'Coins'}</option>
              <option value="xp">{isFa ? 'بیشترین سطح (XP)' : 'XP'}</option>
            </select>

            <button
              className="btn btn-icon"
              onClick={() => setSortOrder(sortOrder === -1 ? 1 : -1)}
              title={isFa ? 'معکوس کردن ترتیب' : 'Reverse Sort'}
            >
              <Filter size={16} />
            </button>

            <button className="btn btn-icon" onClick={fetchUsers} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>

            <button
              className="btn btn-export"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleExportCsv}
              title={isFa ? 'خروجی اکسل/CSV از فهرست کاربران' : 'Export Users CSV'}
            >
              <Download size={14} />
              <span>{isFa ? 'خروجی CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <span>{isFa ? 'فهرست بازیکنان کافه فکر' : 'Players Directory'}</span>
            <span className="badge gold">{total} {isFa ? 'کاربر' : 'Users'}</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'شناسه و نام کاربری' : 'ID & Username'}</th>
                <th>{isFa ? 'شماره تماس' : 'Phone'}</th>
                <th>{isFa ? 'سکه' : 'Coins'}</th>
                <th>{isFa ? 'امتیاز' : 'Score'}</th>
                <th>{isFa ? 'تجربه (XP)' : 'XP'}</th>
                <th>{isFa ? 'قفل بازی' : 'Lock State'}</th>
                <th>{isFa ? 'وضعیت' : 'Status'}</th>
                <th>{isFa ? 'تاریخ ثبت‌نام' : 'Joined'}</th>
                <th style={{ textAlign: 'center' }}>{isFa ? 'عملیات مدیر' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    {isFa ? 'در حال دریافت اطلاعات...' : 'Fetching players...'}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هیچ بازیکنی با این مشخصات یافت نشد.' : 'No players found.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isBot = u._id.startsWith('bot_') || u._id.startsWith('test_bot');
                  const hasLock = Boolean(u.open_game_id || u.open_pre_game_id);
                  return (
                    <tr key={u._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isBot ? 'var(--border-color)' : 'rgba(245, 158, 11, 0.2)',
                              color: isBot ? 'var(--text-dim)' : 'var(--gold-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '12px',
                            }}
                          >
                            {u.image ?? 0}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#fff' }}>
                              {u.username || (isFa ? '(بدون نام)' : 'Anonymous')}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              ID: {u._id} {isBot && <span className="badge gray" style={{ fontSize: '9px' }}>BOT</span>}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={{ direction: 'ltr', textAlign: isFa ? 'right' : 'left' }}>
                        {u.phone || '—'}
                      </td>

                      <td>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                          {u.coin ?? 0}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: 'var(--sapphire)', fontWeight: 'bold' }}>
                          {u.score ?? 0}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: 'var(--purple)', fontWeight: 'bold' }}>
                          {u.xp ?? 0}
                        </span>
                      </td>

                      <td>
                        {hasLock ? (
                          <span
                            className="badge red"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleResetLocks(u)}
                            title={isFa ? 'کلیک کنید تا قفل بازی باز شود' : 'Click to clear stuck match lock'}
                          >
                            <Lock size={12} /> {isFa ? 'در بازی' : 'In Game'}
                          </span>
                        ) : (
                          <span className="badge green">
                            <Unlock size={12} /> {isFa ? 'آزاد' : 'Free'}
                          </span>
                        )}
                      </td>

                      <td>
                        <span className={`badge ${u.is_active !== false ? 'green' : 'red'}`}>
                          {u.is_active !== false ? (isFa ? 'فعال' : 'Active') : (isFa ? 'مسدود' : 'Banned')}
                        </span>
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {u.join_date ? new Date(u.join_date).toLocaleDateString() : '—'}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {/* Inspect Profile */}
                          <button
                            className="btn-icon"
                            style={{ width: '30px', height: '30px' }}
                            onClick={() => onOpenDetails(u)}
                            title={isFa ? 'مشاهده جزئیات کامل پروفایل' : 'View Profile Details'}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Adjust Coins / Score / XP */}
                          <button
                            className="btn-icon"
                            style={{ width: '30px', height: '30px', color: 'var(--gold-primary)' }}
                            onClick={() => onOpenAdjustCurrency(u)}
                            title={isFa ? 'افزایش/کاهش سکه یا امتیاز' : 'Adjust Coins/Score'}
                          >
                            <Coins size={15} />
                          </button>

                          {/* Reset lock */}
                          {hasLock && (
                            <button
                              className="btn-icon"
                              style={{ width: '30px', height: '30px', color: 'var(--emerald)' }}
                              onClick={() => handleResetLocks(u)}
                              title={isFa ? 'آزاد کردن قفل بازی' : 'Clear Match Lock'}
                            >
                              <Unlock size={15} />
                            </button>
                          )}

                          {/* Ban / Unban */}
                          <button
                            className="btn-icon"
                            style={{ width: '30px', height: '30px', color: u.is_active !== false ? 'var(--ruby)' : 'var(--emerald)' }}
                            onClick={() => handleToggleBan(u)}
                            title={u.is_active !== false ? (isFa ? 'مسدود کردن (بن)' : 'Ban User') : (isFa ? 'رفع مسدودیت' : 'Unban')}
                          >
                            {u.is_active !== false ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>

                          {/* Delete */}
                          <button
                            className="btn-icon"
                            style={{ width: '30px', height: '30px', color: 'var(--ruby)' }}
                            onClick={() => handleDeleteUser(u)}
                            title={isFa ? 'حذف کاربر' : 'Delete User'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="pagination">
          <span>
            {isFa
              ? `نمایش صفحه ${page} از ${totalPages} (مجموعاً ${total} کاربر)`
              : `Page ${page} of ${totalPages} (${total} total)`}
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronRight size={16} />
              <span>{isFa ? 'قبلی' : 'Prev'}</span>
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px' }}
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <span>{isFa ? 'بعدی' : 'Next'}</span>
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
