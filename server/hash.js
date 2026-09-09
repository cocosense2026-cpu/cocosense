// Server-side counterpart to src/utils/exportHash.ts. That file hashes
// an exported file's contents so a download can be verified later;
// this file hashes a row's data the moment it's written to the
// database, so every record -- not just what gets exported -- carries
// its own SHA-256 integrity fingerprint (stored in that table's
// `row_hash` column). Same algorithm both places (plain SHA-256 hex
// over a canonical JSON string), so "hash of the data" means the same
// thing everywhere in this app, whether the data is sitting in Turso
// or sitting in a downloaded CSV/JSON file.
import crypto from 'crypto';

// Deterministic stringify: object keys are sorted so the same field
// values always produce the same JSON string (and therefore the same
// hash) no matter what order they were inserted into the object in JS.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Computes the integrity hash for a row given the fields that were
// actually written (id/autoincrement PKs and DB-generated timestamps
// are deliberately left out by the caller -- the hash covers the
// meaningful data, not bookkeeping columns that don't tell you if the
// record was tampered with).
export function rowHash(fields) {
  return sha256Hex(stableStringify(fields));
}

// Stamps (or restamps) a row's integrity hash by reading the row back
// from the database and hashing every column except row_hash itself.
// Used both right after an INSERT (once the row -- and any DB-applied
// column defaults, like `status DEFAULT 'Active'` -- actually exists)
// and after an UPDATE changes a row's data. Always hashing the row as
// it truly sits in the database, rather than the JS object that was
// bound to the INSERT/UPDATE params, is what keeps this reliable: a
// pre-insert hash of "just the fields I passed in" would drift out of
// sync the moment a column default or trigger fills something in that
// wasn't in that JS object.
export async function restampRowHash(db, table, idColumn, idValue) {
  const row = await db.prepare(`SELECT * FROM ${table} WHERE ${idColumn} = ?`).get(idValue);
  if (!row) return;
  const { row_hash, ...fields } = row;
  await db.prepare(`UPDATE ${table} SET row_hash = ? WHERE ${idColumn} = ?`).run(rowHash(fields), idValue);
}
