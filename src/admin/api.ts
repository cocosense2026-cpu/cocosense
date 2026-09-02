// Thin fetch wrapper for the admin console's auth endpoints
// (server/routes/admin.js). Mirrors src/owner/api.ts.

export const ADMIN_API_BASE = 'http://localhost:4000/api';
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

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(`${ADMIN_API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new AdminApiError(
      "Can't reach the CocoSense server. Make sure the backend is running (npm run server).",
      0
    );
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
};
