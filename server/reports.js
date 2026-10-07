// Monthly vibration report -- shared by the admin console (every owner's
// hardware, GET /admin/reports/vibration) and, historically, the owner
// portal. The caller picks the audience with a "scope":
//
//   ownerScope(ownerId)  one farm owner's nodes only
//   allOwnersScope()     every node that belongs to an owner (admin console)
//
// One entry per calendar month, newest first. The CURRENT month is always
// first (even before its first reading lands) and is flagged isCurrent;
// every earlier month that has readings follows below it. Nothing is
// stored or "rolled over" by a job -- months are derived from the readings'
// timestamps on every request, so the instant a new month begins the old
// one becomes a closed entry lower in the list and a fresh one takes the
// top spot.
//
// Months are cut in the viewer's own timezone, not UTC: the client sends
// ?tz=<minutes east of UTC> (e.g. 480 for the Philippines) so a reading at
// 11pm on the 31st lands in the month the viewer actually saw it in.
import { db } from './db.js';
import { severityForGrams, PIEZO_PINS, GRAMS_ELEVATED, GRAMS_CRITICAL } from './utils.js';

export const REPORT_MAX_MONTHS = 12;
// The trace sends the strongest reading in every 3-hour window (a device can
// post several readings a second, so sending them all would be huge). Quiet
// windows are 0, so the line goes flat like a real seismograph.
const TRACE_BUCKET_MIN = 180;
const TRACE_BUCKET_SEC = TRACE_BUCKET_MIN * 60;
const TRACE_PER_DAY = 1440 / TRACE_BUCKET_MIN;

export function ownerScope(ownerId) {
  return {
    where: `n.owner_id = ?`,
    args: [ownerId],
    join: '',
    nodeName: `n.name`,
  };
}

// Admin view: every node that has an owner. Node names such as "Sensor 1"
// repeat across owners, so the owner's name is appended to keep rows apart.
export function allOwnersScope() {
  return {
    where: `n.owner_id IS NOT NULL`,
    args: [],
    join: `LEFT JOIN farm_owners fo ON n.owner_id = fo.id`,
    nodeName: `(n.name || ' - ' || COALESCE(fo.name, n.owner_id))`,
  };
}

export function parseTz(raw) {
  const tz = parseInt(raw, 10);
  return Number.isFinite(tz) && tz >= -840 && tz <= 840 ? tz : 0;
}

// Same scoping as the Vibration Events feed: nothing from a damaged /
// unwired transducer. Built from vibration_rollup (15-minute windows, kept
// ~13 months), NOT vibration_events -- that table only holds the newest 10
// readings per sensor, so it can't describe a month.
function baseSql(scope, range) {
  return `FROM vibration_rollup r
      JOIN master_nodes n ON r.node_id = n.id
      ${scope.join}
      LEFT JOIN piezo_sensors p ON r.piezo_sensor_id = p.id
     WHERE ${scope.where}
       AND (p.status IS NULL OR p.status <> 'DAMAGED')
       AND ${range}`;
}

const num = (v, digits = 2) => (v == null ? 0 : Number(Number(v).toFixed(digits)));

export async function buildVibrationReport(scope, tz) {
  const modifier = `${tz >= 0 ? '+' : '-'}${Math.abs(tz)} minutes`;

  const localNow = new Date(Date.now() + tz * 60000);
  const curY = localNow.getUTCFullYear();
  const curM = localNow.getUTCMonth(); // 0-based
  const currentKey = `${curY}-${String(curM + 1).padStart(2, '0')}`;
  const today = localNow.getUTCDate();

  // Local midnight on the 1st of the oldest month we report, as unix seconds.
  const cutoff = Math.floor((Date.UTC(curY, curM - (REPORT_MAX_MONTHS - 1), 1) - tz * 60000) / 1000);

  const base = baseSql(scope, `r.bucket_ts >= ?`);

  const [monthRows, bucketRows, piezoRows, nodes] = await Promise.all([
    db
      .prepare(
        `SELECT strftime('%Y-%m', r.bucket_ts, 'unixepoch', ?) AS month,
                SUM(r.readings) AS readings, SUM(r.grams_sum) / SUM(r.readings) AS avg_grams,
                MAX(r.grams_peak) AS peak_grams,
                SUM(r.hz_sum) / NULLIF(SUM(r.hz_n), 0) AS avg_hz, SUM(r.pests) AS pests,
                SUM(r.critical) AS critical, SUM(r.elevated) AS elevated
           ${base} GROUP BY month`
      )
      .all(modifier, ...scope.args, cutoff),
    db
      .prepare(
        `SELECT CAST((r.bucket_ts + CAST(? AS INTEGER)) / CAST(? AS INTEGER) AS INTEGER) AS bucket,
                MAX(r.grams_peak) AS peak_grams
           ${base} GROUP BY bucket`
      )
      .all(tz * 60, TRACE_BUCKET_SEC, ...scope.args, cutoff),
    db
      .prepare(
        `SELECT strftime('%Y-%m', r.bucket_ts, 'unixepoch', ?) AS month, r.piezo_sensor_id AS piezo_id,
                MAX(n.id) AS node_id, MAX(${scope.nodeName}) AS node_name,
                SUM(r.readings) AS readings, SUM(r.grams_sum) / SUM(r.readings) AS avg_grams,
                MAX(r.grams_peak) AS peak_grams
           ${base} GROUP BY month, r.piezo_sensor_id`
      )
      .all(modifier, ...scope.args, cutoff),
    db.prepare(`SELECT COUNT(*) AS cnt FROM master_nodes n WHERE ${scope.where}`).get(...scope.args),
  ]);

  const monthsByKey = new Map(monthRows.map((r) => [r.month, r]));
  const bucketPeaks = new Map(bucketRows.map((r) => [Number(r.bucket), Number(r.peak_grams)]));
  const nowBucket = Math.floor(Math.floor(localNow.getTime() / 1000) / TRACE_BUCKET_SEC);
  const keys = new Set(monthsByKey.keys());
  keys.add(currentKey); // current month is always shown
  const ordered = [...keys].filter((k) => k <= currentKey).sort().reverse().slice(0, REPORT_MAX_MONTHS);

  const months = ordered.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const isCurrent = key === currentKey;
    const r = monthsByKey.get(key);
    const readings = Number(r?.readings ?? 0);
    const critical = Number(r?.critical ?? 0);
    const elevated = Number(r?.elevated ?? 0);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    // Strongest reading per 3-hour window, oldest -> newest. The current month
    // stops at "now" so the trace ends on the latest window.
    const startBucket = Math.floor(Date.UTC(y, m - 1, 1) / 1000 / TRACE_BUCKET_SEC);
    const totalBuckets = daysInMonth * TRACE_PER_DAY;
    const seriesLen = isCurrent ? Math.max(1, Math.min(totalBuckets, nowBucket - startBucket + 1)) : totalBuckets;
    const series = Array.from({ length: seriesLen }, (_, i) => num(bucketPeaks.get(startBucket + i)));

    const piezos = piezoRows
      .filter((x) => x.month === key)
      .map((x) => {
        const pin = String(x.piezo_id ?? '').split('-').pop();
        const idx = PIEZO_PINS.indexOf(pin);
        return {
          piezoId: x.piezo_id,
          nodeId: x.node_id,
          nodeName: x.node_name,
          label: idx >= 0 ? `Piezo ${idx + 1}` : 'Piezo',
          readings: Number(x.readings),
          avgGrams: num(x.avg_grams),
          peakGrams: num(x.peak_grams),
        };
      })
      .sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)) || a.label.localeCompare(b.label));

    return {
      key,
      year: y,
      month: m,
      isCurrent,
      daysInMonth,
      daysElapsed: isCurrent ? today : daysInMonth,
      totals: {
        readings,
        avgGrams: num(r?.avg_grams),
        peakGrams: num(r?.peak_grams),
        avgFrequencyHz: num(r?.avg_hz, 1),
        pestDetections: Number(r?.pests ?? 0),
        critical,
        elevated,
        normal: Math.max(0, readings - critical - elevated),
      },
      // UTC instant of local midnight on the 1st; point i of `series` is the
      // window starting startsAt + i * bucketMinutes.
      startsAt: new Date(Date.UTC(y, m - 1, 1) - tz * 60000).toISOString(),
      bucketMinutes: TRACE_BUCKET_MIN,
      series,
      piezos,
    };
  });

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    currentMonth: currentKey,
    nodesCount: Number(nodes?.cnt ?? 0),
    thresholds: { elevated: GRAMS_ELEVATED, critical: GRAMS_CRITICAL },
    months,
  };
}

// ---- CSV download ----
function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  // Node/sensor names are owner-editable text: stop a name such as
  // "=HYPERLINK(...)" from running as a formula when opened in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLine = (cells) => cells.map(csvCell).join(',');

function utcOffsetLabel(tzMin) {
  const a = Math.abs(tzMin);
  return `UTC${tzMin >= 0 ? '+' : '-'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
// "2026-08-14 09:15" in the viewer's local time.
function localStamp(epochSec, tzMin) {
  return new Date((epochSec + tzMin * 60) * 1000).toISOString().slice(0, 16).replace('T', ' ');
}
const r2 = (v) => (v == null ? 0 : Number(Number(v).toFixed(2)));

// Returns { error, status } for a bad request, or { csv, monthName }.
export async function buildVibrationCsv(scope, month, tz) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month ?? ''));
  if (!match) return { status: 400, error: 'Choose a month to download, for example 2026-08.' };
  const y = Number(match[1]);
  const m = Number(match[2]);

  const localNow = new Date(Date.now() + tz * 60000);
  const curY = localNow.getUTCFullYear();
  const curM = localNow.getUTCMonth();
  const key = (yy, mm0) => `${yy}-${String(mm0 + 1).padStart(2, '0')}`; // mm0 is 0-based
  const currentKey = key(curY, curM);
  const oldest = new Date(Date.UTC(curY, curM - (REPORT_MAX_MONTHS - 1), 1));
  if (month > currentKey) return { status: 400, error: "That month hasn't started yet." };
  if (month < key(oldest.getUTCFullYear(), oldest.getUTCMonth())) {
    return { status: 400, error: `Reports go back ${REPORT_MAX_MONTHS} months.` };
  }
  const isCurrent = month === currentKey;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // [start, end) of this local month, as unix seconds.
  const startSec = Math.floor((Date.UTC(y, m - 1, 1) - tz * 60000) / 1000);
  const endSec = Math.floor((Date.UTC(y, m, 1) - tz * 60000) / 1000);

  const base = baseSql(scope, `r.bucket_ts >= ? AND r.bucket_ts < ?`);
  const args = [...scope.args, startSec, endSec];

  const [totals, sensors, rows] = await Promise.all([
    db
      .prepare(
        `SELECT SUM(r.readings) AS readings, SUM(r.grams_sum) / SUM(r.readings) AS avg_grams,
                MAX(r.grams_peak) AS peak_grams, SUM(r.hz_sum) / NULLIF(SUM(r.hz_n), 0) AS avg_hz,
                SUM(r.pests) AS pests, SUM(r.critical) AS critical, SUM(r.elevated) AS elevated
           ${base}`
      )
      .get(...args),
    db
      .prepare(
        `SELECT r.piezo_sensor_id AS piezo_id, MAX(n.id) AS node_id, MAX(${scope.nodeName}) AS node_name,
                SUM(r.readings) AS readings, SUM(r.grams_sum) / SUM(r.readings) AS avg_grams,
                MAX(r.grams_peak) AS peak_grams, SUM(r.pests) AS pests
           ${base} GROUP BY r.piezo_sensor_id`
      )
      .all(...args),
    db
      .prepare(
        `SELECT r.bucket_ts, r.piezo_sensor_id AS piezo_id, n.id AS node_id, ${scope.nodeName} AS node_name,
                r.readings, r.grams_sum, r.grams_peak, r.pests
           ${base} ORDER BY r.bucket_ts, n.id, r.piezo_sensor_id LIMIT 200000`
      )
      .all(...args),
  ]);

  const readings = Number(totals?.readings ?? 0);
  if (readings === 0) {
    return { status: 404, error: 'There are no vibration readings in that month to download.' };
  }

  const sensorLabel = (piezoId) => {
    const idx = PIEZO_PINS.indexOf(String(piezoId ?? '').split('-').pop());
    return idx >= 0 ? `Piezo ${idx + 1}` : 'Piezo';
  };
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const critical = Number(totals.critical ?? 0);
  const elevated = Number(totals.elevated ?? 0);
  const avgHz = totals.avg_hz == null ? null : Number(Number(totals.avg_hz).toFixed(1));

  const out = [
    csvLine(['CocoSense Monthly Vibration Report']),
    csvLine(['Month', monthName]),
    csvLine(['Status', isCurrent ? `In progress (day ${localNow.getUTCDate()} of ${daysInMonth})` : 'Closed']),
    csvLine(['Time zone', utcOffsetLabel(tz)]),
    csvLine(['Generated (local time)', localStamp(Math.floor(Date.now() / 1000), tz)]),
    csvLine(['Thresholds (g)', `Elevated from ${GRAMS_ELEVATED}`, `Critical from ${GRAMS_CRITICAL}`]),
    '',
    csvLine(['SUMMARY']),
    csvLine(['Readings', readings]),
    csvLine(['Average strength (g)', r2(totals.avg_grams)]),
    csvLine(['Peak strength (g)', r2(totals.peak_grams)]),
    ...(avgHz != null ? [csvLine(['Average frequency (Hz)', avgHz])] : []),
    csvLine(['Pest signatures', Number(totals.pests ?? 0)]),
    csvLine(['Critical readings', critical]),
    csvLine(['Elevated readings', elevated]),
    csvLine(['Normal readings', Math.max(0, readings - critical - elevated)]),
    '',
    csvLine(['BY SENSOR']),
    csvLine(['Node', 'Sensor', 'Readings', 'Average (g)', 'Peak (g)', 'Pest signatures']),
    ...sensors
      .map((s) => ({ ...s, label: sensorLabel(s.piezo_id) }))
      .sort((a, b) => String(a.node_id).localeCompare(String(b.node_id)) || a.label.localeCompare(b.label))
      .map((s) => csvLine([s.node_name, s.label, Number(s.readings), r2(s.avg_grams), r2(s.peak_grams), Number(s.pests ?? 0)])),
    '',
    csvLine(['VIBRATION LOG - strongest reading in each 15-minute window (quiet windows are left out)']),
    csvLine(['Local time', 'Node', 'Sensor', 'Readings', 'Average (g)', 'Peak (g)', 'Severity', 'Pest signatures']),
    ...rows.map((r) =>
      csvLine([
        localStamp(Number(r.bucket_ts), tz),
        r.node_name,
        sensorLabel(r.piezo_id),
        Number(r.readings),
        r2(Number(r.grams_sum) / Math.max(1, Number(r.readings))),
        r2(r.grams_peak),
        severityForGrams(Number(r.grams_peak)),
        Number(r.pests ?? 0),
      ])
    ),
  ];

  // BOM so Excel opens it as UTF-8; CRLF line endings per the CSV spec.
  return { csv: '\uFEFF' + out.join('\r\n') + '\r\n', monthName };
}
