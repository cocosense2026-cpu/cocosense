// Admin console "Recent Activity" -- a live view of what every farm owner
// is doing in their portal. Every route is behind requireAdminAuth
// (unlike the older /owners, /alerts, ... read endpoints), since this
// exposes per-person behaviour.
//
//   GET /admin/activity/summary        headline numbers for the stat strip
//   GET /admin/activity/owners         one presence/summary row per owner
//   GET /admin/activity/owners/:id     one owner's summary + 7-day trend
//   GET /admin/activity/feed           merged event feed (?ownerId=, ?kind=, ?q= search)
import { Router } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from './admin.js';
import { parseDbTime, toIso, presenceFor } from '../accessLog.js';

const router = Router();

const FEED_KINDS = ['open', 'action', 'account', 'alert', 'registration'];

// SQL snippet merging every source of "something happened on an owner's
// account" into one shape: (uid, seq, owner_id, kind, action, detail, meta,
// created_at). New sources only need another UNION ALL here.
//   - owner_activity    : signed in, password changed, profile updated ...
//   - owner_access_log  : pages/items opened, actions taken in the portal
//   - alerts            : pest/impact alerts raised on the owner's hardware
//   - farm_owners       : the registration itself
const FEED_SQL = `
  SELECT 'a-' || id AS uid, id AS seq, owner_id, 'account' AS kind, action, detail, NULL AS meta, created_at
    FROM owner_activity
  UNION ALL
  SELECT 'l-' || id, id, owner_id, kind, action, detail, target, created_at
    FROM owner_access_log
  UNION ALL
  SELECT 'x-' || al.id, al.id, COALESCE(n.owner_id, t.owner_id), 'alert',
         COALESCE(al.title, 'Alert raised'), al.description, al.severity, al.created_at
    FROM alerts al
    LEFT JOIN master_nodes n ON al.node_id = n.id
    LEFT JOIN monitored_trees t ON al.tree_id = t.id
   WHERE COALESCE(n.owner_id, t.owner_id) IS NOT NULL
  UNION ALL
  SELECT 'r-' || id, 0, id, 'registration', 'Account registered', NULL, NULL, registered_at
    FROM farm_owners
   WHERE registered_at GLOB '[0-9][0-9][0-9][0-9]-*'
`;

function ownerBrief(o) {
  return {
    id: o.id,
    name: o.name,
    initials: o.initials,
    color: o.color,
    avatarUrl: o.avatar_url ?? null,
  };
}

// Builds the per-owner summary rows. `onlyId` narrows every query to a
// single owner for the detail endpoint.
async function buildOwnerSummaries(onlyId = null) {
  const where = onlyId ? 'WHERE id = ?' : '';
  const args = onlyId ? [onlyId] : [];
  const ownerRows = await db
    .prepare(
      `SELECT id, name, email, initials, color, avatar_url, status, account_confirmed, sector, registered_at
         FROM farm_owners ${where} ORDER BY name`
    )
    .all(...args);
  if (!ownerRows.length) return [];

  const [sessions, stats24, lastOpens, lastAccess, lastAccount, lastSignIns, nodeCounts] = await Promise.all([
    db.prepare(`SELECT owner_id, created_at, last_seen_at, expires_at FROM owner_sessions`).all(),
    db
      .prepare(
        `SELECT owner_id, SUM(kind = 'open') AS opens, SUM(kind = 'action') AS actions
           FROM owner_access_log WHERE created_at >= datetime('now', '-1 day') GROUP BY owner_id`
      )
      .all(),
    db
      .prepare(
        `SELECT l.owner_id, l.action, l.detail, l.created_at
           FROM owner_access_log l
           JOIN (SELECT owner_id, MAX(id) AS mid FROM owner_access_log WHERE kind = 'open' GROUP BY owner_id) m
             ON l.id = m.mid`
      )
      .all(),
    db.prepare(`SELECT owner_id, MAX(created_at) AS at FROM owner_access_log GROUP BY owner_id`).all(),
    db.prepare(`SELECT owner_id, MAX(created_at) AS at FROM owner_activity GROUP BY owner_id`).all(),
    db
      .prepare(`SELECT owner_id, MAX(created_at) AS at FROM owner_activity WHERE action = 'Signed in' GROUP BY owner_id`)
      .all(),
    db.prepare(`SELECT owner_id, COUNT(*) AS n FROM master_nodes WHERE owner_id IS NOT NULL GROUP BY owner_id`).all(),
  ]);

  const byOwner = (rows) => new Map(rows.map((r) => [r.owner_id, r]));
  const stats24By = byOwner(stats24);
  const lastOpenBy = byOwner(lastOpens);
  const lastAccessBy = byOwner(lastAccess);
  const lastAccountBy = byOwner(lastAccount);
  const lastSignInBy = byOwner(lastSignIns);
  const nodesBy = byOwner(nodeCounts);

  // Only unexpired sessions count as "signed in".
  const now = Date.now();
  const liveSessions = new Map();
  for (const s of sessions) {
    if (new Date(s.expires_at).getTime() < now) continue;
    const list = liveSessions.get(s.owner_id) || [];
    list.push(s);
    liveSessions.set(s.owner_id, list);
  }

  return ownerRows.map((o) => {
    const live = liveSessions.get(o.id) || [];
    const lastSeenMs = live.reduce(
      (max, s) => Math.max(max, parseDbTime(s.last_seen_at || s.created_at) || 0),
      0
    );
    const lastSeenAt = lastSeenMs ? new Date(lastSeenMs).toISOString() : null;
    const lastOpen = lastOpenBy.get(o.id);
    const stats = stats24By.get(o.id);

    const lastActivityMs = Math.max(
      parseDbTime(lastAccessBy.get(o.id)?.at) || 0,
      parseDbTime(lastAccountBy.get(o.id)?.at) || 0
    );

    return {
      ...ownerBrief(o),
      email: o.email,
      sector: o.sector,
      status: o.status,
      accountConfirmed: !!o.account_confirmed,
      registeredAt: toIso(o.registered_at),
      presence: presenceFor(lastSeenAt, now),
      lastSeenAt,
      activeSessions: live.length,
      lastSignInAt: toIso(lastSignInBy.get(o.id)?.at),
      lastActivityAt: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
      lastOpened: lastOpen
        ? { label: lastOpen.action.replace(/^Opened /, ''), detail: lastOpen.detail, at: toIso(lastOpen.created_at) }
        : null,
      opens24h: Number(stats?.opens ?? 0),
      actions24h: Number(stats?.actions ?? 0),
      nodesCount: Number(nodesBy.get(o.id)?.n ?? 0),
    };
  });
}

router.get('/admin/activity/owners', requireAdminAuth, async (req, res) => {
  const owners = await buildOwnerSummaries();
  // Online first, then most recently seen -- the order the admin cares about.
  const rank = { online: 0, away: 1, offline: 2 };
  owners.sort(
    (a, b) =>
      rank[a.presence] - rank[b.presence] ||
      (b.lastSeenAt || b.lastActivityAt || '').localeCompare(a.lastSeenAt || a.lastActivityAt || '') ||
      a.name.localeCompare(b.name)
  );
  res.json({ ok: true, serverTime: new Date().toISOString(), owners });
});

router.get('/admin/activity/summary', requireAdminAuth, async (req, res) => {
  const owners = await buildOwnerSummaries();
  const row = await db
    .prepare(
      `SELECT SUM(kind = 'open') AS opens, SUM(kind = 'action') AS actions
         FROM owner_access_log WHERE created_at >= datetime('now', '-1 day')`
    )
    .get();
  res.json({
    ok: true,
    totalOwners: owners.length,
    online: owners.filter((o) => o.presence === 'online').length,
    away: owners.filter((o) => o.presence === 'away').length,
    opens24h: Number(row?.opens ?? 0),
    actions24h: Number(row?.actions ?? 0),
  });
});

router.get('/admin/activity/owners/:id', requireAdminAuth, async (req, res) => {
  const [owner] = await buildOwnerSummaries(req.params.id);
  if (!owner) return res.status(404).json({ ok: false, error: 'Owner not found.' });

  const [topPages, daily] = await Promise.all([
    db
      .prepare(
        `SELECT REPLACE(action, 'Opened ', '') AS label, COUNT(*) AS n
           FROM owner_access_log
          WHERE owner_id = ? AND kind = 'open' AND created_at >= datetime('now', '-7 days')
          GROUP BY action ORDER BY n DESC LIMIT 6`
      )
      .all(req.params.id),
    db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS n
           FROM owner_access_log
          WHERE owner_id = ? AND kind = 'open' AND created_at >= datetime('now', '-6 days', 'start of day')
          GROUP BY day`
      )
      .all(req.params.id),
  ]);

  // Always return exactly 7 buckets (oldest -> today, UTC), zero-filled,
  // so the client can draw the bars without any date maths.
  const counts = new Map(daily.map((d) => [d.day, Number(d.n)]));
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    last7.push({ day, opens: counts.get(day) ?? 0 });
  }

  res.json({
    ok: true,
    owner,
    topPages: topPages.map((p) => ({ label: p.label, count: Number(p.n) })),
    last7Days: last7,
  });
});

router.get('/admin/activity/feed', requireAdminAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const ownerId = typeof req.query.ownerId === 'string' && req.query.ownerId ? req.query.ownerId : null;
  const kind = FEED_KINDS.includes(req.query.kind) ? req.query.kind : null;
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

  const conditions = [`f.owner_id IS NOT NULL`, `f.created_at >= datetime('now', '-30 days')`];
  const args = [];
  if (ownerId) {
    conditions.push('f.owner_id = ?');
    args.push(ownerId);
  }
  if (kind) {
    conditions.push('f.kind = ?');
    args.push(kind);
  }

  // Free-text search over who / what / detail. '!' is the LIKE escape so a
  // typed % or _ is matched literally instead of acting as a wildcard.
  if (search) {
    const like = `%${search.replace(/[!%_]/g, '!$&')}%`;
    conditions.push(
      `(o.name LIKE ? ESCAPE '!' OR f.owner_id LIKE ? ESCAPE '!' OR f.action LIKE ? ESCAPE '!'
        OR f.detail LIKE ? ESCAPE '!' OR f.meta LIKE ? ESCAPE '!')`
    );
    args.push(like, like, like, like, like);
  }

  const rows = await db
    .prepare(
      `SELECT f.*, o.name AS owner_name, o.initials AS owner_initials,
              o.color AS owner_color, o.avatar_url AS owner_avatar_url
         FROM (${FEED_SQL}) f
         JOIN farm_owners o ON o.id = f.owner_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.created_at DESC, f.seq DESC
        LIMIT ?`
    )
    .all(...args, limit);

  const items = rows.map((r) => ({
    id: r.uid,
    kind: r.kind,
    action: r.action,
    detail: r.detail,
    meta: r.meta,
    at: toIso(r.created_at),
    owner: {
      id: r.owner_id,
      name: r.owner_name,
      initials: r.owner_initials,
      color: r.owner_color,
      avatarUrl: r.owner_avatar_url ?? null,
    },
  }));

  res.json({ ok: true, serverTime: new Date().toISOString(), items, hasMore: rows.length === limit });
});

export default router;
