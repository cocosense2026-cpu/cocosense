import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { adminApi, getAdminToken, setAdminToken, AdminApiError } from '../api';

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string | null;
}

// Same demo account server/seed.js provisions in the `admins` table.
// Used as a client-side fallback ONLY when the backend can't be reached
// at all (e.g. previewing the frontend without `npm run server` running)
// -- mirrors the "falls back to local simulation if the backend is
// offline" pattern already used throughout src/App.tsx, so the login
// screen is never a dead end in a demo/offline context. Whenever the
// backend IS reachable, it is always the source of truth.
const OFFLINE_DEMO_ADMIN: AdminProfile = {
  id: 'ADM-0001',
  name: 'Demo Administrator',
  email: 'admin@cocosense.ph',
  role: 'System Administrator',
};
const OFFLINE_DEMO_PASSWORD = 'admin123';
const OFFLINE_TOKEN = 'offline-demo-session';

interface AdminAuthContextType {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  admin: AdminProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-pulls the admin's own profile from the server (e.g. after a Settings save) so avatar/name changes show up in Navigation immediately. */
  refreshAdmin: () => Promise<void>;
  /** Optimistically applies a profile PATCH response without a round trip, then reconciles via refreshAdmin. */
  setAdminProfile: (admin: AdminProfile) => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  const loadFromToken = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    if (token === OFFLINE_TOKEN) {
      setAdmin(OFFLINE_DEMO_ADMIN);
      setStatus('authenticated');
      return;
    }
    try {
      const res = await adminApi.me();
      setAdmin(res.admin);
      setStatus('authenticated');
    } catch (err) {
      setAdminToken(null);
      setAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    loadFromToken();
  }, [loadFromToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await adminApi.login(email, password);
      setAdminToken(res.token);
      setAdmin(res.admin);
      setStatus('authenticated');
    } catch (err) {
      // Only fall back to the offline demo path when the server itself
      // is unreachable (status 0) -- a real 401 from a running backend
      // must still be treated as a rejected login.
      const unreachable = err instanceof AdminApiError && err.status === 0;
      const matchesDemo =
        email.trim().toLowerCase() === OFFLINE_DEMO_ADMIN.email && password === OFFLINE_DEMO_PASSWORD;
      if (unreachable && matchesDemo) {
        setAdminToken(OFFLINE_TOKEN);
        setAdmin(OFFLINE_DEMO_ADMIN);
        setStatus('authenticated');
        return;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const token = getAdminToken();
    if (token && token !== OFFLINE_TOKEN) {
      try {
        await adminApi.logout();
      } catch {
        // Even if the network call fails, forget the token locally.
      }
    }
    setAdminToken(null);
    setAdmin(null);
    setStatus('unauthenticated');
  }, []);

  // Offline-demo sessions have no server row to refetch -- just keep
  // whatever's already in state (setAdminProfile below still lets the
  // Settings page update it locally in that mode).
  const refreshAdmin = useCallback(async () => {
    const token = getAdminToken();
    if (!token || token === OFFLINE_TOKEN) return;
    try {
      const res = await adminApi.me();
      setAdmin(res.admin);
    } catch {
      // Leave current state as-is; loadFromToken's own error handling
      // covers a genuinely dead session on next mount/reload.
    }
  }, []);

  const setAdminProfile = useCallback((next: AdminProfile) => {
    setAdmin(next);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ status, admin, login, logout, refreshAdmin, setAdminProfile }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}
