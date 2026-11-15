import React, { useState } from 'react';
import {
  Coffee,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  Server,
  Globe,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (admin: AdminUser) => void;
  lang: 'fa' | 'en';
  onToggleLang: () => void;
  onOpenSettings: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  lang,
  onToggleLang,
  onOpenSettings,
}) => {
  const isFa = lang === 'fa';
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await ApiService.login(username, password);
      onLoginSuccess(res.admin);
    } catch (err: any) {
      setError(err.message || (isFa ? 'ورود ناموفق بود.' : 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #151d2f 0%, #0a0e17 100%)',
        padding: '20px',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '440px',
          padding: '36px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
        }}
      >
        {/* Top actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button
            className="btn-icon"
            onClick={onToggleLang}
            title={isFa ? 'تغییر زبان' : 'Switch Language'}
          >
            <Globe size={16} />
          </button>

          <button
            className="btn-icon"
            onClick={onOpenSettings}
            title={isFa ? 'تنظیمات آدرس سرور' : 'API Server URL'}
          >
            <Server size={16} />
          </button>
        </div>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            className="brand-badge"
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 14px auto',
              borderRadius: '16px',
            }}
          >
            <Coffee size={34} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
            {isFa ? 'پنل مدیریت کافه فکر' : 'Cafe Fekr Admin'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--gold-primary)', marginTop: '4px', fontWeight: '500' }}>
            {isFa ? 'احراز هویت دیتابیس ادمین‌ها (Database RBAC)' : 'Database Admin Authentication'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--ruby-light)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'var(--ruby)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label className="input-label">{isFa ? 'نام کاربری ادمین' : 'Username'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                className="input-field"
                style={{ width: '100%', paddingInlineStart: '38px' }}
                placeholder={isFa ? 'مثال: admin' : 'admin'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <User
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [isFa ? 'right' : 'left']: '12px',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">{isFa ? 'رمز عبور' : 'Password'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-field"
                style={{ width: '100%', paddingInlineStart: '38px', paddingInlineEnd: '38px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [isFa ? 'right' : 'left']: '12px',
                  color: 'var(--text-dim)',
                }}
              />
              <button
                type="button"
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [isFa ? 'left' : 'right']: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px', fontSize: '14px' }}
            disabled={loading}
          >
            <LogIn size={18} />
            <span>{loading ? (isFa ? 'در حال بررسی...' : 'Authenticating...') : (isFa ? 'ورود به پنل مدیریت' : 'Sign In')}</span>
          </button>
        </form>

        {/* Default credentials hint */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
            <KeyRound size={12} style={{ display: 'inline', verticalAlign: 'middle', marginInlineEnd: '4px' }} />
            {isFa ? 'حساب کاربری پیش‌فرض دیتابیس:' : 'Default Database Superadmin:'}
          </span>
          <code>username: admin / password: admin123456</code>
        </div>
      </div>
    </div>
  );
};
