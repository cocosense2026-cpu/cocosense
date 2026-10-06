// Thin fetch wrapper for the admin console's auth endpoints
// (server/routes/admin.js). Mirrors src/owner/api.ts.

export const ADMIN_API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + '/api';
const TOKEN_KEY = 'cocosense_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore -- private browsing / storage disabled
  }
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// See the matching comment in src/owner/api.ts -- without this, a
// stuck backend request (e.g. a hung DB query) leaves the UI spinning
// forever with no error and nothing actionable in the console.
const REQUEST_TIMEOUT_MS = 15000;
// Backup export/restore move the whole database in one request, and on a
// serverless host the first call may also pay for a cold start -- give
// them far more room than a normal 15s API call.
const BACKUP_TIMEOUT_MS = 60000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(`${ADMIN_API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AdminApiError(
        "The server didn't respond in time. It may be stuck on a database error -- check the backend's terminal for details, then restart it.",
        0
      );
    }
    throw new AdminApiError(
      "Can't reach the CocoSense server. Make sure the backend is running (npm run server).",
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (resp.status === 401) {
    setAdminToken(null);
  }

  let body: any = null;
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await resp.json().catch(() => null);
  }

  if (!resp.ok) {
    throw new AdminApiError(body?.error || `Request failed (${resp.status}).`, resp.status);
  }
  return body as T;
}

// ---------- Recent Activity (server/routes/adminActivity.js) ----------
export type OwnerPresence = 'online' | 'away' | 'offline';
export type ActivityKind = 'open' | 'action' | 'account' | 'alert' | 'registration';

export interface ActivityOwnerBrief {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
  avatarUrl: string | null;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  action: string;
  detail: string | null;
  /** Page route for 'open' events, severity for 'alert' events. */
  meta: string | null;
  at: string;
  owner: ActivityOwnerBrief;
}

export interface OwnerActivitySummary extends ActivityOwnerBrief {
  email: string | null;
  sector: string | null;
  status: string | null;
  accountConfirmed: boolean;
  registeredAt: string | null;
  presence: OwnerPresence;
  lastSeenAt: string | null;
  activeSessions: number;
  lastSignInAt: string | null;
  lastActivityAt: string | null;
  lastOpened: { label: string; detail: string | null; at: string } | null;
  opens24h: number;
  actions24h: number;
  nodesCount: number;
}

export interface OwnerActivityDetail {
  owner: OwnerActivitySummary;
  topPages: Array<{ label: string; count: number }>;
  last7Days: Array<{ day: string; opens: number }>;
}

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ ok: true; token: string; admin: any }>(
      '/admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false
    ),
  logout: () => request('/admin/auth/logout', { method: 'POST' }),
  me: () => request<{ ok: true; admin: any }>('/admin/me'),
  updateProfile: (data: { name?: string; email?: string; avatarUrl?: string | null }) =>
    request<{ ok: true; admin: any }>('/admin/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  activityOwners: () =>
    request<{ ok: true; serverTime: string; owners: OwnerActivitySummary[] }>('/admin/activity/owners'),
  activityOwner: (ownerId: string) =>
    request<{ ok: true } & OwnerActivityDetail>(`/admin/activity/owners/${encodeURIComponent(ownerId)}`),
  activityFeed: (opts: { ownerId?: string | null; kind?: ActivityKind | null; q?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.ownerId) q.set('ownerId', opts.ownerId);
    if (opts.kind) q.set('kind', opts.kind);
    if (opts.q && opts.q.trim()) q.set('q', opts.q.trim());
    q.set('limit', String(opts.limit ?? 50));
    return request<{ ok: true; serverTime: string; items: ActivityItem[]; hasMore: boolean }>(
      `/admin/activity/feed?${q.toString()}`
    );
  },
  // Monthly Report: month-by-month vibration across every owner's hardware.
  // tz = minutes EAST of UTC so months are cut at the admin's local midnight.
  vibrationReport: () => request<any>(`/admin/reports/vibration?tz=${-new Date().getTimezoneOffset()}`),
  // One month as a CSV (Blob). A fetch with the bearer token rather than a
  // plain <a href>, so it stays behind the admin login.
  downloadVibrationReport: async (month: string): Promise<Blob> => {
    const token = getAdminToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let resp: Response;
    try {
      resp = await fetch(
        `${ADMIN_API_BASE}/admin/reports/vibration/export?month=${encodeURIComponent(month)}&tz=${-new Date().getTimezoneOffset()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AdminApiError('The download took too long. Please try again.', 0);
      }
      throw new AdminApiError("Can't reach the CocoSense server. Check your connection and try again.", 0);
    } finally {
      clearTimeout(timeoutId);
    }
    if (resp.status === 401) setAdminToken(null);
    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      throw new AdminApiError(body?.error || `Download failed (${resp.status}).`, resp.status);
    }
    return resp.blob();
  },
  exportBackup: () =>
    request<{ ok: true; version: string; exportedAt: string; exportedBy: string; system: string; tables: Record<string, unknown[]> }>(
      '/admin/backup/export',
      {},
      true,
      BACKUP_TIMEOUT_MS
    ),
  restoreBackup: (payload: string, integrityHash: string) =>
    request<{ ok: true; restoredAt: string; restoredRows: number }>('/admin/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ payload, integrityHash }),
    }, true, BACKUP_TIMEOUT_MS),
};
