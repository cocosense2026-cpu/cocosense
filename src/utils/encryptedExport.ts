// Password-protected export/import for the report-style downloads
// across the admin console (Farm Owners, Municipality Map, Alert
// History, Bioacoustic Reports). Distinct from src/utils/exportHash.ts
// (which only stamps a SHA-256 integrity hash so tampering/corruption
// can be *detected*) and from server/fieldCrypto.js (which encrypts
// farm-owner PII inside the full System Backup with a server-held
// key): this file encrypts an export's *entire contents* with a
// password the admin chooses at export time, so the downloaded file
// itself can't be opened -- in a text editor, on another machine, by
// anyone who intercepts it -- without that password. Nothing here
// talks to the server; everything happens in the browser via
// SubtleCrypto, the same way exportHash.ts already does.
//
// AES-256-GCM (authenticated encryption) with a PBKDF2-SHA256 key
// derived from the password + a random salt: a wrong password fails
// to decrypt instead of silently producing garbage, and a random salt
// means the same password never produces the same ciphertext twice.

const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit GCM nonce
const FORMAT_VERSION = 1;

export interface DecryptedExport {
  content: string;
  mimeType: string;
  originalFilename: string;
  exportedAt?: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(password: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

// Turns "cocosense-farm-owners.csv" into "cocosense-farm-owners.locked.json" --
// always .json because the downloaded file's actual content is now the
// encryption envelope below, regardless of what format the plaintext
// (CSV, plain text report, ...) originally was.
function lockedFilename(originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.');
  const base = dot === -1 ? originalFilename : originalFilename.slice(0, dot);
  return `${base}.locked.json`;
}

// Encrypts `content` with `password` and triggers a browser download of
// the resulting envelope. Returns the plaintext's SHA-256 (useful for a
// confirmation toast), the same way downloadTextWithHash/downloadJsonWithHash do.
export async function encryptAndDownload(
  filename: string,
  content: string,
  mimeType: string,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(content)
  );
  const hash = await sha256Hex(content);

  const envelope = {
    cocosense_encrypted: true,
    v: FORMAT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    originalFilename: filename,
    mimeType,
    exportedAt: new Date().toISOString(),
    sha256: hash,
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lockedFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return hash;
}

// Reverses encryptAndDownload. Throws a friendly Error (never a raw
// DOMException) when the file isn't one of these envelopes, the
// password is wrong, or the ciphertext was tampered with -- GCM's
// built-in authentication tag makes those three indistinguishable at
// the crypto layer, which is intentional: telling an attacker "the
// password was right but the file was corrupted" would leak whether
// they'd guessed correctly.
export async function decryptFile(fileText: string, password: string): Promise<DecryptedExport> {
  let envelope: any;
  try {
    envelope = JSON.parse(fileText);
  } catch {
    throw new Error('This file is not a CocoSense encrypted export (not valid JSON).');
  }
  if (!envelope || envelope.cocosense_encrypted !== true || typeof envelope.ciphertext !== 'string') {
    throw new Error('This file is not a CocoSense encrypted export.');
  }
  if (envelope.v !== FORMAT_VERSION) {
    throw new Error('This encrypted export was made with a newer/older version of CocoSense and cannot be opened here.');
  }

  let plaintext: string;
  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const key = await deriveKey(password, salt, 'decrypt');
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fromBase64(envelope.ciphertext)
    );
    plaintext = new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Incorrect password, or this file is corrupted.');
  }

  if (typeof envelope.sha256 === 'string') {
    const actualHash = await sha256Hex(plaintext);
    if (actualHash !== envelope.sha256) {
      throw new Error('This file failed its integrity check after decrypting -- it may be corrupted.');
    }
  }

  return {
    content: plaintext,
    mimeType: envelope.mimeType || 'text/plain',
    originalFilename: envelope.originalFilename || 'decrypted-export.txt',
    exportedAt: envelope.exportedAt,
  };
}

// Lets the import preview also offer "save the decrypted copy to disk".
export function downloadPlainText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
