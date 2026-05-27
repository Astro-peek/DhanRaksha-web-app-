import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';

// Authentication & Wrappers
import { AuthProvider } from './components/shared/AuthProvider';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AppLayout from './components/shared/AppLayout';
import ErrorBoundary from './components/shared/ErrorBoundary';
import LoadingSpinner from './components/shared/LoadingSpinner';

// Lazy-loaded Page Screens
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vault = lazy(() => import('./pages/Vault'));
const ChitFund = lazy(() => import('./pages/ChitFund'));
const Lending = lazy(() => import('./pages/Lending'));
const Certificate = lazy(() => import('./pages/Certificate'));
const ChitGroupDetail = lazy(() => import('./pages/ChitGroupDetail'));
const Verify = lazy(() => import('./pages/Verify'));

const FullPageLoader = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg">
    <LoadingSpinner size="lg" label="SafeKosh Loading..." />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              {/* Public Path */}
              <Route path="/login" element={<Login />} />

              {/* Protected Workspace Paths */}
              <Route element={<ProtectedRoute />}>
                {/* Onboarding doesn't show default layout navbar */}
                <Route path="/onboarding" element={<Onboarding />} />

                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/vault" element={<Vault />} />
                  <Route path="/chitfund" element={<ChitFund />} />
                  <Route path="/lending" element={<Lending />} />
                  <Route path="/certificate" element={<Certificate />} />
                  <Route path="/chit/:groupId" element={<ChitGroupDetail />} />
                  
                  {/* Fallback internal paths */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>

              {/* Public Verification Path (No Auth / Layout Required) */}
              <Route path="/verify/:certRef" element={<Verify />} />
            </Routes>
          </Suspense>
          
          {/* Global Alert Systems */}
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 3500,
              style: {
                background: '#FFFFFF',
                color: '#1A202C',
                borderRadius: '12px',
                border: '1px solid rgba(2, 128, 144, 0.1)',
                boxShadow: '0 4px 20px -2px rgba(2, 128, 144, 0.08)',
                fontWeight: '600',
                fontSize: '13px'
              }
            }} 
          />
          <SonnerToaster position="bottom-right" theme="light" expand={false} richColors />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
