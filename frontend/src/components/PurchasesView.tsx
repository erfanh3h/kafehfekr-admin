import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Coins,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Calendar,
  Download,
} from 'lucide-react';
import { PurchaseItem } from '../types';
import { ApiService } from '../services/api';

interface PurchasesViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

const PRODUCT_COIN_VALUES: Record<string, number> = {
  '1': 50,
  '2': 160,
  '3': 330,
  '4': 525,
  '5': 1100,
  '6': 1700,
};

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onNotify, lang }) => {
  const isFa = lang === 'fa';
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  const [marketType, setMarketType] = useState('');
  const [productId, setProductId] = useState('');
  const [userIdSearch, setUserIdSearch] = useState('');

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getPurchases({
        page,
        limit,
        market_type: marketType || undefined,
        product_id: productId || undefined,
        user_id: userIdSearch.trim() || undefined,
      });
      setPurchases(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [page, marketType, productId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPurchases();
  };

  const handleExportCsv = () => {
    if (purchases.length === 0) return;
    const headers = ['Transaction ID', 'User ID', 'Market', 'Product Pack', 'Coins', 'Token', 'Date'];
    const rows = purchases.map((p) => [
      `"${p._id}"`,
      `"${p.user_id}"`,
      `"${p.market_type}"`,
      `"Pack #${p.product_id}"`,
      PRODUCT_COIN_VALUES[p.product_id] || 0,
      `"${p.token}"`,
      `"${p.date ? new Date(p.date).toLocaleString() : ''}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kafefekr_purchases_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify(isFa ? 'فایل خروجی تراکنش‌ها با موفقیت دانلود شد.' : 'Purchases CSV exported.', 'success');
  };

  return (
    <div className="page-container">
      {/* Filters and Search */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar">
              <Search size={16} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={isFa ? 'جستجو با شناسه کاربر (User ID)...' : 'Search by User ID...'}
                value={userIdSearch}
                onChange={(e) => setUserIdSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <span>{isFa ? 'جستجو' : 'Search'}</span>
            </button>
            {userIdSearch && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setUserIdSearch('');
                  setPage(1);
                  fetchPurchases();
                }}
              >
                {isFa ? 'پاک کردن' : 'Clear'}
              </button>
            )}
          </form>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Market Filter */}
            <select
              className="input-field"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={marketType}
              onChange={(e) => {
                setMarketType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{isFa ? 'همه مارکت‌ها' : 'All Markets'}</option>
              <option value="bazaar">{isFa ? 'کافه بازار (Bazaar)' : 'Cafe Bazaar'}</option>
              <option value="myket">{isFa ? 'مایکت (Myket)' : 'Myket'}</option>
            </select>

            {/* Product ID Filter */}
            <select
              className="input-field"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{isFa ? 'همه بسته‌ها' : 'All Coin Packs'}</option>
              <option value="1">{isFa ? 'بسته ۱ (۵۰ سکه)' : 'Pack 1 (50 Coins)'}</option>
              <option value="2">{isFa ? 'بسته ۲ (۱۶۰ سکه)' : 'Pack 2 (160 Coins)'}</option>
              <option value="3">{isFa ? 'بسته ۳ (۳۳۰ سکه)' : 'Pack 3 (330 Coins)'}</option>
              <option value="4">{isFa ? 'بسته ۴ (۵۲۵ سکه)' : 'Pack 4 (525 Coins)'}</option>
              <option value="5">{isFa ? 'بسته ۵ (۱۱۰۰ سکه)' : 'Pack 5 (1100 Coins)'}</option>
              <option value="6">{isFa ? 'بسته ۶ (۱۷۰۰ سکه)' : 'Pack 6 (1700 Coins)'}</option>
            </select>

            <button className="btn btn-icon" onClick={fetchPurchases} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>

            <button
              className="btn btn-export"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleExportCsv}
              title={isFa ? 'خروجی تراکنش‌ها به صورت فایل CSV' : 'Export Purchases CSV'}
            >
              <Download size={14} />
              <span>{isFa ? 'خروجی CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <ShoppingBag size={18} style={{ color: 'var(--emerald)' }} />
            <span>{isFa ? 'تراکنش‌های فروشگاه درون‌برنامه‌ای' : 'In-App Purchase Transactions'}</span>
            <span className="badge green">{total} {isFa ? 'پرداخت' : 'Purchases'}</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'شناسه تراکنش' : 'Transaction ID'}</th>
                <th>{isFa ? 'شناسه کاربر خریدار' : 'User ID'}</th>
                <th>{isFa ? 'مارکت و درگاه' : 'Market'}</th>
                <th>{isFa ? 'بسته خریداری‌شده' : 'Product Package'}</th>
                <th>{isFa ? 'سکه‌های اعطاشده' : 'Coins Granted'}</th>
                <th>{isFa ? 'توکن خرید مارکت' : 'Purchase Token'}</th>
                <th>{isFa ? 'تاریخ پرداخت' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    {isFa ? 'در حال دریافت اطلاعات تراکنش‌ها...' : 'Loading purchases...'}
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هیچ تراکنشی یافت نشد.' : 'No purchases found.'}
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const coins = PRODUCT_COIN_VALUES[p.product_id] || '—';
                  const isBazaar = p.market_type.toLowerCase().includes('bazaar');
                  return (
                    <tr key={p._id}>
                      <td style={{ fontWeight: 'bold' }}>{p._id}</td>
                      <td>
                        <span style={{ color: 'var(--sapphire)', fontWeight: '600' }}>{p.user_id}</span>
                      </td>
                      <td>
                        <span className={`badge ${isBazaar ? 'green' : 'blue'}`}>
                          {isBazaar ? 'Cafe Bazaar' : 'Myket'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: '600' }}>
                          {isFa ? `بسته شماره ${p.product_id}` : `Pack #${p.product_id}`}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                          +{coins} {isFa ? 'سکه' : 'coins'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.token}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {p.date ? new Date(p.date).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span>
            {isFa
              ? `صفحه ${page} از ${totalPages} (مجموع ${total} تراکنش)`
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
