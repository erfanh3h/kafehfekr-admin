import React, { useState, useEffect } from 'react';
import {
  X,
  Coins,
  Trophy,
  Zap,
  User,
  ShoppingBag,
  History,
  Shield,
  KeyRound,
  Server,
  Save,
  UsersRound,
} from 'lucide-react';
import { UserItem, UserFullDetails, GamePlayItem, ClanItem } from '../types';
import { ApiService } from '../services/api';

// -------------------------------------------------------------
// User Details Modal
// -------------------------------------------------------------
interface UserDetailsModalProps {
  user: UserItem | null;
  onClose: () => void;
  lang: 'fa' | 'en';
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose, lang }) => {
  const isFa = lang === 'fa';
  const [details, setDetails] = useState<UserFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'stats' | 'games' | 'purchases'>('stats');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    ApiService.getUserDetails(user._id)
      .then((d) => setDetails(d))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-badge" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
              {user.image ?? 0}
            </div>
            <div>
              <span className="modal-title">{user.username || (isFa ? '(بدون نام)' : 'Anonymous')}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block' }}>
                User ID: {user._id} | {isFa ? 'تلفن:' : 'Phone:'} {user.phone || '—'}
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Quick Stats Pill Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div className="kpi-card" style={{ padding: '12px' }}>
              <Coins size={20} style={{ color: 'var(--gold-primary)' }} />
              <div>
                <span className="kpi-label">{isFa ? 'سکه' : 'Coins'}</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{user.coin ?? 0}</span>
              </div>
            </div>
            <div className="kpi-card" style={{ padding: '12px' }}>
              <Trophy size={20} style={{ color: 'var(--sapphire)' }} />
              <div>
                <span className="kpi-label">{isFa ? 'امتیاز' : 'Score'}</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{user.score ?? 0}</span>
              </div>
            </div>
            <div className="kpi-card" style={{ padding: '12px' }}>
              <Zap size={20} style={{ color: 'var(--purple)' }} />
              <div>
                <span className="kpi-label">{isFa ? 'تجربه (XP)' : 'XP'}</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', display: 'block' }}>{user.xp ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Modal Tabs */}
          <div className="tab-list">
            <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
              {isFa ? 'آمار برد/باخت' : 'Win/Loss Stats'}
            </button>
            <button className={`tab-btn ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
              {isFa ? 'مسابقات اخیر' : 'Recent Matches'}
            </button>
            <button className={`tab-btn ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>
              {isFa ? 'خریدهای فروشگاه' : 'Purchases'}
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              {isFa ? 'در حال بارگذاری اطلاعات...' : 'Loading details...'}
            </p>
          ) : (
            <>
              {tab === 'stats' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isFa ? 'مجموع بردها' : 'Total Wins'}</span>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--emerald)' }}>{details?.history.win ?? 0}</p>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isFa ? 'مجموع باخت‌ها' : 'Total Losses'}</span>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--ruby)' }}>{details?.history.lose ?? 0}</p>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isFa ? 'مساوی‌ها' : 'Total Draws'}</span>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--sapphire)' }}>{details?.history.draw ?? 0}</p>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isFa ? 'عضویت در کلن' : 'Clan'}</span>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                      {details?.clan ? `${details.clan.name} (#${details.clan.tag})` : (isFa ? 'بدون کلن' : 'None')}
                    </p>
                  </div>
                </div>
              )}

              {tab === 'games' && (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {(details?.recent_games || []).length === 0 ? (
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '14px' }}>
                      {isFa ? 'مسابقه‌ای ثبت نشده است.' : 'No matches played yet.'}
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>{isFa ? 'بازی‌ها' : 'Games'}</th>
                          <th>{isFa ? 'برنده' : 'Winner'}</th>
                          <th>{isFa ? 'تاریخ' : 'Date'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details?.recent_games || []).map((g) => (
                          <tr key={g._id}>
                            <td>{g._id}</td>
                            <td>{(g.game_types || []).join(', ')}</td>
                            <td>
                              <span className={`badge ${g.winner_id === user._id ? 'green' : 'gray'}`}>
                                {g.winner_id === user._id ? (isFa ? 'این کاربر' : 'User') : (g.winner_id || 'Draw')}
                              </span>
                            </td>
                            <td>{g.start_date ? new Date(g.start_date).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'purchases' && (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {(details?.purchases || []).length === 0 ? (
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '14px' }}>
                      {isFa ? 'تراکنشی برای این کاربر ثبت نشده است.' : 'No purchases found.'}
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>{isFa ? 'مارکت' : 'Market'}</th>
                          <th>{isFa ? 'بسته' : 'Product'}</th>
                          <th>{isFa ? 'تاریخ' : 'Date'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details?.purchases || []).map((p) => (
                          <tr key={p._id}>
                            <td>{p._id}</td>
                            <td>{p.market_type}</td>
                            <td>Pack #{p.product_id}</td>
                            <td>{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Adjust Currency Modal
// -------------------------------------------------------------
interface AdjustCurrencyModalProps {
  user: UserItem | null;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const AdjustCurrencyModal: React.FC<AdjustCurrencyModalProps> = ({
  user,
  onClose,
  onSuccess,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [field, setField] = useState<'coin' | 'score' | 'xp'>('coin');
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState('شارژ توسط مدیریت');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await ApiService.adjustCurrency(user._id, field, amount, reason);
      onNotify(isFa ? `موجودی ${field} کاربر با موفقیت تغییر کرد.` : `${field} updated successfully.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">
            {isFa ? `تغییر موجودی کاربر: ${user.username || user._id}` : `Adjust Balance: ${user.username}`}
          </span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">{isFa ? 'نوع ارز / امتیاز' : 'Currency / Stat'}</label>
              <select
                className="input-field"
                value={field}
                onChange={(e) => setField(e.target.value as any)}
              >
                <option value="coin">{isFa ? 'سکه طلایی (Coins)' : 'Coins'}</option>
                <option value="score">{isFa ? 'امتیاز رنکینگ (Score/Elo)' : 'Ranking Score'}</option>
                <option value="xp">{isFa ? 'تجربه کاربری (XP / Level)' : 'XP'}</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'مقدار تغییر (مثبت برای افزایش، منفی برای کسر)' : 'Amount (+ to add, - to deduct)'}</label>
              <input
                type="number"
                required
                className="input-field"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              />
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[+50, +100, +500, +1000, -50, -100].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => setAmount(v)}
                >
                  {v > 0 ? `+${v}` : v}
                </button>
              ))}
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'دلیل یا توضیحات برای لاگ مدیریت' : 'Reason / Audit Note'}</label>
              <input
                type="text"
                className="input-field"
                placeholder={isFa ? 'مثال: جایزه مسابقه یا رفع اشکال' : 'e.g. Compensation'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isFa ? 'در حال اعمال...' : 'Applying...') : (isFa ? 'اعمال تغییرات' : 'Apply')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Game Details & Rounds Modal
// -------------------------------------------------------------
interface GameDetailsModalProps {
  gameId: string | null;
  onClose: () => void;
  lang: 'fa' | 'en';
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ gameId, onClose, lang }) => {
  const isFa = lang === 'fa';
  const [data, setData] = useState<{ match: GamePlayItem; rounds: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    ApiService.getGameDetails(gameId)
      .then((d) => setData(d))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [gameId]);

  if (!gameId) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <div>
            <span className="modal-title">
              {isFa ? `بررسی راندهای مسابقه: ${gameId}` : `Match Rounds Inspector: ${gameId}`}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block' }}>
              {(data?.match?.game_types || []).join(' → ')} | {data?.match?.game_score_type || 'Rank'}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              {isFa ? 'در حال بارگذاری اطلاعات راندها...' : 'Loading round details...'}
            </p>
          ) : !data ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
              {isFa ? 'اطلاعاتی یافت نشد.' : 'Match not found.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>
                {isFa ? `راندهای انجام‌شده (${data.rounds.length} راند)` : `Played Rounds (${data.rounds.length})`}
              </h3>

              {data.rounds.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                  {isFa ? 'راند جداگانه‌ای ثبت نشده است.' : 'No sub-rounds recorded.'}
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{isFa ? 'نوع بازی' : 'Game'}</th>
                        <th>{isFa ? 'برنده راند' : 'Round Winner'}</th>
                        <th>{isFa ? 'شناسه برنده' : 'Winner User ID'}</th>
                        <th>{isFa ? 'زمان' : 'Time'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rounds.map((r, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td><span className="badge gold">{r.game_type}</span></td>
                          <td>{r.winner_id}</td>
                          <td><span style={{ color: 'var(--emerald)' }}>{r.winner_user_id || '—'}</span></td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {r.date ? new Date(r.date).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Clan Details Modal
// -------------------------------------------------------------
interface ClanDetailsModalProps {
  clanId: string | null;
  onClose: () => void;
  lang: 'fa' | 'en';
}

export const ClanDetailsModal: React.FC<ClanDetailsModalProps> = ({ clanId, onClose, lang }) => {
  const isFa = lang === 'fa';
  const [data, setData] = useState<{ clan: ClanItem; members: any[]; challenges: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clanId) return;
    setLoading(true);
    ApiService.getClanDetails(clanId)
      .then((d) => setData(d))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [clanId]);

  if (!clanId) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <div>
            <span className="modal-title">
              {data?.clan?.name || (isFa ? 'مشخصات کلن' : 'Clan Profile')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block' }}>
              Tag: #{data?.clan?.tag} | Lvl {data?.clan?.level || 1} | {data?.clan?.trophies || 0} Trophies
            </span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              {isFa ? 'در حال دریافت اطلاعات کلن...' : 'Loading clan members...'}
            </p>
          ) : !data ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
              {isFa ? 'کلن یافت نشد.' : 'Clan not found.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {data.clan.description || (isFa ? '(بدون توضیحات)' : 'No description')}
              </p>

              <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>
                {isFa ? `اعضای کلن (${data.members.length} نفر)` : `Clan Roster (${data.members.length})`}
              </h4>

              <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isFa ? 'کاربر' : 'User'}</th>
                      <th>{isFa ? 'نقش در کلن' : 'Role'}</th>
                      <th>{isFa ? 'تاریخ پیوستن' : 'Joined'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{m.user_id}</td>
                        <td><span className="badge blue">{m.role || 'member'}</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Change Password Modal
// -------------------------------------------------------------
interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      onNotify(isFa ? 'رمز عبور جدید و تکرار آن یکسان نیستند.' : 'Passwords do not match.', 'error');
      return;
    }
    setLoading(true);
    try {
      await ApiService.changePassword(oldPass, newPass);
      onNotify(isFa ? 'رمز عبور شما با موفقیت تغییر کرد.' : 'Password changed successfully.', 'success');
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">{isFa ? 'تغییر رمز عبور ادمین' : 'Change Password'}</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">{isFa ? 'رمز عبور فعلی' : 'Current Password'}</label>
              <input
                type="password"
                required
                className="input-field"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'رمز عبور جدید (حداقل ۶ کاراکتر)' : 'New Password'}</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'تکرار رمز عبور جدید' : 'Confirm New Password'}</label>
              <input
                type="password"
                required
                className="input-field"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isFa ? 'در حال ثبت...' : 'Updating...') : (isFa ? 'ثبت رمز عبور جدید' : 'Update Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// API Settings Modal
// -------------------------------------------------------------
interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  lang: 'fa' | 'en';
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [url, setUrl] = useState(ApiService.getBaseUrl());

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    ApiService.setBaseUrl(url);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">{isFa ? 'تنظیم آدرس سرور REST API' : 'API Server URL Settings'}</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">{isFa ? 'آدرس پایه سرور (kafehfekrserver)' : 'Base Server URL'}</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="http://localhost:5001"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                {isFa
                  ? 'پیش‌فرض لوکال: http://localhost:5001 (یا IP سرور اصلی مانند http://85.133.205.107:5001)'
                  : 'Default local: http://localhost:5001'}
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              <span>{isFa ? 'ذخیره آدرس' : 'Save URL'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Bulk Coins Modal
// -------------------------------------------------------------
interface BulkCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const BulkCoinsModal: React.FC<BulkCoinsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [amount, setAmount] = useState(100);
  const [filterType, setFilterType] = useState('real');
  const [reason, setReason] = useState('هدیه مدیریت کافه فکر');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(isFa ? `آیا از اهدای ${amount} سکه به کاربران انتخاب‌شده اطمینان دارید؟` : `Grant ${amount} coins?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await ApiService.bulkDistributeCoins(amount, filterType, reason);
      onNotify(isFa ? `تعداد ${res.modified_count} کاربر هر کدام ${amount} سکه دریافت کردند.` : `Gifted coins to ${res.modified_count} users.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-title">{isFa ? 'اهدای سکه همگانی به بازیکنان' : 'Bulk Gift Coins to Players'}</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label className="input-label">{isFa ? 'تعداد سکه اهدایی به هر بازیکن' : 'Coins Amount per Player'}</label>
              <input
                type="number"
                min="1"
                required
                className="input-field"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'گروه هدف بازیکنان' : 'Target Audience'}</label>
              <select
                className="input-field"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="real">{isFa ? 'فقط کاربران واقعی (ربات‌ها فیلتر شوند)' : 'Real Players Only'}</option>
                <option value="active">{isFa ? 'فقط کاربران فعال و غیرمسدود' : 'Active Non-Banned Users'}</option>
                <option value="all">{isFa ? 'همه کاربران بدون استثنا' : 'All Users'}</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">{isFa ? 'مناسبت یا دلیل اهدای سکه' : 'Occasion / Reason'}</label>
              <input
                type="text"
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isFa ? 'در حال توزیع...' : 'Distributing...') : (isFa ? 'توزیع سکه‌ها' : 'Grant Coins')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
