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
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, AuditLogItem, BackupItem, ConfirmDialogOptions, LangCode } from '../types';
import {
  AUDIT_ACTION_OPTIONS,
  formatDateTime,
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

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'پشتیبان‌گیری و لاگ عملیات' : 'Backups & Audit Trail'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'مدیریت فایل‌های پشتیبان MongoDB (دانلود ZIP / حذف) و رهگیری کامل عملیات مدیران'
              : 'Manage MongoDB BSON snapshots (ZIP download / delete) and inspect admin audit logs'}
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
              fetchBackups();
              fetchLogs();
            }}
          >
            <RefreshCw size={15} className={loadingBackups || loadingLogs ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

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
