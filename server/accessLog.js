// Owner access tracking -- backs the admin console's "Recent Activity"
// page (server/routes/adminActivity.js). Two jobs:
//
//   1. logAccess(): append one row to owner_access_log whenever an owner
//      opens something in the portal or does something there.
//   2. touchSession(): keep owner_sessions.last_seen_at fresh so the admin
//      can tell who is online right now.
//
// Kept out of server/routes/owner.js so both that file and the admin
// route can share the label map and the presence thresholds.
import { db } from './db.js';
import { restampRowHash } from './hash.js';

// ---------- Presence ----------
// The portal pings every 30s while its tab is visible (see
// src/owner/hooks/useOwnerActivityTracking.ts), and every authenticated
// API call also bumps last_seen_at (throttled below). So:
//   online  = seen in the last 90s   (a missed heartbeat or two is fine)
//   away    = seen in the last 15min (tab backgrounded / idle)
//   offline = anything older, or no live session at all
export const ONLINE_WINDOW_MS = 90 * 1000;
export const AWAY_WINDOW_MS = 15 * 60 * 1000;

// Don't write to the database on every single API call -- one write per
// session per this interval is plenty for a 90s "online" window.
const TOUCH_THROTTLE_MS = 20 * 1000;

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC with no zone
// marker. Parse it explicitly as UTC (a bare new Date() would treat it as
// local time and be off by the server's UTC offset).
export function parseDbTime(value) {
  if (!value) return NaN;
  const s = String(value);
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return new Date(s).getTime();
  return new Date(s.replace(' ', 'T') + 'Z').getTime();
}

export function toIso(value) {
  const t = parseDbTime(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function presenceFor(lastSeenIso, now = Date.now()) {
  if (!lastSeenIso) return 'offline';
  const age = now - new Date(lastSeenIso).getTime();
  if (age <= ONLINE_WINDOW_MS) return 'online';
  if (age <= AWAY_WINDOW_MS) return 'away';
  return 'offline';
}

// Called from requireOwnerAuth with the session row it already fetched,
// so the throttle check costs no extra query.
export async function touchSession(session) {
  const last = parseDbTime(session.last_seen_at);
  if (Number.isFinite(last) && Date.now() - last < TOUCH_THROTTLE_MS) return;
  await db.prepare(`UPDATE owner_sessions SET last_seen_at = datetime('now') WHERE token = ?`).run(session.token);
}

// ---------- Page labels ----------
// Maps a client-reported route onto a human label. Anything not listed is
// rejected, so the endpoint can't be used to write arbitrary text into
// the admin's activity feed.
const STATIC_PAGES = {
  '/owner': 'Dashboard',
  '/owner/notifications': 'Notifications',
  '/owner/events': 'Vibration Events',
  '/owner/nodes': 'Master Node Mesh',
  '/owner/profile': 'Profile',
  '/owner/settings': 'Settings',
  '/owner/help': 'Help & Support',
};

export function describePath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  // Strip query string/hash and any trailing slash.
  let path = rawPath.split(/[?#]/)[0].replace(/\/+$/, '');
  if (path === '') path = '/owner';
  if (path.length > 200) return null;

  if (STATIC_PAGES[path]) return { path, label: STATIC_PAGES[path], detail: null };

  const piezo = path.match(/^\/owner\/events\/piezo\/([A-Za-z0-9_.-]{1,80})$/);
  if (piezo) return { path, label: 'Piezo Sensor Detail', detail: `Sensor ${piezo[1]}` };

  return null;
}

// ---------- Logging ----------
// A page that opens twice in a row (React StrictMode's double effect in
// dev, a quick refresh) shouldn't show up twice in the admin's feed.
const OPEN_DEDUPE_SECONDS = 15;
// Opens are high-volume compared to every other table here; keep three
// months, trimmed opportunistically so no scheduled job is needed.
const RETENTION_DAYS = 90;

export async function logAccess(ownerId, kind, action, { target = null, detail = null } = {}) {
  if (kind === 'open' && target) {
    const dupe = await db
      .prepare(
        `SELECT 1 AS hit FROM owner_access_log
         WHERE owner_id = ? AND kind = 'open' AND target = ?
           AND created_at >= datetime('now', ?) LIMIT 1`
      )
      .get(ownerId, target, `-${OPEN_DEDUPE_SECONDS} seconds`);
    if (dupe) return false;
  }

  const result = await db
    .prepare(`INSERT INTO owner_access_log (owner_id, kind, action, target, detail) VALUES (?, ?, ?, ?, ?)`)
    .run(ownerId, kind, action, target, detail);
  await restampRowHash(db, 'owner_access_log', 'id', result.lastInsertRowid);

  if (Math.random() < 0.02) {
    await db
      .prepare(`DELETE FROM owner_access_log WHERE created_at < datetime('now', ?)`)
      .run(`-${RETENTION_DAYS} days`);
  }
  return true;
}

// Fire-and-forget wrapper for call sites where tracking must never be
// able to fail the request the owner actually made (e.g. marking a
// notification read). Errors are logged, not thrown.
export function logAccessSafe(ownerId, kind, action, opts) {
  logAccess(ownerId, kind, action, opts).catch((err) => {
    console.error('[access-log] failed to record', action, err);
  });
}
