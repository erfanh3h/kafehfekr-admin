import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { UsersView } from './components/UsersView';
import { GamesView } from './components/GamesView';
import { ConfigView } from './components/ConfigView';
import { PurchasesView } from './components/PurchasesView';
import { ClansView } from './components/ClansView';
import { ReportsView } from './components/ReportsView';
import { AdminsView } from './components/AdminsView';
import { SystemView } from './components/SystemView';
import { LoginView } from './components/LoginView';
import {
  UserDetailsModal,
  AdjustCurrencyModal,
  GameDetailsModal,
  ClanDetailsModal,
  ChangePasswordModal,
  ApiSettingsModal,
  BulkCoinsModal,
} from './components/Modals';
import { AdminUser, DashboardStats, UserItem } from './types';
import { ApiService } from './services/api';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const App: React.FC = () => {
  const [lang, setLang] = useState<'fa' | 'en'>('fa');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [serverOnline, setServerOnline] = useState<boolean>(true);

  // Dashboard Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Modals state
  const [inspectedUser, setInspectedUser] = useState<UserItem | null>(null);
  const [currencyUser, setCurrencyUser] = useState<UserItem | null>(null);
  const [inspectedGameId, setInspectedGameId] = useState<string | null>(null);
  const [inspectedClanId, setInspectedClanId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showBulkCoinsModal, setShowBulkCoinsModal] = useState<boolean>(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Synchronize HTML direction
  useEffect(() => {
    document.body.className = lang === 'en' ? 'ltr' : '';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  }, [lang]);

  // Auth bootstrap
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
    } catch (err) {
      console.warn('Auth token check failed:', err);
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
      addToast(lang === 'fa' ? 'نشست شما منقضی شد. لطفاً دوباره وارد شوید.' : 'Session expired. Please log in again.', 'error');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await ApiService.getStats();
      setStats(data);
      setServerOnline(true);
    } catch (err: any) {
      setServerOnline(false);
      console.error('Stats error:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = () => {
    ApiService.logout();
    setIsAuthenticated(false);
    setCurrentAdmin(null);
    addToast(lang === 'fa' ? 'با موفقیت خارج شدید.' : 'Logged out successfully.', 'info');
  };

  const handleLoginSuccess = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    setIsAuthenticated(true);
    addToast(lang === 'fa' ? `خوش آمدید، ${admin.full_name || admin.username}!` : `Welcome, ${admin.username}!`, 'success');
    fetchStats();
  };

  if (authChecking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'var(--gold-primary)' }}>
        <p>{lang === 'fa' ? 'در حال بررسی احراز هویت دیتابیس...' : 'Verifying database authorization...'}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onToggleLang={() => setLang(lang === 'fa' ? 'en' : 'fa')}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        <ApiSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => {
            addToast(lang === 'fa' ? 'آدرس سرور ذخیره شد.' : 'Server URL updated.', 'success');
            checkAuth();
          }}
          lang={lang}
        />
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={16} />}
              {t.type === 'error' && <AlertCircle size={16} />}
              {t.type === 'info' && <Info size={16} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard') fetchStats();
        }}
        currentAdmin={currentAdmin}
        reportsBadge={stats?.open_reports_count}
        lang={lang}
      />

      {/* Main Workspace */}
      <div className="main-content">
        <Navbar
          currentAdmin={currentAdmin}
          serverOnline={serverOnline}
          onLogout={handleLogout}
          lang={lang}
          onToggleLang={() => setLang(lang === 'fa' ? 'en' : 'fa')}
          onOpenSettings={() => setShowSettingsModal(true)}
          onChangePassword={() => setShowPasswordModal(true)}
        />

        {/* View Routing */}
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            loading={loadingStats}
            onRefresh={fetchStats}
            onOpenBulkCoins={() => setShowBulkCoinsModal(true)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onNotify={addToast}
            lang={lang}
          />
        )}

        {activeTab === 'users' && (
          <UsersView
            onOpenDetails={(u) => setInspectedUser(u)}
            onOpenAdjustCurrency={(u) => setCurrencyUser(u)}
            onNotify={addToast}
            lang={lang}
          />
        )}

        {activeTab === 'games' && (
          <GamesView
            onOpenGameDetails={(gid) => setInspectedGameId(gid)}
            onNotify={addToast}
            lang={lang}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView onNotify={addToast} lang={lang} />
        )}

        {activeTab === 'purchases' && (
          <PurchasesView onNotify={addToast} lang={lang} />
        )}

        {activeTab === 'clans' && (
          <ClansView
            onOpenClanDetails={(cid) => setInspectedClanId(cid)}
            onNotify={addToast}
            lang={lang}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView onNotify={addToast} lang={lang} />
        )}

        {activeTab === 'admins' && (
          <AdminsView
            currentAdmin={currentAdmin}
            onNotify={addToast}
            lang={lang}
          />
        )}

        {activeTab === 'system' && (
          <SystemView onNotify={addToast} lang={lang} />
        )}
      </div>

      {/* Modals */}
      <UserDetailsModal
        user={inspectedUser}
        onClose={() => setInspectedUser(null)}
        onSuccess={() => {
          fetchStats();
          addToast(lang === 'fa' ? 'اطلاعات کاربر با موفقیت بروزرسانی شد.' : 'User updated successfully.', 'success');
        }}
        lang={lang}
      />

      <AdjustCurrencyModal
        user={currencyUser}
        onClose={() => setCurrencyUser(null)}
        onSuccess={() => {
          fetchStats();
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
        onClose={() => setInspectedClanId(null)}
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
          addToast(lang === 'fa' ? 'آدرس سرور ذخیره شد.' : 'Server URL updated.', 'success');
          fetchStats();
        }}
        lang={lang}
      />

      <BulkCoinsModal
        isOpen={showBulkCoinsModal}
        onClose={() => setShowBulkCoinsModal(false)}
        onSuccess={fetchStats}
        onNotify={addToast}
        lang={lang}
      />

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <AlertCircle size={16} />}
            {t.type === 'info' && <Info size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
