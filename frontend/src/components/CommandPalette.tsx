import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Users,
  Gamepad2,
  Shield,
  Bell,
  ShoppingBag,
  Flag,
  SlidersHorizontal,
  UserCog,
  HardDrive,
  Coins,
  Sun,
  Moon,
  ArrowUpRight,
  User,
} from 'lucide-react';
import { AdminUser, LangCode, NavTab, ThemeMode, UserItem } from '../types';
import { ApiService } from '../services/api';
import { hasAdminPermission } from '../utils/adminUtils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: AdminUser | null;
  lang: LangCode;
  theme: ThemeMode;
  onNavigate: (tab: NavTab) => void;
  onInspectUser: (user: UserItem) => void;
  onOpenBulkCoins: () => void;
  onToggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  currentAdmin,
  lang,
  theme,
  onNavigate,
  onInspectUser,
  onOpenBulkCoins,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [matchedUsers, setMatchedUsers] = useState<UserItem[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setMatchedUsers([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2 || !hasAdminPermission(currentAdmin, 'users:read')) {
      setMatchedUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await ApiService.listUsers({ page: 1, limit: 5, search: trimmed });
        setMatchedUsers(res.items || []);
      } catch {
        setMatchedUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [query, isOpen, currentAdmin]);

  if (!isOpen) return null;

  const rawNavItems: Array<{
    id: NavTab;
    labelFa: string;
    labelEn: string;
    icon: React.FC<{ size?: number; className?: string }>;
    perm?: string;
  }> = [
    { id: 'dashboard', labelFa: 'داشبورد و تحلیل', labelEn: 'Dashboard & Analytics', icon: LayoutDashboard, perm: 'dashboard:read' },
    { id: 'users', labelFa: 'مدیریت بازیکنان', labelEn: 'Players Directory', icon: Users, perm: 'users:read' },
    { id: 'games', labelFa: 'مسابقات و بازی‌ها', labelEn: 'Matches & Live Games', icon: Gamepad2, perm: 'games:read' },
    { id: 'clans', labelFa: 'کلن‌ها و اتحادها', labelEn: 'Clans & Alliances', icon: Shield, perm: 'clans:read' },
    { id: 'notifications', labelFa: 'اعلان‌های درون‌بازی', labelEn: 'In-Game Notifications', icon: Bell, perm: 'notifications:write' },
    { id: 'purchases', labelFa: 'تراکنش‌ها و فروشگاه', labelEn: 'Store Purchases', icon: ShoppingBag, perm: 'economy:read' },
    { id: 'reports', labelFa: 'گزارش‌های تخلف', labelEn: 'Moderation Reports', icon: Flag, perm: 'reports:read' },
    { id: 'config', labelFa: 'تنظیمات و صف بازی', labelEn: 'Config & Queue', icon: SlidersHorizontal, perm: 'config:read' },
    { id: 'admins', labelFa: 'مدیران و دسترسی‌ها', labelEn: 'Staff & RBAC', icon: UserCog, perm: 'admins:manage' },
    { id: 'system', labelFa: 'پشتیبان و لاگ عملیات', labelEn: 'Backups & Audit Trail', icon: HardDrive, perm: 'dashboard:read' },
  ];

  const navItems = rawNavItems.filter((i) => !i.perm || hasAdminPermission(currentAdmin, i.perm));

  const qLower = query.trim().toLowerCase();
  const filteredNav = qLower
    ? navItems.filter(
        (i) =>
          i.labelFa.toLowerCase().includes(qLower) ||
          i.labelEn.toLowerCase().includes(qLower) ||
          i.id.includes(qLower)
      )
    : navItems;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'fa' ? 'فرمان سریع' : 'Command Palette'}
      onClick={onClose}
    >
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === 'fa'
                ? 'جستجوی بخش‌ها، نام کاربری، شناسه بازیکن یا عملیات...'
                : 'Jump to section, search player username/ID, or run action...'
            }
          />
          <span className="kbd-hint">ESC</span>
        </div>

        <div className="cmd-list">
          {query.trim().length >= 2 && (
            <div>
              <div className="cmd-section-title">
                {lang === 'fa' ? 'بازیکنان یافت‌شده' : 'Matching Players'}
              </div>
              {searchingUsers ? (
                <div style={{ padding: '8px 10px', fontSize: 12.5 }} className="text-muted">
                  {lang === 'fa' ? 'در حال جستجو...' : 'Searching players...'}
                </div>
              ) : matchedUsers.length === 0 ? (
                <div style={{ padding: '6px 10px', fontSize: 12.5 }} className="text-muted">
                  {lang === 'fa' ? 'بازیکنی با این عبارت یافت نشد.' : 'No matching players.'}
                </div>
              ) : (
                matchedUsers.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    className="cmd-item"
                    onClick={() => {
                      onInspectUser(u);
                      onClose();
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <User size={15} className="text-accent" />
                      <span>
                        <strong>{u.username || '—'}</strong>
                        <span className="meta-sep" style={{ margin: '0 6px' }}>·</span>
                        <span className="mono text-muted" style={{ fontSize: 11.5 }}>{u._id}</span>
                      </span>
                    </span>
                    <span className="mono text-accent" style={{ fontSize: 12 }}>
                      {(u.coin || 0).toLocaleString()} {lang === 'fa' ? 'سکه' : 'coins'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {filteredNav.length > 0 && (
            <div>
              <div className="cmd-section-title">
                {lang === 'fa' ? 'بخش‌های پنل' : 'Navigation'}
              </div>
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="cmd-item"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Icon size={15} className="text-secondary" />
                      <span>{lang === 'fa' ? item.labelFa : item.labelEn}</span>
                    </span>
                    <ArrowUpRight size={14} className="text-muted" />
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <div className="cmd-section-title">
              {lang === 'fa' ? 'عملیات سریع' : 'Quick Actions'}
            </div>
            {hasAdminPermission(currentAdmin, 'economy:write') && (
              <button
                type="button"
                className="cmd-item"
                onClick={() => {
                  onOpenBulkCoins();
                  onClose();
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Coins size={15} className="text-accent" />
                  <span>{lang === 'fa' ? 'توزیع همگانی سکه به بازیکنان' : 'Bulk Grant Coins to Players'}</span>
                </span>
              </button>
            )}
            <button
              type="button"
              className="cmd-item"
              onClick={() => {
                onToggleTheme();
                onClose();
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {theme === 'dark' ? <Sun size={15} className="text-amber" /> : <Moon size={15} className="text-sapphire" />}
                <span>
                  {theme === 'dark'
                    ? lang === 'fa'
                      ? 'تغییر به پوسته روشن'
                      : 'Switch to Light Theme'
                    : lang === 'fa'
                    ? 'تغییر به پوسته تاریک'
                    : 'Switch to Dark Theme'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
