// Field-level encryption for personally identifiable data inside a
// downloaded system backup (see server/routes/backup.js). This is
// deliberately separate from hash.js's row_hash: row_hash is a
// one-way SHA-256 fingerprint used to detect tampering, and can never
// be turned back into the original value. PII needs the opposite
// property here -- a downloaded backup file must be unreadable to
// anyone who just opens it in a text editor, but "Restore From
// Backup" still has to recover the exact original name/email/phone/
// address so the running app keeps working (owner login by email,
// SMS/email notifications, etc). That means encryption, not hashing.
//
// AES-256-GCM: authenticated encryption, so a byte edited anywhere in
// an encrypted field (someone hand-tampering the JSON) makes it fail
// to decrypt instead of silently decrypting into garbage that then
// gets written into the database on restore.
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the size GCM is designed for
const PREFIX = 'enc:v1:';

let cachedKey = null;

// BACKUP_FIELD_KEY must be a 64-character hex string (32 bytes) kept
// in server/.env -- never committed, never included in the backup
// file itself. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Losing this key means existing encrypted backups can no longer be
// restored; rotating it does not affect the live database, only future
// exports (and it should be treated the same as any other secret --
// e.g. TURSO_AUTH_TOKEN -- when it comes to storage and rotation).
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.BACKUP_FIELD_KEY;
  if (!raw || raw.length !== 64 || !/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error(
      'BACKUP_FIELD_KEY is missing or invalid in server/.env -- set it to a 64-character ' +
      'hex string (32 bytes) before exporting or restoring a backup. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  cachedKey = Buffer.from(raw, 'hex');
  return cachedKey;
}

// Encrypts a single field value for storage inside the exported JSON.
// null/undefined/'' pass through unchanged -- there's nothing to hide
// in an empty field, and it keeps the backup's shape predictable
// (e.g. middle_name is legitimately null for most owners).
export function encryptField(value) {
  if (value === null || value === undefined || value === '') return value;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Reverses encryptField. Throws if the value is tagged as encrypted
// but fails to decrypt/authenticate (wrong key, or tampered bytes) --
// callers should let that abort the restore rather than insert
// corrupted PII into the database.
export function decryptField(value) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value; // not encrypted, pass through
  const key = getKey();
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Applies encryptField/decryptField to a specific set of column names
// on every row in `rows`, leaving all other columns untouched.
export function transformFields(rows, fields, transform) {
  return rows.map((row) => {
    const next = { ...row };
    for (const field of fields) {
      if (field in next) next[field] = transform(next[field]);
    }
    return next;
  });
}
