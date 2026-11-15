import React, { useState } from 'react';
import {
  Users,
  Gamepad2,
  ShoppingBag,
  ShieldAlert,
  Flame,
  Radio,
  RefreshCw,
  Coins,
  Database,
  PlayCircle,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { ApiService } from '../services/api';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenBulkCoins: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onRefresh,
  onOpenBulkCoins,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [cleaningGames, setCleaningGames] = useState(false);
  const [togglingQueue, setTogglingQueue] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);

  const handleCleanupStuckGames = async () => {
    if (!window.confirm(isFa ? 'آیا از پاکسازی تمام بازی‌های رهاشده و ناتمام اطمینان دارید؟' : 'Clean up all stuck unfinished matches?')) {
      return;
    }
    setCleaningGames(true);
    try {
      const res = await ApiService.cleanupStuckGames();
      onNotify(isFa ? `تعداد ${res.cleaned_games_count} بازی ناتمام پاکسازی و قفل کاربران آزاد شد.` : `Cleaned ${res.cleaned_games_count} stuck matches.`, 'success');
      onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setCleaningGames(false);
    }
  };

  const handleToggleQueue = async () => {
    if (!stats) return;
    const current = stats.config.is_queue_open;
    setTogglingQueue(true);
    try {
      await ApiService.setQueue(!current);
      onNotify(isFa ? `صف مسابقات ${!current ? 'باز' : 'بسته'} شد.` : `Queue set to ${!current ? 'OPEN' : 'CLOSED'}.`, 'success');
      onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setTogglingQueue(false);
    }
  };

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await ApiService.triggerBackup();
      onNotify(isFa ? res.message : 'Database backup completed.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setTriggeringBackup(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <RefreshCw size={32} className="spin" style={{ color: 'var(--gold-primary)' }} />
        <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
          {isFa ? 'در حال بارگذاری اطلاعات داشبورد...' : 'Loading dashboard metrics...'}
        </p>
      </div>
    );
  }

  const breakdown = stats?.matches.breakdown || {};
  const sortedGames = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page-container">
      {/* Top Banner & Quick Controls */}
      <div
        className="panel"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 27, 45, 0.95), rgba(15, 21, 35, 0.95))',
          borderColor: 'var(--border-light)',
        }}
      >
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', fontWeight: 'bold' }}>
                {isFa ? 'مرکز مدیریت و عملیات کافه فکر' : 'Cafe Fekr Operations Center'}
              </h2>
              <span className={`badge ${stats?.config.is_queue_open ? 'green' : 'red'}`}>
                {stats?.config.is_queue_open ? (isFa ? 'صف فعال' : 'Queue Open') : (isFa ? 'صف مسدود' : 'Queue Closed')}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isFa
                ? `نسخه مجاز اپلیکیشن: ${stats?.config.allowed_version || '2.0.0'} | زمان سرور: ${stats?.server_time ? new Date(stats.server_time).toLocaleTimeString() : ''}`
                : `Allowed Version: ${stats?.config.allowed_version || '2.0.0'} | Server Time: ${stats?.server_time || ''}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${stats?.config.is_queue_open ? 'btn-danger' : 'btn-success'}`}
              onClick={handleToggleQueue}
              disabled={togglingQueue}
            >
              <Radio size={16} />
              <span>
                {stats?.config.is_queue_open
                  ? (isFa ? 'بستن اضطراری صف' : 'Emergency Close Queue')
                  : (isFa ? 'باز کردن صف' : 'Open Match Queue')}
              </span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleCleanupStuckGames}
              disabled={cleaningGames}
            >
              <AlertTriangle size={16} />
              <span>{isFa ? 'پاکسازی بازی‌های گیرکرده' : 'Clean Stuck Games'}</span>
            </button>

            <button className="btn btn-primary" onClick={onOpenBulkCoins}>
              <Coins size={16} />
              <span>{isFa ? 'اهدای سکه همگانی' : 'Gift Coins'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleTriggerBackup}
              disabled={triggeringBackup}
            >
              <Database size={16} />
              <span>{isFa ? 'پشتیبان‌گیری فوری' : 'Backup DB'}</span>
            </button>

            <button className="btn btn-icon" onClick={onRefresh} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon sapphire">
            <Users size={26} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">{isFa ? 'کل بازیکنان ثبت‌شده' : 'Total Players'}</span>
            <span className="kpi-value">{stats?.users.total.toLocaleString() || 0}</span>
            <span className="kpi-subtext">
              {isFa ? `${stats?.users.real || 0} کاربر واقعی | ${stats?.users.bots || 0} ربات` : `${stats?.users.real || 0} Real`}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon gold">
            <Gamepad2 size={26} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">{isFa ? 'کل مسابقات برگزارشده' : 'Total Matches'}</span>
            <span className="kpi-value">{stats?.matches.total.toLocaleString() || 0}</span>
            <span className="kpi-subtext">
              {isFa ? `${stats?.matches.live || 0} مسابقه زنده | ${stats?.matches.finished || 0} پایان‌یافته` : `${stats?.matches.live || 0} Live`}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon emerald">
            <ShoppingBag size={26} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">{isFa ? 'تراکنش‌های درون‌برنامه‌ای' : 'Total Purchases'}</span>
            <span className="kpi-value">{stats?.purchases.total.toLocaleString() || 0}</span>
            <span className="kpi-subtext">
              {isFa ? `بازار: ${stats?.purchases.bazaar || 0} | مایکت: ${stats?.purchases.myket || 0}` : `Bazaar: ${stats?.purchases.bazaar || 0}`}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon ruby">
            <ShieldAlert size={26} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">{isFa ? 'گزارش‌های باز تخلف' : 'Open Reports'}</span>
            <span className="kpi-value">{stats?.open_reports_count || 0}</span>
            <span className="kpi-subtext">
              {stats?.open_reports_count === 0
                ? (isFa ? 'بدون تخلف معلق' : 'Clear queue')
                : (isFa ? 'نیاز به بررسی سریع' : 'Needs attention')}
            </span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <Flame size={26} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">{isFa ? 'کلن‌های فعال' : 'Active Clans'}</span>
            <span className="kpi-value">{stats?.clans_count || 0}</span>
            <span className="kpi-subtext">{isFa ? 'باشگاه‌های ثبت‌شده' : 'Registered Guilds'}</span>
          </div>
        </div>
      </div>

      {/* Game Popularity Breakdown & System Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Game Types Breakdown */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Gamepad2 size={18} style={{ color: 'var(--gold-primary)' }} />
              <span>{isFa ? 'محبوبیت بازی‌ها (۲۰۰ مسابقه اخیر)' : 'Recent Game Distribution'}</span>
            </span>
            <span className="badge gold">{sortedGames.length} {isFa ? 'بازی فعال' : 'Active Games'}</span>
          </div>
          <div className="panel-body">
            {sortedGames.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
                {isFa ? 'هنوز داده‌ای برای مسابقات ثبت نشده است.' : 'No match data yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedGames.slice(0, 8).map(([gameName, count]) => {
                  const maxCount = sortedGames[0][1] || 1;
                  const percent = Math.round((count / maxCount) * 100);
                  return (
                    <div key={gameName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ fontWeight: '600', color: '#fff' }}>{gameName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{count} {isFa ? 'دست' : 'matches'}</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: 'linear-gradient(90deg, #f59e0b, #eab308)',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* System & Operations Snapshot */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Radio size={18} style={{ color: 'var(--emerald)' }} />
              <span>{isFa ? 'وضعیت پلتفرم و قوانین اجرایی' : 'Platform & Policy Status'}</span>
            </span>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isFa ? 'وضعیت ورود به صف رنک:' : 'Rank Matchmaking Queue:'}</span>
              <span className={`badge ${stats?.config.is_queue_open ? 'green' : 'red'}`}>
                {stats?.config.is_queue_open ? (isFa ? 'مجاز و در دسترس' : 'Online & Open') : (isFa ? 'مسدود شده توسط مدیر' : 'Closed')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isFa ? 'حداقل نسخه مجاز کلاینت (گودوت):' : 'Allowed Client Version:'}</span>
              <span className="badge blue">{stats?.config.allowed_version || '2.0.0'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isFa ? 'جدیدترین نسخه منتشرشده:' : 'Latest Version:'}</span>
              <span className="badge gold">{stats?.config.latest_version || '2.0.0'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isFa ? 'پایگاه داده اصلی:' : 'Database Engine:'}</span>
              <span className="badge green">MongoDB 7.0 (KafehFekrDB)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{isFa ? 'موتور مسابقات بیدرنگ (Realtime):' : 'Realtime Engine:'}</span>
              <span className="badge sapphire">Socket.IO ASGI (Port 5000)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
