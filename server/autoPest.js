// Automatic Infected / Cleared for a piezo on a tree, driven by the readings
// the device sends (called from routes/ingest.js for every reading).
//
//   INFECTED  8 readings IN A ROW that are Elevated or Critical on the same
//             piezo while it sits on a tree. Any Normal reading in between
//             starts the count again from zero.
//   CLEARED   a piezo that is INFECTED and then reports ONLY Normal readings
//             for 10 minutes straight (the tree has been treated).
//
// Both go through setPiezoState(), exactly like the owner's own Infected /
// Cleared buttons, so the Vibration Events page shows them straight away and
// the admin Monthly Report counts them (tree_pest_events history): a tree that
// is auto-cleared leaves Infected and is counted under Cleared.
//
// The running count lives in the database (tree_piezo_auto), not in memory,
// because the API can run as short-lived serverless functions that don't
// share memory between requests.
import { db } from './db.js';
import { setPiezoState, piezoStatesForTrees, DEFAULT_PIEZO_STATE } from './trees.js';

export const AUTO_INFECT_AFTER_READINGS = 8;
export const AUTO_CLEAR_AFTER_SECONDS = 10 * 60;
// If readings stop arriving for longer than this the run is broken: a device
// that was off for an hour has NOT "been normal" for that hour.
export const AUTO_MAX_GAP_SECONDS = 120;

export async function applyAutoPestStatus(treeId, piezoId, severity, nowSec = Math.floor(Date.now() / 1000)) {
  const abnormal = severity === 'Elevated' || severity === 'Critical';

  const row = await db
    .prepare(`SELECT streak, normal_since, settled, last_ts FROM tree_piezo_auto WHERE node_tree_id = ? AND piezo_sensor_id = ?`)
    .get(treeId, piezoId);

  let streak = Number(row?.streak ?? 0);
  let normalSince = row?.normal_since == null ? null : Number(row.normal_since);
  let settled = Number(row?.settled ?? 0);
  if (row?.last_ts != null && nowSec - Number(row.last_ts) > AUTO_MAX_GAP_SECONDS) {
    streak = 0;
    normalSince = null;
    settled = 0;
  }

  if (abnormal) {
    streak += 1;
    normalSince = null;
    settled = 0;
  } else {
    streak = 0;
    if (normalSince == null) {
      normalSince = nowSec;
      settled = 0;
    }
  }

  await db
    .prepare(
      `INSERT INTO tree_piezo_auto (node_tree_id, piezo_sensor_id, streak, normal_since, settled, last_ts)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(node_tree_id, piezo_sensor_id) DO UPDATE SET
         streak = excluded.streak, normal_since = excluded.normal_since,
         settled = excluded.settled, last_ts = excluded.last_ts`
    )
    .run(treeId, piezoId, streak, normalSince, settled, nowSec);

  const currentPest = async () =>
    ((await piezoStatesForTrees([treeId])).get(`${treeId}:${piezoId}`) ?? DEFAULT_PIEZO_STATE).pest;

  if (abnormal && streak >= AUTO_INFECT_AFTER_READINGS) {
    if ((await currentPest()) !== 'INFECTED') {
      await setPiezoState(treeId, piezoId, { pest: 'INFECTED' }, { auto: true });
      return 'INFECTED';
    }
  } else if (!abnormal && !settled && normalSince != null && nowSec - normalSince >= AUTO_CLEAR_AFTER_SECONDS) {
    // Look once per normal run (settled), not on every reading afterwards.
    let result = null;
    if ((await currentPest()) === 'INFECTED') {
      await setPiezoState(treeId, piezoId, { pest: 'CLEARED' }, { auto: true });
      result = 'CLEARED';
    }
    await db
      .prepare(`UPDATE tree_piezo_auto SET settled = 1 WHERE node_tree_id = ? AND piezo_sensor_id = ?`)
      .run(treeId, piezoId);
    return result;
  }
  return null;
}
