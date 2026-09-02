import { Router } from 'express';
import { db } from '../db.js';
import { toCamel, validateAvatarDataUrl } from '../utils.js';
import { verifyPassword, generateSessionToken, sessionExpiryIso } from '../auth.js';

const router = Router();

function publicAdmin(row) {
  const a = toCamel(row);
  if (!a) return a;
  delete a.passwordHash;
  return a;
}

// ---------- Auth middleware ----------
// Bearer token, looked up against admin_sessions -- same shape as the
// owner portal's requireOwnerAuth (see server/routes/owner.js). Exported
// so other route files can gate admin-only endpoints behind it later.
export async function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  const session = await db.prepare(`SELECT * FROM admin_sessions WHERE token = ?`).get(token);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    if (session) await db.prepare(`DELETE FROM admin_sessions WHERE token = ?`).run(token);
    return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
  }

  const admin = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(session.admin_id);
  if (!admin) return res.status(401).json({ ok: false, error: 'Account not found.' });
  if ((admin.status || 'Active') !== 'Active') {
    await db.prepare(`DELETE FROM admin_sessions WHERE token = ?`).run(token);
    return res.status(403).json({ ok: false, error: 'This admin account has been deactivated.' });
  }

  req.adminRow = admin;
  req.adminToken = token;
  next();
}

// ========== Auth ==========

router.post('/admin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required.' });

  const admin = await db.prepare(`SELECT * FROM admins WHERE email = ?`).get(email);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }
  // Deactivated by a Super Admin (see server/routes/superadmin.js) --
  // the row stays, but sign-in is blocked until reactivated.
  if ((admin.status || 'Active') !== 'Active') {
    return res.status(403).json({ ok: false, error: 'This admin account has been deactivated. Contact your super admin.' });
  }

  const token = generateSessionToken();
  await db.prepare(`INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)`).run(
    token,
    admin.id,
    sessionExpiryIso()
  );

  res.json({ ok: true, token, admin: publicAdmin(admin) });
});

router.post('/admin/auth/logout', requireAdminAuth, async (req, res) => {
  await db.prepare(`DELETE FROM admin_sessions WHERE token = ?`).run(req.adminToken);
  res.json({ ok: true });
});

router.get('/admin/me', requireAdminAuth, async (req, res) => {
  res.json({ ok: true, admin: publicAdmin(req.adminRow) });
});

// ========== Profile ==========
// Lets an admin edit their own name/email/picture from the admin
// console's Settings page. Same shape as the Super Admin and Farm
// Owner equivalents (server/routes/superadmin.js, server/routes/owner.js).
router.patch('/admin/profile', requireAdminAuth, async (req, res) => {
  const b = req.body || {};
  const name = (b.name ?? req.adminRow.name ?? '').trim();
  const email = (b.email ?? req.adminRow.email ?? '').trim();

  if (!name) return res.status(400).json({ ok: false, error: 'Name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email is required.' });
  }

  const hasAvatarField = Object.prototype.hasOwnProperty.call(b, 'avatarUrl');
  const avatarUrl = hasAvatarField ? b.avatarUrl || null : req.adminRow.avatar_url;
  if (hasAvatarField) {
    const avatarError = validateAvatarDataUrl(avatarUrl);
    if (avatarError) return res.status(400).json({ ok: false, error: avatarError });
  }

  try {
    await db.prepare(`UPDATE admins SET name = ?, email = ?, avatar_url = ? WHERE id = ?`).run(
      name,
      email,
      avatarUrl,
      req.adminRow.id
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'That email is already in use by another account.' });
    }
    throw err;
  }

  const updated = await db.prepare(`SELECT * FROM admins WHERE id = ?`).get(req.adminRow.id);
  res.json({ ok: true, admin: publicAdmin(updated) });
});

export default router;
