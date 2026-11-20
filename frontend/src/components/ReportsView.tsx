import React, { useState, useEffect } from 'react';
import {
  Flag,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  Ban,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, LangCode, ReportItem } from '../types';
import { formatDateTime, formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface ReportsViewProps {
  currentAdmin: AdminUser | null;
  onInspectUserById: (userId: string) => void;
  onReportsChanged?: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentAdmin,
  onInspectUserById,
  onReportsChanged,
  onNotify,
  lang,
}) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'dismissed' | 'all'>('open');

  // Resolution modal state (replaces window.prompt)
  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'resolved' | 'dismissed'>('resolved');
  const [adminNotes, setAdminNotes] = useState('');
  const [alsoBanTarget, setAlsoBanTarget] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canManageReports = hasAdminPermission(currentAdmin, 'reports:manage');
  const canBanUsers = hasAdminPermission(currentAdmin, 'users:write');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getReports({
        page,
        limit: 20,
        status_filter: statusFilter,
      });
      setReports(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const openResolutionModal = (rep: ReportItem, action: 'resolved' | 'dismissed') => {
    setActiveReport(rep);
    setResolutionAction(action);
    setAdminNotes('');
    setAlsoBanTarget(false);
  };

  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport) return;
    setSubmitting(true);
    try {
      await ApiService.updateReport(activeReport._id, resolutionAction, adminNotes.trim());
      if (alsoBanTarget && activeReport.target_user_id && canBanUsers) {
        await ApiService.toggleBan(
          activeReport.target_user_id,
          false,
          `Report #${activeReport._id}: ${adminNotes.trim() || activeReport.reason}`
        );
      }
      onNotify(
        lang === 'fa'
          ? alsoBanTarget
            ? 'گزارش ثبت و کاربر متخلف مسدود شد.'
            : 'وضعیت گزارش بروزرسانی شد.'
          : alsoBanTarget
          ? 'Report resolved and target player banned.'
          : 'Report status updated.',
        'success'
      );
      setActiveReport(null);
      fetchReports();
      onReportsChanged?.();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const notePresets =
    lang === 'fa'
      ? ['بررسی و اخطار داده شد', 'تخلف محرز شد و مسدود گردید', 'مدرک کافی نبود / رد شد']
      : ['Reviewed and warned', 'Violation confirmed & action taken', 'Insufficient evidence / dismissed'];

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'گزارش‌های تخلف' : 'Moderation Reports'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `${formatNumber(total, lang)} گزارش در فیلتر فعلی — بررسی، ثبت یادداشت و برخورد با متخلفین`
              : `${formatNumber(total, lang)} reports in view — review incidents and take moderation action`}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchReports} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {(
            [
              ['open', 'باز و در انتظار', 'Open'],
              ['resolved', 'رسیدگی شده', 'Resolved'],
              ['dismissed', 'رد شده', 'Dismissed'],
              ['all', 'همه', 'All'],
            ] as const
          ).map(([val, fa, en]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={statusFilter === val}
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
              <th>{lang === 'fa' ? 'گزارش‌دهنده' : 'Reporter'}</th>
              <th>{lang === 'fa' ? 'کاربر متخلف' : 'Reported Player'}</th>
              <th>{lang === 'fa' ? 'علت و جزئیات' : 'Reason & Notes'}</th>
              <th>{lang === 'fa' ? 'وضعیت' : 'Status'}</th>
              <th>{lang === 'fa' ? 'تاریخ' : 'Created'}</th>
              {canManageReports && <th style={{ width: 120 }}>{lang === 'fa' ? 'اقدام' : 'Action'}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={canManageReports ? 6 : 5}><div className="skeleton" style={{ height: 18 }} /></td>
                </tr>
              ))
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={canManageReports ? 6 : 5}>
                  <div className="empty-state">
                    <Flag size={26} />
                    <span>{lang === 'fa' ? 'گزارشی در این دسته‌بندی وجود ندارد.' : 'No reports in this queue.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r._id}>
                  <td>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onInspectUserById(r.reporter_id)}
                    >
                      {r.reporter_username || r.reporter_id}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-btn text-crimson"
                      onClick={() => onInspectUserById(r.target_user_id)}
                    >
                      {r.target_username || r.target_user_id}
                    </button>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ fontWeight: 600 }}>{r.reason}</div>
                    {r.details && <div className="text-secondary" style={{ fontSize: 12 }}>{r.details}</div>}
                    {r.admin_notes && (
                      <div className="text-accent" style={{ fontSize: 12, marginTop: 3 }}>
                        {lang === 'fa' ? 'یادداشت مدیر:' : 'Admin note:'} {r.admin_notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-label ${
                        r.status === 'open' ? 'amber' : r.status === 'resolved' ? 'emerald' : 'muted'
                      }`}
                    >
                      <span
                        className={`status-dot ${
                          r.status === 'open' ? 'warning' : r.status === 'resolved' ? 'online' : 'offline'
                        }`}
                      />
                      {r.status === 'open'
                        ? lang === 'fa' ? 'باز' : 'Open'
                        : r.status === 'resolved'
                        ? lang === 'fa' ? 'رسیدگی شده' : 'Resolved'
                        : lang === 'fa' ? 'رد شده' : 'Dismissed'}
                    </span>
                  </td>
                  <td className="mono text-secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(r.created_at, lang)}
                  </td>
                  {canManageReports && (
                    <td>
                      {r.status === 'open' ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => openResolutionModal(r, 'resolved')}
                            title={lang === 'fa' ? 'تأیید و رسیدگی' : 'Resolve Report'}
                            aria-label={`Resolve report ${r._id}`}
                          >
                            <CheckCircle size={15} className="text-emerald" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon sm danger"
                            onClick={() => openResolutionModal(r, 'dismissed')}
                            title={lang === 'fa' ? 'رد کردن گزارش' : 'Dismiss Report'}
                            aria-label={`Dismiss report ${r._id}`}
                          >
                            <XCircle size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                  )}
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

      {/* Inline Resolution Modal */}
      {activeReport && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !submitting && setActiveReport(null)}
        >
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Flag size={17} className="text-accent" />
                <span>
                  {resolutionAction === 'resolved'
                    ? lang === 'fa' ? 'تأیید و بستن گزارش' : 'Resolve Report'
                    : lang === 'fa' ? 'رد کردن گزارش' : 'Dismiss Report'}
                </span>
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setActiveReport(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmResolution}>
              <div className="modal-body">
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: 14,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <span className="text-muted">{lang === 'fa' ? 'کاربر متخلف:' : 'Target:'}</span>{' '}
                    <strong>{activeReport.target_username || activeReport.target_user_id}</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className="text-muted">{lang === 'fa' ? 'علت:' : 'Reason:'}</span>{' '}
                    <span>{activeReport.reason}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {notePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAdminNotes(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="input-group">
                  <label htmlFor="report-admin-notes" className="input-label">
                    {lang === 'fa' ? 'یادداشت مدیر (اختیاری)' : 'Moderation Notes (Optional)'}
                  </label>
                  <textarea
                    id="report-admin-notes"
                    className="textarea-field"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={lang === 'fa' ? 'توضیح اقدام انجام‌شده...' : 'Describe action taken...'}
                  />
                </div>

                {resolutionAction === 'resolved' && canBanUsers && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: alsoBanTarget ? 'var(--crimson-bg)' : 'var(--bg-surface-2)',
                      border: `1px solid ${alsoBanTarget ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={alsoBanTarget}
                      onChange={(e) => setAlsoBanTarget(e.target.checked)}
                    />
                    <Ban size={14} className="text-crimson" />
                    <span>
                      {lang === 'fa'
                        ? 'هم‌زمان حساب کاربر گزارش‌شده مسدود شود'
                        : 'Also ban the reported player immediately'}
                    </span>
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveReport(null)} disabled={submitting}>
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`btn ${alsoBanTarget ? 'btn-danger-solid' : 'btn-primary'}`}
                  disabled={submitting}
                >
                  {submitting
                    ? lang === 'fa' ? 'در حال ثبت...' : 'Saving...'
                    : lang === 'fa' ? 'ثبت نتیجه' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
