import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Radio,
  History,
  Filter,
  RefreshCw,
  Eye,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Clock,
  User,
} from 'lucide-react';
import { GamePlayItem } from '../types';
import { ApiService } from '../services/api';

interface GamesViewProps {
  onOpenGameDetails: (gameId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const GamesView: React.FC<GamesViewProps> = ({
  onOpenGameDetails,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [tab, setTab] = useState<'live' | 'history'>('live');

  // Live games state
  const [liveGames, setLiveGames] = useState<GamePlayItem[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // History games state
  const [historyGames, setHistoryGames] = useState<GamePlayItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedGameType, setSelectedGameType] = useState('');
  const [selectedScoreType, setSelectedScoreType] = useState('');

  const fetchLiveGames = async () => {
    setLoadingLive(true);
    try {
      const res = await ApiService.getLiveGames();
      setLiveGames(res.games);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingLive(false);
    }
  };

  const fetchHistoryGames = async () => {
    setLoadingHistory(true);
    try {
      const res = await ApiService.getGameHistory({
        page: historyPage,
        limit: 15,
        game_type: selectedGameType || undefined,
        game_score_type: selectedScoreType || undefined,
      });
      setHistoryGames(res.items);
      setHistoryTotal(res.total);
      setHistoryTotalPages(res.total_pages);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (tab === 'live') {
      fetchLiveGames();
    } else {
      fetchHistoryGames();
    }
  }, [tab, historyPage, selectedGameType, selectedScoreType]);

  const handleTerminateGame = async (gameId: string) => {
    if (!window.confirm(isFa ? `آیا از خاتمه دادن اجباری بازی (${gameId}) اطمینان دارید؟ قفل بازیکنان آزاد خواهد شد.` : `Force terminate match ${gameId}?`)) {
      return;
    }
    try {
      await ApiService.terminateGame(gameId);
      onNotify(isFa ? `بازی ${gameId} با موفقیت خاتمه یافت و کاربران آزاد شدند.` : `Game ${gameId} terminated.`, 'success');
      fetchLiveGames();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Top Tabs */}
      <div className="tab-list">
        <button
          className={`tab-btn ${tab === 'live' ? 'active' : ''}`}
          onClick={() => setTab('live')}
        >
          <Radio size={16} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          <span>{isFa ? 'بازی‌های در حال اجرا (زنده)' : 'Live Ongoing Matches'}</span>
          {liveGames.length > 0 && <span className="badge red" style={{ marginInlineStart: '6px' }}>{liveGames.length}</span>}
        </button>

        <button
          className={`tab-btn ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          <History size={16} style={{ display: 'inline', marginInlineEnd: '6px' }} />
          <span>{isFa ? 'تاریخچه مسابقات ثبت‌شده' : 'Finished Matches Archive'}</span>
        </button>
      </div>

      {tab === 'live' ? (
        /* Live Games Panel */
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <Radio size={18} style={{ color: 'var(--ruby)' }} />
              <span>{isFa ? 'مسابقات فعال در سرور بازی' : 'Active Live Matches'}</span>
            </span>
            <button className="btn btn-icon" onClick={fetchLiveGames} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loadingLive ? 'spin' : ''} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isFa ? 'شناسه مسابقه' : 'Match ID'}</th>
                  <th>{isFa ? 'نوع رقابت' : 'Mode'}</th>
                  <th>{isFa ? 'بازی‌های انتخابی' : 'Games in Match'}</th>
                  <th>{isFa ? 'شناسه بازیکنان' : 'Players'}</th>
                  <th>{isFa ? 'زمان شروع' : 'Start Time'}</th>
                  <th style={{ textAlign: 'center' }}>{isFa ? 'عملیات مدیر' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {loadingLive ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      {isFa ? 'در حال دریافت مسابقات زنده...' : 'Loading live matches...'}
                    </td>
                  </tr>
                ) : liveGames.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      {isFa ? 'در حال حاضر هیچ مسابقه فعالی در سرور در جریان نیست.' : 'No active matches currently.'}
                    </td>
                  </tr>
                ) : (
                  liveGames.map((g) => (
                    <tr key={g._id}>
                      <td>
                        <span style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{g._id}</span>
                      </td>
                      <td>
                        <span className="badge blue">{g.game_score_type || 'Rank'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(g.game_types || []).map((t, i) => (
                            <span key={i} className="badge gold">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px' }}>{g.user1_id || g.user_ids?.[0] || '—'}</span>
                          <span style={{ color: 'var(--text-dim)' }}>vs</span>
                          <span style={{ fontSize: '12px' }}>{g.user2_id || g.user_ids?.[1] || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {g.start_date ? new Date(g.start_date).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleTerminateGame(g._id)}
                        >
                          <AlertOctagon size={14} />
                          <span>{isFa ? 'قطع و خاتمه اجباری' : 'Terminate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* History Games Panel */
        <div className="panel">
          <div className="panel-header">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="panel-title">
                <History size={18} style={{ color: 'var(--sapphire)' }} />
                <span>{isFa ? 'آرشیو مسابقات پایان‌یافته' : 'Finished Matches Archive'}</span>
                <span className="badge gold">{historyTotal}</span>
              </span>

              {/* Game Type Filter */}
              <select
                className="input-field"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                value={selectedGameType}
                onChange={(e) => {
                  setSelectedGameType(e.target.value);
                  setHistoryPage(1);
                }}
              >
                <option value="">{isFa ? 'همه بازی‌ها' : 'All Games'}</option>
                {['Risk', 'Uno', 'Chess', 'TicTacToe', 'Ludo', 'Yatzy', 'Sudoku', 'Monopoly', 'Coup', 'Quoridor'].map((gt) => (
                  <option key={gt} value={gt}>{gt}</option>
                ))}
              </select>

              {/* Mode Filter */}
              <select
                className="input-field"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                value={selectedScoreType}
                onChange={(e) => {
                  setSelectedScoreType(e.target.value);
                  setHistoryPage(1);
                }}
              >
                <option value="">{isFa ? 'همه حالت‌ها' : 'All Modes'}</option>
                <option value="Rank">{isFa ? 'رنک (Rank)' : 'Rank'}</option>
                <option value="Classic">{isFa ? 'کلاسیک با ربات (Classic)' : 'Classic'}</option>
                <option value="Lobby">{isFa ? 'لابی دوستانه (Lobby)' : 'Lobby'}</option>
              </select>
            </div>

            <button className="btn btn-icon" onClick={fetchHistoryGames} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loadingHistory ? 'spin' : ''} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isFa ? 'شناسه' : 'ID'}</th>
                  <th>{isFa ? 'نوع مسابقه' : 'Mode'}</th>
                  <th>{isFa ? 'بازی‌های انجام‌شده' : 'Games'}</th>
                  <th>{isFa ? 'بازیکنان' : 'Players'}</th>
                  <th>{isFa ? 'برنده' : 'Winner'}</th>
                  <th>{isFa ? 'تاریخ مسابقه' : 'Date'}</th>
                  <th style={{ textAlign: 'center' }}>{isFa ? 'بررسی راندها' : 'Rounds'}</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      {isFa ? 'در حال دریافت تاریخچه...' : 'Loading history...'}
                    </td>
                  </tr>
                ) : historyGames.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      {isFa ? 'مسابقه‌ای با این فیلتر ثبت نشده است.' : 'No matches found.'}
                    </td>
                  </tr>
                ) : (
                  historyGames.map((g) => (
                    <tr key={g._id}>
                      <td style={{ fontWeight: 'bold' }}>{g._id}</td>
                      <td>
                        <span className="badge blue">{g.game_score_type || 'Rank'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(g.game_types || []).map((t, idx) => (
                            <span key={idx} className="badge gold">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px' }}>{g.user1_id || g.user_ids?.[0] || '—'}</span>
                          <span style={{ color: 'var(--text-dim)' }}>vs</span>
                          <span style={{ fontSize: '12px' }}>{g.user2_id || g.user_ids?.[1] || '—'}</span>
                        </div>
                      </td>
                      <td>
                        {g.winner_id ? (
                          <span className="badge green">
                            <Trophy size={12} /> {g.winner_id}
                          </span>
                        ) : (
                          <span className="badge gray">{isFa ? 'نامشخص / مساوی' : 'Draw'}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {g.start_date ? new Date(g.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '32px', height: '32px', color: 'var(--gold-primary)' }}
                          onClick={() => onOpenGameDetails(g._id)}
                          title={isFa ? 'مشاهده جزئیات راندهای بازی' : 'Inspect Round Details'}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination */}
          <div className="pagination">
            <span>
              {isFa
                ? `صفحه ${historyPage} از ${historyTotalPages} (مجموع ${historyTotal} مسابقه)`
                : `Page ${historyPage} of ${historyTotalPages} (${historyTotal} total)`}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage(historyPage - 1)}
              >
                <ChevronRight size={16} />
                <span>{isFa ? 'قبلی' : 'Prev'}</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage(historyPage + 1)}
              >
                <span>{isFa ? 'بعدی' : 'Next'}</span>
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
