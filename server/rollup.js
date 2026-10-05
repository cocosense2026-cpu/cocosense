// Long-term vibration history (table: vibration_rollup, see schema.sql).
//
// vibration_events keeps only the newest 10 readings per sensor, so the
// week chart and the monthly report can't be built from it. Instead every
// ingested reading is also folded into one row per sensor per 15-minute
// window. 15 minutes is the finest grain that still lines up exactly with
// every real-world timezone (offsets are whole multiples of 15 minutes),
// so a month boundary in the owner's local time never splits a window.
//
// Size: a sensor that vibrates around the clock adds 96 rows/day, and
// quiet windows add nothing -- a few tens of thousands of rows a year
// per sensor at the very worst, versus millions of raw readings.
import { GRAMS_ELEVATED, GRAMS_CRITICAL } from './utils.js';

export const ROLLUP_BUCKET_SEC = 15 * 60;
// A little over the 12 months the report shows, so the oldest month is
// never cut short by pruning.
const ROLLUP_RETENTION_DAYS = 400;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

export function bucketStart(epochSec) {
  return Math.floor(epochSec / ROLLUP_BUCKET_SEC) * ROLLUP_BUCKET_SEC;
}

// Folds one reading into its 15-minute row. Safe under concurrent posts:
// it is a single atomic UPSERT, so two readings landing in the same window
// can't overwrite each other.
export async function recordReading(db, { piezoSensorId, nodeId, grams, pestLikely, frequencyHz }) {
  const bucket = bucketStart(Math.floor(Date.now() / 1000));
  const hasHz = typeof frequencyHz === 'number' && Number.isFinite(frequencyHz);
  await db
    .prepare(
      `INSERT INTO vibration_rollup
         (piezo_sensor_id, bucket_ts, node_id, readings, grams_sum, grams_peak, hz_sum, hz_n, pests, critical, elevated)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(piezo_sensor_id, bucket_ts) DO UPDATE SET
         node_id    = excluded.node_id,
         readings   = readings + 1,
         grams_sum  = grams_sum + excluded.grams_sum,
         grams_peak = MAX(grams_peak, excluded.grams_peak),
         hz_sum     = hz_sum + excluded.hz_sum,
         hz_n       = hz_n + excluded.hz_n,
         pests      = pests + excluded.pests,
         critical   = critical + excluded.critical,
         elevated   = elevated + excluded.elevated`
    )
    .run(
      piezoSensorId,
      bucket,
      nodeId,
      grams,
      grams,
      hasHz ? frequencyHz : 0,
      hasHz ? 1 : 0,
      pestLikely ? 1 : 0,
      grams >= GRAMS_CRITICAL ? 1 : 0,
      grams >= GRAMS_ELEVATED && grams < GRAMS_CRITICAL ? 1 : 0
    );

  // Housekeeping at most once an hour per process, never on the hot path
  // of every reading.
  const now = Date.now();
  if (now - lastPruneAt > PRUNE_EVERY_MS) {
    lastPruneAt = now;
    const cutoff = Math.floor(now / 1000) - ROLLUP_RETENTION_DAYS * 86400;
    db.prepare(`DELETE FROM vibration_rollup WHERE bucket_ts < ?`)
      .run(cutoff)
      .catch((err) => console.warn('[rollup] prune failed:', err.message));
  }
}

// Strongest reading (g) in each `bucketMinutes` window across the last 7
// days, oldest -> newest, ending at the current window. Quiet windows are
// 0, so the chart draws a flat line like a seismograph. Returned as a bare
// number array plus a start time rather than {timestamp, grams, severity}
// objects: the owner pages poll every 10 seconds, and this is ~25x smaller
// (672 numbers for a week of 15-minute windows is about 3 KB).
export async function weekPeaks(db, piezoSensorId, bucketMinutes = 15) {
  const step = bucketMinutes * 60;
  const count = Math.round((7 * 24 * 60) / bucketMinutes);
  const nowIdx = Math.floor(Date.now() / 1000 / step);
  const firstIdx = nowIdx - count + 1;
  const rows = await db
    .prepare(
      `SELECT CAST(bucket_ts / CAST(? AS INTEGER) AS INTEGER) AS idx, MAX(grams_peak) AS peak
         FROM vibration_rollup
        WHERE piezo_sensor_id = ? AND bucket_ts >= ?
        GROUP BY idx`
    )
    .all(step, piezoSensorId, firstIdx * step);
  const peaks = new Array(count).fill(0);
  for (const r of rows) {
    const i = Number(r.idx) - firstIdx;
    if (i >= 0 && i < count) peaks[i] = Number(Number(r.peak).toFixed(2));
  }
  return {
    startsAt: new Date(firstIdx * step * 1000).toISOString(),
    bucketMinutes,
    peaks,
  };
}
