import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ownerApi, getOwnerToken, setOwnerToken, OwnerApiError } from '../api';

interface OwnerProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone?: string;
  sector?: string;
  initials?: string;
  color?: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
}

interface OwnerAuthContextType {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  owner: OwnerProfile | null;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  refreshOwner: () => Promise<void>;
  completeForcedPasswordChange: () => void;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export const OwnerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const loadFromToken = useCallback(async () => {
    const token = getOwnerToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const res = await ownerApi.me();
      setOwner(res.owner);
      setMustChangePassword(!!res.owner.mustChangePassword);
      setStatus('authenticated');
    } catch (err) {
      setOwnerToken(null);
      setOwner(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    loadFromToken();
  }, [loadFromToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await ownerApi.login(email, password);
    setOwnerToken(res.token);
    setOwner(res.owner);
    setMustChangePassword(res.mustChangePassword);
    setStatus('authenticated');
    return { mustChangePassword: res.mustChangePassword };
  }, []);

  const logout = useCallback(async () => {
    try {
      await ownerApi.logout();
    } catch {
      // Even if the network call fails, forget the token locally.
    }
    setOwnerToken(null);
    setOwner(null);
    setMustChangePassword(false);
    setStatus('unauthenticated');
  }, []);

  const refreshOwner = useCallback(async () => {
    try {
      const res = await ownerApi.me();
      setOwner(res.owner);
    } catch (err) {
      if (err instanceof OwnerApiError && err.status === 401) {
        setOwner(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  const completeForcedPasswordChange = useCallback(() => {
    setMustChangePassword(false);
    setOwner((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  return (
    <OwnerAuthContext.Provider
      value={{ status, owner, mustChangePassword, login, logout, refreshOwner, completeForcedPasswordChange }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
};

export function useOwnerAuth(): OwnerAuthContextType {
  const ctx = useContext(OwnerAuthContext);
  if (!ctx) throw new Error('useOwnerAuth must be used within an OwnerAuthProvider');
  return ctx;
}
