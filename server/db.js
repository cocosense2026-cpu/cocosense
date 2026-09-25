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

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Local-first: if TURSO_DATABASE_URL isn't set (or is unset/blank), fall
// back to a local SQLite file on disk via libSQL's embedded "file:" mode.
// This needs no network access and no Turso account -- exactly what you
// want when running on localhost. Set TURSO_DATABASE_URL (and
// TURSO_AUTH_TOKEN) in server/.env if you'd rather point at a hosted
// Turso database instead.
const DEFAULT_LOCAL_DB_PATH = path.join(dirname, 'data', 'cocosense.db');
// Only meaningful for the local `file:` fallback below. On a serverless
// host (Netlify Functions) the deployed function bundle's own directory
// is read-only, so this would throw EROFS if TURSO_DATABASE_URL isn't
// set -- guarded so a missing Turso config surfaces as a clear "no
// database configured" error from the query below instead of crashing
// every cold start before a single request is even handled.
try {
  fs.mkdirSync(path.dirname(DEFAULT_LOCAL_DB_PATH), { recursive: true });
} catch {
  // Read-only filesystem and TURSO_DATABASE_URL is set -- fine, this
  // directory is never touched in that case anyway.
}

const url = process.env.TURSO_DATABASE_URL || `file:${DEFAULT_LOCAL_DB_PATH}`;
// Auth tokens are only meaningful (and only required) for remote
// libsql://.../https:// Turso URLs -- a local file: URL doesn't need one.
const authToken = url.startsWith('file:') ? undefined : process.env.TURSO_AUTH_TOKEN;

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
const schema = fs.readFileSync(path.join(dirname, 'schema.sql'), 'utf8');
const [tablesSql, indexesSql] = schema.split('-- ==INDEXES==');

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
  `ALTER TABLE outbox_sms ADD COLUMN row_hash TEXT`,
  `ALTER TABLE admins ADD COLUMN row_hash TEXT`,
  `ALTER TABLE superadmins ADD COLUMN row_hash TEXT`,
  `ALTER TABLE superadmin_activity ADD COLUMN row_hash TEXT`,
  // linked_at: when a master node's current owner_id was set (not when
  // the row was created) -- distinct from "created" because a stock
  // node (server/routes/superadmin.js POST /superadmin/nodes) can sit
  // owner_id = NULL for a while before someone scans its QR. This is
  // what lets the Super Admin console tell an owner's FIRST master node
  // (earliest linked_at) apart from ones they added later via
  // POST /owner/nodes/link, so it can group a whole owner's mesh under
  // that first node instead of listing every hub as its own top-level
  // entry.
  `ALTER TABLE master_nodes ADD COLUMN linked_at TEXT`,
];

// No top-level `await` here on purpose: esbuild can't compile top-level
// await to CommonJS, which is the format Netlify Functions (v1 handler
// style, like this one) are always bundled to -- regardless of this
// project's "type": "module" setting, which only affects the Vite/
// frontend build. A top-level await here made esbuild fail during
// Netlify's function bundling step, which made Netlify silently fall
// back to shipping the raw, un-bundled source -- and THAT is what
// caused the "Cannot use import statement outside a module" crash at
// runtime. Wrapping init in this async function and exporting the
// resulting promise as `ready` (awaited by server/index.js before any
// request is handled) gets the exact same behavior without a literal
// top-level `await` keyword.
async function initDb() {
  await db.exec(tablesSql);
  for (const sql of migrations) {
    try { await db.exec(sql); } catch { /* column already exists -- fine */ }
  }
  if (indexesSql) await db.exec(indexesSql);
  console.log(`[db] Ready at ${url}`);
}

export const ready = initDb();
