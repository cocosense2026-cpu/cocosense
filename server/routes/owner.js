import { Router } from 'express';
import { db } from '../db.js';
import { toCamel, severityForGrams, validateAvatarDataUrl, PIEZO_PINS, piezoSensorId } from '../utils.js';
import {
  verifyPassword,
  hashPassword,
  passwordStrengthError,
  generateSessionToken,
  sessionExpiryIso,
  generateResetCode,
  hashResetCode,
  verifyResetCode,
  resetCodeExpiryIso,
  hashConfirmToken,
} from '../auth.js';
import { sendMail } from '../mailer.js';

const router = Router();

async function logActivity(ownerId, action, detail) {
  await db.prepare(`INSERT INTO owner_activity (owner_id, action, detail) VALUES (?, ?, ?)`).run(
    ownerId,
    action,
    detail ?? null
  );
}

function publicOwner(row) {
  const o = toCamel(row);
  if (!o) return o;
  delete o.passwordHash;
  delete o.resetCodeHash;
  delete o.resetCodeExpires;
  delete o.confirmTokenHash;
  delete o.confirmTokenExpires;
  return o;
}

// ---------- Auth middleware ----------
// Bearer token, looked up against owner_sessions. Expired/unknown tokens
// are just treated as "signed out" -- the frontend sends them to
// /owner/login either way.
async function requireOwnerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  const session = await db.prepare(`SELECT * FROM owner_sessions WHERE token = ?`).get(token);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    if (session) await db.prepare(`DELETE FROM owner_sessions WHERE token = ?`).run(token);
    return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
  }

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE id = ?`).get(session.owner_id);
  if (!owner) return res.status(401).json({ ok: false, error: 'Account not found.' });

  req.ownerRow = owner;
  req.ownerToken = token;
  next();
}

// ========== Auth ==========

router.post('/owner/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required.' });

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE email = ?`).get(email);
  if (!owner || !verifyPassword(password, owner.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }
  if (!owner.account_confirmed) {
    return res.status(403).json({
      ok: false,
      error: 'Please confirm your email before signing in. Check your inbox for the confirmation link.',
      reason: 'unconfirmed',
    });
  }

  const token = generateSessionToken();
  await db.prepare(`INSERT INTO owner_sessions (token, owner_id, expires_at) VALUES (?, ?, ?)`).run(
    token,
    owner.id,
    sessionExpiryIso()
  );
  await logActivity(owner.id, 'Signed in', 'Logged in from the Farm Owner portal.');

  res.json({
    ok: true,
    token,
    mustChangePassword: !!owner.must_change_password,
    owner: publicOwner(owner),
  });
});

router.post('/owner/auth/logout', requireOwnerAuth, async (req, res) => {
  await db.prepare(`DELETE FROM owner_sessions WHERE token = ?`).run(req.ownerToken);
  res.json({ ok: true });
});

// Forced first-login password change AND the owner-profile "Security"
// form both land here -- both require the current password.
router.post('/owner/auth/change-password', requireOwnerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Current and new password are required.' });
  }
  if (!verifyPassword(currentPassword, req.ownerRow.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });
  }
  const strengthError = passwordStrengthError(newPassword);
  if (strengthError) return res.status(400).json({ ok: false, error: strengthError });

  await db.prepare(`UPDATE farm_owners SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(
    hashPassword(newPassword),
    req.ownerRow.id
  );
  await logActivity(req.ownerRow.id, 'Password changed', null);
  res.json({ ok: true });
});

// Landing page for the confirmation link emailed on account creation
// (and on resend-invite). No session required -- the token IS the auth
// here, same as a password-reset code. Verifying it flips
// account_confirmed to 1 so /owner/auth/login will accept this owner's
// credentials.
router.post('/owner/auth/confirm', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: 'Missing confirmation token.' });

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE confirm_token_hash = ?`).get(hashConfirmToken(token));

  if (!owner) {
    return res.status(400).json({
      ok: false,
      reason: 'invalid',
      error: 'This confirmation link is not recognized. It may have already been used or replaced by a newer invitation.',
    });
  }
  if (new Date(owner.confirm_token_expires).getTime() < Date.now()) {
    return res.status(400).json({
      ok: false,
      reason: 'expired',
      error: 'This confirmation link has expired. Ask your plantation administrator to resend the invitation.',
    });
  }

  await db.prepare(
    `UPDATE farm_owners SET account_confirmed = 1, confirm_token_hash = NULL, confirm_token_expires = NULL WHERE id = ?`
  ).run(owner.id);
  await logActivity(owner.id, 'Email confirmed', null);

  res.json({ ok: true, ownerName: owner.name, email: owner.email });
});

// Step 1: request a 6-digit code. Always responds ok (never reveals
// whether the email exists) -- same behavior as the PHP version.
router.post('/owner/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'Email is required.' });

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE email = ?`).get(email);
  if (!owner) {
    // Don't leak account existence -- just report success.
    return res.json({ ok: true });
  }

  const code = generateResetCode();
  await db.prepare(`UPDATE farm_owners SET reset_code_hash = ?, reset_code_expires = ? WHERE id = ?`).run(
    hashResetCode(code),
    resetCodeExpiryIso(),
    owner.id
  );

  const { deliveryStatus } = await sendMail({
    toName: owner.name,
    toEmail: owner.email,
    subject: 'CocoSense Password Reset Code',
    category: 'system_notice',
    body:
      `Hi ${owner.name},\n\n` +
      `Use this code to reset your CocoSense password:\n\n` +
      `  ${code}\n\n` +
      `This code expires in 10 minutes. If you didn't request this, you can ignore this email.\n\n` +
      `— CocoSense Smart Plantation Monitoring`,
  });

  // If SMTP isn't configured, surface the code directly (same "demo
  // mode" fallback the original build used) so the flow is still
  // testable without Gmail credentials set up.
  res.json({ ok: true, devCode: deliveryStatus === 'delivered' ? undefined : code });
});

router.post('/owner/auth/verify-reset-code', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ ok: false, error: 'Email and code are required.' });

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE email = ?`).get(email);
  if (
    !owner ||
    !owner.reset_code_hash ||
    !owner.reset_code_expires ||
    new Date(owner.reset_code_expires).getTime() < Date.now() ||
    !verifyResetCode(code, owner.reset_code_hash)
  ) {
    return res.status(400).json({ ok: false, error: 'That code is incorrect or has expired.' });
  }

  res.json({ ok: true });
});

router.post('/owner/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Email, code, and new password are required.' });
  }

  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE email = ?`).get(email);
  if (
    !owner ||
    !owner.reset_code_hash ||
    !owner.reset_code_expires ||
    new Date(owner.reset_code_expires).getTime() < Date.now() ||
    !verifyResetCode(code, owner.reset_code_hash)
  ) {
    return res.status(400).json({ ok: false, error: 'That code is incorrect or has expired.' });
  }

  const strengthError = passwordStrengthError(newPassword);
  if (strengthError) return res.status(400).json({ ok: false, error: strengthError });

  await db.prepare(
    `UPDATE farm_owners
     SET password_hash = ?, must_change_password = 0, reset_code_hash = NULL, reset_code_expires = NULL
     WHERE id = ?`
  ).run(hashPassword(newPassword), owner.id);
  await logActivity(owner.id, 'Password reset', 'Reset via the forgot-password flow.');

  res.json({ ok: true });
});

// ========== Profile ==========

router.get('/owner/me', requireOwnerAuth, async (req, res) => {
  res.json({ ok: true, owner: publicOwner(req.ownerRow) });
});

router.patch('/owner/me', requireOwnerAuth, async (req, res) => {
  const b = req.body || {};
  const firstName = (b.firstName ?? req.ownerRow.first_name ?? '').trim();
  const lastName = (b.lastName ?? req.ownerRow.last_name ?? '').trim();
  const middleName = b.middleName ?? req.ownerRow.middle_name ?? null;
  const email = (b.email ?? req.ownerRow.email ?? '').trim();
  const phone = b.phone ?? req.ownerRow.phone ?? null;

  if (!firstName) return res.status(400).json({ ok: false, error: 'First name is required.' });
  if (!lastName) return res.status(400).json({ ok: false, error: 'Last name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email is required.' });
  }

  const name = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  const hasAvatarField = Object.prototype.hasOwnProperty.call(b, 'avatarUrl');
  const avatarUrl = hasAvatarField ? b.avatarUrl || null : req.ownerRow.avatar_url;
  if (hasAvatarField) {
    const avatarError = validateAvatarDataUrl(avatarUrl);
    if (avatarError) return res.status(400).json({ ok: false, error: avatarError });
  }

  try {
    await db.prepare(
      `UPDATE farm_owners
       SET first_name = ?, middle_name = ?, last_name = ?, name = ?, initials = ?, email = ?, phone = ?, avatar_url = ?
       WHERE id = ?`
    ).run(firstName, middleName, lastName, name, initials, email, phone, avatarUrl, req.ownerRow.id);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'That email is already in use by another account.' });
    }
    throw err;
  }

  await logActivity(req.ownerRow.id, 'Profile updated', null);
  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE id = ?`).get(req.ownerRow.id);
  res.json({ ok: true, owner: publicOwner(owner) });
});

router.get('/owner/activity', requireOwnerAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(
    toCamel(
      await db
        .prepare(`SELECT * FROM owner_activity WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?`)
        .all(req.ownerRow.id, limit)
    )
  );
});

// ========== Dashboard ==========

router.get('/owner/dashboard', requireOwnerAuth, async (req, res) => {
  const ownerId = req.ownerRow.id;

  const totalTrees = (await db.prepare(`SELECT COUNT(*) AS n FROM monitored_trees WHERE owner_id = ?`).get(ownerId)).n;
  const healthyTrees = (await db
    .prepare(`SELECT COUNT(*) AS n FROM monitored_trees WHERE owner_id = ? AND status = 'No Pests'`)
    .get(ownerId)).n;
  const nodes = toCamel(await db.prepare(`SELECT * FROM master_nodes WHERE owner_id = ?`).all(ownerId));
  const nodesOnline = nodes.filter((n) => n.online).length;

  const topAlert = toCamel(
    await db
      .prepare(
        `SELECT a.* FROM alerts a
         LEFT JOIN master_nodes n ON a.node_id = n.id
         LEFT JOIN monitored_trees t ON a.tree_id = t.id
         WHERE (n.owner_id = ? OR t.owner_id = ?) AND a.reviewed = 0
         ORDER BY a.created_at DESC LIMIT 1`
      )
      .get(ownerId, ownerId)
  );
  const activeAlertCount = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM alerts a
       LEFT JOIN master_nodes n ON a.node_id = n.id
       LEFT JOIN monitored_trees t ON a.tree_id = t.id
       WHERE (n.owner_id = ? OR t.owner_id = ?) AND a.reviewed = 0`
    )
    .get(ownerId, ownerId)).n;

  const latestReading = toCamel(
    await db
      .prepare(
        `SELECT v.* FROM vibration_events v
         LEFT JOIN master_nodes n ON v.node_id = n.id
         WHERE n.owner_id = ?
         ORDER BY v.timestamp DESC LIMIT 1`
      )
      .get(ownerId)
  );

  const grams = latestReading?.grams ?? 0;
  const vibration = {
    grams,
    severity: latestReading ? severityForGrams(grams) : 'Normal',
    sector: latestReading?.sector ?? req.ownerRow.sector ?? 'Your Estate',
  };

  res.json({
    ownerName: req.ownerRow.name,
    sector: req.ownerRow.sector,
    totalTrees,
    healthyTrees,
    nodesOnline,
    nodesTotal: nodes.length,
    topAlert: topAlert ?? null,
    activeAlertCount,
    vibration,
  });
});

// ========== Master Node Mesh (owner-scoped, read-only) ==========
// Mirrors GET /api/nodes (server/routes/api.js) but scoped to only this
// owner's hubs, and mounted behind requireOwnerAuth. View-only -- the
// owner portal never sends reboot/power control payloads, it just
// mirrors what the Admin console's Master Node Mesh screen shows.

router.get('/owner/nodes', requireOwnerAuth, async (req, res) => {
  const nodes = toCamel(
    await db.prepare(`SELECT * FROM master_nodes WHERE owner_id = ? ORDER BY id`).all(req.ownerRow.id)
  );
  const sensorStmt = db.prepare(`SELECT * FROM piezo_sensors WHERE node_id = ?`);
  for (const node of nodes) {
    node.sensors = toCamel(await sensorStmt.all(node.id));
    node.coordinates = [node.lat, node.lng];
  }
  res.json(nodes);
});

// ========== Vibration events (owner-scoped) ==========

router.get('/owner/events', requireOwnerAuth, async (req, res) => {
  const ownerId = req.ownerRow.id;
  const sort = req.query.sort === 'strongest' ? 'strongest' : 'recent';
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const orderBy = sort === 'strongest' ? 'v.grams DESC' : 'v.timestamp DESC';

  const nodes = toCamel(
    await db.prepare(`SELECT id, name FROM master_nodes WHERE owner_id = ? ORDER BY id`).all(ownerId)
  );

  // One panel per PIEZO TRANSDUCER, not per master node -- every master
  // node always carries exactly 4 piezo_sensors, one per analog input
  // (A0-A3, "Piezo 1"-"Piezo 4" -- see PIEZO_PINS in utils.js), and
  // each one detects/reports its own vibration readings independently.
  // So an owner with 1 node gets 4 panels, an owner with 2 nodes gets
  // 8, etc. A transducer that's DAMAGED or has no piezo physically
  // wired to that pin (NOT_CONNECTED) is still shown for visibility,
  // but comes back with enabled: false so the UI can gray it out and
  // skip polling it for new readings.
  const sensorsStmt = db.prepare(
    `SELECT id, status FROM piezo_sensors WHERE node_id = ? ORDER BY id`
  );
  const recentStmt = db.prepare(
    `SELECT v.* FROM vibration_events v WHERE v.piezo_sensor_id = ? ORDER BY ${orderBy} LIMIT ?`
  );
  const sparklineStmt = db.prepare(
    `SELECT v.* FROM vibration_events v WHERE v.piezo_sensor_id = ? ORDER BY v.timestamp DESC LIMIT 8`
  );

  const panels = [];
  for (const node of nodes) {
    let sensors = toCamel(await sensorsStmt.all(node.id));
    // Defensive fallback: a node created before piezo_sensors existed
    // (or seeded directly) may not have its 4 transducer rows yet --
    // still render 4 slots, matching the real A0-A3 wiring (A3 unwired
    // by default), so the panel count/layout stays consistent instead
    // of silently collapsing to zero panels for that node.
    if (sensors.length === 0) {
      sensors = PIEZO_PINS.map((pin) => ({
        id: piezoSensorId(node.id, pin),
        status: pin === 'A3' ? 'NOT_CONNECTED' : 'OPTIMAL',
      }));
    }

    for (const sensor of sensors) {
      const pin = sensor.id.split('-').pop(); // e.g. "MN-COCO-0001-001-A2" -> "A2"
      const enabled = sensor.status !== 'DAMAGED' && sensor.status !== 'NOT_CONNECTED';
      const rows = enabled ? toCamel(await recentStmt.all(sensor.id, limit)) : [];
      const sparkline = enabled ? toCamel(await sparklineStmt.all(sensor.id)).reverse() : [];
      const latest = rows[0] ?? null;

      // Label is just "Piezo N" -- each master node always carries the
      // same 4 pins (A0-A3), so prefixing every card with the node's
      // name ("Master Node 1 · Piezo 1", "Master Node 1 · Piezo 2" ...)
      // just repeated the same node name 4 times over for a
      // single-node owner. nodeName is still returned separately so a
      // multi-node owner's detail view can disambiguate which hub a
      // given piezo belongs to.
      const pieceNum = PIEZO_PINS.indexOf(pin) + 1;
      panels.push({
        piezoId: sensor.id,
        nodeId: node.id,
        nodeName: node.name,
        pin,
        piezoNumber: pieceNum,
        sensorLabel: `Piezo ${pieceNum > 0 ? pieceNum : '?'}`,
        sensorStatus: sensor.status,
        enabled,
        status: {
          grams: latest?.grams ?? 0,
          severity: !enabled ? 'Offline' : latest ? severityForGrams(latest.grams) : 'Normal',
          sector: latest?.sector ?? req.ownerRow.sector ?? 'Your Estate',
        },
        sparkline,
        logs: rows,
      });
    }
  }

  // Combined "Recent Logs" list across every ENABLED piezo only -- a
  // disabled/damaged/not-connected transducer isn't reporting real
  // readings, so it shouldn't show up mixed into the owner's live log
  // feed.
  const combinedLogs = toCamel(
    await db
      .prepare(
        `SELECT v.* FROM vibration_events v
         LEFT JOIN master_nodes n ON v.node_id = n.id
         LEFT JOIN piezo_sensors p ON v.piezo_sensor_id = p.id
         WHERE n.owner_id = ? AND (p.status IS NULL OR p.status NOT IN ('DAMAGED', 'NOT_CONNECTED'))
         ORDER BY ${orderBy} LIMIT ?`
      )
      .all(ownerId, limit)
  );
  const combinedLatest = combinedLogs[0] ?? null;

  res.json({
    sort,
    // Kept for any older client still reading the top-level shape --
    // mirrors the single strongest/most-recent reading across ALL of
    // the owner's working piezo units, same as this endpoint returned
    // before per-piezo panels existed.
    status: {
      grams: combinedLatest?.grams ?? 0,
      severity: combinedLatest ? severityForGrams(combinedLatest.grams) : 'Normal',
      sector: combinedLatest?.sector ?? req.ownerRow.sector ?? 'Your Estate',
    },
    sparkline: panels.find((p) => p.enabled)?.sparkline ?? [],
    logs: combinedLogs,
    // New: one entry per piezo transducer (always 4 per master node,
    // A0-A3) the owner has provisioned, each independently
    // enabled/disabled.
    panels,
  });
});

// Single-piezo detail (owner-scoped): the page an owner lands on after
// tapping one "Piezo N" card in /owner/events. Scoped to a piezo_sensor
// whose parent master_node belongs to this owner -- returns 404 rather
// than another owner's data if the id doesn't resolve under them.
// Always caps the log list at 10 rows (the "recent log of 10" this
// detail view is meant to show), independent of the ?limit the list
// page uses for its own combined feed.
router.get('/owner/events/piezo/:piezoId', requireOwnerAuth, async (req, res) => {
  const ownerId = req.ownerRow.id;
  const { piezoId } = req.params;
  const RECENT_LIMIT = 10;

  const sensor = toCamel(
    await db
      .prepare(
        `SELECT p.*, n.id AS node_id, n.name AS node_name, n.sector AS node_sector
         FROM piezo_sensors p
         JOIN master_nodes n ON p.node_id = n.id
         WHERE p.id = ? AND n.owner_id = ?`
      )
      .get(piezoId, ownerId)
  );
  if (!sensor) {
    return res.status(404).json({ error: 'Piezo sensor not found for this owner.' });
  }

  const pin = sensor.id.split('-').pop();
  const piezoNumber = PIEZO_PINS.indexOf(pin) + 1;
  const enabled = sensor.status !== 'DAMAGED' && sensor.status !== 'NOT_CONNECTED';

  const logs = enabled
    ? toCamel(
        await db
          .prepare(`SELECT * FROM vibration_events WHERE piezo_sensor_id = ? ORDER BY timestamp DESC LIMIT ?`)
          .all(sensor.id, RECENT_LIMIT)
      )
    : [];
  const sparkline = enabled
    ? toCamel(
        await db
          .prepare(`SELECT * FROM vibration_events WHERE piezo_sensor_id = ? ORDER BY timestamp DESC LIMIT 20`)
          .all(sensor.id)
      ).reverse()
    : [];
  const latest = logs[0] ?? null;

  res.json({
    piezoId: sensor.id,
    nodeId: sensor.nodeId,
    nodeName: sensor.nodeName,
    pin,
    piezoNumber,
    sensorLabel: `Piezo ${piezoNumber > 0 ? piezoNumber : '?'}`,
    sensorStatus: sensor.status,
    enabled,
    status: {
      grams: latest?.grams ?? 0,
      severity: !enabled ? 'Offline' : latest ? severityForGrams(latest.grams) : 'Normal',
      sector: latest?.sector ?? sensor.nodeSector ?? req.ownerRow.sector ?? 'Your Estate',
    },
    sparkline,
    logs,
  });
});

// ========== Notifications ==========
// Merges two sources into one feed: owner-scoped rows already in
// `notifications` (audience='owner'), and this owner's unresolved/-
// resolved alerts reshaped into the same notification shape. Response
// ids are prefixed ("n-12" / "a-7") so mark-read/delete know which
// table to touch.

async function ownerNotificationFeed(ownerId) {
  const notifRows = toCamel(
    await db
      .prepare(`SELECT * FROM notifications WHERE audience = 'owner' AND owner_id = ? ORDER BY created_at DESC`)
      .all(ownerId)
  ).map((n) => ({
    id: `n-${n.id}`,
    icon: n.icon || 'bell',
    title: n.title,
    message: n.message,
    category: n.category === 'credentials' ? 'system' : n.category, // owner never sees raw "credentials"
    createdAt: n.createdAt,
    isRead: !!n.isRead,
  }));

  const alertRows = toCamel(
    await db
      .prepare(
        `SELECT a.* FROM alerts a
         LEFT JOIN master_nodes n ON a.node_id = n.id
         LEFT JOIN monitored_trees t ON a.tree_id = t.id
         WHERE n.owner_id = ? OR t.owner_id = ?
         ORDER BY a.created_at DESC`
      )
      .all(ownerId, ownerId)
  ).map((a) => ({
    id: `a-${a.id}`,
    icon: a.alertType === 'pest' ? 'bug' : 'alert-triangle',
    title: a.title || a.pest || 'Sensor Alert',
    message: a.description || `${a.pest ?? 'Unusual activity'} detected in ${a.sector ?? 'your estate'}.`,
    category: 'alert',
    createdAt: a.createdAt,
    isRead: !!a.reviewed,
  }));

  return [...notifRows, ...alertRows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

router.get('/owner/notifications', requireOwnerAuth, async (req, res) => {
  const filter = req.query.filter || 'all';
  let feed = await ownerNotificationFeed(req.ownerRow.id);
  if (filter === 'alert') feed = feed.filter((n) => n.category === 'alert');
  else if (filter === 'system') feed = feed.filter((n) => n.category === 'system');
  else if (filter === 'report') feed = feed.filter((n) => n.category === 'report');

  const activeAlertCount = feed.filter((n) => n.category === 'alert' && !n.isRead).length;
  res.json({ notifications: feed, activeAlertCount });
});

router.patch('/owner/notifications/:id/read', requireOwnerAuth, async (req, res) => {
  const [prefix, rawId] = String(req.params.id).split('-');
  const id = Number(rawId);
  if (prefix === 'a') {
    // Ownership check matters here: without it, any signed-in owner
    // could mark ANY alert reviewed by guessing/iterating ids, even one
    // belonging to a different owner's trees/nodes entirely. The JOIN
    // below only lets the UPDATE through when this alert's node or tree
    // actually belongs to the requesting owner.
    await db.prepare(
      `UPDATE alerts SET reviewed = 1, reviewed_at = datetime('now'), reviewed_by = ?
       WHERE id = ?
         AND id IN (
           SELECT a.id FROM alerts a
           LEFT JOIN master_nodes n ON a.node_id = n.id
           LEFT JOIN monitored_trees t ON a.tree_id = t.id
           WHERE n.owner_id = ? OR t.owner_id = ?
         )`
    ).run(req.ownerRow.name, id, req.ownerRow.id, req.ownerRow.id);
  } else {
    await db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND owner_id = ?`).run(id, req.ownerRow.id);
  }
  res.json({ ok: true });
});

router.post('/owner/notifications/read-all', requireOwnerAuth, async (req, res) => {
  const ownerId = req.ownerRow.id;
  await db.prepare(`UPDATE notifications SET is_read = 1 WHERE audience = 'owner' AND owner_id = ?`).run(ownerId);
  await db.prepare(
    `UPDATE alerts SET reviewed = 1, reviewed_at = datetime('now'), reviewed_by = ?
     WHERE id IN (
       SELECT a.id FROM alerts a
       LEFT JOIN master_nodes n ON a.node_id = n.id
       LEFT JOIN monitored_trees t ON a.tree_id = t.id
       WHERE n.owner_id = ? OR t.owner_id = ?
     )`
  ).run(req.ownerRow.name, ownerId, ownerId);
  res.json({ ok: true });
});

router.delete('/owner/notifications/:id', requireOwnerAuth, async (req, res) => {
  const [prefix, rawId] = String(req.params.id).split('-');
  const id = Number(rawId);
  if (prefix === 'n') {
    await db.prepare(`DELETE FROM notifications WHERE id = ? AND owner_id = ?`).run(id, req.ownerRow.id);
  }
  // Alert-sourced rows ("a-…") aren't deletable here -- they're the
  // shared alert history the admin console also relies on; owners can
  // only mark them reviewed, same as the original build.
  res.json({ ok: true });
});

// ========== Settings ==========

async function getOrCreateOwnerSettings(ownerId) {
  let row = await db.prepare(`SELECT * FROM owner_settings WHERE owner_id = ?`).get(ownerId);
  if (!row) {
    await db.prepare(`INSERT INTO owner_settings (owner_id) VALUES (?)`).run(ownerId);
    row = await db.prepare(`SELECT * FROM owner_settings WHERE owner_id = ?`).get(ownerId);
  }
  return row;
}

router.get('/owner/settings', requireOwnerAuth, async (req, res) => {
  res.json(toCamel(await getOrCreateOwnerSettings(req.ownerRow.id)));
});

router.patch('/owner/settings', requireOwnerAuth, async (req, res) => {
  await getOrCreateOwnerSettings(req.ownerRow.id);
  const b = req.body || {};
  await db.prepare(
    `UPDATE owner_settings
     SET notify_email = ?, notify_sms = ?, notify_push = ?, local_buzzer_alert = ?,
         notify_critical_only = ?, theme = ?
     WHERE owner_id = ?`
  ).run(
    b.notifyEmail ? 1 : 0,
    b.notifySms ? 1 : 0,
    b.notifyPush ? 1 : 0,
    b.localBuzzerAlert ? 1 : 0,
    b.notifyCriticalOnly ? 1 : 0,
    b.theme === 'Light' ? 'Light' : 'Dark',
    req.ownerRow.id
  );
  res.json(toCamel(await getOrCreateOwnerSettings(req.ownerRow.id)));
});

export default router;
