import React, { useState, useEffect } from 'react';
import {
  UsersRound,
  Search,
  RefreshCw,
  Trophy,
  Shield,
  Eye,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { ClanItem } from '../types';
import { ApiService } from '../services/api';

interface ClansViewProps {
  onOpenClanDetails: (clanId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const ClansView: React.FC<ClansViewProps> = ({
  onOpenClanDetails,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [clans, setClans] = useState<ClanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchClans = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getClans({
        page,
        limit,
        search: search.trim() || undefined,
      });
      setClans(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClans();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClans();
  };

  const handleDisbandClan = async (clan: ClanItem) => {
    if (!window.confirm(isFa ? `هشدار: آیا از انحلال کامل و حذف کلن "${clan.name}" اطمینان دارید؟ همه اعضا از کلن خارج خواهند شد.` : `Disband clan ${clan.name}?`)) {
      return;
    }
    try {
      await ApiService.disbandClan(clan._id);
      onNotify(isFa ? `کلن "${clan.name}" منحل شد.` : `Clan ${clan.name} disbanded.`, 'success');
      fetchClans();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Search Header */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar">
              <Search size={16} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={isFa ? 'جستجو با نام کلن، تگ یا شناسه...' : 'Search by clan name, tag...'}
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
                  fetchClans();
                }}
              >
                {isFa ? 'پاک کردن' : 'Clear'}
              </button>
            )}
          </form>

          <button className="btn btn-icon" onClick={fetchClans} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <UsersRound size={18} style={{ color: 'var(--gold-primary)' }} />
            <span>{isFa ? 'کلن‌ها و اتحادیه‌های بازیکنان' : 'Player Clans & Guilds'}</span>
            <span className="badge gold">{total} {isFa ? 'کلن' : 'Clans'}</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'نام و نشان کلن' : 'Clan Name & Tag'}</th>
                <th>{isFa ? 'سطح (Level)' : 'Level'}</th>
                <th>{isFa ? 'جام‌ها (Trophies)' : 'Trophies'}</th>
                <th>{isFa ? 'رهبر کلن' : 'Owner'}</th>
                <th>{isFa ? 'تعداد اعضا' : 'Members'}</th>
                <th>{isFa ? 'تاریخ تشکیل' : 'Created'}</th>
                <th style={{ textAlign: 'center' }}>{isFa ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    {isFa ? 'در حال دریافت اطلاعات کلن‌ها...' : 'Loading clans...'}
                  </td>
                </tr>
              ) : clans.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هیچ کلنی یافت نشد.' : 'No clans found.'}
                  </td>
                </tr>
              ) : (
                clans.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--gold-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                          }}
                        >
                          <Shield size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>{c.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            Tag: #{c.tag} | ID: {c._id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge blue">Lvl {c.level || 1}</span>
                    </td>

                    <td>
                      <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Trophy size={14} /> {c.trophies || 0}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {c.owner_name ? `${c.owner_name} (${c.owner_id})` : c.owner_id}
                      </span>
                    </td>

                    <td>
                      <span className="badge green">
                        {c.member_count || 1} / {c.max_members || 40}
                      </span>
                    </td>

                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '30px', height: '30px', color: 'var(--gold-primary)' }}
                          onClick={() => onOpenClanDetails(c._id)}
                          title={isFa ? 'مشاهده مشخصات و اعضای کلن' : 'Inspect Clan'}
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: '30px', height: '30px', color: 'var(--ruby)' }}
                          onClick={() => handleDisbandClan(c)}
                          title={isFa ? 'انحلال و حذف کلن' : 'Disband Clan'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span>
            {isFa
              ? `صفحه ${page} از ${totalPages} (مجموع ${total} کلن)`
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
