import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { UsersView } from './components/UsersView';
import { GamesView } from './components/GamesView';
import { ConfigView } from './components/ConfigView';
import { PurchasesView } from './components/PurchasesView';
import { ClansView } from './components/ClansView';
import { ReportsView } from './components/ReportsView';
import { AdminsView } from './components/AdminsView';
import { SystemView } from './components/SystemView';
import { NotificationsView } from './components/NotificationsView';
import { QuestionsView } from './components/QuestionsView';
import { PromosView } from './components/PromosView';
import { LoginView } from './components/LoginView';
import { ConfirmModal } from './components/ConfirmModal';
import { CommandPalette } from './components/CommandPalette';
import {
  UserDetailsModal,
  AdjustCurrencyModal,
  GameDetailsModal,
  ClanDetailsModal,
  ChangePasswordModal,
  ApiSettingsModal,
  BulkCoinsModal,
} from './components/Modals';
import {
  AdminUser,
  ConfirmDialogOptions,
  DashboardStats,
  LangCode,
  NavTab,
  ThemeMode,
  UserItem,
} from './types';
import { ApiService } from './services/api';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const STORAGE_KEY_THEME = 'kafehfekr_admin_theme';

export const App: React.FC = () => {
  const [lang, setLang] = useState<LangCode>('fa');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    return saved === 'light' ? 'light' : 'dark';
  });
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [serverOnline, setServerOnline] = useState<boolean>(true);

  // Dashboard Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Modals & Overlays
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [inspectedUserTab, setInspectedUserTab] = useState<'overview' | 'games' | 'purchases' | 'edit' | 'notify'>('overview');
  const [currencyUser, setCurrencyUser] = useState<UserItem | null>(null);
  const [inspectedGameId, setInspectedGameId] = useState<string | null>(null);
  const [inspectedClanId, setInspectedClanId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showBulkCoinsModal, setShowBulkCoinsModal] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  // Refresh nonce so child views can stay fresh after modal edits
  const [refreshTick, setRefreshTick] = useState(0);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const langRef = useRef<LangCode>(lang);
  langRef.current = lang;

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Synchronize HTML direction & language
  useEffect(() => {
    document.body.className = lang === 'en' ? 'ltr' : '';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  }, [lang]);

  // Synchronize Theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  // Global Ctrl+K / Cmd+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isAuthenticated) {
          setShowCommandPalette((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthenticated]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await ApiService.getStats();
      setStats(data);
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkAuth = async () => {
    setAuthChecking(true);
    const token = ApiService.getToken();
    if (!token) {
      setIsAuthenticated(false);
      setCurrentAdmin(null);
      setAuthChecking(false);
      return;
    }

    try {
      const res = await ApiService.getMe();
      setCurrentAdmin(res.admin);
      setIsAuthenticated(true);
      setServerOnline(true);
      fetchStats();
    } catch {
      ApiService.logout();
      setIsAuthenticated(false);
      setCurrentAdmin(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setCurrentAdmin(null);
      addToast(
        langRef.current === 'fa'
          ? 'نشست شما منقضی شد. لطفاً دوباره وارد شوید.'
          : 'Session expired. Please sign in again.',
        'error'
      );
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const handleLogout = () => {
    ApiService.logout();
    setIsAuthenticated(false);
    setCurrentAdmin(null);
    setMobileMenuOpen(false);
    addToast(lang === 'fa' ? 'با موفقیت خارج شدید.' : 'Signed out successfully.', 'info');
  };

  const handleLoginSuccess = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    addToast(
      lang === 'fa' ? `خوش آمدید، ${admin.full_name || admin.username}!` : `Welcome, ${admin.username}!`,
      'success'
    );
    fetchStats();
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const toggleLang = () => setLang((prev) => (prev === 'fa' ? 'en' : 'fa'));

  if (authChecking) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas)',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}
      >
        <p>{lang === 'fa' ? 'در حال بررسی نشست مدیریت...' : 'Verifying staff session...'}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onToggleLang={toggleLang}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        <ApiSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => {
            addToast(lang === 'fa' ? 'آدرس سرور ذخیره شد.' : 'API endpoint saved.', 'success');
            checkAuth();
          }}
          lang={lang}
        />
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={16} className="text-emerald" />}
              {t.type === 'error' && <AlertCircle size={16} className="text-crimson" />}
              {t.type === 'info' && <Info size={16} className="text-accent" />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard') fetchStats();
        }}
        currentAdmin={currentAdmin}
        reportsBadge={stats?.open_reports_count}
        liveGamesBadge={stats?.matches.live}
        lang={lang}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="main-content">
        <Navbar
          activeTab={activeTab}
          serverOnline={serverOnline}
          onLogout={handleLogout}
          lang={lang}
          onToggleLang={toggleLang}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setShowSettingsModal(true)}
          onChangePassword={() => setShowPasswordModal(true)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main style={{ flex: 1 }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              loading={loadingStats}
              currentAdmin={currentAdmin}
              onRefresh={fetchStats}
              onOpenBulkCoins={() => setShowBulkCoinsModal(true)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              key={`users-${refreshTick}`}
              currentAdmin={currentAdmin}
              onOpenDetails={(u, tab = 'overview') => {
                setInspectedUserTab(tab);
                setInspectedUserId(u._id);
              }}
              onOpenAdjustCurrency={(u) => setCurrencyUser(u)}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'games' && (
            <GamesView
              currentAdmin={currentAdmin}
              onOpenGameDetails={(gid) => setInspectedGameId(gid)}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'clans' && (
            <ClansView
              key={`clans-${refreshTick}`}
              currentAdmin={currentAdmin}
              onOpenClanDetails={(cid) => setInspectedClanId(cid)}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'questions' && (
            <QuestionsView
              currentAdmin={currentAdmin}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'promos' && (
            <PromosView
              currentAdmin={currentAdmin}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchasesView
              stats={stats}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              currentAdmin={currentAdmin}
              onInspectUserById={(uid) => setInspectedUserId(uid)}
              onReportsChanged={fetchStats}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'config' && (
            <ConfigView
              currentAdmin={currentAdmin}
              onConfigChanged={fetchStats}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'admins' && (
            <AdminsView
              currentAdmin={currentAdmin}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'system' && (
            <SystemView
              currentAdmin={currentAdmin}
              onConfirm={setConfirmDialog}
              onNotify={addToast}
              lang={lang}
            />
          )}
        </main>
      </div>

      {/* Overlays & Modals */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        currentAdmin={currentAdmin}
        lang={lang}
        theme={theme}
        onNavigate={(tab) => setActiveTab(tab)}
        onInspectUser={(u) => setInspectedUserId(u._id)}
        onOpenBulkCoins={() => setShowBulkCoinsModal(true)}
        onToggleTheme={toggleTheme}
      />

      <ConfirmModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        lang={lang}
      />

      <UserDetailsModal
        userId={inspectedUserId}
        initialTab={inspectedUserTab}
        currentAdmin={currentAdmin}
        onClose={() => setInspectedUserId(null)}
        onSuccess={() => {
          fetchStats();
          setRefreshTick((t) => t + 1);
          addToast(lang === 'fa' ? 'اطلاعات بازیکن بروزرسانی شد.' : 'Player updated.', 'success');
        }}
        onNotify={addToast}
        lang={lang}
      />

      <AdjustCurrencyModal
        user={currencyUser}
        onClose={() => setCurrencyUser(null)}
        onSuccess={() => {
          fetchStats();
          setRefreshTick((t) => t + 1);
        }}
        onNotify={addToast}
        lang={lang}
      />

      <GameDetailsModal
        gameId={inspectedGameId}
        onClose={() => setInspectedGameId(null)}
        lang={lang}
      />

      <ClanDetailsModal
        clanId={inspectedClanId}
        currentAdmin={currentAdmin}
        onClose={() => setInspectedClanId(null)}
        onSuccess={() => {
          fetchStats();
          setRefreshTick((t) => t + 1);
        }}
        onInspectUserById={(uid) => setInspectedUserId(uid)}
        onConfirm={setConfirmDialog}
        onNotify={addToast}
        lang={lang}
      />

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onNotify={addToast}
        lang={lang}
      />

      <ApiSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSaved={() => {
          addToast(lang === 'fa' ? 'آدرس سرور ذخیره شد.' : 'API endpoint updated.', 'success');
          fetchStats();
        }}
        lang={lang}
      />

      <BulkCoinsModal
        isOpen={showBulkCoinsModal}
        onClose={() => setShowBulkCoinsModal(false)}
        onSuccess={() => {
          fetchStats();
          setRefreshTick((t) => t + 1);
        }}
        onNotify={addToast}
        lang={lang}
      />

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle size={16} className="text-emerald" />}
            {t.type === 'error' && <AlertCircle size={16} className="text-crimson" />}
            {t.type === 'info' && <Info size={16} className="text-accent" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
