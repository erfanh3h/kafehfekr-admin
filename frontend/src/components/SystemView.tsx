import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  DatabaseBackup,
  Activity,
  RefreshCw,
  Download,
  Trash2,
  Search,
  X,
  Server,
  Radio,
  Database,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  AdminUser,
  AuditLogItem,
  BackupItem,
  ConfirmDialogOptions,
  LangCode,
  RuntimeStatus,
} from '../types';
import {
  AUDIT_ACTION_OPTIONS,
  buildCsvContent,
  formatDateTime,
  formatDurationSeconds,
  formatNumber,
  getAuditActionLabel,
  hasAdminPermission,
} from '../utils/adminUtils';

interface SystemViewProps {
  currentAdmin: AdminUser | null;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const SystemView: React.FC<SystemViewProps> = ({
  currentAdmin,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [loadingRuntime, setLoadingRuntime] = useState(true);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const canBackup = hasAdminPermission(currentAdmin, 'system:backup');

  const fetchRuntime = async () => {
    setLoadingRuntime(true);
    try {
      const res = await ApiService.getRuntimeStatus();
      setRuntime(res);
    } catch {
      // Keep last known runtime snapshot
    } finally {
      setLoadingRuntime(false);
    }
  };

  const fetchBackups = async () => {
    if (!canBackup) return;
    setLoadingBackups(true);
    try {
      const res = await ApiService.getBackups();
      setBackups(res.backups || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await ApiService.getAuditLogs({
        limit: 80,
        action: actionFilter,
        search: appliedSearch || undefined,
      });
      setLogs(res.logs || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchRuntime();
    fetchBackups();
  }, [canBackup]);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, appliedSearch]);

  const handleTriggerBackup = async () => {
    setBackingUp(true);
    try {
      const res = await ApiService.triggerBackup();
      onNotify(res.message || (lang === 'fa' ? 'پشتیبان‌گیری با موفقیت انجام شد.' : 'Backup created.'), 'success');
      fetchBackups();
      fetchLogs();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    setDownloadingName(filename);
    try {
      await ApiService.downloadBackup(filename);
      onNotify(lang === 'fa' ? `دانلود ${filename}.zip آغاز شد.` : `Downloading ${filename}.zip`, 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setDownloadingName(null);
    }
  };

  const handleDeleteBackup = (filename: string) => {
    onConfirm({
      title: lang === 'fa' ? 'حذف فایل پشتیبان' : 'Delete Backup Archive',
      message:
        lang === 'fa'
          ? `فایل پشتیبان «${filename}» به صورت دائمی از دیسک سرور حذف خواهد شد. آیا مطمئن هستید؟`
          : `Permanently remove backup "${filename}" from server disk?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'حذف پشتیبان' : 'Delete Backup',
      onConfirm: async () => {
        try {
          await ApiService.deleteBackup(filename);
          onNotify(lang === 'fa' ? 'فایل پشتیبان حذف شد.' : 'Backup deleted.', 'success');
          fetchBackups();
          fetchLogs();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleExportLogsCsv = () => {
    const headers = ['ID', 'Action', 'AdminID', 'AdminUsername', 'Timestamp', 'Details'];
    const rows = logs.map((l) => [
      l._id,
      l.action,
      l.admin_id,
      l.admin_username || '',
      l.timestamp || '',
      JSON.stringify(l.details || {}),
    ]);
    const csv = buildCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kafehfekr_audit_logs.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify(lang === 'fa' ? 'خروجی CSV لاگ ممیزی دانلود شد.' : 'Audit logs CSV exported.', 'success');
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fa' ? 'پایش زنده سرور، پشتیبان و لاگ عملیات' : 'Runtime Telemetry, Backups & Audit'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'وضعیت زنده سرویس‌های Socket.IO / REST API / MongoDB، مدیریت پشتیبان‌ها و ممیزی مدیران'
              : 'Live health for Realtime Backend, REST Server & MongoDB, snapshots, and audit trail'}
          </p>
        </div>
        <div className="header-actions">
          {canBackup && (
            <button type="button" className="btn btn-primary" onClick={handleTriggerBackup} disabled={backingUp}>
              <DatabaseBackup size={15} />
              <span>
                {backingUp
                  ? lang === 'fa' ? 'در حال پشتیبان‌گیری...' : 'Creating backup...'
                  : lang === 'fa' ? 'پشتیبان‌گیری فوری' : 'Create Backup Now'}
              </span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              fetchRuntime();
              fetchBackups();
              fetchLogs();
            }}
          >
            <RefreshCw size={15} className={loadingRuntime || loadingBackups || loadingLogs ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Live Services & Realtime Telemetry */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <Radio size={16} className="text-emerald" />
            <span>{lang === 'fa' ? 'پایش زنده سرویس‌ها و حافظه بازی (Live Telemetry)' : 'Live Services & RAM Telemetry'}</span>
          </div>
          {runtime?.checked_at && (
            <span className="mono text-muted" style={{ fontSize: 11.5 }}>
              {formatDateTime(runtime.checked_at, lang)}
            </span>
          )}
        </div>

        <div className="grid-3" style={{ marginBottom: 14 }}>
          {/* Realtime Backend */}
          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                <Radio size={14} className="text-emerald" />
                <span>{lang === 'fa' ? 'سرور ریل‌تایم (:5000)' : 'Realtime Backend (:5000)'}</span>
              </span>
              <span className={`status-label ${runtime?.backend.online ? 'emerald' : 'crimson'}`}>
                <span className={`status-dot ${runtime?.backend.online ? 'online' : 'offline'}`} />
                {runtime?.backend.online
                  ? lang === 'fa' ? 'آنلاین' : 'Online'
                  : lang === 'fa' ? 'قطع' : 'Offline'}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'کاربران آنلاین:' : 'Online Players:'}</span>
                <strong className="text-emerald">{formatNumber(runtime?.backend.online_social_users, lang)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'بازی‌های فعال در RAM:' : 'Active RAM Matches:'}</span>
                <strong className="text-accent">{formatNumber(runtime?.backend.active_ram_games_count, lang)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'زمان فعالیت / پینگ:' : 'Uptime / Ping:'}</span>
                <span>
                  {runtime?.backend.online
                    ? `${formatDurationSeconds(runtime.backend.uptime_seconds, lang)} · ${runtime.backend.latency_ms}ms`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* REST API Server */}
          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                <Server size={14} className="text-sapphire" />
                <span>{lang === 'fa' ? 'سرور REST API (:5001)' : 'REST API Server (:5001)'}</span>
              </span>
              <span className={`status-label ${runtime?.server.online ? 'emerald' : 'crimson'}`}>
                <span className={`status-dot ${runtime?.server.online ? 'online' : 'offline'}`} />
                {runtime?.server.online
                  ? lang === 'fa' ? 'آنلاین' : 'Online'
                  : lang === 'fa' ? 'قطع' : 'Offline'}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'زمان فعالیت:' : 'Uptime:'}</span>
                <strong>
                  {runtime?.server.online ? formatDurationSeconds(runtime.server.uptime_seconds, lang) : '—'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'پاسخ‌دهی API:' : 'API Latency:'}</span>
                <span>{runtime?.server.latency_ms != null ? `${runtime.server.latency_ms} ms` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'پینگ Mongo از سرور:' : 'Server Mongo Ping:'}</span>
                <span>{runtime?.server.mongo_ping_ms != null ? `${runtime.server.mongo_ping_ms} ms` : '—'}</span>
              </div>
            </div>
          </div>

          {/* MongoDB */}
          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                <Database size={14} className="text-accent" />
                <span>MongoDB (KafehFekrDB)</span>
              </span>
              <span className={`status-label ${runtime?.mongodb.online ? 'emerald' : 'crimson'}`}>
                <span className={`status-dot ${runtime?.mongodb.online ? 'online' : 'offline'}`} />
                {runtime?.mongodb.online
                  ? lang === 'fa' ? 'متصل' : 'Connected'
                  : lang === 'fa' ? 'خطا' : 'Error'}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'پینگ مستقیم:' : 'Direct Ping:'}</span>
                <strong>{runtime?.mongodb.ping_ms != null ? `${runtime.mongodb.ping_ms} ms` : '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'سوکت‌های بازی:' : 'Game Sockets:'}</span>
                <span>{formatNumber(runtime?.backend.active_game_sockets, lang)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{lang === 'fa' ? 'تماشاگران زنده:' : 'Live Spectators:'}</span>
                <span>{formatNumber(runtime?.backend.spectators_count, lang)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Queue & Lobby Strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span className="tag">
            {lang === 'fa' ? 'صف رنک:' : 'Ranked Queue:'}{' '}
            <strong className="mono text-accent">{formatNumber(runtime?.backend.ranked_queue_count, lang)}</strong>
          </span>
          <span className="tag">
            {lang === 'fa' ? 'پیش‌بازی (Pre-Game):' : 'Pre-Games:'}{' '}
            <strong className="mono">{formatNumber(runtime?.backend.active_pre_games_count, lang)}</strong>
          </span>
          <span className="tag">
            {lang === 'fa' ? 'صف چندنفره:' : 'Multi-Rank Queue:'}{' '}
            <strong className="mono text-sapphire">{formatNumber(runtime?.backend.multi_queue_count, lang)}</strong>
          </span>
          <span className="tag">
            {lang === 'fa' ? 'لابی‌های دوستانه:' : 'Active Lobbies:'}{' '}
            <strong className="mono">{formatNumber(runtime?.backend.lobbies_count, lang)}</strong>
          </span>
          <span className="tag">
            {lang === 'fa' ? 'اتاق‌های تماشاگر:' : 'Spectator Rooms:'}{' '}
            <strong className="mono text-emerald">{formatNumber(runtime?.backend.spectator_rooms_count, lang)}</strong>
          </span>
        </div>
      </section>

      {/* Backups Section */}
      {canBackup && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">
              <HardDrive size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'فایل‌های پشتیبان دیتابیس' : 'Database Snapshots'}</span>
            </div>
            <span className="mono text-muted" style={{ fontSize: 12 }}>
              {formatNumber(backups.length, lang)} {lang === 'fa' ? 'نسخه' : 'archives'}
            </span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{lang === 'fa' ? 'نام پوشه / فایل' : 'Snapshot Name'}</th>
                  <th>{lang === 'fa' ? 'حجم واقعی' : 'Actual Size'}</th>
                  <th>{lang === 'fa' ? 'تعداد کالکشن' : 'Files'}</th>
                  <th>{lang === 'fa' ? 'تاریخ ایجاد' : 'Created'}</th>
                  <th style={{ width: 120 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {loadingBackups ? (
                  <tr>
                    <td colSpan={5}><div className="skeleton" style={{ height: 18 }} /></td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state" style={{ padding: '24px 16px' }}>
                        <span>{lang === 'fa' ? 'هنوز پشتیبانی گرفته نشده است.' : 'No backup snapshots found.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="mono" style={{ fontWeight: 600 }}>{b.filename}</td>
                      <td className="mono text-accent">{b.size_formatted}</td>
                      <td className="mono text-secondary">{b.file_count ?? '—'}</td>
                      <td className="mono text-secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(b.modified, lang)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => handleDownloadBackup(b.filename)}
                            disabled={downloadingName === b.filename}
                            title={lang === 'fa' ? 'دانلود ZIP' : 'Download ZIP'}
                            aria-label={`Download ${b.filename}`}
                          >
                            <Download size={14} className="text-emerald" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon sm danger"
                            onClick={() => handleDeleteBackup(b.filename)}
                            title={lang === 'fa' ? 'حذف پشتیبان' : 'Delete Backup'}
                            aria-label={`Delete ${b.filename}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Audit Trail Section */}
      <section className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div className="card-title">
            <Activity size={16} className="text-sapphire" />
            <span>{lang === 'fa' ? 'گزارش ممیزی عملیات مدیران (Audit Trail)' : 'Admin Audit Trail'}</span>
          </div>
          <div className="toolbar-group">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportLogsCsv}
              disabled={logs.length === 0}
            >
              <Download size={14} />
              <span>{lang === 'fa' ? 'خروجی CSV' : 'Export CSV'}</span>
            </button>

            <form
              className="search-box"
              style={{ minWidth: 210 }}
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedSearch(searchInput.trim());
              }}
            >
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="input-field"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={lang === 'fa' ? 'جستجو در نام مدیر یا جزئیات...' : 'Search admin or details...'}
                aria-label={lang === 'fa' ? 'جستجو در لاگ' : 'Search audit logs'}
              />
              {(searchInput || appliedSearch) && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setSearchInput('');
                    setAppliedSearch('');
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            <select
              className="select-field"
              style={{ width: 'auto', minWidth: 180 }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label={lang === 'fa' ? 'فیلتر نوع عملیات' : 'Filter audit action'}
            >
              <option value="all">{lang === 'fa' ? 'همه عملیات‌ها' : 'All Actions'}</option>
              {AUDIT_ACTION_OPTIONS.map((act) => (
                <option key={act} value={act}>
                  {getAuditActionLabel(act, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'fa' ? 'عملیات' : 'Action'}</th>
                <th>{lang === 'fa' ? 'مدیر اجراکننده' : 'Admin'}</th>
                <th>{lang === 'fa' ? 'جزئیات' : 'Details'}</th>
                <th>{lang === 'fa' ? 'زمان' : 'Timestamp'}</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4}><div className="skeleton" style={{ height: 18 }} /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state" style={{ padding: '24px 16px' }}>
                      <span>{lang === 'fa' ? 'لاگی با این فیلتر یافت نشد.' : 'No audit logs match this filter.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{getAuditActionLabel(log.action, lang)}</div>
                      <div className="mono text-muted" style={{ fontSize: 11 }}>{log.action}</div>
                    </td>
                    <td>
                      <span className="tag mono">@{log.admin_username || log.admin_id}</span>
                    </td>
                    <td className="mono text-secondary" style={{ fontSize: 11.5, maxWidth: 420, wordBreak: 'break-word' }}>
                      {JSON.stringify(log.details || {})}
                    </td>
                    <td className="mono text-secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.timestamp, lang)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
