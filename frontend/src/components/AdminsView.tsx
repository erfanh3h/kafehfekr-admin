import React, { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Trash2,
  RefreshCw,
  Edit3,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminRole, AdminUser, ConfirmDialogOptions, LangCode } from '../types';
import { formatDateTime } from '../utils/adminUtils';

interface AdminsViewProps {
  currentAdmin: AdminUser | null;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

const ROLE_SUMMARIES: Array<{
  role: AdminRole;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
}> = [
  {
    role: 'superadmin',
    titleFa: 'مدیر کل (Superadmin)',
    titleEn: 'Superadmin',
    descFa: 'دسترسی کامل به تمام بخش‌ها، مدیریت پرسنل ادمین و پشتیبان‌گیری',
    descEn: 'Unrestricted access to all operations, staff RBAC, and system backups',
  },
  {
    role: 'admin',
    titleFa: 'مدیر عملیات (Admin)',
    titleEn: 'Admin',
    descFa: 'بازیکنان، اقتصاد و سکه، تنظیمات سرور، کلن‌ها، اعلان‌ها و پشتیبان‌گیری',
    descEn: 'Players, economy, config/maintenance, clans, notifications, and backups',
  },
  {
    role: 'moderator',
    titleFa: 'ناظر (Moderator)',
    titleEn: 'Moderator',
    descFa: 'رسیدگی به گزارش‌ها، مسدودسازی، مدیریت بازی‌های معلق و ارسال اعلان',
    descEn: 'Moderation reports, user bans/locks, live match termination, notifications',
  },
  {
    role: 'support',
    titleFa: 'پشتیبان (Support)',
    titleEn: 'Support',
    descFa: 'دسترسی فقط‌خواندنی به داشبورد، بازیکنان، بازی‌ها، کلن‌ها و گزارش‌ها',
    descEn: 'Read-only inspection of dashboard, players, matches, clans, and reports',
  },
];

export const AdminsView: React.FC<AdminsViewProps> = ({
  currentAdmin,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [creating, setCreating] = useState(false);

  // Edit Modal
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('admin');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listAdmins();
      setAdmins(res.admins || []);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await ApiService.createAdmin({
        username: newUsername.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        role: newRole,
      });
      onNotify(lang === 'fa' ? 'ادمین جدید با موفقیت ایجاد شد.' : 'Staff account created.', 'success');
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('admin');
      fetchAdmins();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (adm: AdminUser) => {
    setEditingAdmin(adm);
    setEditFullName(adm.full_name || '');
    setEditRole(adm.role);
    setEditActive(adm.is_active);
    setEditPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSavingEdit(true);
    try {
      await ApiService.updateAdmin(editingAdmin._id, {
        full_name: editFullName.trim(),
        role: editRole,
        is_active: editActive,
        password: editPassword.trim() ? editPassword : undefined,
      });
      onNotify(lang === 'fa' ? 'اطلاعات ادمین بروزرسانی شد.' : 'Staff account updated.', 'success');
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (adm: AdminUser) => {
    onConfirm({
      title: lang === 'fa' ? 'حذف حساب ادمین' : 'Delete Staff Account',
      message:
        lang === 'fa'
          ? `آیا از حذف حساب مدیریتی «${adm.username}» اطمینان دارید؟`
          : `Permanently delete staff account "${adm.username}"?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'حذف ادمین' : 'Delete',
      onConfirm: async () => {
        try {
          await ApiService.deleteAdmin(adm._id);
          onNotify(lang === 'fa' ? 'حساب ادمین حذف شد.' : 'Staff account deleted.', 'success');
          fetchAdmins();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const roleTagTone = (role: AdminRole) => {
    if (role === 'superadmin') return 'accent';
    if (role === 'admin') return 'sapphire';
    if (role === 'moderator') return 'violet';
    return '';
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'مدیران و دسترسی‌ها (RBAC)' : 'Staff & Role Access (RBAC)'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? 'مدیریت حساب‌های پرسنلی، سطح دسترسی نقش‌ها و بازنشانی رمز عبور'
              : 'Manage staff accounts, role-based permissions, and password resets'}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} />
            <span>{lang === 'fa' ? 'افزودن مدیر جدید' : 'Add Staff Account'}</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={fetchAdmins} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{lang === 'fa' ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{lang === 'fa' ? 'نام کاربری و نام کامل' : 'Staff Member'}</th>
              <th>{lang === 'fa' ? 'نقش دسترسی' : 'Role'}</th>
              <th>{lang === 'fa' ? 'وضعیت' : 'Status'}</th>
              <th>{lang === 'fa' ? 'آخرین ورود' : 'Last Login'}</th>
              <th style={{ width: 110 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5}><div className="skeleton" style={{ height: 18 }} /></td>
                </tr>
              ))
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <UserCog size={26} />
                    <span>{lang === 'fa' ? 'مدیری ثبت نشده است.' : 'No staff accounts found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              admins.map((a) => {
                const isSelf = a._id === currentAdmin?._id;
                return (
                  <tr key={a._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {a.full_name || a.username}{' '}
                        {isSelf && <span className="tag emerald">{lang === 'fa' ? 'شما' : 'You'}</span>}
                      </div>
                      <div className="mono text-muted" style={{ fontSize: 11.5 }}>@{a.username}</div>
                    </td>
                    <td>
                      <span className={`tag ${roleTagTone(a.role)}`}>{a.role}</span>
                    </td>
                    <td>
                      <span className={`status-label ${a.is_active ? 'emerald' : 'crimson'}`}>
                        <span className={`status-dot ${a.is_active ? 'online' : 'offline'}`} />
                        {a.is_active ? (lang === 'fa' ? 'فعال' : 'Active') : lang === 'fa' ? 'غیرفعال' : 'Disabled'}
                      </span>
                    </td>
                    <td className="mono text-secondary" style={{ fontSize: 12 }}>
                      {a.last_login ? formatDateTime(a.last_login, lang) : '—'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon sm"
                          onClick={() => openEdit(a)}
                          title={lang === 'fa' ? 'ویرایش نقش و رمز عبور' : 'Edit Staff'}
                          aria-label={`Edit admin ${a.username}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            className="btn-icon sm danger"
                            onClick={() => handleDelete(a)}
                            title={lang === 'fa' ? 'حذف حساب' : 'Delete Staff'}
                            aria-label={`Delete admin ${a.username}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* RBAC Matrix Reference */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={16} className="text-accent" />
            <span>{lang === 'fa' ? 'ماتریس سطوح دسترسی نقش‌ها' : 'Role Permission Matrix'}</span>
          </div>
        </div>
        <div className="grid-2">
          {ROLE_SUMMARIES.map((item) => (
            <div
              key={item.role}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ fontSize: 13.5 }}>{lang === 'fa' ? item.titleFa : item.titleEn}</strong>
                <span className={`tag ${roleTagTone(item.role)} mono`}>{item.role}</span>
              </div>
              <p className="text-secondary" style={{ fontSize: 12.5 }}>
                {lang === 'fa' ? item.descFa : item.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Create Staff Modal */}
      {showCreate && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowCreate(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{lang === 'fa' ? 'افزودن مدیر جدید' : 'Create Staff Account'}</div>
              <button type="button" className="btn-icon sm" onClick={() => setShowCreate(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="input-group">
                  <label htmlFor="new-adm-user" className="input-label">{lang === 'fa' ? 'نام کاربری' : 'Username'}</label>
                  <input
                    id="new-adm-user"
                    type="text"
                    className="input-field"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    minLength={3}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="new-adm-name" className="input-label">{lang === 'fa' ? 'نام و نام خانوادگی' : 'Full Name'}</label>
                  <input
                    id="new-adm-name"
                    type="text"
                    className="input-field"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="new-adm-pass" className="input-label">{lang === 'fa' ? 'رمز عبور (حداقل ۶ کاراکتر)' : 'Password (min 6 chars)'}</label>
                  <input
                    id="new-adm-pass"
                    type="password"
                    className="input-field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="new-adm-role" className="input-label">{lang === 'fa' ? 'نقش دسترسی' : 'Role'}</label>
                  <select
                    id="new-adm-role"
                    className="select-field"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  >
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="support">Support</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? (lang === 'fa' ? 'در حال ایجاد...' : 'Creating...') : lang === 'fa' ? 'ایجاد حساب' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingAdmin && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setEditingAdmin(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {lang === 'fa' ? `ویرایش مدیر (@${editingAdmin.username})` : `Edit Staff (@${editingAdmin.username})`}
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setEditingAdmin(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="input-group">
                  <label htmlFor="edit-adm-name" className="input-label">{lang === 'fa' ? 'نام و نام خانوادگی' : 'Full Name'}</label>
                  <input
                    id="edit-adm-name"
                    type="text"
                    className="input-field"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="edit-adm-role" className="input-label">{lang === 'fa' ? 'نقش دسترسی' : 'Role'}</label>
                  <select
                    id="edit-adm-role"
                    className="select-field"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AdminRole)}
                  >
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="edit-adm-pass" className="input-label">
                    {lang === 'fa' ? 'بازنشانی رمز عبور (اختیاری)' : 'Reset Password (Optional)'}
                  </label>
                  <input
                    id="edit-adm-pass"
                    type="password"
                    className="input-field"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={lang === 'fa' ? 'در صورت عدم تغییر خالی بگذارید' : 'Leave blank to keep unchanged'}
                    minLength={6}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {lang === 'fa' ? 'حساب کاربری فعال باشد' : 'Account Active'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editActive}
                    className={`switch-btn ${editActive ? 'on' : ''}`}
                    onClick={() => setEditActive((v) => !v)}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAdmin(null)}>
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : lang === 'fa' ? 'ذخیره تغییرات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
