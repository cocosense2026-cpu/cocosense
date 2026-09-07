import { Router } from 'express';
import { db } from '../db.js';
import { severityForGrams } from '../utils.js';

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

  const expectedKey = process.env.DEVICE_API_KEY || 'Luna-1327';
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

  // Every master node always has exactly 6 piezo transducers (S1-S6,
  // provisioned in provisionMasterNodes). Real firmware that's only
  // wired to one physical sensor may not send `piezo_id` at all -- in
  // that case, attribute the reading to that node's first transducer
  // (`{node_id}-S1`) so it still lands on a specific Vibration Events
  // panel instead of being orphaned, while multi-sensor firmware can
  // report each transducer separately by passing its real piezo_id.
  const piezoSensorId = piezo_id || `${node_id}-S1`;

  // 1. Always log the raw reading -- this is what powers charts /
  //    "recent logs", independent of severity or pest match.
  await db.prepare(
    `INSERT INTO vibration_events (sector, node_id, piezo_sensor_id, grams, severity, pest_likely, pest_clicks, pest_band_ratio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sector ?? null,
    node_id,
    piezoSensorId,
    grams,
    severity,
    pestLikely ? 1 : 0,
    pest_clicks ?? null,
    pest_band_ratio ?? null
  );

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

  // 2. Impact/tamper alert -- logged for ANY non-normal hit, regardless
  //    of pest match. Goes to Alert History, NOT to notifications.
  //    Throttled per-node so a sustained hard vibration doesn't create
  //    a new alert on every single reading (see cooldown note above).
  if (severity !== 'Normal' && !(await recentlyAlerted(node_id, 'impact', IMPACT_ALERT_COOLDOWN_MS))) {
    await db.prepare(
      `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed)
       VALUES ('impact', ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      `${severity} Impact Detected`,
      sector ?? null,
      node_id,
      severity.toUpperCase(),
      `Piezo sensor ${piezoSensorId} on ${node_id}${sector ? ' in ' + sector : ''} recorded a ${severity.toLowerCase()} impact (${grams.toFixed(2)}g).`,
      grams
    );
  }

  // 3. Pest alert + notification -- deliberately SEPARATE from the impact
  //    check above. Only a real feeding-pattern match creates a
  //    notification (bell icon) / would light up a pest-only dashboard
  //    banner; an ordinary knock never does, even if it's severe.
  //    Also throttled per-node -- see cooldown note above.
  if (pestLikely && !(await recentlyAlerted(node_id, 'pest', PEST_ALERT_COOLDOWN_MS))) {
    await db.prepare(
      `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed)
       VALUES ('pest', ?, ?, ?, 'CRITICAL', ?, ?, 0)`
    ).run(
      'Pest Feeding Pattern Detected',
      sector ?? null,
      node_id,
      `Piezo sensor ${piezoSensorId} on ${node_id}${sector ? ' in ' + sector : ''} matched a sustained feeding-pattern signature` +
        (pest_clicks != null ? ` (${pest_clicks} matching windows` : '') +
        (pest_band_ratio != null ? `, band ratio ${Number(pest_band_ratio).toFixed(2)})` : pest_clicks != null ? ')' : ''),
      grams
    );

    await db.prepare(
      `INSERT INTO notifications (icon, title, message, category)
       VALUES ('alert-triangle', ?, ?, 'pest')`
    ).run(
      'Pest Feeding Pattern Detected',
      `${sector ?? node_id} (${node_id}) matched a sustained feeding-pattern signature.`
    );
  }

  res.json({ ok: true, severity, pest_likely: pestLikely });
});

export default router;
