import React, { useEffect, useState } from 'react';
import {
  Users,
  Gamepad2,
  ShoppingBag,
  Flag,
  RefreshCw,
  Coins,
  Power,
  Trash2,
  DatabaseBackup,
  ShieldAlert,
  LockOpen,
  TrendingUp,
  Trophy,
  Wrench,
  Bell,
  Radio,
} from 'lucide-react';
import {
  AdminUser,
  AnalyticsOverview,
  ConfirmDialogOptions,
  DashboardStats,
  LangCode,
  NavTab,
  RuntimeStatus,
} from '../types';
import { ApiService } from '../services/api';
import {
  computeChartPoints,
  formatNumber,
  formatShortDate,
  hasAdminPermission,
} from '../utils/adminUtils';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  currentAdmin: AdminUser | null;
  onRefresh: () => void;
  onOpenBulkCoins: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onInspectUserById: (userId: string) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

type TrendMetric = 'matches' | 'users' | 'purchases';

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  currentAdmin,
  onRefresh,
  onOpenBulkCoins,
  onNavigateTab,
  onInspectUserById,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [metric, setMetric] = useState<TrendMetric>('matches');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [leaderTab, setLeaderTab] = useState<'score' | 'coin'>('score');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const canWriteConfig = hasAdminPermission(currentAdmin, 'config:write');
  const canManageGames = hasAdminPermission(currentAdmin, 'games:manage');
  const canWriteEconomy = hasAdminPermission(currentAdmin, 'economy:write');
  const canBackup = hasAdminPermission(currentAdmin, 'system:backup');
  const canWriteUsers = hasAdminPermission(currentAdmin, 'users:write');

  const fetchAnalytics = async (targetDays = days) => {
    setAnalyticsLoading(true);
    try {
      const res = await ApiService.getAnalytics(targetDays);
      setAnalytics(res);
    } catch {
      // Gracefully keep existing analytics if backend hasn't updated yet
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchRuntime = async () => {
    try {
      const res = await ApiService.getRuntimeStatus();
      setRuntime(res);
    } catch {
      // Optional telemetry
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
    fetchRuntime();
  }, [days]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchAnalytics(days);
    fetchRuntime();
  };

  const handleToggleQueue = async () => {
    if (!stats) return;
    const nextState = !stats.config.is_queue_open;
    setActionBusy('queue');
    try {
      await ApiService.setQueue(nextState, stats.config.queue_open_hour || 0, stats.config.queue_open_minute || 0);
      onNotify(
        lang === 'fa'
          ? `صف بازی با موفقیت ${nextState ? 'باز' : 'بسته'} شد.`
          : `Matchmaking queue is now ${nextState ? 'OPEN' : 'CLOSED'}.`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const handleCleanupStuck = () => {
    onConfirm({
      title: lang === 'fa' ? 'پاکسازی بازی‌های معلق' : 'Cleanup Stuck Matches',
      message:
        lang === 'fa'
          ? 'تمام بازی‌های ناتمامی که بیش از ۲ ساعت از شروع آن‌ها گذشته بسته شده و قفل بازیکنانشان آزاد می‌شود. ادامه می‌دهید؟'
          : 'All unfinished matches older than 2 hours will be closed and their player locks released. Continue?',
      variant: 'warning',
      confirmLabel: lang === 'fa' ? 'اجرای پاکسازی' : 'Run Cleanup',
      onConfirm: async () => {
        setActionBusy('cleanup');
        try {
          const res = await ApiService.cleanupStuckGames(120);
          onNotify(
            lang === 'fa'
              ? `${res.cleaned_games_count} بازی معلق پاکسازی شد.`
              : `Cleaned ${res.cleaned_games_count} stuck matches.`,
            'success'
          );
          handleRefreshAll();
        } catch (err: any) {
          onNotify(err.message, 'error');
        } finally {
          setActionBusy(null);
        }
      },
    });
  };

  const handleUnlockAllStuckPlayers = () => {
    onConfirm({
      title: lang === 'fa' ? 'رفع قفل همه بازیکنان گیرکرده' : 'Release All Stuck Players',
      message:
        lang === 'fa'
          ? 'قفل بازی (open_game_id و open_pre_game_id) برای تمام بازیکنانی که در حالت گیرکرده هستند پاک می‌شود. آیا مطمئن هستید؟'
          : 'This will clear open_game_id and open_pre_game_id for all currently locked players. Continue?',
      variant: 'warning',
      confirmLabel: lang === 'fa' ? 'رفع قفل گروهی' : 'Release Locks',
      onConfirm: async () => {
        setActionBusy('unlock');
        try {
          const res = await ApiService.bulkResetLocks();
          onNotify(
            lang === 'fa'
              ? `قفل ${res.modified_count} بازیکن با موفقیت آزاد شد.`
              : `Released locks for ${res.modified_count} players.`,
            'success'
          );
          handleRefreshAll();
        } catch (err: any) {
          onNotify(err.message, 'error');
        } finally {
          setActionBusy(null);
        }
      },
    });
  };

  const handleTriggerBackup = async () => {
    setActionBusy('backup');
    try {
      const res = await ApiService.triggerBackup();
      onNotify(res.message || (lang === 'fa' ? 'پشتیبان‌گیری انجام شد.' : 'Backup created.'), 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const series = analytics?.daily_series || [];
  const metricValues = series.map((pt) => pt[metric]);
  const chartW = 640;
  const chartH = 200;
  const { points, maxVal, linePath, areaPath } = computeChartPoints(metricValues, chartW, chartH, 16, 16);

  const metricColor =
    metric === 'matches' ? 'var(--accent)' : metric === 'users' ? 'var(--sapphire)' : 'var(--emerald)';
  const metricSum = metricValues.reduce((acc, v) => acc + v, 0);
  const activePoint = hoveredIdx !== null && series[hoveredIdx] ? series[hoveredIdx] : series[series.length - 1];

  const gameBreakdown = Object.entries(stats?.matches.breakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalGameTypeHits = gameBreakdown.reduce((acc, [, c]) => acc + c, 0) || 1;

  const modeBreakdown = Object.entries(analytics?.mode_breakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalModes = modeBreakdown.reduce((acc, [, c]) => acc + c, 0) || 1;

  const lockedUsersCount = stats?.users.locked ?? analytics?.economy.locked_users ?? 0;
  const leaders = leaderTab === 'score' ? analytics?.top_by_score || [] : analytics?.top_by_coin || [];

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fa' ? 'داشبورد و تحلیل عملکرد' : 'Operations Overview'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'پایش زنده بازیکنان، اقتصاد سکه، روند مسابقات و وضعیت سرویس‌های کافه فکر'
              : 'Live player metrics, coin economy, match trends, and core system controls'}
          </p>
        </div>
        <div className="header-actions">
          {canWriteEconomy && (
            <button type="button" className="btn btn-primary" onClick={onOpenBulkCoins}>
              <Coins size={15} />
              <span>{lang === 'fa' ? 'توزیع همگانی سکه' : 'Bulk Grant Coins'}</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleRefreshAll} disabled={loading}>
            <RefreshCw size={15} className={loading || analyticsLoading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Conditional Operational Alerts */}
      {stats?.config.maintenance_mode && (
        <div className="alert-banner danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wrench size={18} className="text-crimson" />
            <div>
              <strong style={{ fontSize: 13.5 }}>
                {lang === 'fa' ? 'حالت تعمیرات فعال است' : 'Maintenance Mode is Active'}
              </strong>
              {stats.config.maintenance_message && (
                <div className="text-secondary" style={{ fontSize: 12.5 }}>
                  {stats.config.maintenance_message}
                </div>
              )}
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('config')}>
            {lang === 'fa' ? 'مدیریت در تنظیمات' : 'Manage in Config'}
          </button>
        </div>
      )}

      {lockedUsersCount > 0 && (
        <div className="alert-banner warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={18} className="text-amber" />
            <div style={{ fontSize: 13 }}>
              <strong>{formatNumber(lockedUsersCount, lang)}</strong>{' '}
              {lang === 'fa'
                ? 'بازیکن دارای قفل فعال بازی هستند (احتمال گیر کردن در صف یا بازی قدیمی).'
                : 'players currently have active match locks (possible stuck sessions).'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('users')}>
              {lang === 'fa' ? 'بررسی در بازیکنان' : 'Inspect Players'}
            </button>
            {canWriteUsers && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleUnlockAllStuckPlayers}
                disabled={actionBusy === 'unlock'}
              >
                <LockOpen size={14} />
                <span>{lang === 'fa' ? 'رفع قفل همه' : 'Release All'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Runtime Telemetry Strip */}
      {runtime && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Radio size={14} className={runtime.backend.online ? 'text-emerald' : 'text-crimson'} />
              <span>{lang === 'fa' ? 'پایش زنده:' : 'Live Telemetry:'}</span>
            </span>
            <span className="meta-inline">
              <span>{lang === 'fa' ? 'آنلاین:' : 'Online:'}</span>
              <strong className="mono text-emerald">{formatNumber(runtime.backend.online_social_users, lang)}</strong>
            </span>
            <span className="meta-inline">
              <span>{lang === 'fa' ? 'بازی در RAM:' : 'RAM Matches:'}</span>
              <strong className="mono text-accent">{formatNumber(runtime.backend.active_ram_games_count, lang)}</strong>
            </span>
            <span className="meta-inline">
              <span>{lang === 'fa' ? 'در صف:' : 'In Queue:'}</span>
              <strong className="mono text-sapphire">
                {formatNumber(runtime.backend.ranked_queue_count + runtime.backend.multi_queue_count, lang)}
              </strong>
            </span>
            <span className="meta-inline">
              <span>{lang === 'fa' ? 'تماشاگر:' : 'Spectators:'}</span>
              <strong className="mono">{formatNumber(runtime.backend.spectators_count, lang)}</strong>
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('system')}>
            {lang === 'fa' ? 'جزئیات سرویس‌ها' : 'Service Health'}
          </button>
        </div>
      )}

      {/* Executive KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card clickable" onClick={() => onNavigateTab('users')}>
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'کل بازیکنان' : 'Total Players'}</span>
            <span className="kpi-icon sapphire">
              <Users size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(stats?.users.total, lang)}</div>
          <div className="kpi-foot">
            <span>{formatNumber(stats?.users.real, lang)} {lang === 'fa' ? 'واقعی' : 'real'}</span>
            <span className="meta-sep">·</span>
            <span className="text-emerald">+{formatNumber(stats?.users.joined_today, lang)} {lang === 'fa' ? 'امروز' : 'today'}</span>
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigateTab('games')}>
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'مسابقات زنده' : 'Live Matches'}</span>
            <span className="kpi-icon emerald">
              <Gamepad2 size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(stats?.matches.live, lang)}</div>
          <div className="kpi-foot">
            <span>{formatNumber(stats?.matches.today, lang)} {lang === 'fa' ? 'امروز' : 'today'}</span>
            <span className="meta-sep">·</span>
            <span>{formatNumber(stats?.matches.total, lang)} {lang === 'fa' ? 'کل' : 'total'}</span>
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigateTab('purchases')}>
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'تراکنش‌های موفق' : 'Store Purchases'}</span>
            <span className="kpi-icon accent">
              <ShoppingBag size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(stats?.purchases.total, lang)}</div>
          <div className="kpi-foot">
            <span>{lang === 'fa' ? 'بازار' : 'Bazaar'} {formatNumber(stats?.purchases.bazaar, lang)}</span>
            <span className="meta-sep">·</span>
            <span>{lang === 'fa' ? 'مایکت' : 'Myket'} {formatNumber(stats?.purchases.myket, lang)}</span>
          </div>
        </div>

        <div className="kpi-card clickable" onClick={() => onNavigateTab('reports')}>
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'گزارش‌های باز' : 'Open Reports'}</span>
            <span className={`kpi-icon ${(stats?.open_reports_count || 0) > 0 ? 'crimson' : ''}`}>
              <Flag size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(stats?.open_reports_count, lang)}</div>
          <div className="kpi-foot">
            <span>{formatNumber(stats?.clans_count, lang)} {lang === 'fa' ? 'کلن فعال' : 'active clans'}</span>
            <span className="meta-sep">·</span>
            <span className="mono">v{stats?.config.latest_version || '—'}</span>
          </div>
        </div>
      </div>

      {/* Main Row: Daily Activity Trend Chart + Operations Panel */}
      <div className="dash-grid-main">
        <section className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div className="card-title">
              <TrendingUp size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'روند فعالیت روزانه' : 'Daily Activity Trend'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="segmented" role="tablist">
                {(['matches', 'users', 'purchases'] as TrendMetric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={metric === m}
                    className={`segmented-btn ${metric === m ? 'active' : ''}`}
                    onClick={() => setMetric(m)}
                  >
                    {m === 'matches'
                      ? lang === 'fa' ? 'مسابقات' : 'Matches'
                      : m === 'users'
                      ? lang === 'fa' ? 'ثبت‌نام' : 'Signups'
                      : lang === 'fa' ? 'خریدها' : 'Sales'}
                  </button>
                ))}
              </div>
              <div className="segmented">
                {([7, 14, 30] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`segmented-btn ${days === d ? 'active' : ''}`}
                    onClick={() => setDays(d)}
                  >
                    {d}{lang === 'fa' ? 'روز' : 'd'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-tooltip-bar">
            <div className="meta-inline">
              <span>{lang === 'fa' ? 'مجموع بازه:' : 'Period total:'}</span>
              <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(metricSum, lang)}
              </strong>
              <span className="meta-sep">·</span>
              <span>{lang === 'fa' ? 'بیشترین روز:' : 'Peak day:'}</span>
              <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(maxVal, lang)}
              </strong>
            </div>
            {activePoint && (
              <div className="meta-inline">
                <span className="tabular-nums">{formatShortDate(activePoint.date, lang)}</span>
                <span className="meta-sep">·</span>
                <strong className="tabular-nums" style={{ color: metricColor }}>
                  {formatNumber(activePoint[metric], lang)}
                </strong>
              </div>
            )}
          </div>

          <div className="chart-shell">
            {analyticsLoading && series.length === 0 ? (
              <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="skeleton" style={{ width: '100%', height: 160 }} />
              </div>
            ) : series.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 16px' }}>
                <span>{lang === 'fa' ? 'داده‌ای برای این بازه ثبت نشده است.' : 'No activity data for this period.'}</span>
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="chart-svg"
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metricColor} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={metricColor} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = 16 + (chartH - 32) * ratio;
                    return (
                      <line
                        key={ratio}
                        x1={16}
                        x2={chartW - 16}
                        y1={y}
                        y2={y}
                        className="chart-grid-line"
                      />
                    );
                  })}
                  {areaPath && <path d={areaPath} fill="url(#trendGrad)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke={metricColor}
                      strokeWidth="2.4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {points.map((pt) => {
                    const isHover = hoveredIdx === pt.index;
                    return (
                      <g key={pt.index}>
                        <rect
                          x={pt.x - 16}
                          y={0}
                          width={32}
                          height={chartH}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredIdx(pt.index)}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHover ? 5 : 3}
                          fill={isHover ? metricColor : 'var(--bg-surface)'}
                          stroke={metricColor}
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })}
                </svg>
                <div className="chart-x-labels">
                  <span>{formatShortDate(series[0]?.date, lang)}</span>
                  <span>{formatShortDate(series[Math.floor(series.length / 2)]?.date, lang)}</span>
                  <span>{formatShortDate(series[series.length - 1]?.date, lang)}</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Quick Controls & Economy Summary */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">
              <Power size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'کنترل سریع عملیات' : 'Quick Operations'}</span>
            </div>
            <span className={`status-label ${stats?.config.is_queue_open ? 'emerald' : 'crimson'}`}>
              <span className={`status-dot ${stats?.config.is_queue_open ? 'online' : 'offline'}`} />
              {stats?.config.is_queue_open
                ? lang === 'fa' ? 'صف باز' : 'Queue Open'
                : lang === 'fa' ? 'صف بسته' : 'Queue Closed'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div className="text-muted" style={{ fontSize: 11.5 }}>
                {lang === 'fa' ? 'کل سکه‌های در گردش' : 'Coins in Circulation'}
              </div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {formatNumber(analytics?.economy.total_coins, lang)}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11.5 }}>
                {lang === 'fa' ? 'میانگین سکه هر بازیکن' : 'Avg Coins / Player'}
              </div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>
                {formatNumber(analytics?.economy.avg_coins_real, lang)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {canWriteConfig && (
              <button
                type="button"
                className={`btn ${stats?.config.is_queue_open ? 'btn-danger' : 'btn-emerald'}`}
                style={{ justifyContent: 'space-between' }}
                onClick={handleToggleQueue}
                disabled={actionBusy === 'queue' || !stats}
              >
                <span>
                  {stats?.config.is_queue_open
                    ? lang === 'fa' ? 'بستن صف بازی آنلاین' : 'Close Matchmaking Queue'
                    : lang === 'fa' ? 'باز کردن صف بازی آنلاین' : 'Open Matchmaking Queue'}
                </span>
                <Power size={15} />
              </button>
            )}

            {canManageGames && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={handleCleanupStuck}
                disabled={actionBusy === 'cleanup'}
              >
                <span>{lang === 'fa' ? 'پاکسازی بازی‌های معلق (+۲ ساعت)' : 'Cleanup Stuck Matches (>2h)'}</span>
                <Trash2 size={15} className="text-amber" />
              </button>
            )}

            {hasAdminPermission(currentAdmin, 'notifications:write') && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={() => onNavigateTab('notifications')}
              >
                <span>{lang === 'fa' ? 'ارسال اعلان درون‌بازی' : 'Send In-Game Notification'}</span>
                <Bell size={15} className="text-sapphire" />
              </button>
            )}

            {canBackup && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={handleTriggerBackup}
                disabled={actionBusy === 'backup'}
              >
                <span>
                  {actionBusy === 'backup'
                    ? lang === 'fa' ? 'در حال پشتیبان‌گیری...' : 'Creating backup...'
                    : lang === 'fa' ? 'گرفتن پشتیبان فوری دیتابیس' : 'Run Instant DB Backup'}
                </span>
                <DatabaseBackup size={15} className="text-emerald" />
              </button>
            )}
          </div>

          <div
            className="meta-inline"
            style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span>{lang === 'fa' ? 'نسخه مجاز:' : 'Allowed:'}</span>
            <strong className="mono">v{stats?.config.allowed_version || '—'}</strong>
            <span className="meta-sep">·</span>
            <span>{lang === 'fa' ? 'مسدودشده:' : 'Banned:'}</span>
            <strong className="mono text-crimson">
              {formatNumber(stats?.users.banned ?? analytics?.economy.banned_users, lang)}
            </strong>
          </div>
        </section>
      </div>

      {/* Bottom Row: Top Players + Game Popularity & Mode Split */}
      <div className="dash-grid-sub">
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Trophy size={16} className="text-accent" />
              <span>{lang === 'fa' ? 'برترین بازیکنان واقعی' : 'Top Real Players'}</span>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={`segmented-btn ${leaderTab === 'score' ? 'active' : ''}`}
                onClick={() => setLeaderTab('score')}
              >
                {lang === 'fa' ? 'امتیاز' : 'Score'}
              </button>
              <button
                type="button"
                className={`segmented-btn ${leaderTab === 'coin' ? 'active' : ''}`}
                onClick={() => setLeaderTab('coin')}
              >
                {lang === 'fa' ? 'سکه' : 'Coins'}
              </button>
            </div>
          </div>

          {leaders.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <span>{lang === 'fa' ? 'داده‌ای یافت نشد.' : 'No leaderboard data yet.'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaders.map((u, idx) => (
                <div
                  key={u._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        width: 22,
                        textAlign: 'center',
                        fontWeight: 700,
                        color: idx === 0 ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onInspectUserById(u._id)}
                      >
                        {u.username || u._id}
                      </button>
                      <div className="mono text-muted" style={{ fontSize: 11 }}>
                        {u._id}
                      </div>
                    </div>
                  </div>
                  <div className="mono" style={{ textAlign: 'end' }}>
                    <div style={{ fontWeight: 700, color: leaderTab === 'coin' ? 'var(--accent)' : 'var(--emerald)' }}>
                      {formatNumber(leaderTab === 'score' ? u.score : u.coin, lang)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {leaderTab === 'score'
                        ? `${formatNumber(u.coin, lang)} ${lang === 'fa' ? 'سکه' : 'coins'}`
                        : `${formatNumber(u.score, lang)} ${lang === 'fa' ? 'امتیاز' : 'pts'}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Gamepad2 size={16} className="text-sapphire" />
              <span>{lang === 'fa' ? 'محبوبیت بازی‌ها و حالت‌های مسابقه' : 'Game & Mode Distribution'}</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {lang === 'fa' ? '۲۰۰ مسابقه اخیر' : 'Recent 200 matches'}
            </span>
          </div>

          {gameBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <span>{lang === 'fa' ? 'هنوز آماری ثبت نشده است.' : 'No match statistics recorded.'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {gameBreakdown.slice(0, 6).map(([gameName, count]) => {
                const pct = Math.round((count / totalGameTypeHits) * 100);
                return (
                  <div key={gameName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{gameName}</span>
                      <span className="mono text-secondary">
                        {formatNumber(count, lang)} ({pct}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}

              {modeBreakdown.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {modeBreakdown.map(([mode, count]) => (
                    <span key={mode} className="tag">
                      <span>{mode}</span>
                      <span className="mono text-accent">{Math.round((count / totalModes) * 100)}%</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
