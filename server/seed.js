// Optional: run with `npm run seed`. Populates a small starter dataset so
// the app isn't blank on first run -- safe to skip entirely; the ingest
// endpoint will create/update real data as your device reports in.
// Re-running is safe (INSERT OR IGNORE on primary keys).
import './load-env.js'; // must stay first -- see comment in that file
import './db.js';
import { db } from './db.js';
import { hashDefaultPassword, hashPassword } from './auth.js';

// Demo admin console login -- see src/admin/. Password is intentionally
// simple/memorable since this is a demo account, not a real deployment.
await db.prepare(
  `INSERT OR IGNORE INTO admins (id, name, email, role, password_hash)
   VALUES (?,?,?,?,?)`
).run('ADM-0001', 'Demo Administrator', 'admin@cocosense.ph', 'System Administrator', hashPassword('admin123'));

// Demo Super Admin console login -- see src/superadmin/. Sits one level
// above the admin console above (provisions/deactivates Administrator
// accounts, doesn't touch plantation data directly).
await db.prepare(
  `INSERT OR IGNORE INTO superadmins (id, name, email, role, password_hash)
   VALUES (?,?,?,?,?)`
).run('SA-0001', 'Root Super Admin', 'superadmin@cocosense.ph', 'Super Administrator', hashPassword('super123'));

await db.prepare(
  `INSERT OR IGNORE INTO farm_owners
    (id, name, first_name, last_name, email, phone, country, region, province,
     city_municipality, barangay, street, address, sector, geo_coordinates, color, initials,
     account_confirmed, password_hash, must_change_password)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
).run(
  'COCO-0001', 'Demo Owner', 'Demo', 'Owner', 'demo@example.com', '+63 900 000 0000',
  'Philippines', 'Region II (Cagayan Valley)', 'Nueva Vizcaya', 'Bayombong', 'Barangay 1',
  'Sample St.', 'Sample St., Barangay 1, Bayombong, Nueva Vizcaya, Philippines',
  'Sector 1', '16.4833, 121.1500', '#059669', 'DO', 1, hashDefaultPassword()
);

// Matches nodeId in the merged ESP32 sketch (const char* nodeId = "MN-N1")
// so readings from the real device land against a node that already exists.
await db.prepare(
  `INSERT OR IGNORE INTO master_nodes
    (id, name, sector, owner_id, online, battery_percent, signal_rssi, firmware_version, lat, lng)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
).run('MN-N1', 'Master Node 1', 'Sector 1', 'COCO-0001', 1, 100, '-60 dBm (Strong)', 'v1.0', 16.4833, 121.1500);

await db.prepare(
  `INSERT OR IGNORE INTO monitored_trees
    (id, owner_id, sector, row, col, x, y, status, threat_score, pest_detected,
     vibration_frequency_hz, vibration_grams, assigned_node_id)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
).run('TR-0001', 'COCO-0001', 'Sector 1', 1, 1, 20, 30, 'No Pests', 0, 'None', 0, 0, 'MN-N1');

console.log('[seed] done.');

// The libSQL client keeps a connection handle open, which stops this
// one-off script from exiting on its own -- exit explicitly (the long-
// running server in index.js is unaffected, since it's meant to keep
// running anyway).
process.exit(0);
