import { Router } from 'express';
import { db } from '../db.js';
import { toCamel, validateAvatarDataUrl } from '../utils.js';
import { verifyPassword, hashPassword, generateSessionToken, sessionExpiryIso } from '../auth.js';

const router = Router();

function publicSuperAdmin(row) {
  const sa = toCamel(row);
  if (!sa) return sa;
  delete sa.passwordHash;
  return sa;
}

function publicAdmin(row) {
  const a = toCamel(row);
  if (!a) return a;
  delete a.passwordHash;
  return a;
}

async function logActivity(superadminId, action, detail) {
  await db.prepare(
    `INSERT INTO superadmin_activity (superadmin_id, action, detail) VALUES (?, ?, ?)`
  ).run(superadminId, action, detail ?? null);
}

// ---------- Auth middleware ----------
// Same bearer-token-against-a-sessions-table shape as requireAdminAuth
// in server/routes/admin.js -- kept as a fully separate table/middleware
// (not "admins with a super role") so a leaked or forged admin session
// can never reach super-admin-only endpoints.
export async function requireSuperAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  const session = await db.prepare(`SELECT * FROM superadmin_sessions WHERE token = ?`).get(token);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    if (session) await db.prepare(`DELETE FROM superadmin_sessions WHERE token = ?`).run(token);
    return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
  }

  const superadmin = await db.prepare(`SELECT * FROM superadmins WHERE id = ?`).get(session.superadmin_id);
  if (!superadmin) return res.status(401).json({ ok: false, error: 'Account not found.' });

  req.superadminRow = superadmin;
  req.superadminToken = token;
  next();
}

// ========== Auth ==========

router.post('/superadmin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required.' });

  const superadmin = await db.prepare(`SELECT * FROM superadmins WHERE email = ?`).get(email);
  if (!superadmin || !verifyPassword(password, superadmin.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  const token = generateSessionToken();
  await db.prepare(`INSERT INTO superadmin_sessions (token, superadmin_id, expires_at) VALUES (?, ?, ?)`).run(
    token,
    superadmin.id,
    sessionExpiryIso()
  );
  await logActivity(superadmin.id, 'Signed in', null);

  res.json({ ok: true, token, superadmin: publicSuperAdmin(superadmin) });
});

router.post('/superadmin/auth/logout', requireSuperAdminAuth, async (req, res) => {
  await db.prepare(`DELETE FROM superadmin_sessions WHERE token = ?`).run(req.superadminToken);
  res.json({ ok: true });
});

router.get('/superadmin/me', requireSuperAdminAuth, async (req, res) => {
  res.json({ ok: true, superadmin: publicSuperAdmin(req.superadminRow) });
});

// ========== Profile ==========
// Lets a super admin edit their own name/email/picture from the Super
// Admin console's Settings page. Mirrors PATCH /admin/profile.
router.patch('/superadmin/profile', requireSuperAdminAuth, async (req, res) => {
  const b = req.body || {};
  const name = (b.name ?? req.superadminRow.name ?? '').trim();
  const email = (b.email ?? req.superadminRow.email ?? '').trim();

  if (!name) return res.status(400).json({ ok: false, error: 'Name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email is required.' });
  }

  const hasAvatarField = Object.prototype.hasOwnProperty.call(b, 'avatarUrl');
  const avatarUrl = hasAvatarField ? b.avatarUrl || null : req.superadminRow.avatar_url;
  if (hasAvatarField) {
    const avatarError = validateAvatarDataUrl(avatarUrl);
    if (avatarError) return res.status(400).json({ ok: false, error: avatarError });
  }

  try {
    await db.prepare(`UPDATE superadmins SET name = ?, email = ?, avatar_url = ? WHERE id = ?`).run(
      name,
      email,
      avatarUrl,
      req.superadminRow.id
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'That email is already in use by another account.' });
    }
    throw err;
  }

  const updated = await db.prepare(`SELECT * FROM superadmins WHERE id = ?`).get(req.superadminRow.id);
  res.json({ ok: true, superadmin: publicSuperAdmin(updated) });
});

// ========== Admin account management ==========

router.get('/superadmin/admins', requireSuperAdminAuth, async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM admins ORDER BY created_at DESC`).all();
  res.json(rows.map(publicAdmin));
});

router.post('/superadmin/admins', requireSuperAdminAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.email) return res.status(400).json({ ok: false, error: 'Name and email are required.' });

  const existing = await db.prepare(`SELECT id FROM admins WHERE email = ?`).get(b.email);
  if (existing) return res.status(409).json({ ok: false, error: 'An admin account with that email already exists.' });

  const id = `ADM-${String(Date.now()).slice(-6)}`;
  const password = typeof b.password === 'string' && b.password.length >= 6 ? b.password : 'admin123';
  await db.prepare(
    `INSERT INTO admins (id, name, email, role, status, password_hash) VALUES (?,?,?,?,?,?)`
  ).run(id, b.name, b.email, b.role || 'Administrator', 'Active', hashPassword(password));

  await logActivity(req.superadminRow.id, 'Created admin account', `${b.name} (${b.email})`);

  const created = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(id);
  res.status(201).json({ ok: true, admin: publicAdmin(created), temporaryPassword: password });
});

router.patch('/superadmin/admins/:id/status', requireSuperAdminAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ ok: false, error: "status must be 'Active' or 'Inactive'." });
  }
  const admin = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(req.params.id);
  if (!admin) return res.status(404).json({ ok: false, error: 'Admin account not found.' });

  await db.prepare(`UPDATE admins SET status = ? WHERE id = ?`).run(status, admin.id);
  if (status === 'Inactive') {
    await db.prepare(`DELETE FROM admin_sessions WHERE admin_id = ?`).run(admin.id);
  }
  await logActivity(
    req.superadminRow.id,
    status === 'Active' ? 'Reactivated admin account' : 'Deactivated admin account',
    `${admin.name} (${admin.email})`
  );

  const updated = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(admin.id);
  res.json({ ok: true, admin: publicAdmin(updated) });
});

router.delete('/superadmin/admins/:id', requireSuperAdminAuth, async (req, res) => {
  const admin = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(req.params.id);
  if (!admin) return res.status(404).json({ ok: false, error: 'Admin account not found.' });

  await db.prepare(`DELETE FROM admins WHERE id = ?`).run(admin.id);
  await logActivity(req.superadminRow.id, 'Removed admin account', `${admin.name} (${admin.email})`);
  res.json({ ok: true });
});

// ========== Plantation-wide overview ==========
// Network-wide rollup across every farm owner -- what the Super Admin
// dashboard/overview page shows. Deliberately read-only: super admins
// provision admin accounts, but plantation data itself is still managed
// from the admin console.

router.get('/superadmin/overview', requireSuperAdminAuth, async (req, res) => {
  const owners = toCamel(
    await db
      .prepare(
        `SELECT o.id, o.name, o.sector, o.piezo_health, o.status, o.avatar_url, o.color, o.initials,
           (SELECT COUNT(*) FROM master_nodes n WHERE n.owner_id = o.id) AS nodesCount,
           (SELECT COUNT(*) FROM monitored_trees t WHERE t.owner_id = o.id) AS treesCount,
           (SELECT COUNT(*) FROM monitored_trees t WHERE t.owner_id = o.id AND t.status != 'No Pests') AS infectedTreesCount
         FROM farm_owners o ORDER BY o.registered_at DESC`
      )
      .all()
  );

  const admins = await db.prepare(`SELECT * FROM admins`).all();
  const totals = {
    totalOwners: owners.length,
    totalTrees: owners.reduce((sum, o) => sum + (o.treesCount || 0), 0),
    totalInfectedTrees: owners.reduce((sum, o) => sum + (o.infectedTreesCount || 0), 0),
    totalNodes: owners.reduce((sum, o) => sum + (o.nodesCount || 0), 0),
    offlineOwners: owners.filter((o) => o.piezoHealth !== 'Working').length,
    totalAdmins: admins.length,
    activeAdmins: admins.filter((a) => (a.status || 'Active') === 'Active').length,
  };

  res.json({ ok: true, owners, totals });
});

// ========== Master Node Mesh (plantation-wide, read-only monitoring) ==========
// Every hub across every farm owner, for the Super Admin's device-health
// monitoring screen. Deliberately read-only (no reboot/power control --
// that stays an Admin-console-only action): super admins watch the mesh
// and run component self-tests, they don't operate it.

router.get('/superadmin/nodes', requireSuperAdminAuth, async (req, res) => {
  const nodes = toCamel(
    await db
      .prepare(
        `SELECT n.*, o.name AS owner_name, o.sector AS owner_sector
         FROM master_nodes n
         LEFT JOIN farm_owners o ON n.owner_id = o.id
         ORDER BY n.id`
      )
      .all()
  );
  const sensorStmt = db.prepare(`SELECT * FROM piezo_sensors WHERE node_id = ?`);
  for (const node of nodes) {
    node.sensors = toCamel(await sensorStmt.all(node.id));
    node.coordinates = [node.lat, node.lng];
  }
  res.json(nodes);
});

router.get('/superadmin/activity', requireSuperAdminAuth, async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT * FROM superadmin_activity WHERE superadmin_id = ? ORDER BY created_at DESC LIMIT 10`
    )
    .all(req.superadminRow.id);
  res.json(toCamel(rows));
});

export default router;
