import React, { useState, useEffect } from 'react';
import {
  Power,
  Smartphone,
  Megaphone,
  Save,
  RefreshCw,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, LangCode, SystemConfig } from '../types';
import { hasAdminPermission } from '../utils/adminUtils';

interface ConfigViewProps {
  currentAdmin: AdminUser | null;
  onConfigChanged?: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  currentAdmin,
  onConfigChanged,
  onNotify,
  lang,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [isQueueOpen, setIsQueueOpen] = useState(true);
  const [queueHour, setQueueHour] = useState(0);
  const [queueMinute, setQueueMinute] = useState(0);

  const [allowedVersion, setAllowedVersion] = useState('2.0.0');
  const [latestVersion, setLatestVersion] = useState('2.0.0');

  const [announcement, setAnnouncement] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const canWriteConfig = hasAdminPermission(currentAdmin, 'config:write');

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg: SystemConfig = await ApiService.getConfig();
      setIsQueueOpen(cfg.is_queue_open ?? true);
      setQueueHour(cfg.queue_open_hour ?? 0);
      setQueueMinute(cfg.queue_open_minute ?? 0);
      setAllowedVersion(cfg.allowed_version || '2.0.0');
      setLatestVersion(cfg.latest_version || '2.0.0');
      setAnnouncement(cfg.announcement || '');
      setAnnouncementActive(cfg.announcement_active ?? Boolean(cfg.announcement));
      setMaintenanceMode(Boolean(cfg.maintenance_mode));
      setMaintenanceMessage(cfg.maintenance_message || '');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('queue');
    try {
      await ApiService.setQueue(isQueueOpen, queueHour, queueMinute);
      onNotify(lang === 'fa' ? 'تنظیمات صف بازی ذخیره شد.' : 'Queue settings saved.', 'success');
      onConfigChanged?.();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveVersions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('version');
    try {
      await ApiService.setVersions(allowedVersion, latestVersion);
      onNotify(lang === 'fa' ? 'نسخه‌های اپلیکیشن بروزرسانی شد.' : 'Client versions updated.', 'success');
      onConfigChanged?.();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('announcement');
    try {
      await ApiService.setAnnouncement(announcement, announcementActive);
      onNotify(lang === 'fa' ? 'تنظیمات بنر اعلان ذخیره شد.' : 'Announcement banner updated.', 'success');
      onConfigChanged?.();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('maintenance');
    try {
      await ApiService.setMaintenance(maintenanceMode, maintenanceMessage);
      onNotify(
        lang === 'fa'
          ? maintenanceMode
            ? 'حالت تعمیرات فعال شد.'
            : 'حالت تعمیرات غیرفعال شد.'
          : maintenanceMode
          ? 'Maintenance mode enabled.'
          : 'Maintenance mode disabled.',
        'success'
      );
      onConfigChanged?.();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'تنظیمات و صف بازی' : 'System Config & Queue'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'مدیریت صف آنلاین، حالت تعمیرات، کنترل نسخه اجباری و بنر اعلان عمومی'
              : 'Control matchmaking queue, maintenance mode, forced updates, and lobby banners'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchConfig} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{lang === 'fa' ? 'بازخوانی تنظیمات' : 'Reload Config'}</span>
        </button>
      </div>

      <div className="grid-2">
        {/* Queue Status */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Power size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'صف جستجوی بازی آنلاین' : 'Matchmaking Queue'}</span>
            </div>
            <span className={`status-label ${isQueueOpen ? 'emerald' : 'crimson'}`}>
              <span className={`status-dot ${isQueueOpen ? 'online' : 'offline'}`} />
              {isQueueOpen ? (lang === 'fa' ? 'باز' : 'Open') : lang === 'fa' ? 'بسته' : 'Closed'}
            </span>
          </div>

          <form onSubmit={handleSaveQueue}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {lang === 'fa' ? 'پذیرش بازیکن در صف رنک' : 'Accept Ranked Queue Entries'}
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {lang === 'fa'
                    ? 'در صورت بسته بودن، امکان شروع مسابقه جدید متوقف می‌شود'
                    : 'Closing pauses new matchmaking entries while active games finish'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isQueueOpen}
                aria-label={lang === 'fa' ? 'تغییر وضعیت صف' : 'Toggle queue'}
                className={`switch-btn ${isQueueOpen ? 'on' : ''}`}
                disabled={!canWriteConfig}
                onClick={() => setIsQueueOpen((v) => !v)}
              >
                <span className="switch-knob" />
              </button>
            </div>

            <div className="grid-2" style={{ gap: 10 }}>
              <div className="input-group">
                <label htmlFor="cfg-q-hour" className="input-label">
                  {lang === 'fa' ? 'ساعت بازگشایی (اختیاری)' : 'Reopen Hour (Optional)'}
                </label>
                <input
                  id="cfg-q-hour"
                  type="number"
                  min={0}
                  max={23}
                  className="input-field mono"
                  value={queueHour}
                  onChange={(e) => setQueueHour(Number(e.target.value))}
                  disabled={!canWriteConfig}
                />
              </div>
              <div className="input-group">
                <label htmlFor="cfg-q-min" className="input-label">
                  {lang === 'fa' ? 'دقیقه بازگشایی' : 'Reopen Minute'}
                </label>
                <input
                  id="cfg-q-min"
                  type="number"
                  min={0}
                  max={59}
                  className="input-field mono"
                  value={queueMinute}
                  onChange={(e) => setQueueMinute(Number(e.target.value))}
                  disabled={!canWriteConfig}
                />
              </div>
            </div>

            {canWriteConfig && (
              <button type="submit" className="btn btn-primary" disabled={saving === 'queue'}>
                <Save size={15} />
                <span>{saving === 'queue' ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'ذخیره تنظیمات صف' : 'Save Queue Settings'}</span>
              </button>
            )}
          </form>
        </section>

        {/* Maintenance Mode */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Wrench size={16} className="text-crimson" />
              <span>{lang === 'fa' ? 'حالت تعمیرات سرور' : 'Server Maintenance Mode'}</span>
            </div>
            <span className={`status-label ${maintenanceMode ? 'crimson' : 'emerald'}`}>
              <span className={`status-dot ${maintenanceMode ? 'offline' : 'online'}`} />
              {maintenanceMode ? (lang === 'fa' ? 'در حال تعمیر' : 'Maintenance') : lang === 'fa' ? 'عادی' : 'Normal'}
            </span>
          </div>

          <form onSubmit={handleSaveMaintenance}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: maintenanceMode ? 'var(--crimson-bg)' : 'var(--bg-surface-2)',
                border: `1px solid ${maintenanceMode ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {lang === 'fa' ? 'فعال‌سازی قفل تعمیرات' : 'Enable Maintenance Lock'}
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {lang === 'fa'
                    ? 'پیام تعمیرات به تمام کلاینت‌ها نمایش داده می‌شود'
                    : 'Displays maintenance notice to incoming clients'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceMode}
                aria-label={lang === 'fa' ? 'تغییر حالت تعمیرات' : 'Toggle maintenance mode'}
                className={`switch-btn ${maintenanceMode ? 'on danger' : ''}`}
                disabled={!canWriteConfig}
                onClick={() => setMaintenanceMode((v) => !v)}
              >
                <span className="switch-knob" />
              </button>
            </div>

            <div className="input-group">
              <label htmlFor="cfg-maint-msg" className="input-label">
                {lang === 'fa' ? 'پیام وضعیت تعمیرات' : 'Maintenance Notice Message'}
              </label>
              <input
                id="cfg-maint-msg"
                type="text"
                className="input-field"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً: سرور تا ساعت ۲۲:۳۰ در حال بروزرسانی است...' : 'e.g. Scheduled upgrade in progress...'}
                disabled={!canWriteConfig}
              />
            </div>

            {canWriteConfig && (
              <button
                type="submit"
                className={`btn ${maintenanceMode ? 'btn-danger-solid' : 'btn-primary'}`}
                disabled={saving === 'maintenance'}
              >
                <AlertTriangle size={15} />
                <span>
                  {saving === 'maintenance'
                    ? lang === 'fa' ? 'در حال ذخیره...' : 'Saving...'
                    : lang === 'fa' ? 'اعمال وضعیت تعمیرات' : 'Apply Maintenance State'}
                </span>
              </button>
            )}
          </form>
        </section>

        {/* Client Versions */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Smartphone size={16} className="text-sapphire" />
              <span>{lang === 'fa' ? 'کنترل نسخه اپلیکیشن' : 'Client Version Control'}</span>
            </div>
          </div>

          <form onSubmit={handleSaveVersions}>
            <div className="input-group">
              <label htmlFor="cfg-allowed-ver" className="input-label">
                {lang === 'fa' ? 'حداقل نسخه مجاز (آپدیت اجباری)' : 'Minimum Allowed Version (Force Update)'}
              </label>
              <input
                id="cfg-allowed-ver"
                type="text"
                className="input-field mono"
                value={allowedVersion}
                onChange={(e) => setAllowedVersion(e.target.value)}
                placeholder="2.0.0"
                disabled={!canWriteConfig}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="cfg-latest-ver" className="input-label">
                {lang === 'fa' ? 'جدیدترین نسخه منتشرشده (پیشنهادی)' : 'Latest Released Version'}
              </label>
              <input
                id="cfg-latest-ver"
                type="text"
                className="input-field mono"
                value={latestVersion}
                onChange={(e) => setLatestVersion(e.target.value)}
                placeholder="2.4.0"
                disabled={!canWriteConfig}
                required
              />
            </div>

            {canWriteConfig && (
              <button type="submit" className="btn btn-primary" disabled={saving === 'version'}>
                <Save size={15} />
                <span>{saving === 'version' ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'بروزرسانی نسخه‌ها' : 'Save Versions'}</span>
              </button>
            )}
          </form>
        </section>

        {/* Global Banner Announcement */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Megaphone size={16} className="text-amber" />
              <span>{lang === 'fa' ? 'بنر اعلان لابی بازی' : 'Lobby Announcement Banner'}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={announcementActive}
              aria-label={lang === 'fa' ? 'فعال بودن بنر' : 'Toggle banner active'}
              className={`switch-btn ${announcementActive ? 'on' : ''}`}
              disabled={!canWriteConfig}
              onClick={() => setAnnouncementActive((v) => !v)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <form onSubmit={handleSaveAnnouncement}>
            <div className="input-group">
              <label htmlFor="cfg-banner-msg" className="input-label">
                {lang === 'fa' ? 'متن اعلان صفحه اصلی' : 'Banner Text'}
              </label>
              <textarea
                id="cfg-banner-msg"
                className="textarea-field"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder={lang === 'fa' ? 'متن اعلان برای نمایش در صفحه اصلی کلاینت...' : 'Announcement text shown in game lobby...'}
                disabled={!canWriteConfig}
              />
            </div>

            {canWriteConfig && (
              <button type="submit" className="btn btn-primary" disabled={saving === 'announcement'}>
                <Save size={15} />
                <span>{saving === 'announcement' ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'ذخیره بنر اعلان' : 'Save Banner'}</span>
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};
