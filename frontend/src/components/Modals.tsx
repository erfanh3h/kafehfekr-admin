import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Coins,
  Gamepad2,
  Shield,
  KeyRound,
  Settings,
  Save,
  LockOpen,
  UserMinus,
  Edit3,
  Send,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  AdminUser,
  ClanItem,
  ClanMemberItem,
  ConfirmDialogOptions,
  GamePlayItem,
  GameRoundItem,
  LangCode,
  UserFullDetails,
  UserItem,
} from '../types';
import { formatDateTime, formatNumber, hasAdminPermission } from '../utils/adminUtils';

// =========================================================================
// 1. User Details & Edit Modal (works with any userId)
// =========================================================================

interface UserDetailsModalProps {
  userId: string | null;
  currentAdmin: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  userId,
  currentAdmin,
  onClose,
  onSuccess,
  onNotify,
  lang,
}) => {
  const [details, setDetails] = useState<UserFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'games' | 'purchases' | 'edit' | 'notify'>('overview');

  // Edit form state
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCoin, setEditCoin] = useState(0);
  const [editScore, setEditScore] = useState(0);
  const [editXp, setEditXp] = useState(0);
  const [saving, setSaving] = useState(false);

  // Direct notice state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  const canWriteUsers = hasAdminPermission(currentAdmin, 'users:write');
  const canSendNotice = hasAdminPermission(currentAdmin, 'notifications:write');

  const loadDetails = async (uid: string) => {
    setLoading(true);
    try {
      const res = await ApiService.getUserDetails(uid);
      setDetails(res);
      setEditUsername(res.user.username || '');
      setEditPhone(res.user.phone || '');
      setEditCoin(res.user.coin || 0);
      setEditScore(res.user.score || 0);
      setEditXp(res.user.xp || 0);
    } catch (err: any) {
      onNotify(err.message, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      setTab('overview');
      setNoticeTitle('');
      setNoticeMessage('');
      loadDetails(userId);
    } else {
      setDetails(null);
    }
  }, [userId]);

  if (!userId) return null;

  const user = details?.user;
  const isLocked = Boolean(user?.open_game_id || user?.open_pre_game_id);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await ApiService.updateUser(user._id, {
        username: editUsername.trim(),
        phone: editPhone.trim(),
        coin: Number(editCoin),
        score: Number(editScore),
        xp: Number(editXp),
      });
      await loadDetails(user._id);
      setTab('overview');
      onSuccess();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearLocks = async () => {
    if (!user) return;
    try {
      await ApiService.resetUserLocks(user._id);
      onNotify(lang === 'fa' ? 'قفل بازی بازیکن پاک شد.' : 'Player match locks cleared.', 'success');
      await loadDetails(user._id);
      onSuccess();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleSendDirectNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noticeTitle.trim() || !noticeMessage.trim()) return;
    setSendingNotice(true);
    try {
      await ApiService.sendNotification({
        target_type: 'user',
        user_id: user._id,
        title: noticeTitle.trim(),
        message: noticeMessage.trim(),
      });
      onNotify(lang === 'fa' ? 'اعلان مستقیم برای بازیکن ارسال شد.' : 'Direct notification sent.', 'success');
      setNoticeTitle('');
      setNoticeMessage('');
      setTab('overview');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSendingNotice(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <User size={18} className="text-accent" />
            <span>{user?.username || userId}</span>
            <span className="mono text-muted" style={{ fontSize: 12 }}>({userId})</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading || !details || !user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ height: 48 }} />
              <div className="skeleton" style={{ height: 110 }} />
            </div>
          ) : (
            <>
              <div className="toolbar" style={{ marginBottom: 16 }}>
                <div className="segmented" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'overview'}
                    className={`segmented-btn ${tab === 'overview' ? 'active' : ''}`}
                    onClick={() => setTab('overview')}
                  >
                    {lang === 'fa' ? 'خلاصه' : 'Overview'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'games'}
                    className={`segmented-btn ${tab === 'games' ? 'active' : ''}`}
                    onClick={() => setTab('games')}
                  >
                    {lang === 'fa' ? 'بازی‌ها' : 'Matches'} ({details.recent_games.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'purchases'}
                    className={`segmented-btn ${tab === 'purchases' ? 'active' : ''}`}
                    onClick={() => setTab('purchases')}
                  >
                    {lang === 'fa' ? 'خریدها' : 'Purchases'} ({details.purchases.length})
                  </button>
                  {canWriteUsers && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'edit'}
                      className={`segmented-btn ${tab === 'edit' ? 'active' : ''}`}
                      onClick={() => setTab('edit')}
                    >
                      {lang === 'fa' ? 'ویرایش' : 'Edit'}
                    </button>
                  )}
                  {canSendNotice && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'notify'}
                      className={`segmented-btn ${tab === 'notify' ? 'active' : ''}`}
                      onClick={() => setTab('notify')}
                    >
                      {lang === 'fa' ? 'ارسال پیام' : 'Notify'}
                    </button>
                  )}
                </div>

                {canWriteUsers && isLocked && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearLocks}>
                    <LockOpen size={14} className="text-amber" />
                    <span>{lang === 'fa' ? 'رفع قفل بازی' : 'Clear Lock'}</span>
                  </button>
                )}
              </div>

              {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="grid-3">
                    <div className="card card-compact">
                      <div className="text-muted" style={{ fontSize: 12 }}>{lang === 'fa' ? 'سکه' : 'Coins'}</div>
                      <div className="mono text-accent" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                        {formatNumber(user.coin, lang)}
                      </div>
                    </div>
                    <div className="card card-compact">
                      <div className="text-muted" style={{ fontSize: 12 }}>{lang === 'fa' ? 'امتیاز' : 'Score'}</div>
                      <div className="mono text-emerald" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                        {formatNumber(user.score, lang)}
                      </div>
                    </div>
                    <div className="card card-compact">
                      <div className="text-muted" style={{ fontSize: 12 }}>XP</div>
                      <div className="mono text-sapphire" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                        {formatNumber(user.xp, lang)}
                      </div>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="card card-compact" style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-muted">{lang === 'fa' ? 'شماره تماس' : 'Phone'}</span>
                        <span className="mono">{user.phone || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-muted">{lang === 'fa' ? 'تاریخ عضویت' : 'Joined'}</span>
                        <span className="mono">{formatDateTime(user.join_date, lang)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-muted">{lang === 'fa' ? 'آخرین بازی' : 'Last Active'}</span>
                        <span className="mono">{formatDateTime(user.last_time_played, lang)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span className="text-muted">{lang === 'fa' ? 'قفل بازی فعال' : 'Active Lock'}</span>
                        <span className={`mono ${isLocked ? 'text-amber' : 'text-muted'}`}>
                          {user.open_game_id || user.open_pre_game_id || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="card card-compact" style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-muted">{lang === 'fa' ? 'برد / باخت / مساوی' : 'W / L / D'}</span>
                        <span className="mono">
                          <span className="text-emerald">{details.history?.win || 0}</span> /{' '}
                          <span className="text-crimson">{details.history?.lose || 0}</span> /{' '}
                          <span>{details.history?.draw || 0}</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-muted">{lang === 'fa' ? 'وضعیت حساب' : 'Account Status'}</span>
                        <span className={`status-label ${user.is_active === false ? 'crimson' : 'emerald'}`}>
                          {user.is_active === false ? (lang === 'fa' ? 'مسدود' : 'Banned') : lang === 'fa' ? 'فعال' : 'Active'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span className="text-muted">{lang === 'fa' ? 'کلن فعلی' : 'Clan'}</span>
                        <span>{details.clan ? `${details.clan.name} [${details.clan.tag}]` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'games' && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'fa' ? 'شناسه' : 'ID'}</th>
                        <th>{lang === 'fa' ? 'بازی‌ها' : 'Games'}</th>
                        <th>{lang === 'fa' ? 'حالت' : 'Mode'}</th>
                        <th>{lang === 'fa' ? 'نتیجه' : 'Outcome'}</th>
                        <th>{lang === 'fa' ? 'تاریخ' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.recent_games.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 24 }} className="text-muted">
                            {lang === 'fa' ? 'سابقه‌ای یافت نشد.' : 'No recent matches.'}
                          </td>
                        </tr>
                      ) : (
                        details.recent_games.map((g) => (
                          <tr key={g._id}>
                            <td className="mono text-muted" style={{ fontSize: 11.5 }}>{g._id}</td>
                            <td>{(g.game_types || []).join(' · ')}</td>
                            <td>{g.game_score_type}</td>
                            <td>
                              {!g.is_finished ? (
                                <span className="tag amber">{lang === 'fa' ? 'در جریان' : 'Live'}</span>
                              ) : g.winner_id === user._id ? (
                                <span className="tag emerald">{lang === 'fa' ? 'برنده' : 'Won'}</span>
                              ) : (
                                <span className="text-muted">{lang === 'fa' ? 'پایان‌یافته' : 'Finished'}</span>
                              )}
                            </td>
                            <td className="mono text-secondary" style={{ fontSize: 12 }}>
                              {formatDateTime(g.start_date, lang)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'purchases' && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'fa' ? 'محصول' : 'SKU'}</th>
                        <th>{lang === 'fa' ? 'مارکت' : 'Store'}</th>
                        <th>{lang === 'fa' ? 'تاریخ' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.purchases.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', padding: 24 }} className="text-muted">
                            {lang === 'fa' ? 'خریدی ثبت نشده است.' : 'No purchases recorded.'}
                          </td>
                        </tr>
                      ) : (
                        details.purchases.map((p) => (
                          <tr key={p._id}>
                            <td className="mono text-accent">{p.product_id}</td>
                            <td>{p.market_type}</td>
                            <td className="mono text-secondary" style={{ fontSize: 12 }}>
                              {formatDateTime(p.date, lang)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'edit' && canWriteUsers && (
                <form onSubmit={handleSaveEdit}>
                  <div className="grid-2">
                    <div className="input-group">
                      <label htmlFor="u-edit-name" className="input-label">{lang === 'fa' ? 'نام کاربری' : 'Username'}</label>
                      <input
                        id="u-edit-name"
                        type="text"
                        className="input-field"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="u-edit-phone" className="input-label">{lang === 'fa' ? 'شماره تماس' : 'Phone'}</label>
                      <input
                        id="u-edit-phone"
                        type="text"
                        className="input-field mono"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid-3">
                    <div className="input-group">
                      <label htmlFor="u-edit-coin" className="input-label">{lang === 'fa' ? 'سکه' : 'Coins'}</label>
                      <input
                        id="u-edit-coin"
                        type="number"
                        min={0}
                        className="input-field mono"
                        value={editCoin}
                        onChange={(e) => setEditCoin(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="u-edit-score" className="input-label">{lang === 'fa' ? 'امتیاز' : 'Score'}</label>
                      <input
                        id="u-edit-score"
                        type="number"
                        min={0}
                        className="input-field mono"
                        value={editScore}
                        onChange={(e) => setEditScore(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="u-edit-xp" className="input-label">XP</label>
                      <input
                        id="u-edit-xp"
                        type="number"
                        min={0}
                        className="input-field mono"
                        value={editXp}
                        onChange={(e) => setEditXp(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={15} />
                    <span>{saving ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'ذخیره تغییرات' : 'Save Changes'}</span>
                  </button>
                </form>
              )}

              {tab === 'notify' && canSendNotice && (
                <form onSubmit={handleSendDirectNotice}>
                  <div className="input-group">
                    <label htmlFor="u-ntf-title" className="input-label">{lang === 'fa' ? 'عنوان اعلان' : 'Title'}</label>
                    <input
                      id="u-ntf-title"
                      type="text"
                      className="input-field"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="u-ntf-msg" className="input-label">{lang === 'fa' ? 'متن پیام به بازیکن' : 'Message'}</label>
                    <textarea
                      id="u-ntf-msg"
                      className="textarea-field"
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={sendingNotice}>
                    <Send size={15} />
                    <span>{sendingNotice ? (lang === 'fa' ? 'در حال ارسال...' : 'Sending...') : lang === 'fa' ? 'ارسال اعلان مستقیم' : 'Send Direct Notice'}</span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. Adjust Currency Modal
// =========================================================================

interface AdjustCurrencyModalProps {
  user: UserItem | null;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const AdjustCurrencyModal: React.FC<AdjustCurrencyModalProps> = ({
  user,
  onClose,
  onSuccess,
  onNotify,
  lang,
}) => {
  const [field, setField] = useState<'coin' | 'score' | 'xp'>('coin');
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    try {
      await ApiService.adjustCurrency(user._id, field, Number(amount), reason.trim());
      onNotify(
        lang === 'fa' ? 'تغییر موجودی با موفقیت ثبت شد.' : 'Player balance updated.',
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Coins size={17} className="text-accent" />
            <span>{lang === 'fa' ? `تغییر دارایی: ${user.username || user._id}` : `Adjust Balance: ${user.username || user._id}`}</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="adj-field" className="input-label">{lang === 'fa' ? 'نوع دارایی' : 'Currency Type'}</label>
              <select
                id="adj-field"
                className="select-field"
                value={field}
                onChange={(e) => setField(e.target.value as 'coin' | 'score' | 'xp')}
              >
                <option value="coin">{lang === 'fa' ? `سکه (فعلی: ${user.coin || 0})` : `Coins (Current: ${user.coin || 0})`}</option>
                <option value="score">{lang === 'fa' ? `امتیاز (فعلی: ${user.score || 0})` : `Score (Current: ${user.score || 0})`}</option>
                <option value="xp">{lang === 'fa' ? `XP (فعلی: ${user.xp || 0})` : `XP (Current: ${user.xp || 0})`}</option>
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="adj-amount" className="input-label">
                {lang === 'fa' ? 'مقدار تغییر (مثبت برای افزایش، منفی برای کسر)' : 'Delta Amount (+ to add, - to deduct)'}
              </label>
              <input
                id="adj-amount"
                type="number"
                className="input-field mono"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="adj-reason" className="input-label">{lang === 'fa' ? 'دلیل (ثبت در لاگ ممیزی)' : 'Reason (Audit Log)'}</label>
              <input
                id="adj-reason"
                type="text"
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً: جبران خطای سرور' : 'e.g. Support compensation'}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {lang === 'fa' ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (lang === 'fa' ? 'در حال ثبت...' : 'Applying...') : lang === 'fa' ? 'اعمال تغییر' : 'Apply Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 3. Game Details Modal
// =========================================================================

interface GameDetailsModalProps {
  gameId: string | null;
  onClose: () => void;
  lang: LangCode;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ gameId, onClose, lang }) => {
  const [data, setData] = useState<{ match: GamePlayItem; rounds: GameRoundItem[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) {
      setData(null);
      return;
    }
    setLoading(true);
    ApiService.getGameDetails(gameId)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [gameId]);

  if (!gameId) return null;

  const names = data?.match.player_names || {};

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Gamepad2 size={18} className="text-sapphire" />
            <span>{lang === 'fa' ? 'جزئیات و راندهای مسابقه' : 'Match & Round Details'}</span>
            <span className="mono text-muted" style={{ fontSize: 12 }}>({gameId})</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading || !data ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-3">
                <div className="card card-compact">
                  <div className="text-muted" style={{ fontSize: 12 }}>{lang === 'fa' ? 'حالت بازی' : 'Mode'}</div>
                  <div style={{ fontWeight: 700, marginTop: 3 }}>{data.match.game_score_type || 'Standard'}</div>
                </div>
                <div className="card card-compact">
                  <div className="text-muted" style={{ fontSize: 12 }}>{lang === 'fa' ? 'برنده نهایی' : 'Winner'}</div>
                  <div className="text-emerald" style={{ fontWeight: 700, marginTop: 3 }}>
                    {data.match.winner_id ? names[data.match.winner_id] || data.match.winner_id : '—'}
                  </div>
                </div>
                <div className="card card-compact">
                  <div className="text-muted" style={{ fontSize: 12 }}>{lang === 'fa' ? 'زمان شروع' : 'Started'}</div>
                  <div className="mono" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {formatDateTime(data.match.start_date, lang)}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{lang === 'fa' ? 'مینی‌گیم' : 'Mini-Game'}</th>
                      <th>{lang === 'fa' ? 'برنده راند' : 'Round Winner'}</th>
                      <th>{lang === 'fa' ? 'زمان' : 'Time'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rounds.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 20 }} className="text-muted">
                          {lang === 'fa' ? 'راندی ثبت نشده است.' : 'No round records available.'}
                        </td>
                      </tr>
                    ) : (
                      data.rounds.map((r, idx) => {
                        const wId = String(r.winner_user_id || r.winner_id || '');
                        return (
                          <tr key={r._id || idx}>
                            <td className="mono text-muted">{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{r.game_type}</td>
                            <td className="text-emerald">{names[wId] || wId || '—'}</td>
                            <td className="mono text-secondary" style={{ fontSize: 12 }}>
                              {formatDateTime(r.date, lang)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 4. Clan Details, Edit & Member Management Modal
// =========================================================================

interface ClanDetailsModalProps {
  clanId: string | null;
  currentAdmin: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
  onInspectUserById: (userId: string) => void;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const ClanDetailsModal: React.FC<ClanDetailsModalProps> = ({
  clanId,
  currentAdmin,
  onClose,
  onSuccess,
  onInspectUserById,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [data, setData] = useState<{ clan: ClanItem; members: ClanMemberItem[]; challenges: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'members' | 'edit'>('members');

  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLevel, setEditLevel] = useState(1);
  const [editTrophies, setEditTrophies] = useState(0);
  const [saving, setSaving] = useState(false);

  const canManageClans = hasAdminPermission(currentAdmin, 'clans:manage');

  const loadClan = async (cid: string) => {
    setLoading(true);
    try {
      const res = await ApiService.getClanDetails(cid);
      setData(res);
      setEditName(res.clan.name || '');
      setEditTag(res.clan.tag || '');
      setEditDesc(res.clan.description || '');
      setEditLevel(res.clan.level || 1);
      setEditTrophies(res.clan.trophies || 0);
    } catch (err: any) {
      onNotify(err.message, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clanId) {
      setTab('members');
      loadClan(clanId);
    } else {
      setData(null);
    }
  }, [clanId]);

  if (!clanId) return null;

  const handleSaveClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      await ApiService.updateClan(data.clan._id, {
        name: editName.trim(),
        tag: editTag.trim(),
        description: editDesc.trim(),
        level: Number(editLevel),
        trophies: Number(editTrophies),
      });
      onNotify(lang === 'fa' ? 'اطلاعات کلن با موفقیت ویرایش شد.' : 'Clan updated.', 'success');
      await loadClan(data.clan._id);
      setTab('members');
      onSuccess();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKickMember = (member: ClanMemberItem) => {
    if (!data) return;
    onConfirm({
      title: lang === 'fa' ? 'اخراج عضو از کلن' : 'Remove Clan Member',
      message:
        lang === 'fa'
          ? `آیا از اخراج «${member.username || member.user_id}» از کلن «${data.clan.name}» اطمینان دارید؟`
          : `Remove "${member.username || member.user_id}" from clan "${data.clan.name}"?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'اخراج عضو' : 'Remove Member',
      onConfirm: async () => {
        try {
          await ApiService.removeClanMember(data.clan._id, member.user_id);
          onNotify(lang === 'fa' ? 'عضو از کلن اخراج شد.' : 'Member removed from clan.', 'success');
          await loadClan(data.clan._id);
          onSuccess();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Shield size={18} className="text-accent" />
            <span>{data?.clan.name || clanId}</span>
            {data?.clan.tag && <span className="tag accent mono">[{data.clan.tag}]</span>}
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading || !data ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : (
            <>
              <div className="toolbar" style={{ marginBottom: 14 }}>
                <div className="segmented" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'members'}
                    className={`segmented-btn ${tab === 'members' ? 'active' : ''}`}
                    onClick={() => setTab('members')}
                  >
                    {lang === 'fa' ? 'اعضای کلن' : 'Members'} ({data.members.length})
                  </button>
                  {canManageClans && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'edit'}
                      className={`segmented-btn ${tab === 'edit' ? 'active' : ''}`}
                      onClick={() => setTab('edit')}
                    >
                      <Edit3 size={13} />
                      <span>{lang === 'fa' ? 'ویرایش مشخصات کلن' : 'Edit Clan'}</span>
                    </button>
                  )}
                </div>

                <div className="meta-inline">
                  <span className="mono">Lv.{data.clan.level}</span>
                  <span className="meta-sep">·</span>
                  <span className="mono text-accent">{formatNumber(data.clan.trophies, lang)} {lang === 'fa' ? 'امتیاز' : 'trophies'}</span>
                </div>
              </div>

              {tab === 'members' ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'fa' ? 'بازیکن' : 'Player'}</th>
                        <th>{lang === 'fa' ? 'نقش' : 'Role'}</th>
                        <th>{lang === 'fa' ? 'عضویت' : 'Joined'}</th>
                        {canManageClans && <th style={{ width: 70 }}>{lang === 'fa' ? 'اخراج' : 'Kick'}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.length === 0 ? (
                        <tr>
                          <td colSpan={canManageClans ? 4 : 3} style={{ textAlign: 'center', padding: 20 }} className="text-muted">
                            {lang === 'fa' ? 'عضوی ثبت نشده است.' : 'No members listed.'}
                          </td>
                        </tr>
                      ) : (
                        data.members.map((m) => (
                          <tr key={m._id || m.user_id}>
                            <td>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => {
                                  onClose();
                                  onInspectUserById(m.user_id);
                                }}
                              >
                                {m.username || m.user_id}
                              </button>
                              <div className="mono text-muted" style={{ fontSize: 11 }}>{m.user_id}</div>
                            </td>
                            <td><span className="tag">{m.role || 'member'}</span></td>
                            <td className="mono text-secondary" style={{ fontSize: 12 }}>
                              {formatDateTime(m.joined_at, lang)}
                            </td>
                            {canManageClans && (
                              <td>
                                <button
                                  type="button"
                                  className="btn-icon sm danger"
                                  onClick={() => handleKickMember(m)}
                                  title={lang === 'fa' ? 'اخراج از کلن' : 'Remove from clan'}
                                  aria-label={`Kick ${m.username || m.user_id}`}
                                >
                                  <UserMinus size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <form onSubmit={handleSaveClan}>
                  <div className="grid-2">
                    <div className="input-group">
                      <label htmlFor="c-edit-name" className="input-label">{lang === 'fa' ? 'نام کلن' : 'Clan Name'}</label>
                      <input
                        id="c-edit-name"
                        type="text"
                        className="input-field"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="c-edit-tag" className="input-label">{lang === 'fa' ? 'تگ کلن' : 'Clan Tag'}</label>
                      <input
                        id="c-edit-tag"
                        type="text"
                        className="input-field mono"
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="input-group">
                      <label htmlFor="c-edit-lvl" className="input-label">{lang === 'fa' ? 'سطح (Level)' : 'Level'}</label>
                      <input
                        id="c-edit-lvl"
                        type="number"
                        min={1}
                        className="input-field mono"
                        value={editLevel}
                        onChange={(e) => setEditLevel(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="c-edit-tr" className="input-label">{lang === 'fa' ? 'امتیاز کلن (Trophies)' : 'Trophies / Score'}</label>
                      <input
                        id="c-edit-tr"
                        type="number"
                        min={0}
                        className="input-field mono"
                        value={editTrophies}
                        onChange={(e) => setEditTrophies(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="c-edit-desc" className="input-label">{lang === 'fa' ? 'توضیحات کلن' : 'Description'}</label>
                    <textarea
                      id="c-edit-desc"
                      className="textarea-field"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={15} />
                    <span>{saving ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'ذخیره تغییرات کلن' : 'Save Clan Changes'}</span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 5. Change Password Modal
// =========================================================================

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onNotify,
  lang,
}) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ApiService.changePassword(oldPass, newPass);
      onNotify(lang === 'fa' ? 'رمز عبور شما با موفقیت تغییر کرد.' : 'Password updated.', 'success');
      setOldPass('');
      setNewPass('');
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <KeyRound size={17} className="text-accent" />
            <span>{lang === 'fa' ? 'تغییر رمز عبور' : 'Change Password'}</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="pw-old" className="input-label">{lang === 'fa' ? 'رمز عبور فعلی' : 'Current Password'}</label>
              <input
                id="pw-old"
                type="password"
                className="input-field"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                required
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="pw-new" className="input-label">{lang === 'fa' ? 'رمز عبور جدید (حداقل ۶ کاراکتر)' : 'New Password (min 6 chars)'}</label>
              <input
                id="pw-new"
                type="password"
                className="input-field"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {lang === 'fa' ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (lang === 'fa' ? 'در حال ثبت...' : 'Updating...') : lang === 'fa' ? 'ثبت رمز جدید' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 6. API Server Settings Modal
// =========================================================================

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  lang: LangCode;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  lang,
}) => {
  const [url, setUrl] = useState(ApiService.getBaseUrl());

  useEffect(() => {
    if (isOpen) setUrl(ApiService.getBaseUrl());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    ApiService.setBaseUrl(url.trim());
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Settings size={17} className="text-accent" />
            <span>{lang === 'fa' ? 'تنظیمات آدرس سرور ادمین' : 'Admin API Endpoint'}</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="api-base-url" className="input-label">
                {lang === 'fa' ? 'آدرس کامل سرور (پیش‌فرض پورت 5002)' : 'Backend Base URL (Default Port 5002)'}
              </label>
              <input
                id="api-base-url"
                type="text"
                className="input-field mono"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:5002"
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {lang === 'fa' ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary">
              {lang === 'fa' ? 'ذخیره آدرس' : 'Save Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 7. Bulk Grant Coins Modal
// =========================================================================

interface BulkCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

export const BulkCoinsModal: React.FC<BulkCoinsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onNotify,
  lang,
}) => {
  const [amount, setAmount] = useState(500);
  const [filterType, setFilterType] = useState('real');
  const [reason, setReason] = useState('هدیه مدیریت');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    try {
      const res = await ApiService.bulkDistributeCoins(Number(amount), filterType, reason.trim());
      onNotify(
        lang === 'fa'
          ? `${formatNumber(amount, lang)} سکه برای ${formatNumber(res.modified_count, lang)} بازیکن واریز شد.`
          : `Granted ${amount} coins to ${res.modified_count} players.`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Coins size={17} className="text-accent" />
            <span>{lang === 'fa' ? 'توزیع همگانی سکه' : 'Bulk Coin Distribution'}</span>
          </div>
          <button type="button" className="btn-icon sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="bulk-target" className="input-label">{lang === 'fa' ? 'جامعه هدف' : 'Target Audience'}</label>
              <select
                id="bulk-target"
                className="select-field"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="real">{lang === 'fa' ? 'فقط بازیکنان واقعی (بدون ربات)' : 'Real Players Only (No Bots)'}</option>
                <option value="active">{lang === 'fa' ? 'بازیکنان فعال (غیرمسدود)' : 'Active Non-Banned Players'}</option>
                <option value="all">{lang === 'fa' ? 'تمام رکوردهای کاربران' : 'All User Records'}</option>
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="bulk-amt" className="input-label">{lang === 'fa' ? 'تعداد سکه' : 'Coin Amount'}</label>
              <input
                id="bulk-amt"
                type="number"
                className="input-field mono"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="bulk-reason" className="input-label">{lang === 'fa' ? 'توضیح (لاگ عملیات)' : 'Audit Reason'}</label>
              <input
                id="bulk-reason"
                type="text"
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {lang === 'fa' ? 'انصراف' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (lang === 'fa' ? 'در حال واریز...' : 'Distributing...') : lang === 'fa' ? 'واریز همگانی' : 'Distribute Coins'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
