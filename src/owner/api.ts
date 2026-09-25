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

// Requests used to be able to hang forever with no feedback if the
// backend accepted the connection but never sent a response (e.g. a
// stuck/corrupted DB query) -- the UI would just spin indefinitely with
// nothing in the console to point at. Aborting after REQUEST_TIMEOUT_MS
// turns that silent hang into a real, visible error.
const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getOwnerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${OWNER_API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OwnerApiError(
        "The server didn't respond in time. It may be stuck on a database error -- check the backend's terminal for details, then restart it.",
        0,
        'timeout'
      );
    }
    throw new OwnerApiError(
      "Can't reach the CocoSense server. Make sure the backend is running (npm run server).",
      0
    );
  } finally {
    clearTimeout(timeoutId);
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
  signup: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    // Address -- CocoSense only registers farms within Aurora province.
    // See src/owner/pages/SignupPage.tsx for the PSGC-backed cascade that
    // fills these in.
    country?: string;
    region?: string;
    province?: string;
    cityMunicipality?: string;
    barangay?: string;
    street?: string;
    address?: string;
    geoCoordinates?: string;
    // Set when the signup form was opened from a master-node QR sticker
    // (see src/superadmin/pages/SuperAdminQrCodesPage.tsx) -- links the
    // new account straight to that hardware. See ownerApi.lookupNode.
    masterNodeId?: string;
  }) =>
    request<{ ok: true; id: string; email: string; linkedNodeId: string | null }>(
      '/owner/auth/signup',
      { method: 'POST', body: JSON.stringify(data) },
      false
    ),
  // Public check for a scanned master-node QR code, used by SignupPage
  // to show "This account will be linked to Master Node MN-STOCK-0007"
  // (or a clear already-used / not-recognized message) before the form
  // is even filled in.
  lookupNode: (nodeId: string) =>
    request<{ ok: true; valid: boolean; nodeId?: string; reason?: 'not_found' | 'already_linked' }>(
      `/owner/node-lookup/${encodeURIComponent(nodeId)}`,
      { method: 'GET' },
      false
    ),
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

  piezoEvents: (piezoId: string) => request<any>(`/owner/events/piezo/${encodeURIComponent(piezoId)}`),

  notifications: (filter: string) => request<{ notifications: any[]; activeAlertCount: number }>(
    `/owner/notifications?filter=${filter}`
  ),
  markNotificationRead: (id: string) => request(`/owner/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/owner/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => request(`/owner/notifications/${id}`, { method: 'DELETE' }),

  nodes: () => request<any[]>('/owner/nodes'),
  // Adds a further master node to this (already signed-in) owner's mesh
  // by scanning its QR sticker -- see AddMasterNodeModal. masterNodeId
  // can be the raw node id or the full signup URL a QR decode returns;
  // the server pulls the id out of either.
  linkNode: (masterNodeId: string) =>
    request<{ ok: true; node: any }>('/owner/nodes/link', {
      method: 'POST',
      body: JSON.stringify({ masterNodeId }),
    }),

  settings: () => request<any>('/owner/settings'),
  updateSettings: (data: Record<string, any>) =>
    request<any>('/owner/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};
