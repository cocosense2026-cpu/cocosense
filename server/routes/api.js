import { Router } from 'express';
import { db } from '../db.js';
import { toCamel } from '../utils.js';
import {
  hashDefaultPassword,
  generateConfirmToken,
  hashConfirmToken,
  confirmTokenExpiryIso,
} from '../auth.js';
import { sendMail } from '../mailer.js';

const router = Router();

const OWNER_PORTAL_URL = process.env.OWNER_PORTAL_URL || 'http://localhost:3000';

// Creates `count` master_nodes (+ 6 piezo_sensors each, matching the
// hardware allocation shown in the Add Owner / Expand Nodes forms) for
// an owner, continuing the numbering from however many nodes they
// already have. Shared by owner creation and node expansion so both
// paths provision hardware identically -- previously only expansion
// actually created rows here, which meant a brand-new owner's chosen
// "Initial Master Nodes" count was collected by the form but silently
// dropped, leaving the new owner with zero nodes until an admin used
// Expand Nodes at least once.
async function provisionMasterNodes(ownerId, sector, count) {
  const existingCount = (await db.prepare(`SELECT COUNT(*) AS n FROM master_nodes WHERE owner_id = ?`).get(ownerId)).n;

  for (let i = 0; i < count; i++) {
    const nodeNumber = existingCount + i + 1;
    const nodeId = `MN-${ownerId}-${String(nodeNumber).padStart(3, '0')}`;
    await db.prepare(
      `INSERT INTO master_nodes
        (id, name, sector, owner_id, online, battery_percent, signal_rssi, total_sensors, working_sensors, damaged_sensors, last_ping, firmware_version)
       VALUES (?,?,?,?,1,100,?,6,6,0,datetime('now'),'v2.4.8-STABLE')`
    ).run(nodeId, `Master Node ${nodeNumber}`, sector ?? null, ownerId, '-58 dBm (Strong)');

    for (let s = 1; s <= 6; s++) {
      await db.prepare(
        `INSERT INTO piezo_sensors (id, node_id, status, frequency_hz, voltage_mv) VALUES (?,?,?,?,?)`
      ).run(`${nodeId}-S${s}`, nodeId, 'OPTIMAL', 0, 3300);
    }
  }
}

// Plain-text version -- always sent alongside the HTML version below so
// clients that can't render HTML (and the Outbox admin log, which only
// ever stores this) still get the full message.
function confirmationEmailBody({ name, id, email, token }) {
  const link = `${OWNER_PORTAL_URL}/owner/confirm?token=${token}`;
  return (
    `Mabuhay ${name},\n\n` +
    `Your CocoSense monitoring account has been created.\n\n` +
    `  Owner ID: ${id}\n` +
    `  Login email: ${email}\n` +
    `  Temporary password: user123\n\n` +
    `Before you can sign in, please confirm your email by clicking the link below ` +
    `(valid for 24 hours):\n\n` +
    `  ${link}\n\n` +
    `Once confirmed, sign in to your Farm Owner Portal at /owner/login. For security, ` +
    `you'll be required to change your temporary password the first time you log in. ` +
    `Choose a new password that's at least 8 characters and includes an uppercase letter, ` +
    `a lowercase letter, a number, and a symbol.\n\n` +
    `— CocoSense Smart Plantation Monitoring`
  );
}

// Owner-supplied fields (name/id/email) land inside HTML below, so they
// need escaping -- this isn't a trusted-input boundary.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// HTML version of the first-time sign-in / confirmation email -- an
// upright "book" card: dark header carrying the CocoSense mark, paper
// body, and a nested white panel holding the credentials and the
// confirm link. Table-based layout (not flex/grid) for compatibility
// across email clients (Outlook in particular).
function confirmationEmailHtml({ name, id, email, token }) {
  const link = `${OWNER_PORTAL_URL}/owner/confirm?token=${token}`;
  const safeName = escapeHtml(name);
  const safeId = escapeHtml(id);
  const safeEmail = escapeHtml(email);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDEBE3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEBE3;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="400" cellpadding="0" cellspacing="0" style="width:400px;max-width:100%;background:#F7F5EF;border:1px solid #D8D5C8;border-radius:14px;overflow:hidden;">

<tr><td style="background:#0A0A0A;padding:22px 24px 20px 26px;border-left:6px solid #1A1A1A;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px;">
<svg width="38" height="38" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
<path d="M 26 106 L 38 16 A 92 92 0 0 1 120 106 Z" fill="#16A34A" stroke="#000000" stroke-width="4"/>
<path d="M 26 106 L 32 60 A 48 48 0 0 1 74 106" stroke="#064E3B" stroke-width="2.5" fill="none"/>
<line x1="26" y1="106" x2="120" y2="106" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
<line x1="26" y1="106" x2="38" y2="16" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
<path d="M 25 106 Q 30 64 34 26 L 38 27 Q 34 65 29 106 Z" fill="#000000"/>
<path d="M 36 26 C 34 14 36 4 36 0 C 38 6 39 16 36 26 Z" fill="#000000"/>
<path d="M 36 26 C 24 14 14 12 2 16 C 12 20 24 24 36 26 Z" fill="#000000"/>
<path d="M 36 26 C 50 14 60 14 70 20 C 60 22 48 24 36 26 Z" fill="#000000"/>
<circle cx="26" cy="106" r="7" fill="#000000" stroke="#ffffff" stroke-width="2"/>
<circle cx="26" cy="106" r="3" fill="#22C55E"/>
</svg>
</td>
<td style="vertical-align:middle;">
<span style="color:#FFFFFF;font-weight:bold;font-size:18px;letter-spacing:1px;">COCO</span><span style="color:#22C55E;font-weight:bold;font-size:18px;letter-spacing:1px;">SENSE</span>
<div style="color:#808080;font-size:10px;letter-spacing:1px;margin-top:2px;">SMART PLANTATION MONITORING</div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:26px 26px 30px 32px;border-left:6px solid #1A1A1A;">
<p style="margin:0 0 14px;font-size:15px;color:#1A1A1A;">Mabuhay ${safeName},</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3A3A38;">Your CocoSense monitoring account has been created. Confirm your email to activate it.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #D8D5C8;border-radius:10px;">
<tr><td style="padding:18px 18px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
<tr><td style="color:#807F70;padding:4px 0;">Owner ID</td><td align="right" style="padding:4px 0;color:#1A1A1A;font-weight:bold;">${safeId}</td></tr>
<tr><td style="color:#807F70;padding:4px 0;">Login email</td><td align="right" style="padding:4px 0;color:#1A1A1A;font-weight:bold;">${safeEmail}</td></tr>
<tr><td style="color:#807F70;padding:4px 0;">Temp. password</td><td align="right" style="padding:4px 0;color:#1A1A1A;font-weight:bold;">user123</td></tr>
</table>
<div style="border-top:1px solid #E5E2D6;margin:14px 0 16px;"></div>
<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#3A3A38;">This link is valid for 24 hours. You'll be asked to set a new password on first sign-in.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" bgcolor="#16A34A" style="border-radius:8px;">
<a href="${link}" style="display:block;padding:11px;font-size:13px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Confirm your account</a>
</td></tr>
</table>
</td></tr>
</table>

<p style="margin:18px 0 0;font-size:11px;color:#A3A196;text-align:center;">CocoSense Smart Plantation Monitoring</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------- Dashboard summary ----------
router.get('/dashboard', async (req, res) => {
  const owners = (await db.prepare(`SELECT COUNT(*) AS n FROM farm_owners`).get()).n;
  const nodesOnline = (await db.prepare(`SELECT COUNT(*) AS n FROM master_nodes WHERE online = 1`).get()).n;
  const nodesTotal = (await db.prepare(`SELECT COUNT(*) AS n FROM master_nodes`).get()).n;
  const trees = (await db.prepare(`SELECT COUNT(*) AS n FROM monitored_trees`).get()).n;
  const activeInfestations = (await db
    .prepare(`SELECT COUNT(*) AS n FROM monitored_trees WHERE status = 'Active Infestation'`)
    .get()).n;
  const unreviewedPestAlerts = (await db
    .prepare(`SELECT COUNT(*) AS n FROM alerts WHERE alert_type = 'pest' AND reviewed = 0`)
    .get()).n;
  const latestPestAlert = toCamel(
    await db.prepare(`SELECT * FROM alerts WHERE alert_type = 'pest' ORDER BY created_at DESC LIMIT 1`).get()
  );
  const recentReadings = toCamel(
    await db.prepare(`SELECT * FROM vibration_events ORDER BY timestamp DESC LIMIT 20`).all()
  );

  res.json({
    owners,
    nodesOnline,
    nodesTotal,
    trees,
    activeInfestations,
    unreviewedPestAlerts,
    latestPestAlert: latestPestAlert ?? null,
    recentReadings,
  });
});

// ---------- Farm owners ----------
router.get('/owners', async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT o.*,
         (SELECT COUNT(*) FROM master_nodes n WHERE n.owner_id = o.id) AS nodesCount,
         (SELECT COUNT(*) FROM monitored_trees t WHERE t.owner_id = o.id) AS treesCount,
         (SELECT COUNT(*) FROM monitored_trees t WHERE t.owner_id = o.id AND t.status != 'No Pests') AS infectedTreesCount
       FROM farm_owners o ORDER BY o.registered_at DESC`
    )
    .all();
  const owners = toCamel(rows);
  // password_hash and confirmation-token internals must never leave the
  // server -- strip them, keep the account/must-change-password flags
  // so the UI can show pending-confirmation status and prompt correctly.
  for (const o of owners) {
    delete o.passwordHash;
    delete o.resetCodeHash;
    delete o.resetCodeExpires;
    delete o.confirmTokenHash;
    delete o.confirmTokenExpires;
  }
  res.json(owners);
});

router.post('/owners', async (req, res) => {
  const b = req.body || {};
  if (!b.id || !b.name) return res.status(400).json({ ok: false, error: 'id and name are required' });
  if (!b.email) return res.status(400).json({ ok: false, error: 'email is required to send credentials' });

  // Duplicate-registration guard: block only when name, address, AND
  // email all exactly match (case/whitespace-insensitive) an existing
  // owner. Email alone is already enforced unique at the DB level (see
  // the UNIQUE-constraint catch below), but this gives a clearer,
  // specific message and catches the case the admin actually cares
  // about -- the same person being registered twice -- without
  // blocking two different owners who happen to share only a name or
  // only an address (e.g. family members on the same estate).
  const duplicate = await db
    .prepare(
      `SELECT id FROM farm_owners
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(address, ''))) = LOWER(TRIM(?))
         AND LOWER(TRIM(email)) = LOWER(TRIM(?))`
    )
    .get(b.name, b.address ?? '', b.email);
  if (duplicate) {
    return res.status(409).json({
      ok: false,
      error: `An account with this exact name, address, and email already exists (Owner ID: ${duplicate.id}).`,
    });
  }

  const confirmToken = generateConfirmToken();

  try {
    await db.prepare(
      `INSERT INTO farm_owners
        (id, name, first_name, last_name, middle_name, email, phone, country, region, province,
         city_municipality, barangay, street, address, sector, geo_coordinates, color, initials,
         account_confirmed, password_hash, must_change_password, confirm_token_hash, confirm_token_expires)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,1,?,?)`
    ).run(
      b.id, b.name, b.firstName ?? null, b.lastName ?? null, b.middleName ?? null,
      b.email, b.phone ?? null, b.country ?? null, b.region ?? null, b.province ?? null,
      b.cityMunicipality ?? null, b.barangay ?? null, b.street ?? null, b.address ?? null,
      b.sector ?? null, b.geoCoordinates ?? null, b.color ?? '#059669', b.initials ?? null,
      hashDefaultPassword(), hashConfirmToken(confirmToken), confirmTokenExpiryIso()
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'An owner with that id or email already exists.' });
    }
    throw err;
  }

  // Provision the hardware the admin selected in "Initial Master Nodes"
  // on the Add Owner form -- this is what makes that many devices (and
  // this many Vibration Intensity panels, in the Owner Portal) actually
  // exist for the owner from day one, instead of only after the first
  // Expand Nodes action.
  await provisionMasterNodes(b.id, b.sector ?? null, Math.max(1, Math.min(20, Number(b.nodesCount) || 1)));

  const { deliveryStatus, deliveryError } = await sendMail({
    toName: b.name,
    toEmail: b.email,
    subject: 'Welcome to CocoSense — Confirm Your Account',
    category: 'credentials',
    body: confirmationEmailBody({ name: b.name, id: b.id, email: b.email, token: confirmToken }),
    html: confirmationEmailHtml({ name: b.name, id: b.id, email: b.email, token: confirmToken }),
  });

  // Owner-facing welcome notification -- shows up in their portal's
  // Notifications page the first time they sign in, separate from the
  // admin-wide notification created below.
  await db.prepare(
    `INSERT INTO notifications (icon, title, message, category, audience, owner_id)
     VALUES (?, ?, ?, 'system', 'owner', ?)`
  ).run(
    'party-popper',
    'Welcome to CocoSense',
    `Your monitoring account is ready. Sign in with ${b.email} using the temporary password emailed to you.`,
    b.id
  );

  res.status(201).json({ ok: true, id: b.id, emailDeliveryStatus: deliveryStatus, emailDeliveryError: deliveryError });
});

// Note: owner login/change-password used to live here too, before the
// full owner portal (server/routes/owner.js) existed. Removed as dead
// code -- src/owner/api.ts only ever calls the /owner/auth/* routes,
// which also enforce the account-confirmation gate these didn't.

router.post('/owners/:id/resend-invite', async (req, res) => {
  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE id = ?`).get(req.params.id);
  if (!owner) return res.status(404).json({ ok: false, error: 'Owner not found.' });

  let body;
  let html;
  let subject;

  if (owner.account_confirmed) {
    // Already confirmed -- just a credentials reminder, no new token needed.
    subject = 'Reminder: Your CocoSense Account';
    body =
      `Hello ${owner.name},\n\n` +
      `Your monitoring station credentials for ${owner.sector ?? ''} (${owner.id}) are ready.\n\n` +
      (owner.must_change_password
        ? `Temporary password: user123 (you'll be asked to change this on first login)\n\n`
        : '') +
      `Sign in any time at /owner/login.\n\n` +
      `— CocoSense Smart Plantation Monitoring`;
  } else {
    // Not yet confirmed -- issue a fresh token (the old one, if any, may
    // have expired) and resend the confirmation link.
    const confirmToken = generateConfirmToken();
    await db.prepare(`UPDATE farm_owners SET confirm_token_hash = ?, confirm_token_expires = ? WHERE id = ?`).run(
      hashConfirmToken(confirmToken),
      confirmTokenExpiryIso(),
      owner.id
    );
    subject = 'Reminder: Confirm Your CocoSense Account';
    body = confirmationEmailBody({ name: owner.name, id: owner.id, email: owner.email, token: confirmToken });
    html = confirmationEmailHtml({ name: owner.name, id: owner.id, email: owner.email, token: confirmToken });
  }

  const { deliveryStatus, deliveryError } = await sendMail({
    toName: owner.name,
    toEmail: owner.email,
    subject,
    category: 'credentials',
    body,
    ...(html ? { html } : {}),
  });

  res.json({ ok: true, emailDeliveryStatus: deliveryStatus, emailDeliveryError: deliveryError });
});

// Deletes the owner account itself, but only UNASSIGNS (doesn't
// delete) their hardware and tree records -- the physical nodes/trees
// still exist in the field even if the account tracking them is gone,
// so we keep that inventory and just clear its owner_id.
router.delete('/owners/:id', async (req, res) => {
  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE id = ?`).get(req.params.id);
  if (!owner) return res.status(404).json({ ok: false, error: 'Owner not found.' });

  await db.exec('BEGIN');
  try {
    await db.prepare(`DELETE FROM owner_sessions WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`DELETE FROM owner_settings WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`DELETE FROM owner_activity WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`DELETE FROM notifications WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`UPDATE master_nodes SET owner_id = NULL WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`UPDATE monitored_trees SET owner_id = NULL WHERE owner_id = ?`).run(req.params.id);
    await db.prepare(`DELETE FROM farm_owners WHERE id = ?`).run(req.params.id);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  res.json({ ok: true });
});

// Provisions N new Master Nodes (+6 piezo sensors each, matching the
// admin console's "+N Master Nodes (+6N Sensors)" messaging) for an
// existing owner. nodesCount/treesCount on the owner are DERIVED
// (COUNT(*) against these tables -- see GET /owners above), so this is
// the only way those numbers actually change; there's no counter
// column to increment directly.
router.post('/owners/:id/expand-nodes', async (req, res) => {
  const owner = await db.prepare(`SELECT * FROM farm_owners WHERE id = ?`).get(req.params.id);
  if (!owner) return res.status(404).json({ ok: false, error: 'Owner not found.' });

  const additionalNodes = Math.max(1, Math.min(20, Number(req.body?.additionalNodes) || 1));

  await db.exec('BEGIN');
  try {
    await provisionMasterNodes(owner.id, owner.sector, additionalNodes);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM master_nodes WHERE owner_id = ?) AS nodesCount,
         (SELECT COUNT(*) FROM monitored_trees WHERE owner_id = ?) AS treesCount`
    )
    .get(owner.id, owner.id);

  res.json({ ok: true, ...counts });
});

// ---------- Master nodes ----------
router.get('/nodes', async (req, res) => {
  const nodes = toCamel(await db.prepare(`SELECT * FROM master_nodes ORDER BY id`).all());
  const sensorStmt = db.prepare(`SELECT * FROM piezo_sensors WHERE node_id = ?`);
  for (const node of nodes) {
    node.sensors = toCamel(await sensorStmt.all(node.id));
    node.coordinates = [node.lat, node.lng];
  }
  res.json(nodes);
});

router.post('/nodes', async (req, res) => {
  const b = req.body || {};
  if (!b.id || !b.name) return res.status(400).json({ ok: false, error: 'id and name are required' });
  await db.prepare(
    `INSERT INTO master_nodes
      (id, name, sector, owner_id, online, battery_percent, signal_rssi, note,
       total_sensors, working_sensors, damaged_sensors, firmware_version, lat, lng)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    b.id, b.name, b.sector ?? null, b.ownerId ?? null, b.online === false ? 0 : 1,
    b.batteryPercent ?? 100, b.signalRssi ?? null, b.note ?? null,
    b.totalSensors ?? 0, b.workingSensors ?? 0, b.damagedSensors ?? 0,
    b.firmwareVersion ?? null, b.coordinates?.[0] ?? null, b.coordinates?.[1] ?? null
  );
  res.status(201).json({ ok: true, id: b.id });
});

// ---------- Monitored trees ----------
router.get('/trees', async (req, res) => {
  res.json(toCamel(await db.prepare(`SELECT * FROM monitored_trees ORDER BY id`).all()));
});

router.post('/trees', async (req, res) => {
  const b = req.body || {};
  if (!b.id) return res.status(400).json({ ok: false, error: 'id is required' });
  await db.prepare(
    `INSERT INTO monitored_trees
      (id, owner_id, sector, row, col, x, y, status, threat_score, pest_detected,
       vibration_frequency_hz, vibration_grams, assigned_node_id, piezo_sensor_id,
       soil_moisture_percent, ambient_temp_c)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    b.id, b.ownerId ?? null, b.sector ?? null, b.row ?? null, b.column ?? null,
    b.x ?? null, b.y ?? null, b.status ?? 'No Pests', b.threatScore ?? 0,
    b.pestDetected ?? 'None', b.vibrationFrequencyHz ?? 0, b.vibrationGrams ?? 0,
    b.assignedNodeId ?? null, b.piezoSensorId ?? null,
    b.soilMoisturePercent ?? null, b.ambientTempC ?? null
  );
  res.status(201).json({ ok: true, id: b.id });
});

// ---------- Vibration events (raw log, for charts) ----------
router.get('/vibration-events', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  res.json(
    toCamel(await db.prepare(`SELECT * FROM vibration_events ORDER BY timestamp DESC LIMIT ?`).all(limit))
  );
});

// ---------- Alerts ----------
router.get('/alerts', async (req, res) => {
  const { type, reviewed } = req.query;
  let sql = `SELECT * FROM alerts WHERE 1=1`;
  const params = [];
  if (type) { sql += ` AND alert_type = ?`; params.push(type); }
  if (reviewed !== undefined) { sql += ` AND reviewed = ?`; params.push(reviewed === 'true' ? 1 : 0); }
  sql += ` ORDER BY created_at DESC`;
  res.json(toCamel(await db.prepare(sql).all(...params)));
});

router.patch('/alerts/:id/review', async (req, res) => {
  const { reviewedBy } = req.body || {};
  await db.prepare(
    `UPDATE alerts SET reviewed = 1, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
  ).run(reviewedBy ?? null, req.params.id);
  res.json({ ok: true });
});

// ---------- Notifications ----------
router.get('/notifications', async (req, res) => {
  res.json(toCamel(await db.prepare(`SELECT * FROM notifications ORDER BY created_at DESC`).all()));
});

router.patch('/notifications/:id/read', async (req, res) => {
  await db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

router.patch('/notifications/read-all', async (req, res) => {
  await db.prepare(`UPDATE notifications SET is_read = 1`).run();
  res.json({ ok: true });
});

// ---------- Outbox ----------
router.get('/outbox', async (req, res) => {
  res.json(toCamel(await db.prepare(`SELECT * FROM outbox_emails ORDER BY created_at DESC`).all()));
});

export default router;
