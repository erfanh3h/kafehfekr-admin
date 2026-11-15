import React from 'react';
import {
  LayoutDashboard,
  Users,
  Gamepad2,
  Sliders,
  ShoppingBag,
  ShieldAlert,
  UsersRound,
  ShieldCheck,
  Database,
  Coffee,
} from 'lucide-react';
import { AdminUser } from '../types';

export type NavTab =
  | 'dashboard'
  | 'users'
  | 'games'
  | 'config'
  | 'purchases'
  | 'clans'
  | 'reports'
  | 'admins'
  | 'system';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentAdmin: AdminUser | null;
  reportsBadge?: number;
  lang: 'fa' | 'en';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentAdmin,
  reportsBadge,
  lang,
}) => {
  const isFa = lang === 'fa';
  const isSuperAdmin = currentAdmin?.role === 'superadmin';

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: isFa ? 'نمایه کلی و آمار' : 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'users' as NavTab,
      label: isFa ? 'مدیریت کاربران' : 'Users Management',
      icon: Users,
    },
    {
      id: 'games' as NavTab,
      label: isFa ? 'بازی‌ها و مسابقات' : 'Games & Matches',
      icon: Gamepad2,
    },
    {
      id: 'config' as NavTab,
      label: isFa ? 'تنظیمات صف و سرور' : 'Queue & Config',
      icon: Sliders,
    },
    {
      id: 'purchases' as NavTab,
      label: isFa ? 'فروشگاه و پرداخت‌ها' : 'Store & Purchases',
      icon: ShoppingBag,
    },
    {
      id: 'clans' as NavTab,
      label: isFa ? 'کلن‌ها و اجتماعات' : 'Clans & Social',
      icon: UsersRound,
    },
    {
      id: 'reports' as NavTab,
      label: isFa ? 'گزارشات و تخلفات' : 'Reports & Moderation',
      icon: ShieldAlert,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'admins' as NavTab,
            label: isFa ? 'مدیران و دسترسی‌ها' : 'Admin Staff',
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      id: 'system' as NavTab,
      label: isFa ? 'پشتیبان‌گیری و لاگ‌ها' : 'Backups & Audit',
      icon: Database,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">
          <Coffee size={24} />
        </div>
        <div className="brand-info">
          <h1>{isFa ? 'کافه فکر' : 'Cafe Fekr'}</h1>
          <p>{isFa ? 'پنل مدیریت رسمی' : 'Official Admin'}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === 'reports' && reportsBadge !== undefined && reportsBadge > 0 && (
                <span
                  className="badge red"
                  style={{
                    marginRight: isFa ? 'auto' : undefined,
                    marginLeft: !isFa ? 'auto' : undefined,
                    padding: '1px 6px',
                    fontSize: '11px',
                    borderRadius: '10px',
                  }}
                >
                  {reportsBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {isFa ? 'نسخه ۲.۰.۰' : 'v2.0.0 Production'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
          Kafeh Fekr
        </span>
      </div>
    </aside>
  );
};
