import React from 'react';
import {
  LayoutDashboard,
  Users,
  Gamepad2,
  SlidersHorizontal,
  ShoppingBag,
  Shield,
  Flag,
  UserCog,
  HardDrive,
  Bell,
  Coffee,
  X,
} from 'lucide-react';
import { AdminUser, LangCode, NavTab } from '../types';
import { hasAdminPermission } from '../utils/adminUtils';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentAdmin: AdminUser | null;
  reportsBadge?: number;
  liveGamesBadge?: number;
  lang: LangCode;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItemDef {
  id: NavTab;
  labelFa: string;
  labelEn: string;
  icon: React.FC<{ size?: number }>;
  permission?: string;
  badge?: number;
  badgeTone?: 'crimson' | 'live';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentAdmin,
  reportsBadge,
  liveGamesBadge,
  lang,
  mobileOpen,
  onCloseMobile,
}) => {
  const groups: Array<{ titleFa: string; titleEn: string; items: NavItemDef[] }> = [
    {
      titleFa: 'نمای کلی',
      titleEn: 'Overview',
      items: [
        {
          id: 'dashboard',
          labelFa: 'داشبورد و تحلیل',
          labelEn: 'Dashboard',
          icon: LayoutDashboard,
          permission: 'dashboard:read',
        },
      ],
    },
    {
      titleFa: 'عملیات بازی',
      titleEn: 'Operations',
      items: [
        {
          id: 'users',
          labelFa: 'بازیکنان',
          labelEn: 'Players',
          icon: Users,
          permission: 'users:read',
        },
        {
          id: 'games',
          labelFa: 'مسابقات و بازی‌ها',
          labelEn: 'Matches',
          icon: Gamepad2,
          permission: 'games:read',
          badge: liveGamesBadge,
          badgeTone: 'live',
        },
        {
          id: 'clans',
          labelFa: 'کلن‌ها و اتحادها',
          labelEn: 'Clans',
          icon: Shield,
          permission: 'clans:read',
        },
        {
          id: 'purchases',
          labelFa: 'تراکنش‌ها و فروشگاه',
          labelEn: 'Purchases',
          icon: ShoppingBag,
          permission: 'economy:read',
        },
      ],
    },
    {
      titleFa: 'ارتباطات و نظارت',
      titleEn: 'Moderation',
      items: [
        {
          id: 'reports',
          labelFa: 'گزارش‌های تخلف',
          labelEn: 'Reports',
          icon: Flag,
          permission: 'reports:read',
          badge: reportsBadge,
          badgeTone: 'crimson',
        },
        {
          id: 'notifications',
          labelFa: 'اعلان‌های درون‌بازی',
          labelEn: 'Notifications',
          icon: Bell,
          permission: 'notifications:write',
        },
      ],
    },
    {
      titleFa: 'پیکربندی و سیستم',
      titleEn: 'System',
      items: [
        {
          id: 'config',
          labelFa: 'تنظیمات و صف بازی',
          labelEn: 'Config & Queue',
          icon: SlidersHorizontal,
          permission: 'config:read',
        },
        {
          id: 'admins',
          labelFa: 'مدیران و دسترسی‌ها',
          labelEn: 'Staff & RBAC',
          icon: UserCog,
          permission: 'admins:manage',
        },
        {
          id: 'system',
          labelFa: 'پشتیبان و لاگ عملیات',
          labelEn: 'Backups & Audit',
          icon: HardDrive,
          permission: 'dashboard:read',
        },
      ],
    },
  ];

  const handleSelect = (tab: NavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  const roleLabels: Record<string, { fa: string; en: string }> = {
    superadmin: { fa: 'مدیر کل', en: 'Superadmin' },
    admin: { fa: 'مدیر', en: 'Admin' },
    moderator: { fa: 'ناظر', en: 'Moderator' },
    support: { fa: 'پشتیبان', en: 'Support' },
  };

  const roleText = currentAdmin?.role
    ? roleLabels[currentAdmin.role]?.[lang] || currentAdmin.role
    : '';

  return (
    <>
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'mobile-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Primary Navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            <div className="brand-mark">
              <Coffee size={18} />
            </div>
            <div>
              <div className="brand-title">{lang === 'fa' ? 'کافه فکر' : 'Cafe Fekr'}</div>
              <div className="brand-sub">{lang === 'fa' ? 'کنسول مدیریت' : 'Admin Console'}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon sm sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label={lang === 'fa' ? 'بستن منو' : 'Close menu'}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.permission || hasAdminPermission(currentAdmin, item.permission)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.titleEn} className="nav-group">
                <div className="nav-group-label">{lang === 'fa' ? group.titleFa : group.titleEn}</div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelect(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={17} />
                      <span>{lang === 'fa' ? item.labelFa : item.labelEn}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={`nav-badge ${item.badgeTone === 'live' ? 'live' : ''}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {currentAdmin && (
          <div className="sidebar-footer">
            <div className="staff-avatar">
              {(currentAdmin.full_name || currentAdmin.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="staff-meta">
              <div className="staff-name">{currentAdmin.full_name || currentAdmin.username}</div>
              <div className="staff-role">
                {roleText} · <span className="mono">@{currentAdmin.username}</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
