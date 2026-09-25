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

// Every master node has exactly 4 analog inputs wired for piezo
// transducers -- A0 through A3. "Piezo N" numbering always maps to the
// pin 1:1 (A0 = Piezo 1 ... A3 = Piezo 4) so the label is meaningful to
// whoever is out at the tree with a multimeter, not just an arbitrary
// index.
export const PIEZO_PINS = ['A0', 'A1', 'A2', 'A3'];

export function piezoSensorId(nodeId, pin) {
  return `${nodeId}-${pin}`;
}

export function piezoLabel(pin) {
  const num = PIEZO_PINS.indexOf(pin) + 1;
  return `Piezo ${num > 0 ? num : '?'} (${pin})`;
}

export function severityForGrams(grams) {
  if (grams >= GRAMS_CRITICAL) return 'Critical';
  if (grams >= GRAMS_ELEVATED) return 'Elevated';
  return 'Normal';
}

// The real ESP32 firmware POSTs a reading to /ingest-vibration multiple
// times per second while it's powered on and reachable (see
// routes/ingest.js), so a gap this long since a node's last_ping means
// it has actually lost power or connectivity -- not just a stale flag.
// ingest-vibration only ever sets `online = 1`, it never flips a node
// back to 0 on its own, so trusting that stored column would leave a
// node that's gone dark in the field showing ONLINE forever. Deriving
// status from last_ping recency instead keeps it honest everywhere the
// node list is read (Admin, Owner, Super Admin consoles all share this).
export const NODE_OFFLINE_AFTER_MS = Number(process.env.NODE_OFFLINE_AFTER_MS ?? 3 * 60 * 1000); // 3 minutes

function lastPingEpochMs(lastPing) {
  if (!lastPing) return NaN;
  // Stored via SQLite datetime('now') as "YYYY-MM-DD HH:MM:SS" (UTC, no
  // offset marker) -- same parsing convention already used elsewhere in
  // this codebase (see relativeTime() on the client) for that format.
  return new Date(String(lastPing).replace(' ', 'T') + 'Z').getTime();
}

// Mutates a toCamel()'d master_nodes row in place with its real,
// recency-derived health snapshot, and returns it for chaining:
//  - online: only true if the device has ever actually reported AND
//    that report was recent enough to still trust.
//  - batteryPercent / signalRssi: a node that has never reported at all
//    has never really sent these values -- they're just the schema's
//    placeholder defaults (100%, null) -- so null them out instead of
//    presenting a device that's never connected as "86% battery".
//    Once a node HAS reported at least once, its last known battery/
//    signal are kept even while offline (still accurate, just stale --
//    the UI can label it accordingly), rather than being blanked out.
export function applyDerivedNodeHealth(node) {
  const ms = lastPingEpochMs(node.lastPing);
  const hasReported = !Number.isNaN(ms);
  node.online = hasReported && Date.now() - ms < NODE_OFFLINE_AFTER_MS;
  if (!hasReported) {
    node.batteryPercent = null;
    node.signalRssi = null;
  }
  return node;
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
