import React, { useEffect, useState } from 'react';
import { Bell, Send, RefreshCw, Users, User, Shield, Clock } from 'lucide-react';
import { ApiService } from '../services/api';
import { BroadcastNotificationItem, ConfirmDialogOptions, LangCode } from '../types';
import { formatDateTime, formatNumber } from '../utils/adminUtils';

interface NotificationsViewProps {
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onConfirm,
  onNotify,
  lang,
}) => {
  const [targetType, setTargetType] = useState<'all' | 'user' | 'clan'>('all');
  const [userId, setUserId] = useState('');
  const [clanId, setClanId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<BroadcastNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getNotificationHistory(30);
      setHistory(res.items || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const templates =
    lang === 'fa'
      ? [
          {
            label: 'بروزرسانی سرور',
            title: 'بروزرسانی کوتاه سرور',
            message: 'بازیکنان عزیز، سرور کافه فکر تا دقایقی دیگر برای بهبود عملکرد بروزرسانی می‌شود.',
          },
          {
            label: 'هدیه مدیریت',
            title: 'هدیه ویژه کافه فکر',
            message: 'سکه هدیه به حساب شما واریز شد. بازی خوبی داشته باشید!',
          },
          {
            label: 'تذکر انضباطی',
            title: 'تذکر قوانین بازی جوانمردانه',
            message: 'لطفاً قوانین بازی جوانمردانه را رعایت کنید تا حساب شما با محدودیت مواجه نشود.',
          },
        ]
      : [
          {
            label: 'Maintenance',
            title: 'Scheduled Server Maintenance',
            message: 'Servers will undergo brief maintenance shortly to improve match stability.',
          },
          {
            label: 'Gift Notice',
            title: 'Special Gift from Cafe Fekr',
            message: 'Bonus coins have been credited to your account. Enjoy your matches!',
          },
          {
            label: 'Fair Play Warning',
            title: 'Fair Play Reminder',
            message: 'Please follow community guidelines to avoid account restrictions.',
          },
        ];

  const executeSend = async () => {
    setSending(true);
    try {
      const res = await ApiService.sendNotification({
        target_type: targetType,
        title: title.trim(),
        message: message.trim(),
        user_id: targetType === 'user' ? userId.trim() : undefined,
        clan_id: targetType === 'clan' ? clanId.trim() : undefined,
      });
      onNotify(
        lang === 'fa'
          ? `اعلان برای ${formatNumber(res.sent_count, lang)} بازیکن ارسال و ثبت شد.`
          : `Notification delivered to ${res.sent_count} player(s).`,
        'success'
      );
      setTitle('');
      setMessage('');
      setUserId('');
      setClanId('');
      fetchHistory();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      onNotify(
        lang === 'fa' ? 'عنوان و متن اعلان را وارد کنید.' : 'Title and message are required.',
        'error'
      );
      return;
    }
    if (targetType === 'user' && !userId.trim()) {
      onNotify(lang === 'fa' ? 'شناسه کاربر مقصد الزامی است.' : 'Target User ID is required.', 'error');
      return;
    }
    if (targetType === 'clan' && !clanId.trim()) {
      onNotify(lang === 'fa' ? 'شناسه کلن مقصد الزامی است.' : 'Target Clan ID is required.', 'error');
      return;
    }

    if (targetType === 'all') {
      onConfirm({
        title: lang === 'fa' ? 'ارسال اعلان همگانی' : 'Send Global Broadcast',
        message:
          lang === 'fa'
            ? `این اعلان با عنوان «${title.trim()}» برای تمام بازیکنان فعال ثبت خواهد شد. ادامه می‌دهید؟`
            : `This notification ("${title.trim()}") will be sent to ALL active players. Continue?`,
        variant: 'warning',
        confirmLabel: lang === 'fa' ? 'ارسال همگانی' : 'Broadcast Now',
        onConfirm: executeSend,
      });
    } else {
      executeSend();
    }
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fa' ? 'اعلان‌های درون‌بازی' : 'In-Game Notifications'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'ارسال پیام مستقیم به بازیکن خاص، اعضای یک کلن یا پیام همگانی به کل جامعه بازی'
              : 'Send targeted alerts to a specific player, an entire clan, or broadcast to all active players'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchHistory} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{lang === 'fa' ? 'بروزرسانی تاریخچه' : 'Refresh History'}</span>
        </button>
      </div>

      <div className="dash-grid-main">
        {/* Composer */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Bell size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'ایجاد و ارسال اعلان جدید' : 'Compose Notification'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <span className="input-label">{lang === 'fa' ? 'جامعه هدف' : 'Audience'}</span>
              <div className="segmented" style={{ width: 'fit-content' }}>
                <button
                  type="button"
                  className={`segmented-btn ${targetType === 'all' ? 'active' : ''}`}
                  onClick={() => setTargetType('all')}
                >
                  <Users size={14} />
                  <span>{lang === 'fa' ? 'همه بازیکنان فعال' : 'All Active Players'}</span>
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${targetType === 'user' ? 'active' : ''}`}
                  onClick={() => setTargetType('user')}
                >
                  <User size={14} />
                  <span>{lang === 'fa' ? 'بازیکن مشخص' : 'Single Player'}</span>
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${targetType === 'clan' ? 'active' : ''}`}
                  onClick={() => setTargetType('clan')}
                >
                  <Shield size={14} />
                  <span>{lang === 'fa' ? 'اعضای یک کلن' : 'Clan Members'}</span>
                </button>
              </div>
            </div>

            {targetType === 'user' && (
              <div className="input-group">
                <label htmlFor="ntf-user-id" className="input-label">
                  {lang === 'fa' ? 'شناسه بازیکن (User ID)' : 'Target User ID'}
                </label>
                <input
                  id="ntf-user-id"
                  type="text"
                  className="input-field mono"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="usr_..."
                  required
                />
              </div>
            )}

            {targetType === 'clan' && (
              <div className="input-group">
                <label htmlFor="ntf-clan-id" className="input-label">
                  {lang === 'fa' ? 'شناسه کلن (Clan ID)' : 'Target Clan ID'}
                </label>
                <input
                  id="ntf-clan-id"
                  type="text"
                  className="input-field mono"
                  value={clanId}
                  onChange={(e) => setClanId(e.target.value)}
                  placeholder="clan_..."
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="text-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                {lang === 'fa' ? 'قالب‌های آماده:' : 'Presets:'}
              </span>
              {templates.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setTitle(tpl.title);
                    setMessage(tpl.message);
                  }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <div className="input-group">
              <label htmlFor="ntf-title" className="input-label">
                {lang === 'fa' ? 'عنوان اعلان' : 'Notification Title'}
              </label>
              <input
                id="ntf-title"
                type="text"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً: جایزه هفته جدید!' : 'e.g. Weekend Bonus Event!'}
                maxLength={120}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="ntf-message" className="input-label">
                {lang === 'fa' ? 'متن پیام' : 'Message Body'}
              </label>
              <textarea
                id="ntf-message"
                className="textarea-field"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === 'fa' ? 'متن کامل اعلان برای نمایش در صندوق پیام بازیکن...' : 'Full notification body...'}
                maxLength={1000}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={sending}>
              <Send size={15} />
              <span>
                {sending
                  ? lang === 'fa' ? 'در حال ارسال...' : 'Sending...'
                  : lang === 'fa' ? 'ارسال اعلان' : 'Send Notification'}
              </span>
            </button>
          </form>
        </section>

        {/* Sent History */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Clock size={16} className="text-sapphire" />
              <span>{lang === 'fa' ? 'تاریخچه ارسال‌های اخیر' : 'Recent Broadcasts'}</span>
            </div>
            <span className="mono text-muted" style={{ fontSize: 12 }}>
              {formatNumber(history.length, lang)}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 54 }} />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <Bell size={24} />
              <span>{lang === 'fa' ? 'هنوز اعلانی ارسال نشده است.' : 'No notifications sent yet.'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
              {history.map((item) => (
                <div
                  key={item._id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                    <span className="tag accent mono">
                      {formatNumber(item.sent_count, lang)} {lang === 'fa' ? 'نفر' : 'sent'}
                    </span>
                  </div>
                  <p className="text-secondary" style={{ fontSize: 12.5, marginBottom: 8 }}>
                    {item.message}
                  </p>
                  <div className="meta-inline" style={{ fontSize: 11.5 }}>
                    <span className="mono">{item.target_type}</span>
                    <span className="meta-sep">·</span>
                    <span>{item.admin_username || item.admin_id}</span>
                    <span className="meta-sep">·</span>
                    <span className="mono">{formatDateTime(item.created_at, lang)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
