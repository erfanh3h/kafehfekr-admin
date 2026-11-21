import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Settings,
  KeyRound,
  Globe,
  Search,
  Sun,
  Moon,
  Menu,
  Clock,
} from 'lucide-react';
import { LangCode, NavTab, ThemeMode } from '../types';
import { formatTehranClock } from '../utils/adminUtils';

interface NavbarProps {
  activeTab: NavTab;
  serverOnline: boolean;
  onLogout: () => void;
  lang: LangCode;
  onToggleLang: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onChangePassword: () => void;
  onOpenCommandPalette: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<NavTab, { fa: string; en: string }> = {
  dashboard: { fa: 'داشبورد و تحلیل', en: 'Dashboard & Analytics' },
  users: { fa: 'مدیریت بازیکنان', en: 'Player Management' },
  games: { fa: 'مسابقات و بازی‌ها', en: 'Matches & Live Sessions' },
  clans: { fa: 'کلن‌ها و اتحادها', en: 'Clans & Alliances' },
  notifications: { fa: 'اعلان‌های درون‌بازی', en: 'In-Game Notifications' },
  purchases: { fa: 'تراکنش‌ها و فروشگاه', en: 'Store Purchases' },
  reports: { fa: 'گزارش‌های تخلف', en: 'Moderation Reports' },
  config: { fa: 'تنظیمات و صف بازی', en: 'Config & Queue Control' },
  admins: { fa: 'مدیران و دسترسی‌ها', en: 'Staff & RBAC' },
  system: { fa: 'پشتیبان و لاگ عملیات', en: 'Backups & Audit Trail' },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  serverOnline,
  onLogout,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenSettings,
  onChangePassword,
  onOpenCommandPalette,
  onOpenMobileMenu,
}) => {
  const currentTitle = TAB_TITLES[activeTab]?.[lang] || activeTab;
  const [tehranTime, setTehranTime] = useState<string>(() => formatTehranClock(new Date(), lang));

  useEffect(() => {
    const tick = () => setTehranTime(formatTehranClock(new Date(), lang));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lang]);

  return (
    <header className="navbar">
      <div className="navbar-start">
        <button
          type="button"
          className="btn-icon mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label={lang === 'fa' ? 'باز کردن منو' : 'Open navigation'}
        >
          <Menu size={18} />
        </button>

        <div className="navbar-crumb">
          <span className="navbar-crumb-root">{lang === 'fa' ? 'کافه فکر' : 'Cafe Fekr'}</span>
          <span className="meta-sep">/</span>
          <span className="navbar-crumb-title">{currentTitle}</span>
        </div>
      </div>

      <div className="navbar-actions">
        <button
          type="button"
          className="cmd-trigger"
          onClick={onOpenCommandPalette}
          aria-label={lang === 'fa' ? 'جستجوی سریع (Ctrl+K)' : 'Quick Search (Ctrl+K)'}
        >
          <Search size={14} />
          <span className="cmd-trigger-text">
            {lang === 'fa' ? 'جستجو یا پرش سریع...' : 'Quick jump or search...'}
          </span>
          <span className="kbd-hint">Ctrl K</span>
        </button>

        <div
          className="server-indicator"
          style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
          title={lang === 'fa' ? 'ساعت رسمی به وقت تهران (UTC+03:30)' : 'Official Tehran Time (UTC+03:30)'}
        >
          <Clock size={13} style={{ color: 'var(--accent)' }} />
          <span className="server-indicator-text">
            {lang === 'fa' ? 'تهران' : 'Tehran'} {tehranTime}
          </span>
        </div>

        <div
          className="server-indicator"
          title={
            serverOnline
              ? lang === 'fa'
                ? 'اتصال سرور برقرار است'
                : 'Backend API reachable'
              : lang === 'fa'
              ? 'سرور در دسترس نیست'
              : 'Backend unreachable'
          }
        >
          <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`} />
          <span className="server-indicator-text">
            {serverOnline
              ? lang === 'fa'
                ? 'متصل'
                : 'Connected'
              : lang === 'fa'
              ? 'قطع'
              : 'Offline'}
          </span>
        </div>

        <button
          type="button"
          className="btn-icon"
          onClick={onToggleTheme}
          title={
            theme === 'dark'
              ? lang === 'fa'
                ? 'تغییر به حالت روشن'
                : 'Switch to Light Mode'
              : lang === 'fa'
              ? 'تغییر به حالت تاریک'
              : 'Switch to Dark Mode'
          }
          aria-label={lang === 'fa' ? 'تغییر پوسته' : 'Toggle theme'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          type="button"
          className="btn-icon"
          onClick={onToggleLang}
          title={lang === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
          aria-label={lang === 'fa' ? 'تغییر زبان' : 'Toggle language'}
        >
          <Globe size={16} />
        </button>

        <button
          type="button"
          className="btn-icon"
          onClick={onOpenSettings}
          title={lang === 'fa' ? 'تنظیمات آدرس سرور' : 'API Server URL'}
          aria-label={lang === 'fa' ? 'تنظیمات سرور' : 'API settings'}
        >
          <Settings size={16} />
        </button>

        <button
          type="button"
          className="btn-icon"
          onClick={onChangePassword}
          title={lang === 'fa' ? 'تغییر رمز عبور' : 'Change password'}
          aria-label={lang === 'fa' ? 'تغییر رمز عبور' : 'Change password'}
        >
          <KeyRound size={16} />
        </button>

        <button
          type="button"
          className="btn-icon danger"
          onClick={onLogout}
          title={lang === 'fa' ? 'خروج از حساب' : 'Sign out'}
          aria-label={lang === 'fa' ? 'خروج' : 'Sign out'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
