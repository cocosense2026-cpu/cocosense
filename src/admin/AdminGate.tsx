import React from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { BrandLogo } from '../components/BrandLogo';

const AdminGateInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAdminAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo variant="horizontal" size="sm" animateSweep={false} />
          <span className="text-xs text-[#606060] font-mono animate-pulse">Checking session…</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <AdminLoginPage />;
  }

  return <>{children}</>;
};

// Wraps the admin console (src/App.tsx) with a login-required gate, kept
// as a thin separate module rather than modifying App.tsx's own return
// value directly. App.tsx and Navigation.tsx pull the signed-in admin
// (and a logout action) from useAdminAuth() themselves.
export const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminAuthProvider>
    <AdminGateInner>{children}</AdminGateInner>
  </AdminAuthProvider>
);
