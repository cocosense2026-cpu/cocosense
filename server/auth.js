// Password hashing via Node's built-in crypto.scrypt -- deliberately no
// bcrypt/argon2 dependency, same "use what's already there" approach as
// the rest of server/. scrypt is a solid, still-current choice for this.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

const DEFAULT_PASSWORD = 'user123';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function hashDefaultPassword() {
  return hashPassword(DEFAULT_PASSWORD);
}

// ---------- Owner portal sessions ----------
// Opaque bearer token, not a JWT -- there's nothing here a client needs
// to read, so a random string looked up server-side (see
// server/routes/owner.js) is simpler and just as secure for this app's
// size. 30-day expiry, same as the old PHP "Remember Me" cookie.
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

export function sessionExpiryIso() {
  return new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
}

// ---------- Forgot-password reset codes ----------
// A 6-digit code, hashed with the same scrypt helper as a password so
// nothing readable ever sits in the DB, even briefly. 10-minute expiry.
const RESET_CODE_LIFETIME_MS = 10 * 60 * 1000;

export function generateResetCode() {
  // 000000-999999, zero-padded -- crypto-random, not Math.random().
  const n = randomBytes(4).readUInt32BE(0) % 1000000;
  return String(n).padStart(6, '0');
}

export function hashResetCode(code) {
  return hashPassword(code); // same salt:hash shape, different value space
}

export function verifyResetCode(code, stored) {
  return verifyPassword(code, stored);
}

export function resetCodeExpiryIso() {
  return new Date(Date.now() + RESET_CODE_LIFETIME_MS).toISOString();
}

// Used server-side when a strong new password is set. Frontend should
// mirror this so users see the requirement before submitting, but the
// backend is the source of truth -- never trust client-side validation
// alone for something like this.
export function passwordStrengthError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password === DEFAULT_PASSWORD) {
    return 'New password must be different from the default password.';
  }
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include a number.';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must include a symbol.';
  return null;
}

export { DEFAULT_PASSWORD };

// ---------- Account-confirmation link tokens ----------
// A newly-created owner can't log in until they click the link in their
// welcome email. Unlike a password/reset-code, the confirm endpoint has
// to look the owner up BY the token alone (it's the only thing in the
// URL) -- so this uses a plain, unsalted SHA-256 digest instead of the
// scrypt salt+hash helpers above: still one-way (a DB leak doesn't hand
// out working links), but deterministic, so `WHERE confirm_token_hash =
// ?` can find the row directly. 24-hour expiry, matching the old PHP
// build.
const CONFIRM_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function generateConfirmToken() {
  return randomBytes(32).toString('hex'); // sent as ?token=... in the email link
}

export function hashConfirmToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function confirmTokenExpiryIso() {
  return new Date(Date.now() + CONFIRM_TOKEN_LIFETIME_MS).toISOString();
}
