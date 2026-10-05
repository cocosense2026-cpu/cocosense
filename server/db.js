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

  // Runs many statements as ONE atomic transaction in a SINGLE network
  // round trip. `statements` is an array of [sql, argsArray]. The
  // interactive BEGIN/COMMIT path above costs one round trip per
  // statement, which is fine for a handful of writes but far too slow for
  // a full-system restore (thousands of rows) on a serverless host: the
  // function hits Netlify's execution limit and the browser sees a 504.
  async batch(statements) {
    if (!statements.length) return [];
    return client.batch(
      statements.map(([sql, args = []]) => ({ sql, args })),
      'write'
    );
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

// Locate schema.sql across two different layouts:
//  - Local/Render (`node server/index.js`): schema.sql sits right next
//    to this file, so the dirname-relative path resolves directly.
//  - Netlify Functions: esbuild bundles this file into
//    netlify/functions/api.js, so `dirname` points at
//    /var/task/netlify/functions -- NOT where schema.sql ends up.
//    netlify.toml's `included_files = ["server/schema.sql"]` copies it
//    into the deploy preserving its ORIGINAL repo-relative path, so it
//    actually lands at /var/task/server/schema.sql. process.cwd() is
//    /var/task in that environment, so joining it with 'server/schema.sql'
//    matches where included_files actually put the file.
function resolveSchemaPath() {
  const candidates = [
    path.join(dirname, 'schema.sql'),
    path.join(process.cwd(), 'server', 'schema.sql'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `schema.sql not found. Checked:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
    );
  }
  return found;
}

// schema.sql is split into a "tables" half and an "indexes" half by the
// ==INDEXES== marker comment. We run tables -> migrations -> indexes, in
// that order, because some indexes (e.g. on notifications.owner_id)
// reference columns that only exist after migrations run -- on a
// database created before the owner portal was added, running the
// indexes together with the original CREATE TABLE statements would
// fail with "no such column" before the migration ever got a chance to
// add it.
const schema = fs.readFileSync(resolveSchemaPath(), 'utf8');
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
  // last_seen_at: presence for the admin console's Recent Activity page
  // (who is online right now). owner_access_log itself is a brand-new
  // table, so CREATE TABLE IF NOT EXISTS in schema.sql covers it.
  `ALTER TABLE owner_sessions ADD COLUMN last_seen_at TEXT`,
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

  // Previously this fired every ALTER TABLE in `migrations` one after
  // another and swallowed the "duplicate column" error from each. On a
  // remote Turso database that is ~30 sequential network round-trips on
  // EVERY cold start, which on Netlify (cold starts are frequent, and the
  // function may be far from the database) can take longer than the
  // browser's request timeout -- the admin console then shows "The server
  // didn't respond in time" for whatever the first request happened to be
  // (e.g. Export System Backup). Instead, read each affected table's
  // columns once (in parallel) and only run the ALTERs that are actually
  // missing -- usually none, so a warm database costs one parallel wave.
  const alterRe = /^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/i;
  const wanted = migrations.map((sql) => {
    const m = sql.match(alterRe);
    return m ? { sql, table: m[1], column: m[2].toLowerCase() } : { sql, table: null, column: null };
  });
  const tablesToCheck = [...new Set(wanted.map((w) => w.table).filter(Boolean))];
  const existingColumns = {};
  await Promise.all(
    tablesToCheck.map(async (table) => {
      const info = await client.execute(`PRAGMA table_info(${table})`);
      existingColumns[table] = new Set(info.rows.map((r) => String(r.name).toLowerCase()));
    })
  );
  for (const w of wanted) {
    if (w.table && existingColumns[w.table]?.has(w.column)) continue; // already migrated
    try { await db.exec(w.sql); } catch { /* column already exists -- fine */ }
  }

  if (indexesSql) await db.exec(indexesSql);

  // vibration_rollup is new, so an existing database starts with it empty
  // even though vibration_events already holds readings. Seed it once from
  // those (only when completely empty, so this can never double-count
  // against live ingest) -- afterwards ingest.js keeps it current.
  try {
    const have = await client.execute(`SELECT COUNT(*) AS n FROM vibration_rollup`);
    if (Number(have.rows[0]?.n ?? 0) === 0) {
      const elevated = Number(process.env.GRAMS_ELEVATED ?? 1.5);
      const critical = Number(process.env.GRAMS_CRITICAL ?? 5.0);
      await client.execute({
        sql: `INSERT OR IGNORE INTO vibration_rollup
                (piezo_sensor_id, bucket_ts, node_id, readings, grams_sum, grams_peak, hz_sum, hz_n, pests, critical, elevated)
              SELECT piezo_sensor_id,
                     (CAST(strftime('%s', timestamp) AS INTEGER) / 900) * 900 AS b,
                     MAX(node_id), COUNT(*), SUM(grams), MAX(grams),
                     COALESCE(SUM(frequency_hz), 0), COUNT(frequency_hz),
                     SUM(COALESCE(pest_likely, 0)),
                     SUM(CASE WHEN grams >= ? THEN 1 ELSE 0 END),
                     SUM(CASE WHEN grams >= ? AND grams < ? THEN 1 ELSE 0 END)
                FROM vibration_events
               WHERE piezo_sensor_id IS NOT NULL AND node_id IS NOT NULL AND timestamp IS NOT NULL
               GROUP BY piezo_sensor_id, b`,
        args: [critical, elevated, critical],
      });
    }
  } catch (err) {
    console.warn('[db] vibration_rollup backfill skipped:', err.message);
  }
  console.log(`[db] Ready at ${url}`);
}

export const ready = initDb();
