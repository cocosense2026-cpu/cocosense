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

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
  exportBackup: () =>
    request<{ ok: true; version: string; exportedAt: string; exportedBy: string; system: string; tables: Record<string, unknown[]> }>(
      '/admin/backup/export'
    ),
  restoreBackup: (payload: string, integrityHash: string) =>
    request<{ ok: true; restoredAt: string; restoredRows: number }>('/admin/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ payload, integrityHash }),
    }),
};
