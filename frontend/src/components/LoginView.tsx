import React, { useState } from 'react';
import {
  Coffee,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  Settings,
  Globe,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AdminUser, LangCode, ThemeMode } from '../types';

interface LoginViewProps {
  onLoginSuccess: (admin: AdminUser) => void;
  lang: LangCode;
  onToggleLang: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenSettings,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError(
        lang === 'fa'
          ? 'لطفاً نام کاربری و رمز عبور خود را وارد کنید.'
          : 'Please enter both username and password.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await ApiService.login(cleanUser, password);
      onLoginSuccess(res.admin);
    } catch (err: any) {
      setError(
        err.message || (lang === 'fa' ? 'ورود ناموفق بود.' : 'Authentication failed.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Coffee size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              {lang === 'fa' ? 'کنسول مدیریت کافه فکر' : 'Cafe Fekr Admin Console'}
            </h1>
            <p className="text-secondary" style={{ fontSize: 13 }}>
              {lang === 'fa'
                ? 'برای دسترسی به ابزارهای مدیریت وارد حساب پرسنلی خود شوید'
                : 'Sign in with your staff account to access game operations'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="admin-login-username" className="input-label">
              {lang === 'fa' ? 'نام کاربری' : 'Username'}
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={15}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: lang === 'fa' ? 11 : undefined,
                  left: lang === 'en' ? 11 : undefined,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="admin-login-username"
                type="text"
                className="input-field"
                style={{
                  paddingRight: lang === 'fa' ? 34 : 12,
                  paddingLeft: lang === 'en' ? 34 : 12,
                }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={lang === 'fa' ? 'مثلاً admin' : 'e.g. admin'}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 18 }}>
            <label htmlFor="admin-login-password" className="input-label">
              {lang === 'fa' ? 'رمز عبور' : 'Password'}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={15}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: lang === 'fa' ? 11 : undefined,
                  left: lang === 'en' ? 11 : undefined,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                style={{
                  paddingRight: lang === 'fa' ? 34 : 36,
                  paddingLeft: lang === 'en' ? 34 : 36,
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? lang === 'fa'
                      ? 'مخفی کردن رمز عبور'
                      : 'Hide password'
                    : lang === 'fa'
                    ? 'نمایش رمز عبور'
                    : 'Show password'
                }
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: lang === 'fa' ? 8 : undefined,
                  right: lang === 'en' ? 8 : undefined,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--crimson-bg)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: 'var(--crimson)',
                fontSize: 12.5,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: 40 }}
            disabled={loading}
          >
            {loading ? (
              <span>{lang === 'fa' ? 'در حال ورود...' : 'Signing in...'}</span>
            ) : (
              <>
                <span>{lang === 'fa' ? 'ورود به کنسول مدیریت' : 'Sign In to Console'}</span>
                {lang === 'fa' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </>
            )}
          </button>
        </form>

        <div className="login-footer-bar">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onOpenSettings}
            style={{ padding: '0 6px' }}
          >
            <Settings size={14} />
            <span className="mono" style={{ fontSize: 11.5 }}>
              {ApiService.getBaseUrl().replace(/^https?:\/\//, '')}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="btn-icon sm"
              onClick={onToggleTheme}
              aria-label={lang === 'fa' ? 'تغییر پوسته' : 'Toggle theme'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onToggleLang}
              style={{ padding: '0 8px' }}
            >
              <Globe size={14} />
              <span>{lang === 'fa' ? 'EN' : 'فا'}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
