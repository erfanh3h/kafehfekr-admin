import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  UserX,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { ReportItem } from '../types';
import { ApiService } from '../services/api';

interface ReportsViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNotify, lang }) => {
  const isFa = lang === 'fa';
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('open');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getReports({
        page,
        limit,
        status_filter: statusFilter,
      });
      setReports(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const handleUpdateStatus = async (report: ReportItem, newStatus: 'resolved' | 'dismissed') => {
    const note = window.prompt(
      isFa ? 'یادداشت مدیر (اختیاری):' : 'Admin resolution note (optional):',
      newStatus === 'resolved' ? 'بررسی شد و تذکر داده شد' : 'رد گزارش'
    );
    if (note === null) return;

    try {
      await ApiService.updateReport(report._id, newStatus, note);
      onNotify(isFa ? 'وضعیت گزارش به‌روزرسانی شد.' : 'Report status updated.', 'success');
      fetchReports();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleBanReportedPlayer = async (report: ReportItem) => {
    if (!window.confirm(isFa ? `آیا می‌خواهید کاربر متخلف (${report.target_user_id}) را فوراً مسدود (بن) کنید؟` : `Ban reported user ${report.target_user_id}?`)) {
      return;
    }
    try {
      await ApiService.toggleBan(report.target_user_id, false, `گزارش تخلف: ${report.reason}`);
      await ApiService.updateReport(report._id, 'resolved', 'کاربر متخلف مسدود شد.');
      onNotify(isFa ? 'کاربر متخلف مسدود و گزارش بسته شد.' : 'Target user banned and report resolved.', 'success');
      fetchReports();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header and Filter */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {isFa ? 'فیلتر وضعیت گزارش:' : 'Status Filter:'}
            </span>
            {[
              { id: 'open', label: isFa ? 'معلق و باز' : 'Open' },
              { id: 'resolved', label: isFa ? 'حل‌شده' : 'Resolved' },
              { id: 'dismissed', label: isFa ? 'رد شده' : 'Dismissed' },
              { id: 'all', label: isFa ? 'همه' : 'All' },
            ].map((f) => (
              <button
                key={f.id}
                className={`btn ${statusFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={() => {
                  setStatusFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button className="btn btn-icon" onClick={fetchReports} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <ShieldAlert size={18} style={{ color: 'var(--ruby)' }} />
            <span>{isFa ? 'صف رسیدگی به تخلفات و گزارش‌ها' : 'Moderation & Abuse Reports'}</span>
            <span className="badge red">{total} {isFa ? 'مورد' : 'Reports'}</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'شناسه گزارش' : 'Report ID'}</th>
                <th>{isFa ? 'گزارش‌دهنده' : 'Reporter'}</th>
                <th>{isFa ? 'کاربر متخلف' : 'Reported User'}</th>
                <th>{isFa ? 'علت تخلف' : 'Reason'}</th>
                <th>{isFa ? 'توضیحات و جزئیات' : 'Details'}</th>
                <th>{isFa ? 'وضعیت' : 'Status'}</th>
                <th>{isFa ? 'تاریخ ثبت' : 'Date'}</th>
                <th style={{ textAlign: 'center' }}>{isFa ? 'اقدامات ناظر' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    {isFa ? 'در حال دریافت گزارش‌ها...' : 'Loading reports...'}
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هیچ گزارشی در این بخش موجود نیست.' : 'No reports found in this view.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isOpen = r.status === 'open';
                  return (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 'bold' }}>{r._id}</td>
                      <td>
                        <span style={{ color: 'var(--sapphire)' }}>{r.reporter_id}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--ruby)', fontWeight: 'bold' }}>
                          {r.target_user_id}
                        </span>
                      </td>
                      <td>
                        <span className="badge red">{r.reason}</span>
                      </td>
                      <td style={{ fontSize: '12px', maxWidth: '240px' }}>
                        {r.details || '—'}
                      </td>
                      <td>
                        <span className={`badge ${isOpen ? 'red' : r.status === 'resolved' ? 'green' : 'gray'}`}>
                          {isOpen ? (isFa ? 'معلق' : 'Open') : r.status === 'resolved' ? (isFa ? 'حل‌شده' : 'Resolved') : (isFa ? 'رد شده' : 'Dismissed')}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {isOpen && (
                            <>
                              <button
                                className="btn-icon"
                                style={{ width: '30px', height: '30px', color: 'var(--emerald)' }}
                                onClick={() => handleUpdateStatus(r, 'resolved')}
                                title={isFa ? 'علامت‌گذاری به عنوان حل‌شده' : 'Mark Resolved'}
                              >
                                <CheckCircle size={15} />
                              </button>

                              <button
                                className="btn-icon"
                                style={{ width: '30px', height: '30px', color: 'var(--text-dim)' }}
                                onClick={() => handleUpdateStatus(r, 'dismissed')}
                                title={isFa ? 'رد کردن گزارش' : 'Dismiss'}
                              >
                                <XCircle size={15} />
                              </button>

                              <button
                                className="btn-icon"
                                style={{ width: '30px', height: '30px', color: 'var(--ruby)' }}
                                onClick={() => handleBanReportedPlayer(r)}
                                title={isFa ? 'بن کردن فوری کاربر متخلف' : 'Ban Reported Player'}
                              >
                                <UserX size={15} />
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
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span>
            {isFa
              ? `صفحه ${page} از ${totalPages} (مجموع ${total} گزارش)`
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
