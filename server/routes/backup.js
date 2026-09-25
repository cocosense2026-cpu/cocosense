import { Router } from 'express';
import { db } from '../db.js';
import { sha256Hex } from '../hash.js';
import { encryptField, decryptField, transformFields } from '../fieldCrypto.js';
import { requireAdminAuth } from './admin.js';

const router = Router();

// Farm owners' personally identifiable columns -- encrypted (AES-256-GCM,
// see fieldCrypto.js) before the export ever leaves the server, so a
// downloaded cocosense-system-backup.json is unreadable to anyone who
// opens it in a text editor or VS Code without BACKUP_FIELD_KEY. geo_coordinates
// is included because it pinpoints the farm's physical location, which is
// PII for a small owner-operated plot the same way a home address is.
// Left out deliberately: id/status/color/initials/avatar_url/sector/
// piezo_health/registered_at/account_confirmed/row_hash -- these are
// either structural (needed to sort/filter/relate rows) or, for
// row_hash, already a one-way fingerprint of the plaintext and must
// stay byte-for-byte stable so a restored row's hash still matches.
const FARM_OWNER_PII_FIELDS = [
  'name', 'first_name', 'last_name', 'middle_name', 'email', 'phone',
  'address', 'street', 'barangay', 'city_municipality', 'province', 'geo_coordinates',
];

// Tables included in a full system backup/restore, and -- for each --
// the exact columns that may ever be exported or written back. Two
// things are deliberate here, both security-motivated:
//
// 1. Scope: excludes admins/superadmins/admin_sessions/owner_sessions/
//    owner_settings/owner_activity entirely -- a restore should never be
//    able to overwrite login accounts or silently sign everyone out --
//    and excludes outbox_emails/outbox_sms, since those are historical
//    message logs whose body can contain a plaintext password-reset code
//    or account-confirmation link (see server/routes/owner.js), not data
//    a restore actually needs.
//
// 2. Columns: farm_owners' password_hash, reset_code_hash/expires, and
//    confirm_token_hash/expires are left out of its list below -- a
//    downloaded backup file should never be able to leak (or restore) a
//    working credential or a live reset code. An owner whose row is
//    restored just uses "Forgot password" afterward.
//
// The column list also closes a SQL-injection hole: column names are
// interpolated directly into the INSERT statement during restore, so
// only ever building that list from this allowlist -- never from
// whatever keys happen to be on the uploaded JSON's rows -- means a
// crafted backup file can't smuggle an arbitrary string into raw SQL.
const TABLE_COLUMNS = {
  farm_owners: [
    'id', 'name', 'first_name', 'last_name', 'middle_name', 'email', 'phone',
    'country', 'region', 'province', 'city_municipality', 'barangay', 'street',
    'address', 'sector', 'geo_coordinates', 'piezo_health', 'status', 'color',
    'initials', 'avatar_url', 'registered_at', 'account_confirmed', 'row_hash',
  ],
  master_nodes: [
    'id', 'name', 'sector', 'owner_id', 'online', 'battery_percent', 'signal_rssi',
    'note', 'total_sensors', 'working_sensors', 'damaged_sensors', 'last_ping',
    'firmware_version', 'lat', 'lng', 'row_hash',
  ],
  piezo_sensors: ['id', 'node_id', 'tree_id', 'status', 'frequency_hz', 'voltage_mv', 'row_hash'],
  monitored_trees: [
    'id', 'owner_id', 'sector', 'row', 'col', 'x', 'y', 'status', 'threat_score',
    'pest_detected', 'vibration_frequency_hz', 'vibration_grams', 'last_inspected',
    'assigned_node_id', 'piezo_sensor_id', 'soil_moisture_percent', 'ambient_temp_c', 'row_hash',
  ],
  vibration_events: [
    'id', 'sector', 'tree_id', 'node_id', 'piezo_sensor_id', 'grams', 'frequency_hz',
    'severity', 'timestamp', 'pest_likely', 'pest_clicks', 'pest_band_ratio', 'row_hash',
  ],
  alerts: [
    'id', 'alert_type', 'title', 'sector', 'tree_id', 'node_id', 'pest', 'pest_type',
    'severity', 'description', 'grams', 'frequency_hz', 'threat_score', 'created_at',
    'reviewed', 'reviewed_at', 'reviewed_by', 'row_hash',
  ],
  notifications: [
    'id', 'icon', 'title', 'message', 'category', 'audience', 'owner_id', 'created_at',
    'is_read', 'row_hash',
  ],
};

// Parent-first, so a restore's INSERTs never hit a dangling foreign key
// (e.g. monitored_trees.owner_id needs its farm_owners row to already
// exist). Reversed for DELETE, so nothing is dropped out from under a
// row that still references it.
const BACKUP_TABLES = Object.keys(TABLE_COLUMNS);

router.get('/admin/backup/export', requireAdminAuth, async (req, res) => {
  const tables = {};
  for (const table of BACKUP_TABLES) {
    let rows = await db.prepare(`SELECT ${TABLE_COLUMNS[table].join(', ')} FROM ${table}`).all();
    if (table === 'farm_owners') {
      rows = transformFields(rows, FARM_OWNER_PII_FIELDS, encryptField);
    }
    tables[table] = rows;
  }

  res.json({
    ok: true,
    version: '2.4.8',
    exportedAt: new Date().toISOString(),
    exportedBy: req.adminRow.email,
    system: 'CocoSense Smart Plantation Telemetry',
    tables,
  });
});

router.post('/admin/backup/restore', requireAdminAuth, async (req, res) => {
  const { payload, integrityHash } = req.body || {};
  if (typeof payload !== 'string' || typeof integrityHash !== 'string') {
    return res.status(400).json({ ok: false, error: 'This file is not a valid CocoSense system backup.' });
  }

  // Independently re-verifies the integrity hash here, server-side,
  // rather than trusting that the Settings page already checked it --
  // anyone who can reach this API directly (bypassing the browser
  // entirely) could otherwise restore silently-tampered data with no
  // integrity check at all.
  const expectedHash = `sha256:${sha256Hex(payload)}`;
  if (expectedHash !== integrityHash) {
    return res.status(400).json({
      ok: false,
      error: "This backup failed the server's integrity check -- it may be corrupted or was edited after export. Restore refused.",
    });
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return res.status(400).json({ ok: false, error: 'Backup payload is not valid JSON.' });
  }
  const tables = parsedPayload && typeof parsedPayload === 'object' ? parsedPayload.tables : null;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    return res.status(400).json({ ok: false, error: 'This backup has no restorable data.' });
  }
  for (const table of BACKUP_TABLES) {
    if (table in tables && !Array.isArray(tables[table])) {
      return res.status(400).json({ ok: false, error: `Backup file's "${table}" data is malformed.` });
    }
  }

  // Decrypted -- and any decryption failure surfaced as a clean 400 --
  // before BEGIN even runs, so a backup file with corrupted/tampered
  // farm-owner PII is rejected without ever opening a transaction, let
  // alone deleting existing rows.
  if (Array.isArray(tables.farm_owners)) {
    try {
      tables.farm_owners = transformFields(tables.farm_owners, FARM_OWNER_PII_FIELDS, decryptField);
    } catch {
      return res.status(400).json({
        ok: false,
        error: "This backup's farm owner data could not be decrypted -- it may have been edited after export, or was exported with a different BACKUP_FIELD_KEY. Restore refused.",
      });
    }
  }

  let restoredRows = 0;
  await db.exec('BEGIN');
  try {
    // Children before parents, so no delete ever violates a foreign key
    // still pointing at a row from a table earlier in BACKUP_TABLES.
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }
    // Parents before children, mirroring BACKUP_TABLES' own order, so
    // every INSERT's foreign keys already resolve.
    for (const table of BACKUP_TABLES) {
      const allowedColumns = new Set(TABLE_COLUMNS[table]);
      const rows = tables[table] || []; // farm_owners' PII is already decrypted above
      for (const row of rows) {
        // Only ever insert columns this table's allowlist names -- any
        // other key present on the row is silently dropped instead of
        // ever reaching the SQL string (see the allowlist comment above).
        const columns = Object.keys(row).filter((c) => allowedColumns.has(c));
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((c) => {
          const v = row[c];
          // libSQL's driver rejects plain JS booleans -- every flag
          // column in schema.sql is already stored as 0/1 anyway.
          return typeof v === 'boolean' ? (v ? 1 : 0) : v;
        });
        await db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
        restoredRows += 1;
      }
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  res.json({ ok: true, restoredAt: new Date().toISOString(), restoredRows });
});

export default router;
