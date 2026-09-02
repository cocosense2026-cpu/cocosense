// Converts snake_case sqlite columns -> camelCase keys so JSON responses
// match the shapes already used in src/types.ts (grams stays "grams",
// but e.g. tree_id -> treeId, created_at -> createdAt, etc).
export function toCamel(row) {
  if (row == null) return row;
  if (Array.isArray(row)) return row.map(toCamel);
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

// Grams -> severity bucket. TUNE THESE against real hits from your
// device -- these are placeholder thresholds, not calibrated values.
export const GRAMS_ELEVATED = Number(process.env.GRAMS_ELEVATED ?? 1.5);
export const GRAMS_CRITICAL = Number(process.env.GRAMS_CRITICAL ?? 5.0);

export function severityForGrams(grams) {
  if (grams >= GRAMS_CRITICAL) return 'Critical';
  if (grams >= GRAMS_ELEVATED) return 'Elevated';
  return 'Normal';
}

// Profile-picture uploads (admin/superadmin/farm-owner profiles) are
// sent as a base64 data URL and stored as-is in avatar_url -- no
// separate file storage needed for this project's scale. The client
// (src/components/AvatarUpload.tsx) already resizes/compresses to a
// small JPEG before sending, but we still cap the size server-side
// since the client is not a trust boundary.
const AVATAR_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([a-zA-Z0-9+/]+=*)$/;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB, matches the 6mb JSON body cap with headroom

// Returns an error string if `value` isn't acceptable as an avatarUrl,
// or null if it's fine to store as-is. `null`/`undefined`/`''` are
// treated as "clear the picture" by the caller, not validated here.
export function validateAvatarDataUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return 'Profile picture must be an image upload.';
  const match = value.match(AVATAR_DATA_URL_RE);
  if (!match) return 'Profile picture must be a PNG, JPEG, WEBP, or GIF image.';
  // Rough byte size from base64 length (4 chars ~= 3 bytes), good
  // enough for a sanity cap without decoding the whole payload.
  const approxBytes = Math.floor((match[2].length * 3) / 4);
  if (approxBytes > AVATAR_MAX_BYTES) return 'Profile picture is too large (max 2MB).';
  return null;
}
