import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OwnerAuthProvider, useOwnerAuth } from './context/OwnerAuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyCodePage } from './pages/VerifyCodePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { OwnerShell } from './components/OwnerShell';
import { DashboardPage } from './pages/DashboardPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { EventsPage } from './pages/EventsPage';
import { PiezoDetailPage } from './pages/PiezoDetailPage';
import { MasterNodesPage } from './pages/MasterNodesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';

const OwnerLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
    <div className="flex items-center gap-2.5 text-[#808080] text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
      Loading your portal…
    </div>
  </div>
);

// Requires a signed-in owner who has already completed the forced
// first-login password change. Anything else bounces to the right step.
const RequireOwnerAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, mustChangePassword } = useOwnerAuth();
  if (status === 'loading') return <OwnerLoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/owner/login" replace />;
  if (mustChangePassword) return <Navigate to="/owner/change-password" replace />;
  return <>{children}</>;
};

// The forced change-password page itself: needs a signed-in owner, but
// is exactly the page must-change-password redirects TO, so it can't
// also require !mustChangePassword (that would loop).
const RequireOwnerSession: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useOwnerAuth();
  if (status === 'loading') return <OwnerLoadingScreen />;
  if (status === 'unauthenticated') return <Navigate to="/owner/login" replace />;
  return <>{children}</>;
};

// Public auth pages (login, forgot/verify/reset) should bounce a
// signed-in owner straight to their dashboard instead of showing the
// form again.
const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, mustChangePassword } = useOwnerAuth();
  if (status === 'loading') return <OwnerLoadingScreen />;
  if (status === 'authenticated') {
    return <Navigate to={mustChangePassword ? '/owner/change-password' : '/owner'} replace />;
  }
  return <>{children}</>;
};

const OwnerRoutes: React.FC = () => (
  <Routes>
    <Route
      path="login"
      element={
        <RedirectIfAuthenticated>
          <LoginPage />
        </RedirectIfAuthenticated>
      }
    />
    <Route
      path="forgot-password"
      element={
        <RedirectIfAuthenticated>
          <ForgotPasswordPage />
        </RedirectIfAuthenticated>
      }
    />
    <Route
      path="verify-code"
      element={
        <RedirectIfAuthenticated>
          <VerifyCodePage />
        </RedirectIfAuthenticated>
      }
    />
    <Route
      path="reset-password"
      element={
        <RedirectIfAuthenticated>
          <ResetPasswordPage />
        </RedirectIfAuthenticated>
      }
    />
    {/* Public -- reached by clicking the emailed confirmation link, not
        by navigating the app, so it isn't gated by auth state either
        way (an already-signed-in owner clicking an old link should
        still see the result, not get bounced to their dashboard). */}
    <Route path="confirm" element={<ConfirmPage />} />
    <Route
      path="change-password"
      element={
        <RequireOwnerSession>
          <ChangePasswordPage />
        </RequireOwnerSession>
      }
    />

    <Route
      element={
        <RequireOwnerAuth>
          <OwnerShell />
        </RequireOwnerAuth>
      }
    >
      <Route index element={<DashboardPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="events" element={<EventsPage />} />
      <Route path="events/piezo/:piezoId" element={<PiezoDetailPage />} />
      <Route path="nodes" element={<MasterNodesPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="help" element={<HelpPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/owner" replace />} />
  </Routes>
);

export const OwnerApp: React.FC = () => (
  <OwnerAuthProvider>
    <OwnerRoutes />
  </OwnerAuthProvider>
);

export default OwnerApp;
