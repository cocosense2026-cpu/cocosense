// Fills in for real hardware: this project is a solar-powered LoRa
// mesh, so battery_percent should rise and fall with a day/night solar
// cycle, and signal_rssi should drift the way a real radio link does,
// even before every node has an actual ESP32 in the field posting to
// /api/ingest-vibration. Once a node's ingest.js writes DO start
// arriving, this module gets out of the way for that node automatically
// (see the last_ping check in tick() below) -- so nothing needs to be
// switched off by hand as real hardware comes online one node at a time.
import { db } from './db.js';
import { restampRowHash } from './hash.js';

// The frontend polls /api/nodes every 10s (see usePolling in
// src/App.tsx). Ticking a little faster than that means every poll
// picks up fresh numbers instead of occasionally landing between ticks.
const TICK_MS = 8000;

// A full simulated solar day, compressed into ten minutes, so a charge
// -> discharge -> charge cycle is actually visible in one sitting
// (a demo, a grading session) instead of only completing once every
// real 24 hours.
const DAY_CYCLE_MS = 10 * 60 * 1000;

// A node that received a real reading more recently than this is
// assumed to have live hardware attached -- its battery/signal are left
// exactly as that hardware reported them. Two ticks' worth of grace so
// a device that pings slightly slower than TICK_MS is never mistaken
// for "no hardware yet".
const REAL_HARDWARE_GRACE_MS = TICK_MS * 2;

function signalLabelFor(rssi) {
  const tier = rssi >= -70 ? 'Excellent' : rssi >= -90 ? 'Good' : rssi >= -110 ? 'Fair' : 'No Signal';
  return `${rssi} dBm (${tier})`;
}

// Deterministic pseudo-random in [0, 1) from an integer seed, so the
// same node id always gets the same "personality" below across server
// restarts, with no extra DB column needed just to remember it.
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// Per-node "character" so every node's battery and signal move
// independently instead of in obvious lockstep: some panels sit in more
// shade (lower amplitude), some nodes are just farther from the gateway
// (weaker signal baseline), each with its own point in the day cycle.
const nodeProfiles = new Map();

function profileFor(nodeId) {
  let profile = nodeProfiles.get(nodeId);
  if (profile) return profile;
  const h = hashString(nodeId);
  profile = {
    phaseOffsetMs: seededRandom(h) * DAY_CYCLE_MS,
    batteryAmplitude: 30 + seededRandom(h + 1) * 15, // how deep this panel's swing is
    batteryBase: 55 + seededRandom(h + 2) * 10,
    signalBaselineDbm: -58 - seededRandom(h + 3) * 48, // ~-58 (great) to ~-106 (weak)
    signalDriftPhase: seededRandom(h + 4) * 1000,
  };
  nodeProfiles.set(nodeId, profile);
  return profile;
}

async function tick() {
  const now = Date.now();
  let rows;
  try {
    rows = await db.prepare(`SELECT id, last_ping, online FROM master_nodes`).all();
  } catch (err) {
    console.warn('[simulate] Could not read master_nodes for this tick:', err.message);
    return;
  }

  for (const node of rows) {
    // Real hardware always wins -- don't fight a live device's own
    // reported numbers with simulated ones.
    if (node.last_ping) {
      const lastPingMs = new Date(String(node.last_ping).replace(' ', 'T') + 'Z').getTime();
      if (!Number.isNaN(lastPingMs) && now - lastPingMs < REAL_HARDWARE_GRACE_MS) continue;
    }
    // A node marked offline (decommissioned, or an admin took it down)
    // shouldn't come back to life just because the simulator ticked.
    if (!node.online) continue;

    const profile = profileFor(node.id);

    // Battery: smooth sine-wave day/night solar cycle, per-node phase
    // and depth, plus a touch of jitter so it doesn't look like a
    // perfect drawn curve.
    const phase = (((now + profile.phaseOffsetMs) % DAY_CYCLE_MS) + DAY_CYCLE_MS) % DAY_CYCLE_MS / DAY_CYCLE_MS;
    const solarLevel = profile.batteryBase + profile.batteryAmplitude * Math.sin(2 * Math.PI * (phase - 0.25));
    const jitter = (Math.random() - 0.5) * 2;
    const batteryPercent = Math.max(2, Math.min(100, Math.round(solarLevel + jitter)));

    // Signal: slow drift around this node's own baseline (changing
    // foliage, humidity, multipath), with an occasional deeper dip to
    // imitate something briefly getting in the way of the link.
    const driftPhase = now / 45000 + profile.signalDriftPhase;
    const drift = Math.sin(driftPhase) * 6;
    const obstruction = Math.random() < 0.04 ? -(8 + Math.random() * 12) : 0;
    const rssi = Math.round(
      Math.max(-118, Math.min(-45, profile.signalBaselineDbm + drift + obstruction))
    );
    const signalRssi = signalLabelFor(rssi);

    try {
      await db
        .prepare(`UPDATE master_nodes SET battery_percent = ?, signal_rssi = ? WHERE id = ?`)
        .run(batteryPercent, signalRssi, node.id);
      await restampRowHash(db, 'master_nodes', 'id', node.id);
    } catch (err) {
      console.warn(`[simulate] Failed to update telemetry for ${node.id}:`, err.message);
    }
  }
}

export function startTelemetrySimulation() {
  if (process.env.DISABLE_TELEMETRY_SIM === '1') {
    console.log('[simulate] Telemetry simulation disabled (DISABLE_TELEMETRY_SIM=1).');
    return;
  }
  console.log('[simulate] Simulating solar battery + LoRa signal telemetry for nodes with no live hardware yet.');
  tick(); // run once immediately so numbers aren't stale until the first interval fires
  setInterval(tick, TICK_MS);
}
