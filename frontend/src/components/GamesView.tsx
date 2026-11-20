import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Play,
  History,
  StopCircle,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, ConfirmDialogOptions, GamePlayItem, LangCode } from '../types';
import { formatDateTime, formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface GamesViewProps {
  currentAdmin: AdminUser | null;
  onOpenGameDetails: (gameId: string) => void;
  onInspectUserById: (userId: string) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const GamesView: React.FC<GamesViewProps> = ({
  currentAdmin,
  onOpenGameDetails,
  onInspectUserById,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [subTab, setSubTab] = useState<'live' | 'history'>('live');
  const [liveGames, setLiveGames] = useState<GamePlayItem[]>([]);
  const [historyGames, setHistoryGames] = useState<GamePlayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modeFilter, setModeFilter] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');

  const canManageGames = hasAdminPermission(currentAdmin, 'games:manage');

  const fetchLive = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getLiveGames();
      setLiveGames(res.games || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await ApiService.getGameHistory({
        page,
        limit: 20,
        game_score_type: modeFilter || undefined,
        user_id: appliedUserId || undefined,
      });
      setHistoryGames(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'live') {
      fetchLive();
    } else {
      fetchHistory();
    }
  }, [subTab, page, modeFilter, appliedUserId]);

  const handleTerminate = (gameId: string) => {
    onConfirm({
      title: lang === 'fa' ? 'خاتمه اجباری بازی زنده' : 'Force Terminate Live Match',
      message:
        lang === 'fa'
          ? `بازی ${gameId} بسته شده و قفل تمام بازیکنان آن آزاد می‌شود. آیا مطمئن هستید؟`
          : `Match ${gameId} will be terminated and all participant locks released. Continue?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'خاتمه دادن' : 'Terminate Match',
      onConfirm: async () => {
        try {
          await ApiService.terminateGame(gameId);
          onNotify(lang === 'fa' ? 'بازی متوقف و قفل بازیکنان آزاد شد.' : 'Match terminated.', 'success');
          fetchLive();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleCleanupStuck = () => {
    onConfirm({
      title: lang === 'fa' ? 'پاکسازی بازی‌های معلق' : 'Cleanup Stuck Matches',
      message:
        lang === 'fa'
          ? 'تمام بازی‌های ناتمامی که بیش از ۲ ساعت از شروع آن‌ها گذشته به صورت خودکار بسته می‌شوند.'
          : 'Close all unfinished matches started more than 2 hours ago and unlock their players.',
      variant: 'warning',
      confirmLabel: lang === 'fa' ? 'اجرای پاکسازی' : 'Cleanup Now',
      onConfirm: async () => {
        try {
          const res = await ApiService.cleanupStuckGames(120);
          onNotify(
            lang === 'fa'
              ? `${res.cleaned_games_count} بازی معلق پاکسازی شد.`
              : `Cleaned ${res.cleaned_games_count} stuck matches.`,
            'success'
          );
          fetchLive();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const renderPlayers = (g: GamePlayItem) => {
    const uids =
      g.user_ids && g.user_ids.length > 0
        ? g.user_ids
        : [g.user1_id, g.user2_id].filter(Boolean) as string[];
    const names = g.player_names || {};

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {uids.map((uid, idx) => (
          <React.Fragment key={uid}>
            {idx > 0 && <span className="meta-sep">vs</span>}
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: 12.5 }}
              onClick={() => onInspectUserById(uid)}
              title={uid}
            >
              {names[uid] || uid}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'مسابقات و بازی‌ها' : 'Matches & Live Sessions'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'پایش بازی‌های در حال اجرا، خاتمه جلسات معلق و آرشیو کامل نتایج'
              : 'Monitor live sessions, release stuck matches, and browse full match history'}
          </p>
        </div>
        <div className="header-actions">
          {subTab === 'live' && canManageGames && (
            <button type="button" className="btn btn-secondary" onClick={handleCleanupStuck}>
              <Trash2 size={15} className="text-amber" />
              <span>{lang === 'fa' ? 'پاکسازی معلق‌ها (+۲ ساعت)' : 'Cleanup Stuck (>2h)'}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={subTab === 'live' ? fetchLive : fetchHistory}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'live'}
            className={`segmented-btn ${subTab === 'live' ? 'active' : ''}`}
            onClick={() => setSubTab('live')}
          >
            <Play size={14} className="text-emerald" />
            <span>
              {lang === 'fa' ? 'بازی‌های زنده' : 'Live Matches'} ({formatNumber(liveGames.length, lang)})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'history'}
            className={`segmented-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => setSubTab('history')}
          >
            <History size={14} />
            <span>{lang === 'fa' ? 'آرشیو مسابقات' : 'Match History'}</span>
          </button>
        </div>

        {subTab === 'history' && (
          <div className="toolbar-group">
            <form
              className="search-box"
              style={{ minWidth: 220 }}
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setAppliedUserId(userSearchInput.trim());
              }}
            >
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="input-field"
                value={userSearchInput}
                onChange={(e) => setUserSearchInput(e.target.value)}
                placeholder={lang === 'fa' ? 'فیلتر شناسه بازیکن...' : 'Filter by Player ID...'}
                aria-label={lang === 'fa' ? 'فیلتر بازیکن' : 'Filter by player ID'}
              />
              {(userSearchInput || appliedUserId) && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setUserSearchInput('');
                    setAppliedUserId('');
                    setPage(1);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            <select
              className="select-field"
              style={{ width: 'auto', minWidth: 150 }}
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value);
                setPage(1);
              }}
              aria-label={lang === 'fa' ? 'حالت مسابقه' : 'Match mode'}
            >
              <option value="">{lang === 'fa' ? 'همه حالت‌ها' : 'All Modes'}</option>
              <option value="Rank">Rank</option>
              <option value="MultiRank">MultiRank</option>
              <option value="ClassicRank">ClassicRank</option>
              <option value="Lobby">Lobby</option>
              <option value="Clan">Clan</option>
            </select>
          </div>
        )}
      </div>

      <div className="table-wrap">
        {subTab === 'live' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'fa' ? 'شناسه بازی' : 'Match ID'}</th>
                <th>{lang === 'fa' ? 'بازی‌ها و حالت' : 'Games & Mode'}</th>
                <th>{lang === 'fa' ? 'بازیکنان' : 'Participants'}</th>
                <th>{lang === 'fa' ? 'زمان شروع' : 'Started'}</th>
                <th style={{ width: 120 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5}><div className="skeleton" style={{ height: 18 }} /></td>
                  </tr>
                ))
              ) : liveGames.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <Gamepad2 size={26} />
                      <span>{lang === 'fa' ? 'در حال حاضر هیچ بازی زنده‌ای در جریان نیست.' : 'No live matches right now.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                liveGames.map((g) => (
                  <tr key={g._id}>
                    <td className="mono text-accent" style={{ fontSize: 12 }}>{g._id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{(g.game_types || []).join(' · ') || '—'}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{g.game_score_type || 'Standard'}</div>
                    </td>
                    <td>{renderPlayers(g)}</td>
                    <td className="mono text-secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(g.start_date, lang)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon sm"
                          onClick={() => onOpenGameDetails(g._id)}
                          title={lang === 'fa' ? 'مشاهده راندها' : 'Inspect Rounds'}
                          aria-label={`Inspect match ${g._id}`}
                        >
                          <Eye size={14} />
                        </button>
                        {canManageGames && (
                          <button
                            type="button"
                            className="btn-icon sm danger"
                            onClick={() => handleTerminate(g._id)}
                            title={lang === 'fa' ? 'خاتمه اجباری' : 'Force Terminate'}
                            aria-label={`Terminate match ${g._id}`}
                          >
                            <StopCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{lang === 'fa' ? 'شناسه' : 'Match ID'}</th>
                  <th>{lang === 'fa' ? 'نوع و حالت' : 'Type & Mode'}</th>
                  <th>{lang === 'fa' ? 'بازیکنان' : 'Participants'}</th>
                  <th>{lang === 'fa' ? 'برنده' : 'Winner'}</th>
                  <th>{lang === 'fa' ? 'زمان' : 'Date'}</th>
                  <th style={{ width: 80 }}>{lang === 'fa' ? 'جزئیات' : 'Details'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}><div className="skeleton" style={{ height: 18 }} /></td>
                    </tr>
                  ))
                ) : historyGames.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <History size={26} />
                        <span>{lang === 'fa' ? 'مسابقه‌ای یافت نشد.' : 'No match history found.'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historyGames.map((g) => {
                    const winnerName = g.winner_id
                      ? g.player_names?.[g.winner_id] || g.winner_id
                      : '';
                    return (
                      <tr key={g._id}>
                        <td className="mono text-muted" style={{ fontSize: 12 }}>{g._id}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{(g.game_types || []).join(' · ') || '—'}</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>{g.game_score_type || 'Standard'}</div>
                        </td>
                        <td>{renderPlayers(g)}</td>
                        <td>
                          {g.terminated_by_admin ? (
                            <span className="status-label crimson">{lang === 'fa' ? 'توقف ادمین' : 'Terminated'}</span>
                          ) : winnerName ? (
                            <button
                              type="button"
                              className="link-btn text-emerald"
                              onClick={() => g.winner_id && onInspectUserById(g.winner_id)}
                            >
                              {winnerName}
                            </button>
                          ) : (
                            <span className="text-muted">{lang === 'fa' ? 'مساوی / نامشخص' : 'Draw / N/A'}</span>
                          )}
                        </td>
                        <td className="mono text-secondary" style={{ fontSize: 12 }}>
                          {formatDateTime(g.start_date, lang)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-icon sm"
                            onClick={() => onOpenGameDetails(g._id)}
                            title={lang === 'fa' ? 'مشاهده راندها' : 'Inspect Match'}
                            aria-label={`Inspect match ${g._id}`}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <span>
                  {lang === 'fa'
                    ? `صفحه ${formatNumber(page, lang)} از ${formatNumber(totalPages, lang)} (کل: ${formatNumber(total, lang)})`
                    : `Page ${page} of ${totalPages} (${total} total)`}
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
          </>
        )}
      </div>
    </div>
  );
};
