import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  superAdminApi,
  getSuperAdminToken,
  setSuperAdminToken,
  SuperAdminApiError,
} from '../api';

export interface SuperAdminProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string | null;
}

// Same demo account server/seed.js provisions in the `superadmins`
// table. Used as a client-side fallback ONLY when the backend can't be
// reached at all -- mirrors the offline-demo pattern already used by
// src/admin/context/AdminAuthContext.tsx, so this login screen is never
// a dead end when previewing the frontend without `npm run server`.
const OFFLINE_DEMO_SUPERADMIN: SuperAdminProfile = {
  id: 'SA-0001',
  name: 'Root Super Admin',
  email: 'superadmin@cocosense.ph',
  role: 'Super Administrator',
};
const OFFLINE_DEMO_PASSWORD = 'super123';
const OFFLINE_TOKEN = 'offline-demo-superadmin-session';

interface SuperAdminAuthContextType {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  superadmin: SuperAdminProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-pulls the super admin's own profile from the server (e.g. after a Settings save). */
  refreshSuperAdmin: () => Promise<void>;
  /** Optimistically applies a profile PATCH response without a round trip. */
  setSuperAdminProfile: (superadmin: SuperAdminProfile) => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

export const SuperAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [superadmin, setSuperAdmin] = useState<SuperAdminProfile | null>(null);

  const loadFromToken = useCallback(async () => {
    const token = getSuperAdminToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    if (token === OFFLINE_TOKEN) {
      setSuperAdmin(OFFLINE_DEMO_SUPERADMIN);
      setStatus('authenticated');
      return;
    }
    try {
      const res = await superAdminApi.me();
      setSuperAdmin(res.superadmin);
      setStatus('authenticated');
    } catch {
      setSuperAdminToken(null);
      setSuperAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    loadFromToken();
  }, [loadFromToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await superAdminApi.login(email, password);
      setSuperAdminToken(res.token);
      setSuperAdmin(res.superadmin);
      setStatus('authenticated');
    } catch (err) {
      // Only fall back to the offline demo path when the server itself
      // is unreachable (status 0) -- a real 401 from a running backend
      // must still be treated as a rejected login.
      const unreachable = err instanceof SuperAdminApiError && err.status === 0;
      const matchesDemo =
        email.trim().toLowerCase() === OFFLINE_DEMO_SUPERADMIN.email && password === OFFLINE_DEMO_PASSWORD;
      if (unreachable && matchesDemo) {
        setSuperAdminToken(OFFLINE_TOKEN);
        setSuperAdmin(OFFLINE_DEMO_SUPERADMIN);
        setStatus('authenticated');
        return;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const token = getSuperAdminToken();
    if (token && token !== OFFLINE_TOKEN) {
      try {
        await superAdminApi.logout();
      } catch {
        // Even if the network call fails, forget the token locally.
      }
    }
    setSuperAdminToken(null);
    setSuperAdmin(null);
    setStatus('unauthenticated');
  }, []);

  const refreshSuperAdmin = useCallback(async () => {
    const token = getSuperAdminToken();
    if (!token || token === OFFLINE_TOKEN) return;
    try {
      const res = await superAdminApi.me();
      setSuperAdmin(res.superadmin);
    } catch {
      // Leave current state as-is; loadFromToken covers a genuinely
      // dead session on next mount/reload.
    }
  }, []);

  const setSuperAdminProfile = useCallback((next: SuperAdminProfile) => {
    setSuperAdmin(next);
  }, []);

  return (
    <SuperAdminAuthContext.Provider
      value={{ status, superadmin, login, logout, refreshSuperAdmin, setSuperAdminProfile }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
};

export function useSuperAdminAuth(): SuperAdminAuthContextType {
  const ctx = useContext(SuperAdminAuthContext);
  if (!ctx) throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  return ctx;
}
