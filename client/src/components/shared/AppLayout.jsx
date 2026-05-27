import React, { useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import useAppStore from '../../store/appStore';
import { asDisplayText } from '../../lib/utils';

const tabs = [
  { name: 'Dashboard', path: '/dashboard', icon: 'home', iconFilled: 'home' },
  { name: 'Vault',     path: '/vault',      icon: 'savings', iconFilled: 'savings' },
  { name: 'ChitFund', path: '/chitfund',    icon: 'groups', iconFilled: 'groups' },
  { name: 'Lending',  path: '/lending',     icon: 'payments', iconFilled: 'payments' },
  { name: 'Cert.',    path: '/certificate', icon: 'workspace_premium', iconFilled: 'workspace_premium' },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useAppStore();

  const getPhoneLabel = () => {
    if (!user) return 'User Account';
    return asDisplayText(user.mobile, 'Verified Account');
  };

  const isActive = (path) => location.pathname === path;

  // Auto-close sidebar on route change (mobile/tablet)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <div className="min-h-screen flex bg-background text-on-surface font-sans">

      {/* ── Sidebar (desktop always visible; tablet toggled; mobile hidden) ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-[240px] z-30 flex flex-col justify-between
          bg-surface border-r border-outline-variant/40 shadow-[4px_0_24px_rgba(0,0,0,0.04)]
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          hidden sm:flex
        `}
      >
        <div className="flex flex-col h-full">

          {/* Logo Header */}
          <div className="flex items-center justify-between px-5 h-20 border-b border-outline-variant/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-on-primary text-[22px]">account_balance_wallet</span>
              </div>
              <div>
                <h1 className="font-headline-md text-[17px] font-bold tracking-tight text-primary">SafeKosh</h1>
                <span className="text-[9px] uppercase font-bold tracking-widest text-secondary">Secure Finance</span>
              </div>
            </div>
            {/* Close on tablet */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Close sidebar"
              className="lg:hidden p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Nav Links */}
          <nav className="px-3 py-5 space-y-1 flex-1">
            {tabs.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-primary-container text-on-primary-fixed font-bold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[22px] flex-shrink-0 transition-all duration-200 ${
                      active ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'
                    }`}
                    style={{ fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Footer */}
          <div className="p-3 border-t border-outline-variant/30">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm mb-2">
              <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-fixed font-bold text-xs shadow-inner shrink-0">
                {getPhoneLabel().slice(-4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">
                  {getPhoneLabel()}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-secondary">
                    OTP Verified
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              aria-label="Log out of application"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-error hover:bg-error-container/20 rounded-xl transition-colors duration-200 border border-transparent hover:border-error-container"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Container ── */}
      <div className="flex-1 flex flex-col sm:pl-[240px]">

        {/* Top Header */}
        <header className="h-16 md:h-20 flex items-center justify-between px-5 md:px-8 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-sm sticky top-0 z-20 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            {/* Hamburger: mobile only */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle navigation menu"
              className="sm:hidden p-2 rounded-lg border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            {/* Hamburger: tablet (sm→md) */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle navigation menu"
              className="hidden sm:flex md:hidden p-2 rounded-lg border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <div>
              <h2 className="text-base md:text-lg font-bold text-on-surface leading-tight">SafeKosh Savings Trust</h2>
              <p className="hidden md:block text-[11px] text-on-surface-variant mt-0.5">Your decentralized micro-credit portal is secured and running.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-xs font-bold">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              Mainnet Active
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 pb-24 sm:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar (< 640px) ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-outline-variant/40 flex justify-around py-2 sm:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center py-1 px-2 text-center rounded-xl transition-all active:scale-90 duration-200 min-w-[52px] ${
                active
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-all ${active ? 'text-primary' : ''}`}
                style={{ fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}
              >
                {tab.icon}
              </span>
              <span className={`text-[10px] font-bold mt-0.5 ${active ? 'text-primary' : ''}`}>{tab.name}</span>
              {active && <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
            </Link>
          );
        })}
      </nav>

    </div>
  );
};

export default AppLayout;
