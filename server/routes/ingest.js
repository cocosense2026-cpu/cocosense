import { Router } from 'express';
import { db } from '../db.js';
import { severityForGrams, piezoSensorId } from '../utils.js';
import { restampRowHash } from '../hash.js';
import { notifyOwner } from '../notify.js';

// Alert History is a review queue, not a permanent archive -- capping
// it keeps the admin/owner UI scrollable and the table from growing
// forever. Once a new alert pushes the count past this, the oldest
// alert (by created_at) is dropped, same "rolling window" pattern the
// vibration_events cap below already uses.
const MAX_ALERTS = 50;

async function capAlerts() {
  await db.prepare(
    `DELETE FROM alerts
     WHERE id NOT IN (
       SELECT id FROM alerts ORDER BY created_at DESC, id DESC LIMIT ?
     )`
  ).run(MAX_ALERTS);
}

const router = Router();

// Turn a raw LoRa RSSI (dBm) reading into the same human-readable label
// format the dashboard already displays (e.g. "-62 dBm (Strong)") --
// ported from the old PHP ingest endpoint's signal-quality mapping so a
// real device's readings show up in the UI exactly like the seed/mock
// data already does, instead of the bare "online" flag we had before.
function signalLabelFor(rssi) {
  const tier = rssi >= -70 ? 'Excellent' : rssi >= -90 ? 'Good' : rssi >= -110 ? 'Fair' : 'No Signal';
  return `${rssi} dBm (${tier})`;
}

// The ESP32 firmware POSTs readings very frequently (multiple times per
// second) and, once a pest-like pattern is detected, keeps reporting
// pest_likely:true on every single loop for as long as the condition
// holds -- there's no "I already reported this" state in the firmware.
// Left unthrottled, that turns one real detection into hundreds of
// duplicate alert/notification rows within minutes. These cooldowns
// make sure a human only sees ONE alert per node for a given ongoing
// condition, no matter how fast the device re-reports it. The raw
// reading itself (vibration_events, below) is NOT throttled -- that's
// what powers the live chart, and every real reading should show there.
const PEST_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const IMPACT_ALERT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

async function recentlyAlerted(nodeId, alertType, cooldownMs) {
  const row = await db
    .prepare(
      `SELECT created_at FROM alerts WHERE node_id = ? AND alert_type = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(nodeId, alertType);
  if (!row) return false;
  const ageMs = Date.now() - new Date(row.created_at.replace(' ', 'T') + 'Z').getTime();
  return ageMs < cooldownMs;
}

// The ESP32 firmware already POSTs this exact JSON shape:
//   { api_key, node_id, sector, grams, battery, rssi, pest_likely, pest_clicks, pest_band_ratio }
// so this endpoint is a drop-in target -- just change serverURL in the
// sketch to point here (see README "Connecting the device"). `battery`
// and `rssi` are optional -- omit them and the node's existing values
// are left untouched.
router.post('/ingest-vibration', async (req, res) => {
  const {
    api_key,
    node_id,
    piezo_id,
    sector,
    grams,
    battery,
    rssi,
    pest_likely,
    pest_clicks,
    pest_band_ratio,
  } = req.body || {};

  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: 'server misconfigured: DEVICE_API_KEY not set' });
  }
  if (!api_key || api_key !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'invalid api_key' });
  }
  if (typeof grams !== 'number' || Number.isNaN(grams)) {
    return res.status(400).json({ ok: false, error: 'grams (number) is required' });
  }
  if (!node_id) {
    return res.status(400).json({ ok: false, error: 'node_id is required' });
  }

  const severity = severityForGrams(grams);
  const pestLikely = !!pest_likely;

  // Which farm owner this node belongs to -- needed to route the alert
  // through that owner's Settings page toggles (Email/SMS/Push/Critical-
  // Only). A node not yet assigned to an owner just skips delivery.
  const nodeOwnerRow = await db.prepare(`SELECT owner_id FROM master_nodes WHERE id = ?`).get(node_id);
  const ownerId = nodeOwnerRow?.owner_id ?? null;

  // Every master node always has exactly 4 piezo transducers, one per
  // analog input (A0-A3 -- see PIEZO_PINS in utils.js). Real firmware
  // that's only wired to one physical sensor may not send `piezo_id`
  // at all -- in that case, attribute the reading to that node's A0
  // input (its default/primary transducer) so it still lands on a
  // specific Vibration Events panel instead of being orphaned, while
  // multi-sensor firmware can report each transducer separately by
  // passing its real piezo_id (e.g. "MN-N1-A2").
  const piezoSensorIdValue = piezo_id || piezoSensorId(node_id, 'A0');

  // 1. Always log the raw reading -- this is what powers charts /
  //    "recent logs", independent of severity or pest match.
  const vibrationInsert = await db.prepare(
    `INSERT INTO vibration_events (sector, node_id, piezo_sensor_id, grams, severity, pest_likely, pest_clicks, pest_band_ratio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sector ?? null,
    node_id,
    piezoSensorIdValue,
    grams,
    severity,
    pestLikely ? 1 : 0,
    pest_clicks ?? null,
    pest_band_ratio ?? null
  );
  await restampRowHash(db, 'vibration_events', 'id', vibrationInsert.lastInsertRowid);

  // Cap raw readings at 10 per sensor -- once a new reading pushes a
  // sensor's count past 10, the oldest one for that sensor is dropped so
  // vibration_events stays a rolling window instead of growing forever.
  // Scoped to piezo_sensor_id only -- alerts and notifications are
  // untouched and keep accumulating normally.
  await db.prepare(
    `DELETE FROM vibration_events
     WHERE piezo_sensor_id = ?
       AND id NOT IN (
         SELECT id FROM vibration_events
         WHERE piezo_sensor_id = ?
         ORDER BY timestamp DESC, id DESC
         LIMIT 10
       )`
  ).run(piezoSensorIdValue, piezoSensorIdValue);

  // Keep master_nodes' live health snapshot fresh if this node is already
  // registered. battery/signal are only touched when the device actually
  // sent them -- COALESCE keeps whatever was there before otherwise, so
  // an older/simpler sketch that only sends grams doesn't blank them out.
  const batteryPercent = battery != null ? Math.max(0, Math.min(100, Math.round(Number(battery)))) : null;
  const signalRssi = rssi != null ? signalLabelFor(Math.round(Number(rssi))) : null;

  await db.prepare(
    `UPDATE master_nodes
     SET last_ping = datetime('now'),
         online = 1,
         battery_percent = COALESCE(?, battery_percent),
         signal_rssi = COALESCE(?, signal_rssi)
     WHERE id = ?`
  ).run(batteryPercent, signalRssi, node_id);
  await restampRowHash(db, 'master_nodes', 'id', node_id);

  // Tracks whether the owner's on-site buzzer should sound for THIS
  // request specifically -- the device gets it back in the response
  // below, since a synchronous reply to its own POST is the only way
  // this system can reach the physical hardware right now (see
  // notify.js's notifyOwner for why it's decided there).
  let buzzer = false;

  // 2. Impact/tamper alert -- logged for ANY non-normal hit, regardless
  //    of pest match. Always recorded to Alert History; also fanned out
  //    to the owner's chosen channels (respecting their Settings page
  //    toggles) for Elevated/Critical hits, same cooldown as the alert
  //    itself so it can't spam a channel any faster than Alert History
  //    already throttles to.
  if (severity !== 'Normal' && !(await recentlyAlerted(node_id, 'impact', IMPACT_ALERT_COOLDOWN_MS))) {
    const impactInsert = await db.prepare(
      `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed)
       VALUES ('impact', ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      `${severity} Impact Detected`,
      sector ?? null,
      node_id,
      severity.toUpperCase(),
      `Piezo sensor ${piezoSensorIdValue} on ${node_id}${sector ? ' in ' + sector : ''} recorded a ${severity.toLowerCase()} impact (${grams.toFixed(2)}g).`,
      grams
    );
    await restampRowHash(db, 'alerts', 'id', impactInsert.lastInsertRowid);
    await capAlerts();

    const impactResult = await notifyOwner(ownerId, {
      icon: 'alert-triangle',
      title: `${severity} Impact Detected`,
      message: `${sector ?? node_id} (${node_id}) recorded a ${severity.toLowerCase()} vibration impact (${grams.toFixed(2)}g).`,
      category: 'IMPACT',
      severity,
    });
    buzzer = buzzer || impactResult.buzzer;
  }

  // 3. Pest alert + notification -- deliberately SEPARATE from the impact
  //    check above. Only a real feeding-pattern match creates a
  //    notification (bell icon) / would light up a pest-only dashboard
  //    banner; an ordinary knock never does, even if it's severe.
  //    Also throttled per-node -- see cooldown note above.
  if (pestLikely && !(await recentlyAlerted(node_id, 'pest', PEST_ALERT_COOLDOWN_MS))) {
    const pestDescription =
      `Piezo sensor ${piezoSensorIdValue} on ${node_id}${sector ? ' in ' + sector : ''} matched a sustained feeding-pattern signature` +
      (pest_clicks != null ? ` (${pest_clicks} matching windows` : '') +
      (pest_band_ratio != null ? `, band ratio ${Number(pest_band_ratio).toFixed(2)})` : pest_clicks != null ? ')' : '');

    const pestInsert = await db.prepare(
      `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed)
       VALUES ('pest', ?, ?, ?, 'CRITICAL', ?, ?, 0)`
    ).run(
      'Pest Feeding Pattern Detected',
      sector ?? null,
      node_id,
      pestDescription,
      grams
    );
    await restampRowHash(db, 'alerts', 'id', pestInsert.lastInsertRowid);
    await capAlerts();

    // Admin-console-wide bell notification (audience='admin', unchanged).
    const notificationMessage = `${sector ?? node_id} (${node_id}) matched a sustained feeding-pattern signature.`;
    const notificationInsert = await db.prepare(
      `INSERT INTO notifications (icon, title, message, category)
       VALUES (?, ?, ?, ?)`
    ).run('alert-triangle', 'Pest Feeding Pattern Detected', notificationMessage, 'PEST');
    await restampRowHash(db, 'notifications', 'id', notificationInsert.lastInsertRowid);

    // Owner-scoped fan-out (bell/email/SMS per that owner's Settings
    // toggles) -- pest detections are always treated as Critical.
    const pestResult = await notifyOwner(ownerId, {
      icon: 'alert-triangle',
      title: 'Pest Feeding Pattern Detected',
      message: notificationMessage,
      category: 'PEST',
      severity: 'Critical',
    });
    buzzer = buzzer || pestResult.buzzer;
  }

  res.json({ ok: true, severity, pest_likely: pestLikely, buzzer });
});

export default router;
