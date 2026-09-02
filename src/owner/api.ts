// Thin fetch wrapper for the owner portal's endpoints (server/routes/owner.js).
// Mirrors the "try the backend, don't crash the UI if it's offline" spirit
// of src/App.tsx, but throws on failure so callers can show an inline
// error -- the owner portal has real forms with real validation states
// to drive (wrong password, expired code, etc.), unlike the admin
// console's toast-and-move-on pattern.

export const OWNER_API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + '/api';
const TOKEN_KEY = 'cocosense_owner_token';

export function getOwnerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setOwnerToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore -- private browsing / storage disabled
  }
}

export class OwnerApiError extends Error {
  status: number;
  reason?: string;
  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getOwnerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(`${OWNER_API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new OwnerApiError(
      "Can't reach the CocoSense server. Make sure the backend is running (npm run server).",
      0
    );
  }

  if (resp.status === 401) {
    setOwnerToken(null);
  }

  let body: any = null;
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await resp.json().catch(() => null);
  }

  if (!resp.ok) {
    throw new OwnerApiError(body?.error || `Request failed (${resp.status}).`, resp.status, body?.reason);
  }
  return body as T;
}

export const ownerApi = {
  login: (email: string, password: string) =>
    request<{ ok: true; token: string; mustChangePassword: boolean; owner: any }>(
      '/owner/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false
    ),
  logout: () => request('/owner/auth/logout', { method: 'POST' }),
  confirmAccount: (token: string) =>
    request<{ ok: true; ownerName: string; email: string }>(
      '/owner/auth/confirm',
      { method: 'POST', body: JSON.stringify({ token }) },
      false
    ),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/owner/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  forgotPassword: (email: string) =>
    request<{ ok: true; devCode?: string }>(
      '/owner/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
      false
    ),
  verifyResetCode: (email: string, code: string) =>
    request<{ ok: true }>(
      '/owner/auth/verify-reset-code',
      { method: 'POST', body: JSON.stringify({ email, code }) },
      false
    ),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ ok: true }>(
      '/owner/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ email, code, newPassword }) },
      false
    ),

  me: () => request<{ ok: true; owner: any }>('/owner/me'),
  updateProfile: (data: Record<string, any>) =>
    request<{ ok: true; owner: any }>('/owner/me', { method: 'PATCH', body: JSON.stringify(data) }),
  activity: () => request<any[]>('/owner/activity'),

  dashboard: () => request<any>('/owner/dashboard'),

  events: (sort: 'recent' | 'strongest') => request<any>(`/owner/events?sort=${sort}`),

  notifications: (filter: string) => request<{ notifications: any[]; activeAlertCount: number }>(
    `/owner/notifications?filter=${filter}`
  ),
  markNotificationRead: (id: string) => request(`/owner/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/owner/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => request(`/owner/notifications/${id}`, { method: 'DELETE' }),

  nodes: () => request<any[]>('/owner/nodes'),

  settings: () => request<any>('/owner/settings'),
  updateSettings: (data: Record<string, any>) =>
    request<any>('/owner/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};
