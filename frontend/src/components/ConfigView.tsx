import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Radio,
  Clock,
  Sparkles,
  Save,
  RefreshCw,
  Bell,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { SystemConfig } from '../types';
import { ApiService } from '../services/api';

interface ConfigViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const ConfigView: React.FC<ConfigViewProps> = ({ onNotify, lang }) => {
  const isFa = lang === 'fa';
  const [loading, setLoading] = useState(false);
  const [savingQueue, setSavingQueue] = useState(false);
  const [savingVersions, setSavingVersions] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // Form states
  const [isQueueOpen, setIsQueueOpen] = useState(true);
  const [queueHour, setQueueHour] = useState(0);
  const [queueMinute, setQueueMinute] = useState(0);

  const [allowedVersion, setAllowedVersion] = useState('2.0.0');
  const [latestVersion, setLatestVersion] = useState('2.0.0');

  const [announcement, setAnnouncement] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await ApiService.getConfig();
      setIsQueueOpen(Boolean(cfg.is_queue_open));
      setAllowedVersion(cfg.allowed_version || '2.0.0');
      setLatestVersion(cfg.latest_version || '2.0.0');
      setAnnouncement(cfg.announcement || '');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveQueue = async () => {
    setSavingQueue(true);
    try {
      await ApiService.setQueue(isQueueOpen, queueHour, queueMinute);
      onNotify(isFa ? 'تنظیمات صف مسابقات با موفقیت ذخیره شد.' : 'Queue settings saved successfully.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingQueue(false);
    }
  };

  const handleSaveVersions = async () => {
    if (!allowedVersion || !latestVersion) {
      onNotify(isFa ? 'لطفاً مقادیر نسخه را کامل وارد کنید.' : 'Please enter valid versions.', 'error');
      return;
    }
    setSavingVersions(true);
    try {
      await ApiService.setVersions(allowedVersion, latestVersion);
      onNotify(isFa ? 'نسخه‌های برنامه به‌روزرسانی شد. کلاینت‌ها ملزم به آپدیت می‌شوند.' : 'App versions updated.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingVersions(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await ApiService.setAnnouncement(announcement, announcementActive);
      onNotify(isFa ? 'اعلان سراسری درون‌بازی ذخیره شد.' : 'Broadcast announcement updated.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <Sliders size={20} style={{ color: 'var(--gold-primary)' }} />
            <span>{isFa ? 'تنظیمات سرور و کنترل صف مسابقات' : 'Server Engine & Matchmaking Queue'}</span>
          </span>
          <button className="btn btn-icon" onClick={fetchConfig} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Matchmaking Queue Section */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Radio size={18} style={{ color: 'var(--emerald)' }} />
              <span>{isFa ? 'کنترل صف مسابقات (Matchmaking)' : 'Matchmaking Queue Gates'}</span>
            </span>
            <span className={`badge ${isQueueOpen ? 'green' : 'red'}`}>
              {isQueueOpen ? (isFa ? 'صف باز است' : 'Queue Open') : (isFa ? 'صف مسدود' : 'Queue Closed')}
            </span>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>
                  {isFa ? 'وضعیت فوری ورود به صف' : 'Instant Queue Switch'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {isFa
                    ? 'در صورت بسته بودن، بازیکنان نمی‌توانند وارد صف مسابقات شوند.'
                    : 'When disabled, players cannot join ranked queues.'}
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isQueueOpen}
                  onChange={(e) => setIsQueueOpen(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">{isFa ? 'ساعت بازگشایی خودکار' : 'Schedule Hour (0-23)'}</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  className="input-field"
                  value={queueHour}
                  onChange={(e) => setQueueHour(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">{isFa ? 'دقیقه' : 'Minute (0-59)'}</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="input-field"
                  value={queueMinute}
                  onChange={(e) => setQueueMinute(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: '10px' }}
              onClick={handleSaveQueue}
              disabled={savingQueue}
            >
              <Save size={16} />
              <span>{isFa ? 'ذخیره تنظیمات صف' : 'Save Queue Settings'}</span>
            </button>
          </div>
        </div>

        {/* Version Control Section */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Layers size={18} style={{ color: 'var(--sapphire)' }} />
              <span>{isFa ? 'مدیریت نسخه‌ها و آپدیت اجباری' : 'Client Version Enforcement'}</span>
            </span>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isFa
                ? 'کلاینت بازی گودوت هنگام اتصال نسخه خود را با Allowed Version مقایسه می‌کند. اگر نسخه پایین‌تر باشد، صفحه آپدیت اجباری ظاهر می‌شود.'
                : 'Godot client compares its version against Allowed Version. If lower, client displays force-update screen.'}
            </p>

            <div className="input-group">
              <label className="input-label">{isFa ? 'حداقل نسخه مجاز (Allowed Version)' : 'Allowed Version'}</label>
              <input
                type="text"
                className="input-field"
                placeholder="2.0.0"
                value={allowedVersion}
                onChange={(e) => setAllowedVersion(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'جدیدترین نسخه منتشرشده (Latest Version)' : 'Latest Version'}</label>
              <input
                type="text"
                className="input-field"
                placeholder="2.0.0"
                value={latestVersion}
                onChange={(e) => setLatestVersion(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: '10px' }}
              onClick={handleSaveVersions}
              disabled={savingVersions}
            >
              <Save size={16} />
              <span>{isFa ? 'اعمال نسخه‌ها به کلاینت‌ها' : 'Update Client Versions'}</span>
            </button>
          </div>
        </div>

        {/* In-Game Broadcast Announcement */}
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <span className="panel-title">
              <Bell size={18} style={{ color: 'var(--gold-primary)' }} />
              <span>{isFa ? 'اعلان سراسری درون‌بازی (Broadcast Banner)' : 'Live In-Game Broadcast Announcement'}</span>
            </span>
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">{isFa ? 'متن پیام اعلان برای همه بازیکنان' : 'Announcement Text'}</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder={isFa ? 'مثال: سرور امشب از ساعت ۰۲:۰۰ الی ۰۲:۳۰ برای به‌روزرسانی در دسترس نخواهد بود.' : 'Example: Scheduled maintenance at midnight.'}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={announcementActive}
                  onChange={(e) => setAnnouncementActive(e.target.checked)}
                />
                <span>{isFa ? 'فعال بودن نمایش بنر برای کاربران' : 'Display active in client'}</span>
              </label>

              <button
                className="btn btn-primary"
                onClick={handleSaveAnnouncement}
                disabled={savingAnnouncement}
              >
                <Save size={16} />
                <span>{isFa ? 'ارسال و ذخیره اعلان' : 'Broadcast Announcement'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
