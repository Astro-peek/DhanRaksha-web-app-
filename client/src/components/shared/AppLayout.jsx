import React, { useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, 
  Lock, 
  Users, 
  Coins, 
  Award, 
  LogOut, 
  Menu, 
  X, 
  ShieldAlert,
  Wallet
} from 'lucide-react';
import useAppStore from '../../store/appStore';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useAppStore();

  const tabs = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Vault', path: '/vault', icon: Lock },
    { name: 'ChitFund', path: '/chitfund', icon: Users },
    { name: 'Lending', path: '/lending', icon: Coins },
    { name: 'Certificate', path: '/certificate', icon: Award },
  ];

  const getPhoneLabel = () => {
    if (!user) return 'User Account';
    return user.mobile || 'Verified Account';
  };

  const isActive = (path) => location.pathname === path;

  // Auto-close sidebar on location change for mobile/tablet
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <div className="min-h-screen flex bg-brand-bg text-brand-textPrimary font-sans">
      {/* Sidebar Navigation */}
      {/* 
        - Desktop: Fixed left sidebar (240px)
        - Tablet (768px to 1023px): Collapsible drawer using sidebarOpen
        - Mobile (< 768px): Hidden completely (uses bottom bar)
      */}
      <aside 
        className={`fixed inset-y-0 left-0 w-[240px] glass-panel border-r border-slate-200/50 shadow-premium z-30 flex-col justify-between transition-transform duration-300 md:flex
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          hidden sm:flex md:w-[240px]
        `}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="gradient-primary w-9 h-9 rounded-xl flex items-center justify-center shadow-md">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-brand-dark">SafeKosh</h1>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-brand-secondary">Secure Finance</span>
                </div>
              </div>
              {/* Close Button on Tablet */}
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Close sidebar"
                className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Links */}
            <nav className="px-4 py-6 space-y-1.5">
              {tabs.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-input transition-all duration-200 ${
                      active
                        ? 'gradient-primary text-white shadow-md'
                        : 'text-brand-textMuted hover:bg-white hover:text-brand-primary'
                    }`}
                  >
                    <Icon className={`mr-3.5 h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      active ? 'text-white' : 'text-brand-textMuted group-hover:text-brand-primary'
                    }`} />
                    {item.name}
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile Footer */}
          <div className="p-4 border-t border-slate-100 bg-white/40">
            <div className="flex items-center space-x-3 p-2.5 rounded-card bg-white border border-slate-100 shadow-soft">
              <div className="gradient-dark w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner">
                {getPhoneLabel().slice(-4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-textPrimary truncate">
                  {getPhoneLabel()}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-brand-success">
                    OTP Verified
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={logout}
              aria-label="Log out of application"
              className="w-full mt-3 flex items-center justify-center px-4 py-2.5 text-xs font-bold text-brand-error hover:bg-red-50 rounded-input transition-colors duration-200 border border-transparent hover:border-red-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col sm:pl-[240px]">
        
        {/* Top Header */}
        {/* Collapsible toggle button only visible on Tablet (768px-1023px) */}
        <header className="h-16 md:h-20 flex items-center justify-between px-6 md:px-8 border-b border-slate-200/40 bg-white/40 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle navigation menu"
              className="sm:hidden md:hidden lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Show menu button only on Tablet (768px to 1023px) */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle navigation menu"
              className="hidden sm:inline-block md:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-base md:text-lg font-bold text-brand-dark leading-tight">SafeKosh Savings Trust</h2>
              <p className="hidden md:block text-[11px] text-brand-textMuted mt-0.5">Your decentralized micro-credit portal is secured and running.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-badge text-xs font-bold shadow-soft">
              <ShieldAlert className="w-3.5 h-3.5" />
              Mainnet Active
            </div>
          </div>
        </header>

        {/* Nested Content Area */}
        <main className="flex-1 p-4 md:p-8 pb-24 sm:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (< 768px) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around py-2 sm:hidden z-40 shadow-premium">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center py-1 px-3 text-center rounded-lg transition-colors ${
                active ? 'text-brand-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5.5 h-5.5" />
              <span className="text-[10px] font-bold mt-1">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AppLayout;
