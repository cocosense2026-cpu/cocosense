import { Router } from 'express';
import { db } from '../db.js';
import { severityForGrams, piezoSensorId, normalizePin, splitNodeAndPin } from '../utils.js';
import { restampRowHash } from '../hash.js';
import { notifyOwner } from '../notify.js';
import { recordReading } from '../rollup.js';
import { ensureActiveTree } from '../trees.js';

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

// Cooldown is per node AND per piezo (and per tree): each piezo keeps its own
// alert history, so one piezo's alert must not swallow another piezo's.
async function recentlyAlerted(nodeId, alertType, cooldownMs, piezoId, nodeTreeId) {
  const row = await db
    .prepare(
      `SELECT created_at FROM alerts
        WHERE node_id = ? AND alert_type = ? AND piezo_sensor_id IS ? AND node_tree_id IS ?
        ORDER BY created_at DESC LIMIT 1`
    )
    .get(nodeId, alertType, piezoId ?? null, nodeTreeId ?? null);
  if (!row) return false;
  const ageMs = Date.now() - new Date(row.created_at.replace(' ', 'T') + 'Z').getTime();
  return ageMs < cooldownMs;
}

// Accepted payloads (both work):
//
//  1) BATCH -- what the base station now sends, ONE request per LoRa packet:
//       { api_key, node_id, sector, battery, rssi,
//         readings: [ { pin:"A0", grams, pest_likely, pest_clicks }, ... up to 4 ] }
//
//  2) SINGLE (legacy, older firmware):
//       { api_key, node_id, sector, grams, battery, rssi, pin | piezo_id,
//         pest_likely, pest_clicks, pest_band_ratio }
//
// Why batch: the gateway used to make 4 separate HTTPS requests per second,
// and every request paid for ~13 sequential round trips to the database.
// That is slower than 1 second, so the gateway's queue backed up and
// readings arrived minutes late (or were dropped). Now the node/tree/piezo
// lookups happen ONCE per packet, the per-piezo writes run in parallel,
// and the raw-log trim only runs every few readings.
const MAX_READINGS_PER_REQUEST = 8;
const TRIM_EVERY_N_READINGS = 10;
const RAW_RETENTION_PER_SENSOR = 600; // ~10 min of per-second readings per sensor
const trimCounters = new Map(); // per warm function instance; harmless if reset

async function storeReading(r, { node_id, nodeTreeId }) {
  const vibrationInsert = await db.prepare(
    `INSERT INTO vibration_events (sector, node_id, piezo_sensor_id, node_tree_id, grams, severity, pest_likely, pest_clicks, pest_band_ratio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    r.sector ?? null,
    node_id,
    r.piezoSensorIdValue,
    nodeTreeId,
    r.grams,
    r.severity,
    r.pestLikely ? 1 : 0,
    r.pest_clicks ?? null,
    r.pest_band_ratio ?? null
  );

  // Independent of each other once the row exists, so run together.
  await Promise.all([
    restampRowHash(db, 'vibration_events', 'id', vibrationInsert.lastInsertRowid),
    // A rollup failure must never drop the reading itself.
    recordReading(db, {
      piezoSensorId: r.piezoSensorIdValue,
      nodeId: node_id,
      nodeTreeId,
      grams: r.grams,
      pestLikely: r.pestLikely,
    }).catch((err) => console.warn('[ingest] rollup update failed:', err.message)),
  ]);

  // Rolling window: trim only every Nth reading per sensor instead of on
  // every single one (saves a DB round trip per reading; the table may
  // briefly hold a few rows over the cap, which is harmless).
  const key = `${r.piezoSensorIdValue}|${nodeTreeId}`;
  const n = (trimCounters.get(key) ?? 0) + 1;
  if (n >= TRIM_EVERY_N_READINGS) {
    trimCounters.set(key, 0);
    await db.prepare(
      `DELETE FROM vibration_events
       WHERE piezo_sensor_id = ? AND node_tree_id IS ?
         AND id NOT IN (
           SELECT id FROM vibration_events
           WHERE piezo_sensor_id = ? AND node_tree_id IS ?
           ORDER BY timestamp DESC, id DESC
           LIMIT ?
         )`
    ).run(r.piezoSensorIdValue, nodeTreeId, r.piezoSensorIdValue, nodeTreeId, RAW_RETENTION_PER_SENSOR);
  } else {
    trimCounters.set(key, n);
  }
}

router.post('/ingest-vibration', async (req, res) => {
  const body = req.body || {};
  const { api_key, node_id: rawNodeId, sector, battery, rssi } = body;

  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: 'server misconfigured: DEVICE_API_KEY not set' });
  }
  if (!api_key || api_key !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'invalid api_key' });
  }

  const split = rawNodeId ? splitNodeAndPin(rawNodeId) : { nodeId: rawNodeId, pin: null };
  const node_id = split.nodeId;
  if (!node_id) {
    return res.status(400).json({ ok: false, error: 'node_id is required' });
  }

  // Normalise both payload shapes into one list of readings.
  const rawReadings = Array.isArray(body.readings)
    ? body.readings.slice(0, MAX_READINGS_PER_REQUEST)
    : [{
        piezo_id: body.piezo_id,
        pin: body.pin ?? split.pin,
        grams: body.grams,
        pest_likely: body.pest_likely,
        pest_clicks: body.pest_clicks,
        pest_band_ratio: body.pest_band_ratio,
      }];

  const readings = [];
  for (const raw of rawReadings) {
    if (!raw || typeof raw.grams !== 'number' || Number.isNaN(raw.grams)) continue;
    const normalizedPin = normalizePin(raw.pin ?? split.pin);
    if (!raw.piezo_id && normalizedPin == null) {
      console.warn('[ingest] unrecognised/missing pin', JSON.stringify(raw.pin), 'from', node_id, '-> defaulting to A0');
    }
    readings.push({
      sector,
      grams: raw.grams,
      severity: severityForGrams(raw.grams),
      pestLikely: !!raw.pest_likely,
      pest_clicks: raw.pest_clicks,
      pest_band_ratio: raw.pest_band_ratio,
      piezoSensorIdValue: raw.piezo_id || piezoSensorId(node_id, normalizedPin || 'A0'),
    });
  }
  if (!readings.length) {
    return res.status(400).json({ ok: false, error: 'at least one reading with numeric grams is required' });
  }

  // ---- Once per packet (was once per piezo) ----
  const nodeOwnerRow = await db.prepare(`SELECT owner_id FROM master_nodes WHERE id = ?`).get(node_id);
  const ownerId = nodeOwnerRow?.owner_id ?? null;

  const activeTree = await ensureActiveTree(node_id, ownerId);
  const nodeTreeId = activeTree?.id ?? null;
  const treeSuffix = activeTree ? ` (${activeTree.name})` : '';

  // Which piezos the owner switched off for this tree -- one query for all.
  const offSensors = new Set();
  if (nodeTreeId != null) {
    const rows = await db
      .prepare(`SELECT piezo_sensor_id FROM tree_piezo_state WHERE node_tree_id = ? AND is_active = 0`)
      .all(nodeTreeId);
    for (const row of rows) offSensors.add(row.piezo_sensor_id);
  }
  for (const r of readings) r.piezoOff = offSensors.has(r.piezoSensorIdValue);

  const batteryPercent = battery != null ? Math.max(0, Math.min(100, Math.round(Number(battery)))) : null;
  const signalRssi = rssi != null ? signalLabelFor(Math.round(Number(rssi))) : null;

  // ---- Writes: all piezos + the node heartbeat in parallel ----
  await Promise.all([
    ...readings.filter((r) => !r.piezoOff).map((r) => storeReading(r, { node_id, nodeTreeId })),
    (async () => {
      await db.prepare(
        `UPDATE master_nodes
         SET last_ping = datetime('now'),
             online = 1,
             battery_percent = COALESCE(?, battery_percent),
             signal_rssi = COALESCE(?, signal_rssi)
         WHERE id = ?`
      ).run(batteryPercent, signalRssi, node_id);
      await restampRowHash(db, 'master_nodes', 'id', node_id);
    })(),
  ]);

  // ---- Alerts: sequential on purpose, so the per-node cooldown check sees
  //      an alert inserted by an earlier piezo in this same packet ----
  let buzzer = false;
  for (const r of readings) {
    if (r.piezoOff) continue;
    const { grams, severity, pestLikely, piezoSensorIdValue, pest_clicks, pest_band_ratio } = r;

    if (severity !== 'Normal' && !(await recentlyAlerted(node_id, 'impact', IMPACT_ALERT_COOLDOWN_MS, piezoSensorIdValue, nodeTreeId))) {
      const impactInsert = await db.prepare(
        `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed, node_tree_id, piezo_sensor_id)
         VALUES ('impact', ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(
        `${severity} Impact Detected`,
        sector ?? null,
        node_id,
        severity.toUpperCase(),
        `Piezo sensor ${piezoSensorIdValue} on ${node_id}${treeSuffix}${sector ? ' in ' + sector : ''} recorded a ${severity.toLowerCase()} impact (${grams.toFixed(2)}g).`,
        grams,
        nodeTreeId,
        piezoSensorIdValue
      );
      await restampRowHash(db, 'alerts', 'id', impactInsert.lastInsertRowid);
      await capAlerts();

      const impactResult = await notifyOwner(ownerId, {
        icon: 'alert-triangle',
        title: `${severity} Impact Detected`,
        message: `${sector ?? node_id} (${node_id})${treeSuffix} recorded a ${severity.toLowerCase()} vibration impact (${grams.toFixed(2)}g).`,
        category: 'IMPACT',
        severity,
      });
      buzzer = buzzer || impactResult.buzzer;
    }

    if (pestLikely && !(await recentlyAlerted(node_id, 'pest', PEST_ALERT_COOLDOWN_MS, piezoSensorIdValue, nodeTreeId))) {
      const pestDescription =
        `Piezo sensor ${piezoSensorIdValue} on ${node_id}${treeSuffix}${sector ? ' in ' + sector : ''} matched a sustained feeding-pattern signature` +
        (pest_clicks != null ? ` (${pest_clicks} matching windows` : '') +
        (pest_band_ratio != null ? `, band ratio ${Number(pest_band_ratio).toFixed(2)})` : pest_clicks != null ? ')' : '');

      const pestInsert = await db.prepare(
        `INSERT INTO alerts (alert_type, title, sector, node_id, severity, description, grams, reviewed, node_tree_id, piezo_sensor_id)
         VALUES ('pest', ?, ?, ?, 'CRITICAL', ?, ?, 0, ?, ?)`
      ).run('Pest Feeding Pattern Detected', sector ?? null, node_id, pestDescription, grams, nodeTreeId, piezoSensorIdValue);
      await restampRowHash(db, 'alerts', 'id', pestInsert.lastInsertRowid);
      await capAlerts();

      const notificationMessage = `${sector ?? node_id} (${node_id})${treeSuffix} matched a sustained feeding-pattern signature.`;
      const notificationInsert = await db.prepare(
        `INSERT INTO notifications (icon, title, message, category)
         VALUES (?, ?, ?, ?)`
      ).run('alert-triangle', 'Pest Feeding Pattern Detected', notificationMessage, 'PEST');
      await restampRowHash(db, 'notifications', 'id', notificationInsert.lastInsertRowid);

      const pestResult = await notifyOwner(ownerId, {
        icon: 'alert-triangle',
        title: 'Pest Feeding Pattern Detected',
        message: notificationMessage,
        category: 'PEST',
        severity: 'Critical',
      });
      buzzer = buzzer || pestResult.buzzer;
    }
  }

  const rank = { Normal: 0, Elevated: 1, Critical: 2 };
  const worst = readings.reduce((a, r) => (rank[r.severity] > rank[a] ? r.severity : a), 'Normal');
  res.json({
    ok: true,
    severity: worst,
    pest_likely: readings.some((r) => r.pestLikely),
    buzzer,
    stored: readings.filter((r) => !r.piezoOff).length,
    ...(readings.every((r) => r.piezoOff) ? { ignored: true } : {}),
  });
});

export default router;
