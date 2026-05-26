import React, { useState } from 'react';
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
  Wallet,
  PhoneCall
} from 'lucide-react';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Vault', href: '/vault', icon: Lock },
    { name: 'ChitFund', href: '/chitfund', icon: Users },
    { name: 'Lending', href: '/lending', icon: Coins },
    { name: 'Certificate', href: '/certificate', icon: Award },
  ];

  const getPhoneLabel = () => {
    if (!user) return 'User Account';
    return user.phone || user.email || 'Verified Account';
  };

  const isActive = (href) => location.pathname === href;

  return (
    <div className="min-h-screen flex bg-brand-bg text-brand-textPrimary">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 glass-panel border-r border-slate-200/50 shadow-premium z-30">
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-100">
          <div className="gradient-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-dark">SafeKosh</h1>
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand-secondary">Secure Finance</span>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
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

        {/* User Profile Card */}
        <div className="p-4 border-t border-slate-100 bg-white/40">
          <div className="flex items-center space-x-3 p-2.5 rounded-card bg-white border border-slate-100 shadow-soft">
            <div className="gradient-dark w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner">
              {getPhoneLabel().slice(-4)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-textPrimary truncate">
                {getPhoneLabel()}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-brand-success">
                  Phone OTP Active
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full mt-3 flex items-center justify-center px-4 py-2.5 text-xs font-bold text-brand-error hover:bg-red-50 rounded-input transition-colors duration-200 border border-transparent hover:border-red-100"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Top Navigation */}
      <div className="md:hidden w-full fixed top-0 left-0 h-16 glass-panel border-b border-slate-200/50 shadow-soft flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-2">
          <div className="gradient-primary w-8 h-8 rounded-lg flex items-center justify-center text-white">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-brand-dark">SafeKosh</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-input bg-white border border-slate-200 text-brand-textPrimary"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer Slide-out */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl pt-5 pb-4">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            
            <div className="flex-shrink-0 flex items-center px-4 gap-2 mb-6">
              <div className="gradient-primary w-8 h-8 rounded-lg flex items-center justify-center text-white">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold tracking-tight text-brand-dark">SafeKosh</span>
            </div>

            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-input transition-colors duration-200 ${
                      active
                        ? 'gradient-primary text-white'
                        : 'text-brand-textMuted hover:bg-slate-50 hover:text-brand-primary'
                    }`}
                  >
                    <Icon className={`mr-4 h-5 w-5 ${active ? 'text-white' : 'text-brand-textMuted'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3 p-2 bg-white rounded-card border border-slate-200/50 shadow-soft">
                <div className="gradient-dark w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {getPhoneLabel().slice(-4)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-brand-textPrimary truncate">{getPhoneLabel()}</p>
                  <p className="text-[10px] text-brand-success font-medium">OTP Verified</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full mt-3 flex items-center justify-center px-4 py-2 text-xs font-bold text-brand-error hover:bg-red-50 rounded-input border border-red-100"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64">
        {/* Desktop Header Spacer */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 border-b border-slate-200/40 bg-white/40 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">SafeKosh Dashboard</h2>
            <p className="text-xs text-brand-textMuted">Welcome back to your decentralized savings trust.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-badge text-xs font-bold shadow-soft">
              <ShieldAlert className="w-3.5 h-3.5" />
              Mainnet Active
            </div>
          </div>
        </header>

        {/* Dynamic Nested Screen Content */}
        <main className="flex-1 p-6 md:p-8 pt-20 md:pt-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
