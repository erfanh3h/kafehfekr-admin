import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Edit,
  Trash2,
  RefreshCw,
  KeyRound,
  Shield,
  Check,
  X,
  User,
} from 'lucide-react';
import { AdminUser, AdminRole } from '../types';
import { ApiService } from '../services/api';

interface AdminsViewProps {
  currentAdmin: AdminUser | null;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'fa' | 'en';
}

export const AdminsView: React.FC<AdminsViewProps> = ({
  currentAdmin,
  onNotify,
  lang,
}) => {
  const isFa = lang === 'fa';
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [creating, setCreating] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listAdmins();
      setAdmins(res.admins);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      onNotify(isFa ? 'نام کاربری و رمز عبور الزامی است.' : 'Username and password required.', 'error');
      return;
    }
    setCreating(true);
    try {
      await ApiService.createAdmin({
        username: newUsername,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
      });
      onNotify(isFa ? `ادمین جدید (${newUsername}) در پایگاه داده ایجاد شد.` : `Admin ${newUsername} created in database.`, 'success');
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      fetchAdmins();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAdminActive = async (adm: AdminUser) => {
    if (adm._id === currentAdmin?._id) {
      onNotify(isFa ? 'نمی‌توانید وضعیت حساب کاربری خودتان را تغییر دهید.' : 'Cannot toggle your own status.', 'error');
      return;
    }
    const newStatus = !adm.is_active;
    try {
      await ApiService.updateAdmin(adm._id, { is_active: newStatus });
      onNotify(isFa ? `وضعیت حساب ${adm.username} تغییر کرد.` : `Admin status updated.`, 'success');
      setAdmins(admins.map((a) => (a._id === adm._id ? { ...a, is_active: newStatus } : a)));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteAdmin = async (adm: AdminUser) => {
    if (adm._id === currentAdmin?._id) {
      onNotify(isFa ? 'نمی‌توانید حساب کاربری خودتان را حذف کنید.' : 'Cannot delete yourself.', 'error');
      return;
    }
    if (!window.confirm(isFa ? `آیا از حذف حساب کاربری ادمین "${adm.username}" از پایگاه داده اطمینان دارید؟` : `Delete admin ${adm.username}?`)) {
      return;
    }
    try {
      await ApiService.deleteAdmin(adm._id);
      onNotify(isFa ? `ادمین ${adm.username} حذف شد.` : `Admin deleted.`, 'success');
      fetchAdmins();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
              {isFa ? 'مدیریت ادمین‌ها و سطوح دسترسی (ذخیره‌شده در دیتابیس)' : 'Database-Backed Admin Staff & RBAC'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isFa
                ? 'تمام اطلاعات حساب‌ها، نقش‌ها و مجوزها در کالکشن admins دیتابیس مونگو ذخیره می‌شوند.'
                : 'All credentials, roles, and privileges are securely persisted in MongoDB.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <UserPlus size={16} />
              <span>{isFa ? 'افزودن ادمین جدید به دیتابیس' : 'Add New Admin to Database'}</span>
            </button>
            <button className="btn btn-icon" onClick={fetchAdmins} title={isFa ? 'تازه‌سازی' : 'Refresh'}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <ShieldCheck size={18} style={{ color: 'var(--gold-primary)' }} />
            <span>{isFa ? 'فهرست مدیران سیستم' : 'Active Admin Roster'}</span>
            <span className="badge gold">{admins.length} {isFa ? 'ادمین' : 'Admins'}</span>
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{isFa ? 'نام کاربری و شناسه' : 'Username & ID'}</th>
                <th>{isFa ? 'نام کامل' : 'Full Name'}</th>
                <th>{isFa ? 'نقش کاربری' : 'Role'}</th>
                <th>{isFa ? 'وضعیت حساب' : 'Status'}</th>
                <th>{isFa ? 'تاریخ ایجاد' : 'Created At'}</th>
                <th>{isFa ? 'آخرین ورود به سیستم' : 'Last Login'}</th>
                <th style={{ textAlign: 'center' }}>{isFa ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    {isFa ? 'در حال بارگذاری لیست ادمین‌ها...' : 'Loading admins...'}
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {isFa ? 'هیچ ادمینی یافت نشد.' : 'No admins found.'}
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const isCurrent = adm._id === currentAdmin?._id;
                  return (
                    <tr key={adm._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="admin-avatar">
                            <User size={14} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>
                              @{adm.username} {isCurrent && <span className="badge gold" style={{ fontSize: '9px' }}>{isFa ? 'شما' : 'YOU'}</span>}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{adm._id}</span>
                          </div>
                        </div>
                      </td>

                      <td>{adm.full_name || '—'}</td>

                      <td>
                        <span className={`role-tag ${adm.role}`}>
                          {adm.role}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${adm.is_active !== false ? 'green' : 'red'}`}>
                          {adm.is_active !== false ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Inactive')}
                        </span>
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {adm.created_at ? new Date(adm.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {adm.last_login ? new Date(adm.last_login).toLocaleString() : (isFa ? 'هنوز وارد نشده' : 'Never')}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {!isCurrent && (
                            <>
                              <button
                                className="btn-icon"
                                style={{ width: '30px', height: '30px', color: adm.is_active !== false ? 'var(--ruby)' : 'var(--emerald)' }}
                                onClick={() => handleToggleAdminActive(adm)}
                                title={adm.is_active !== false ? (isFa ? 'غیرفعال‌سازی ادمین' : 'Deactivate') : (isFa ? 'فعال‌سازی' : 'Activate')}
                              >
                                {adm.is_active !== false ? <X size={15} /> : <Check size={15} />}
                              </button>

                              <button
                                className="btn-icon"
                                style={{ width: '30px', height: '30px', color: 'var(--ruby)' }}
                                onClick={() => handleDeleteAdmin(adm)}
                                title={isFa ? 'حذف ادمین از دیتابیس' : 'Delete Admin'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
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
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                {isFa ? 'افزودن ادمین جدید به دیتابیس' : 'Add New Admin to Database'}
              </span>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdminSubmit}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">{isFa ? 'نام کاربری ادمین (یکتا)' : 'Admin Username'}</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. erfan_admin"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">{isFa ? 'نام و نام خانوادگی' : 'Full Display Name'}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={isFa ? 'مثال: عرفان حیات‌بخش' : 'Display name'}
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">{isFa ? 'رمز عبور (حداقل ۶ کاراکتر)' : 'Password'}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input-field"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">{isFa ? 'سطح دسترسی و نقش (Role)' : 'Role'}</label>
                  <select
                    className="input-field"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  >
                    <option value="superadmin">{isFa ? 'مدیر ارشد (Super Admin) - دسترسی کامل به همه بخش‌ها' : 'Super Admin (Full Access)'}</option>
                    <option value="admin">{isFa ? 'مدیر اجرایی (Admin) - کاربران، بازی‌ها، صف و اقتصاد' : 'Admin (Users, Games, Economy)'}</option>
                    <option value="moderator">{isFa ? 'ناظر و مودراتور (Moderator) - نظارت و گزارش‌های تخلف' : 'Moderator (Reports & Bans)'}</option>
                    <option value="support">{isFa ? 'پشتیبان (Support) - مشاهده و پاسخگویی' : 'Support (Read-only)'}</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? (isFa ? 'در حال ثبت...' : 'Saving...') : (isFa ? 'ثبت ادمین در پایگاه داده' : 'Create Admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
