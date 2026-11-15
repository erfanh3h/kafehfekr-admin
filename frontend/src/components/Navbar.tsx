import React, { useState } from 'react';
import {
  Shield,
  Wifi,
  WifiOff,
  Settings,
  LogOut,
  Globe,
  User,
  KeyRound,
} from 'lucide-react';
import { AdminUser } from '../types';
import { ApiService } from '../services/api';

interface NavbarProps {
  currentAdmin: AdminUser | null;
  serverOnline: boolean;
  onLogout: () => void;
  lang: 'fa' | 'en';
  onToggleLang: () => void;
  onOpenSettings: () => void;
  onChangePassword: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentAdmin,
  serverOnline,
  onLogout,
  lang,
  onToggleLang,
  onOpenSettings,
  onChangePassword,
}) => {
  const isFa = lang === 'fa';

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <div className={`status-pill ${serverOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span>
            {serverOnline
              ? (isFa ? 'سرور متصل' : 'Server Online')
              : (isFa ? 'سرور آفلاین' : 'Server Offline')}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {ApiService.getBaseUrl()}
        </span>
      </div>

      <div className="navbar-right">
        {/* Language switch */}
        <button
          className="btn-icon"
          onClick={onToggleLang}
          title={isFa ? 'تغییر زبان به انگلیسی' : 'Switch to Persian'}
        >
          <Globe size={18} />
        </button>

        {/* Server API URL settings */}
        <button
          className="btn-icon"
          onClick={onOpenSettings}
          title={isFa ? 'تنظیمات آدرس سرور' : 'API Server Settings'}
        >
          <Settings size={18} />
        </button>

        {/* Change password button */}
        <button
          className="btn-icon"
          onClick={onChangePassword}
          title={isFa ? 'تغییر رمز عبور' : 'Change Password'}
        >
          <KeyRound size={18} />
        </button>

        {/* Admin profile pill */}
        {currentAdmin && (
          <div className="admin-badge">
            <div className="admin-avatar">
              <User size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="admin-name">{currentAdmin.full_name || currentAdmin.username}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>@{currentAdmin.username}</span>
            </div>
            <span className={`role-tag ${currentAdmin.role}`}>
              {currentAdmin.role}
            </span>
          </div>
        )}

        {/* Logout button */}
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px' }}
          onClick={onLogout}
          title={isFa ? 'خروج از پنل' : 'Logout'}
        >
          <LogOut size={16} />
          <span>{isFa ? 'خروج' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
};
