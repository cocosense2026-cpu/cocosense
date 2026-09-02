// Thin fetch wrapper for the super admin console's endpoints
// (server/routes/superadmin.js). Mirrors src/admin/api.ts and
// src/owner/api.ts.

export const SUPERADMIN_API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + '/api';
const TOKEN_KEY = 'cocosense_superadmin_token';

export function getSuperAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSuperAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore -- private browsing / storage disabled
  }
}

export class SuperAdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getSuperAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(`${SUPERADMIN_API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new SuperAdminApiError(
      "Can't reach the CocoSense server. Make sure the backend is running (npm run server).",
      0
    );
  }

  if (resp.status === 401) {
    setSuperAdminToken(null);
  }

  let body: any = null;
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await resp.json().catch(() => null);
  }

  if (!resp.ok) {
    throw new SuperAdminApiError(body?.error || `Request failed (${resp.status}).`, resp.status);
  }
  return body as T;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface OwnerRollup {
  id: string;
  name: string;
  sector: string;
  piezoHealth: string;
  status: string;
  avatarUrl?: string | null;
  color?: string | null;
  initials?: string | null;
  nodesCount: number;
  treesCount: number;
  infectedTreesCount: number;
}

export interface OverviewTotals {
  totalOwners: number;
  totalTrees: number;
  totalInfectedTrees: number;
  totalNodes: number;
  offlineOwners: number;
  totalAdmins: number;
  activeAdmins: number;
}

export interface ActivityEntry {
  id: number;
  action: string;
  detail: string | null;
  createdAt: string;
}

export const superAdminApi = {
  login: (email: string, password: string) =>
    request<{ ok: true; token: string; superadmin: any }>(
      '/superadmin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false
    ),
  logout: () => request('/superadmin/auth/logout', { method: 'POST' }),
  me: () => request<{ ok: true; superadmin: any }>('/superadmin/me'),
  updateProfile: (data: { name?: string; email?: string; avatarUrl?: string | null }) =>
    request<{ ok: true; superadmin: any }>('/superadmin/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  listAdmins: () => request<AdminAccount[]>('/superadmin/admins'),
  createAdmin: (data: { name: string; email: string; role?: string; password?: string }) =>
    request<{ ok: true; admin: AdminAccount; temporaryPassword: string }>('/superadmin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setAdminStatus: (id: string, status: 'Active' | 'Inactive') =>
    request<{ ok: true; admin: AdminAccount }>(`/superadmin/admins/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  removeAdmin: (id: string) => request<{ ok: true }>(`/superadmin/admins/${id}`, { method: 'DELETE' }),

  overview: () => request<{ ok: true; owners: OwnerRollup[]; totals: OverviewTotals }>('/superadmin/overview'),
  activity: () => request<ActivityEntry[]>('/superadmin/activity'),

  nodes: () => request<SuperAdminMasterNode[]>('/superadmin/nodes'),
};

export interface SuperAdminMasterNode {
  id: string;
  name: string;
  sector: string;
  ownerName?: string | null;
  ownerSector?: string | null;
  online: boolean;
  batteryPercent: number;
  signalRssi: string;
  note?: string;
  totalSensors: number;
  workingSensors: number;
  damagedSensors: number;
  lastPing: string;
  firmwareVersion: string;
  coordinates: [number, number];
  sensors: Array<{
    id: string;
    treeId: string;
    status: string;
    frequencyHz: number;
    voltageMv: number;
  }>;
}
