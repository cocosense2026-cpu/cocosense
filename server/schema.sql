-- CocoSense backend schema (SQLite)
-- Mirrors src/types.ts shapes so the frontend can be wired to real data
-- with minimal changes later. Nothing in src/ is touched by this file.

CREATE TABLE IF NOT EXISTS farm_owners (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  middle_name         TEXT,
  email               TEXT UNIQUE,
  phone               TEXT,
  country             TEXT,
  region              TEXT,
  province            TEXT,
  city_municipality   TEXT,
  barangay            TEXT,
  street              TEXT,
  address             TEXT,
  sector              TEXT,
  geo_coordinates     TEXT,
  piezo_health        TEXT DEFAULT 'Working',
  status              TEXT DEFAULT 'Active',
  color               TEXT DEFAULT '#059669',
  initials            TEXT,
  -- Profile picture, edited from the Owner Portal's Profile page (or
  -- set by an admin). Stored as a data URL (already resized/compressed
  -- client-side -- see src/components/AvatarUpload.tsx) so no extra
  -- file-storage/CDN setup is needed; falls back to the initials/color
  -- chip above when NULL. Shows up automatically in the admin and
  -- super admin consoles since they read this same row.
  avatar_url          TEXT,
  registered_at       TEXT DEFAULT (datetime('now')),
  account_confirmed   INTEGER DEFAULT 0,
  -- Account-confirmation link: an owner can't log in until they click
  -- the emailed link. confirm_token_hash is a deterministic SHA-256
  -- digest (see server/auth.js) so the confirm endpoint can look the
  -- owner up by token alone; cleared once used or once a fresh
  -- invitation is resent. 24-hour expiry.
  confirm_token_hash    TEXT,
  confirm_token_expires TEXT,
  -- Auth: every new owner starts on the shared default password and is
  -- required to change it before continuing. password_hash is
  -- "salt:hash" (scrypt, see server/auth.js) -- never returned by the API.
  password_hash       TEXT,
  must_change_password INTEGER DEFAULT 1,
  -- Forgot-password flow: a 6-digit code (hashed the same way as a
  -- password, so nothing readable sits in the DB) + expiry. Cleared once
  -- consumed or once a new one is requested. See server/routes/owner.js.
  reset_code_hash      TEXT,
  reset_code_expires   TEXT
);

-- One row per signed-in owner session. Deliberately NOT cookie-based --
-- the owner portal is a separate SPA route (/owner) from the admin
-- console, so a bearer token kept in the browser (see src/owner/) is
-- simpler than standing up express-session for one half of the app.
-- token is a random 32-byte hex string, opaque to the client.
CREATE TABLE IF NOT EXISTS owner_sessions (
  token               TEXT PRIMARY KEY,
  owner_id            TEXT NOT NULL REFERENCES farm_owners(id) ON DELETE CASCADE,
  created_at          TEXT DEFAULT (datetime('now')),
  expires_at          TEXT NOT NULL
);

-- Per-owner notification + display preferences, edited from the Owner
-- Portal's Settings page. One row per owner, created on first write.
CREATE TABLE IF NOT EXISTS owner_settings (
  owner_id              TEXT PRIMARY KEY REFERENCES farm_owners(id) ON DELETE CASCADE,
  notify_email          INTEGER DEFAULT 1,
  notify_sms            INTEGER DEFAULT 0,
  notify_push           INTEGER DEFAULT 1,
  local_buzzer_alert    INTEGER DEFAULT 1,
  notify_critical_only  INTEGER DEFAULT 0,
  theme                 TEXT DEFAULT 'Dark'
);

-- Short activity trail shown on the owner's Profile page ("Recent
-- Activity") -- signed in, changed password, updated profile, etc.
CREATE TABLE IF NOT EXISTS owner_activity (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id            TEXT NOT NULL REFERENCES farm_owners(id) ON DELETE CASCADE,
  action              TEXT NOT NULL,
  detail              TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS master_nodes (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  sector              TEXT,
  owner_id            TEXT REFERENCES farm_owners(id),
  online              INTEGER DEFAULT 1,
  battery_percent     INTEGER DEFAULT 100,
  signal_rssi         TEXT,
  note                TEXT,
  total_sensors       INTEGER DEFAULT 0,
  working_sensors     INTEGER DEFAULT 0,
  damaged_sensors     INTEGER DEFAULT 0,
  last_ping           TEXT,
  firmware_version    TEXT,
  lat                 REAL,
  lng                 REAL
);

CREATE TABLE IF NOT EXISTS piezo_sensors (
  id                  TEXT PRIMARY KEY,
  node_id             TEXT REFERENCES master_nodes(id),
  tree_id             TEXT,
  status              TEXT DEFAULT 'OPTIMAL',
  frequency_hz        REAL,
  voltage_mv          REAL
);

CREATE TABLE IF NOT EXISTS monitored_trees (
  id                        TEXT PRIMARY KEY,
  owner_id                  TEXT REFERENCES farm_owners(id),
  sector                    TEXT,
  row                       INTEGER,
  col                       INTEGER,
  x                         REAL,
  y                         REAL,
  status                    TEXT DEFAULT 'No Pests',
  threat_score              REAL DEFAULT 0,
  pest_detected             TEXT DEFAULT 'None',
  vibration_frequency_hz    REAL DEFAULT 0,
  vibration_grams           REAL DEFAULT 0,
  last_inspected            TEXT,
  assigned_node_id          TEXT REFERENCES master_nodes(id),
  piezo_sensor_id           TEXT,
  soil_moisture_percent     REAL,
  ambient_temp_c            REAL
);

-- Every raw reading a node/device sends in. Always written, regardless of
-- severity or pest match -- this is what backs charts / "recent logs".
CREATE TABLE IF NOT EXISTS vibration_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sector              TEXT,
  tree_id             TEXT,
  node_id             TEXT,
  piezo_sensor_id     TEXT,
  grams               REAL NOT NULL,
  frequency_hz        REAL,
  severity             TEXT DEFAULT 'Normal',
  timestamp           TEXT DEFAULT (datetime('now')),
  pest_likely         INTEGER DEFAULT 0,
  pest_clicks         INTEGER,
  pest_band_ratio     REAL
);

-- Reviewable alerts. alert_type distinguishes a hard-knock/tamper "impact"
-- event from a real feeding-pattern "pest" match, same split used on the
-- PHP side -- keep them separate so a dashboard/banner can filter to
-- alert_type = 'pest' only, without touching impact alerts.
CREATE TABLE IF NOT EXISTS alerts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type          TEXT NOT NULL DEFAULT 'impact', -- 'impact' | 'pest'
  title               TEXT,
  sector              TEXT,
  tree_id             TEXT,
  node_id             TEXT,
  pest                TEXT,
  pest_type           TEXT,
  severity            TEXT DEFAULT 'INFO',
  description         TEXT,
  grams               REAL,
  frequency_hz        REAL,
  threat_score        REAL,
  created_at          TEXT DEFAULT (datetime('now')),
  reviewed            INTEGER DEFAULT 0,
  reviewed_at         TEXT,
  reviewed_by         TEXT
);

-- audience/owner_id split the same feed between the admin console and
-- the owner portal: audience='admin', owner_id=NULL rows are the
-- existing admin-wide notifications (untouched); audience='owner' rows
-- belong to exactly one farm owner and only ever appear in their portal.
CREATE TABLE IF NOT EXISTS notifications (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  icon                TEXT,
  title               TEXT,
  message             TEXT,
  category            TEXT DEFAULT 'system',
  audience            TEXT DEFAULT 'admin',
  owner_id            TEXT REFERENCES farm_owners(id) ON DELETE CASCADE,
  created_at          TEXT DEFAULT (datetime('now')),
  is_read             INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outbox_emails (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  to_name             TEXT,
  to_email            TEXT,
  subject             TEXT,
  category            TEXT,
  body                TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  status              TEXT DEFAULT 'sent',
  delivery_status     TEXT DEFAULT 'delivered',
  delivery_error      TEXT
);

-- Admin console accounts. Separate from farm_owners -- an admin manages
-- the whole plantation network, not a single farm. Deliberately minimal
-- (no confirm-email / forgot-password flow like the owner portal has)
-- since accounts here are provisioned directly by whoever runs the
-- system, not self-registered.
CREATE TABLE IF NOT EXISTS admins (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  role                TEXT DEFAULT 'Administrator',
  -- Provisioned/deactivated from the Super Admin console -- a
  -- deactivated admin can no longer sign into the admin console (see
  -- requireActiveAdmin in server/routes/admin.js) but the row (and their
  -- history) is kept rather than deleted.
  status              TEXT DEFAULT 'Active',
  -- Profile picture, edited from the admin console's own Settings page.
  -- Same data-URL storage as farm_owners.avatar_url.
  avatar_url          TEXT,
  -- Auth: "salt:hash" (scrypt, see server/auth.js) -- never returned by the API.
  password_hash       TEXT NOT NULL,
  created_at          TEXT DEFAULT (datetime('now'))
);

-- One row per signed-in admin session. Same bearer-token pattern as
-- owner_sessions -- the admin console is a plain SPA route (mounted at
-- "/", outside /owner), so a token kept client-side is simpler than
-- standing up express-session.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token               TEXT PRIMARY KEY,
  admin_id            TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at          TEXT DEFAULT (datetime('now')),
  expires_at          TEXT NOT NULL
);

-- Super Admin accounts. Sits one level above the admin console: super
-- admins don't manage plantation data directly, they provision and
-- deactivate the Administrator accounts that do (see
-- server/routes/superadmin.js). Deliberately its own table -- same
-- reasoning as admins being separate from farm_owners -- so a
-- super-admin session can never be confused with a regular admin one.
CREATE TABLE IF NOT EXISTS superadmins (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  role                TEXT DEFAULT 'Super Administrator',
  password_hash       TEXT NOT NULL,
  -- Profile picture, edited from the Super Admin console's own Settings
  -- page. Same data-URL storage as farm_owners.avatar_url.
  avatar_url          TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS superadmin_sessions (
  token               TEXT PRIMARY KEY,
  superadmin_id       TEXT NOT NULL REFERENCES superadmins(id) ON DELETE CASCADE,
  created_at          TEXT DEFAULT (datetime('now')),
  expires_at          TEXT NOT NULL
);

-- Short activity trail shown on the Super Admin dashboard -- signing
-- in, creating an admin account, activating/deactivating one, etc.
-- Mirrors owner_activity's shape.
CREATE TABLE IF NOT EXISTS superadmin_activity (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  superadmin_id       TEXT NOT NULL REFERENCES superadmins(id) ON DELETE CASCADE,
  action              TEXT NOT NULL,
  detail              TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

-- ==INDEXES==
-- (do not remove the marker above -- server/db.js splits the file here
-- so table migrations can run before indexes reference new columns)
CREATE INDEX IF NOT EXISTS idx_vibration_events_time ON vibration_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type_reviewed ON alerts(alert_type, reviewed);
CREATE INDEX IF NOT EXISTS idx_trees_owner ON monitored_trees(owner_id);
CREATE INDEX IF NOT EXISTS idx_nodes_owner ON master_nodes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_id, audience);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_owner ON owner_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_activity_owner ON owner_activity(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owners_confirm_token ON farm_owners(confirm_token_hash);
CREATE INDEX IF NOT EXISTS idx_superadmin_sessions_sa ON superadmin_sessions(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_activity_sa ON superadmin_activity(superadmin_id, created_at DESC);
