import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { DashboardStats, LangCode, PurchaseItem } from '../types';
import { buildCsvContent, formatDateTime, formatNumber } from '../utils/adminUtils';

interface PurchasesViewProps {
  stats: DashboardStats | null;
  onInspectUserById: (userId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  stats,
  onInspectUserById,
  onNotify,
  lang,
}) => {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [marketFilter, setMarketFilter] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getPurchases({
        page,
        limit: 20,
        market_type: marketFilter || undefined,
        user_id: appliedUserId || undefined,
      });
      setPurchases(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [page, marketFilter, appliedUserId]);

  const handleExportCSV = () => {
    const headers = ['ID', 'User ID', 'Username', 'Product ID', 'Market', 'Token', 'Date'];
    const rows = purchases.map((p) => [
      p._id,
      p.user_id,
      p.username || '',
      p.product_id,
      p.market_type,
      p.token || '',
      p.date || '',
    ]);
    const csv = buildCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kafehfekr_purchases_p${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'تراکنش‌ها و فروشگاه' : 'Store Purchases'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `${formatNumber(total, lang)} تراکنش ثبت‌شده در کافه‌بازار و مایکت`
              : `${formatNumber(total, lang)} verified store transactions`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV} disabled={purchases.length === 0}>
            <Download size={15} />
            <span>{lang === 'fa' ? 'خروجی CSV' : 'Export CSV'}</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={fetchPurchases} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Store Summary Strip */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'کل خریدهای تاییدشده' : 'Total Verified Purchases'}</span>
          </div>
          <div className="kpi-value">{formatNumber(stats?.purchases.total ?? total, lang)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'کافه‌بازار (Bazaar)' : 'Cafe Bazaar'}</span>
          </div>
          <div className="kpi-value text-emerald">{formatNumber(stats?.purchases.bazaar ?? 0, lang)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'مایکت (Myket)' : 'Myket'}</span>
          </div>
          <div className="kpi-value text-sapphire">{formatNumber(stats?.purchases.myket ?? 0, lang)}</div>
        </div>
      </div>

      <div className="toolbar">
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedUserId(userSearchInput.trim());
          }}
        >
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="input-field"
            placeholder={lang === 'fa' ? 'جستجو بر اساس شناسه کاربر...' : 'Filter by User ID...'}
            value={userSearchInput}
            onChange={(e) => setUserSearchInput(e.target.value)}
            aria-label={lang === 'fa' ? 'جستجوی شناسه خریدار' : 'Filter by user ID'}
          />
          {(userSearchInput || appliedUserId) && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setUserSearchInput('');
                setAppliedUserId('');
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
              ['', 'همه مارکت‌ها', 'All Stores'],
              ['bazaar', 'کافه‌بازار', 'Bazaar'],
              ['myket', 'مایکت', 'Myket'],
            ] as const
          ).map(([val, fa, en]) => (
            <button
              key={val || 'all'}
              type="button"
              className={`segmented-btn ${marketFilter === val ? 'active' : ''}`}
              onClick={() => {
                setMarketFilter(val);
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
              <th>{lang === 'fa' ? 'خریدار' : 'Buyer'}</th>
              <th>{lang === 'fa' ? 'بسته خریداری‌شده' : 'Product SKU'}</th>
              <th>{lang === 'fa' ? 'مارکت' : 'Store'}</th>
              <th>{lang === 'fa' ? 'توکن رسید' : 'Receipt Token'}</th>
              <th>{lang === 'fa' ? 'تاریخ' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5}><div className="skeleton" style={{ height: 18 }} /></td>
                </tr>
              ))
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <ShoppingBag size={26} />
                    <span>{lang === 'fa' ? 'تراکنشی یافت نشد.' : 'No purchases found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              purchases.map((p) => {
                const isBazaar = p.market_type?.toLowerCase().includes('bazaar');
                return (
                  <tr key={p._id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => onInspectUserById(p.user_id)}
                        >
                          {p.username || p.user_id}
                        </button>
                        <span className="mono text-muted" style={{ fontSize: 11.5 }}>{p.user_id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="tag accent mono">{p.product_id}</span>
                    </td>
                    <td>
                      <span className={`tag ${isBazaar ? 'emerald' : 'sapphire'}`}>
                        {p.market_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="mono text-muted" style={{ fontSize: 11.5, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.token || '—'}
                    </td>
                    <td className="mono text-secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(p.date, lang)}
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
    </div>
  );
};
