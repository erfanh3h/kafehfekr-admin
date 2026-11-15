import React, { useState, useEffect } from 'react';
import {
  Database,
  FileText,
  RefreshCw,
  HardDrive,
  Download,
  Clock,
  Shield,
  Activity,
} from 'lucide-react';
import { AuditLogItem } from '../types';
import { ApiService } from '../services/api';

interface SystemViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const SystemView: React.FC<SystemViewProps> = ({ onNotify, lang }) => {
  const isFa = lang === 'fa';
  const [backups, setBackups] = useState<any[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await ApiService.getBackups();
      setBackups(res.backups);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await ApiService.getAuditLogs(50);
      setLogs(res.logs);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchLogs();
  }, []);

  const handleTriggerBackup = async () => {
    setTriggering(true);
    try {
      const res = await ApiService.triggerBackup();
      onNotify(isFa ? res.message : 'Database backup completed.', 'success');
      fetchBackups();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="page-container">
      {/* DB Backups Section */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <Database size={18} style={{ color: 'var(--emerald)' }} />
            <span>{isFa ? 'پشتیبان‌های پایگاه داده (MongoDB BSON Backups)' : 'MongoDB Database Backups'}</span>
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={handleTriggerBackup}
              disabled={triggering}
            >
              <HardDrive size={16} />
              <span>{triggering ? (isFa ? 'در حال تهیه پشتیبان...' : 'Backing up...') : (isFa ? 'پشتیبان‌گیری فوری' : 'Backup Database Now')}</span>
            </button>
            <button className="btn btn-icon" onClick={fetchBackups} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loadingBackups ? 'spin' : ''} />
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'نام فایل پشتیبان' : 'Backup Filename'}</th>
                <th>{isFa ? 'حجم فایل' : 'File Size'}</th>
                <th>{isFa ? 'تاریخ ایجاد' : 'Created Date'}</th>
                <th>{isFa ? 'وضعیت سلامت' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {loadingBackups ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                    {isFa ? 'در حال بررسی پوشه پشتیبان‌ها...' : 'Checking backups...'}
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                    {isFa ? 'فایل پشتیبانی یافت نشد. دکمه "پشتیبان‌گیری فوری" را بزنید.' : 'No backups found. Click "Backup Database Now".'}
                  </td>
                </tr>
              ) : (
                backups.map((b, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} style={{ color: 'var(--gold-primary)' }} />
                        <span style={{ fontWeight: '600' }}>{b.filename}</span>
                      </div>
                    </td>
                    <td>{b.size_formatted}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(b.modified).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge green">{isFa ? 'موجود روی دیسک' : 'Valid'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Audit Logs Timeline */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <Activity size={18} style={{ color: 'var(--sapphire)' }} />
            <span>{isFa ? 'لاگ عملیات و فعالیت‌های مدیران (Audit Trail)' : 'Admin Operations Audit Trail'}</span>
            <span className="badge blue">{logs.length} {isFa ? 'رویداد' : 'Events'}</span>
          </span>
          <button className="btn btn-icon" onClick={fetchLogs} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
            <RefreshCw size={16} className={loadingLogs ? 'spin' : ''} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'زمان رویداد' : 'Timestamp'}</th>
                <th>{isFa ? 'ادمین مجری' : 'Admin'}</th>
                <th>{isFa ? 'نوع عملیات' : 'Action'}</th>
                <th>{isFa ? 'جزئیات عملیات' : 'Details'}</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                    {isFa ? 'در حال دریافت لاگ‌ها...' : 'Loading audit logs...'}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هنوز لاگ عملیاتی ثبت نشده است.' : 'No audit logs recorded yet.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                        {log.admin_id}
                      </span>
                    </td>
                    <td>
                      <span className="badge blue">{log.action}</span>
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '350px' }}>
                      <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {JSON.stringify(log.details)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
