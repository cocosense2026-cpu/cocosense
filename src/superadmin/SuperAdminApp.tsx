import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SuperAdminAuthProvider, useSuperAdminAuth } from './context/SuperAdminAuthContext';
import { SuperAdminLoginPage } from './pages/SuperAdminLoginPage';
import { SuperAdminShell } from './components/SuperAdminShell';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { SuperAdminAdminsPage } from './pages/SuperAdminAdminsPage';
import { SuperAdminOverviewPage } from './pages/SuperAdminOverviewPage';
import { SuperAdminMasterNodesPage } from './pages/SuperAdminMasterNodesPage';
import { SuperAdminSettingsPage } from './pages/SuperAdminSettingsPage';

const SuperAdminLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
    <div className="flex items-center gap-2.5 text-[#808080] text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
      Checking session…
    </div>
  </div>
);

const RequireSuperAdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useSuperAdminAuth();
  if (status === 'loading') return <SuperAdminLoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/superadmin/login" replace />;
  return <>{children}</>;
};

// Bounces a signed-in super admin straight to the dashboard instead of
// showing the login form again -- same pattern as OwnerApp's
// RedirectIfAuthenticated.
const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useSuperAdminAuth();
  if (status === 'loading') return <SuperAdminLoadingScreen />;
  if (status === 'authenticated') return <Navigate to="/superadmin" replace />;
  return <>{children}</>;
};

const SuperAdminRoutes: React.FC = () => (
  <Routes>
    <Route
      path="login"
      element={
        <RedirectIfAuthenticated>
          <SuperAdminLoginPage />
        </RedirectIfAuthenticated>
      }
    />

    <Route
      element={
        <RequireSuperAdminAuth>
          <SuperAdminShell />
        </RequireSuperAdminAuth>
      }
    >
      <Route index element={<SuperAdminDashboardPage />} />
      <Route path="admins" element={<SuperAdminAdminsPage />} />
      <Route path="overview" element={<SuperAdminOverviewPage />} />
      <Route path="nodes" element={<SuperAdminMasterNodesPage />} />
      <Route path="settings" element={<SuperAdminSettingsPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/superadmin" replace />} />
  </Routes>
);

export const SuperAdminApp: React.FC = () => (
  <SuperAdminAuthProvider>
    <SuperAdminRoutes />
  </SuperAdminAuthProvider>
);

export default SuperAdminApp;
