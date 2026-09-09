// Turso (libSQL) -- a hosted, SQLite-compatible database reached over
// HTTPS. This replaces the local node:sqlite file so data survives
// redeploys/restarts on hosts (like Render's free tier) that don't
// give you a persistent disk. The SQL itself is unchanged from plain
// SQLite; only *how* queries run changed (network call -> always
// async), so every call site now awaits db.prepare(sql).get/all/run().
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    'TURSO_DATABASE_URL is not set. Create a free database at https://turso.tech, ' +
    'then copy .env.example to .env and fill in TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.'
  );
}

const client = createClient({ url, authToken });

// Only one BEGIN/COMMIT/ROLLBACK transaction can be open at a time --
// fine for this app's traffic (infrequent admin actions, not a
// high-concurrency API). Two admins clicking "Delete"/"Expand Nodes"
// at close to the same moment used to be able to race on a shared
// `activeTx` flag: request B's BEGIN could see the flag still unset
// (because request A's `await client.transaction('write')` hadn't
// resolved yet) and open a second transaction, silently overwriting
// request A's reference -- whichever request committed/rolled back
// last would then be operating on the WRONG transaction object, and
// if a request threw before reaching COMMIT/ROLLBACK at all, the flag
// stayed stuck "open" forever, permanently 500-ing every future
// transactional request until the process restarted (see the postmortem
// for the 2026-09-08 registration outage).
//
// Fixed with a proper async mutex: BEGIN calls queue up and run their
// transaction one at a time in arrival order instead of racing, and
// the lock is released in a `finally` around COMMIT/ROLLBACK (and
// immediately if BEGIN itself fails to open) so a failed transaction
// can never wedge the lock open for good.
let activeTx = null;
let lockChain = Promise.resolve();
let releaseLock = null;

function acquireTxLock() {
  const waitForTurn = lockChain;
  lockChain = new Promise((resolveNextTurn) => {
    waitForTurn.then(() => {
      // This request now holds the lock; releaseLock() hands it to
      // whoever is next in line.
      releaseLock = resolveNextTurn;
    });
  });
  return waitForTurn;
}

async function exec1(sql, args = []) {
  const executor = activeTx ?? client;
  return executor.execute({ sql, args });
}

export const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const res = await exec1(sql, params);
        return res.rows[0] ?? undefined;
      },
      async all(...params) {
        const res = await exec1(sql, params);
        return res.rows;
      },
      async run(...params) {
        const res = await exec1(sql, params);
        return {
          changes: Number(res.rowsAffected ?? 0),
          lastInsertRowid: res.lastInsertRowid,
        };
      },
    };
  },

  // Mirrors node:sqlite's db.exec(): runs a raw statement or a
  // multi-statement script. Also doubles as the transaction control
  // surface, since the route files already call db.exec('BEGIN') /
  // ('COMMIT') / ('ROLLBACK') around a block of .run() calls.
  async exec(sql) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed === 'BEGIN') {
      await acquireTxLock();
      try {
        activeTx = await client.transaction('write');
      } catch (err) {
        // Never actually opened -- free the lock immediately instead
        // of leaving the next request waiting on a transaction that
        // doesn't exist.
        activeTx = null;
        const release = releaseLock;
        releaseLock = null;
        if (release) release();
        throw err;
      }
      return;
    }
    if (trimmed === 'COMMIT') {
      if (activeTx) {
        const tx = activeTx;
        activeTx = null;
        try {
          await tx.commit();
        } finally {
          const release = releaseLock;
          releaseLock = null;
          if (release) release();
        }
      }
      return;
    }
    if (trimmed === 'ROLLBACK') {
      if (activeTx) {
        const tx = activeTx;
        activeTx = null;
        try {
          await tx.rollback();
        } finally {
          const release = releaseLock;
          releaseLock = null;
          if (release) release();
        }
      }
      return;
    }
    // Schema/migration script: multiple ;-separated statements in one
    // string. executeMultiple() is libSQL's built-in equivalent of
    // node:sqlite's db.exec() for scripts -- handles statement
    // splitting correctly (comments, blank statements, etc.), which a
    // naive sql.split(';') does not.
    await client.executeMultiple(sql);
  },
};

// schema.sql is split into a "tables" half and an "indexes" half by the
// ==INDEXES== marker comment. We run tables -> migrations -> indexes, in
// that order, because some indexes (e.g. on notifications.owner_id)
// reference columns that only exist after migrations run -- on a
// database created before the owner portal was added, running the
// indexes together with the original CREATE TABLE statements would
// fail with "no such column" before the migration ever got a chance to
// add it.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const [tablesSql, indexesSql] = schema.split('-- ==INDEXES==');
await db.exec(tablesSql);

// Defensive migration: CREATE TABLE IF NOT EXISTS above won't add new
// columns to a farm_owners/notifications table created by an older
// version of this schema (e.g. before the owner portal was added). Try
// each ALTER once; SQLite errors (harmlessly) if the column is already
// there, which we just swallow.
const migrations = [
  `ALTER TABLE farm_owners ADD COLUMN reset_code_hash TEXT`,
  `ALTER TABLE farm_owners ADD COLUMN reset_code_expires TEXT`,
  `ALTER TABLE farm_owners ADD COLUMN confirm_token_hash TEXT`,
  `ALTER TABLE farm_owners ADD COLUMN confirm_token_expires TEXT`,
  `ALTER TABLE notifications ADD COLUMN audience TEXT DEFAULT 'admin'`,
  `ALTER TABLE notifications ADD COLUMN owner_id TEXT REFERENCES farm_owners(id) ON DELETE CASCADE`,
  `ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'Active'`,
  `ALTER TABLE farm_owners ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE admins ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE superadmins ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE vibration_events ADD COLUMN piezo_sensor_id TEXT`,
  // row_hash: SHA-256 integrity fingerprint of each row's data fields,
  // stamped at write time (see server/hash.js). Added across every
  // data table -- not just new ones -- so a pre-existing database
  // upgrades to the same guarantee new rows get.
  `ALTER TABLE farm_owners ADD COLUMN row_hash TEXT`,
  `ALTER TABLE owner_settings ADD COLUMN row_hash TEXT`,
  `ALTER TABLE owner_activity ADD COLUMN row_hash TEXT`,
  `ALTER TABLE master_nodes ADD COLUMN row_hash TEXT`,
  `ALTER TABLE piezo_sensors ADD COLUMN row_hash TEXT`,
  `ALTER TABLE monitored_trees ADD COLUMN row_hash TEXT`,
  `ALTER TABLE vibration_events ADD COLUMN row_hash TEXT`,
  `ALTER TABLE alerts ADD COLUMN row_hash TEXT`,
  `ALTER TABLE notifications ADD COLUMN row_hash TEXT`,
  `ALTER TABLE outbox_emails ADD COLUMN row_hash TEXT`,
  `ALTER TABLE admins ADD COLUMN row_hash TEXT`,
  `ALTER TABLE superadmins ADD COLUMN row_hash TEXT`,
  `ALTER TABLE superadmin_activity ADD COLUMN row_hash TEXT`,
];
for (const sql of migrations) {
  try { await db.exec(sql); } catch { /* column already exists -- fine */ }
}

if (indexesSql) await db.exec(indexesSql);

console.log(`[db] Turso ready at ${url}`);
