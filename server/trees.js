// Trees a master node has been placed on (table: node_trees, see schema.sql).
//
// An owner typically has far fewer devices than trees, so a device is moved
// from tree to tree. Each tree owns its own readings (vibration_events /
// vibration_rollup carry node_tree_id), and exactly one tree per node is
// "active" -- the one new readings are filed under.
import { db } from './db.js';
import { restampRowHash } from './hash.js';

export const MAX_TREES_PER_NODE = 500;
export const MAX_TREE_NAME_LENGTH = 60;

// Owners name their own trees ("Tree 1" is only the starting name). Returns
// the cleaned name, or null if nothing usable was typed. Control characters
// are dropped and runs of whitespace collapsed so a name can't break layout
// or sneak in invisible duplicates. Longer names are rejected by the caller
// (not silently cut) so the owner sees what was actually saved.
export function cleanTreeName(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

// Two trees on the same device can't share a name (case-insensitive), or
// the tabs would be indistinguishable.
export async function treeNameTaken(nodeId, name, exceptId = null) {
  const row = await db
    .prepare(`SELECT id FROM node_trees WHERE node_id = ? AND lower(name) = lower(?) AND id != ? LIMIT 1`)
    .get(nodeId, name, exceptId ?? -1);
  return !!row;
}

export async function renameTree(id, name) {
  await db.prepare(`UPDATE node_trees SET name = ? WHERE id = ?`).run(name, id);
  await restampTree(id);
}

async function restampTree(id) {
  await restampRowHash(db, 'node_trees', 'id', id);
}

// Everything that predates trees (NULL tree on raw events, 0 on rollup rows)
// belongs to the node's first tree -- it was all recorded on one tree, the
// one the device was on. Also picks up readings that arrive while a node has
// no owner yet. Restamps the few raw rows touched so their row_hash stays
// valid (vibration_events only ever holds ~10 rows per sensor).
async function adoptUntaggedReadings(nodeId, treeId) {
  const raw = await db
    .prepare(`SELECT id FROM vibration_events WHERE node_id = ? AND node_tree_id IS NULL`)
    .all(nodeId);
  if (raw.length) {
    await db.prepare(`UPDATE vibration_events SET node_tree_id = ? WHERE node_id = ? AND node_tree_id IS NULL`).run(treeId, nodeId);
    for (const r of raw) await restampRowHash(db, 'vibration_events', 'id', r.id);
  }
  await db.prepare(`UPDATE vibration_rollup SET node_tree_id = ? WHERE node_id = ? AND node_tree_id = 0`).run(treeId, nodeId);
}

export async function createTree(nodeId, ownerId, { activate = true, name = null } = {}) {
  const next = await db
    .prepare(`SELECT COALESCE(MAX(number), 0) + 1 AS n FROM node_trees WHERE node_id = ?`)
    .get(nodeId);
  const number = Number(next.n);
  // Inserted inactive first: if this loses a race on the unique
  // (node_id, number) index it throws BEFORE touching whichever tree is
  // currently active. Activation is a separate atomic step below.
  const result = await db
    .prepare(`INSERT INTO node_trees (node_id, owner_id, number, name, is_active) VALUES (?, ?, ?, ?, 0)`)
    .run(nodeId, ownerId ?? null, number, name ?? `Tree ${number}`);
  const id = Number(result.lastInsertRowid);
  if (activate) await activateTree({ id, node_id: nodeId });
  else await restampTree(id);
  return id;
}

// Makes sure `nodeId` has at least one tree, creating "Tree 1" (and filing
// all older readings under it) on first use. Returns the node's active tree
// row, or null when the node has no owner yet (nothing to attach a tree to).
export async function ensureActiveTree(nodeId, ownerId) {
  let active = await db.prepare(`SELECT * FROM node_trees WHERE node_id = ? AND is_active = 1`).get(nodeId);
  if (active) return active;

  // Trees exist but none is active (shouldn't happen) -> reactivate the newest.
  const newest = await db.prepare(`SELECT * FROM node_trees WHERE node_id = ? ORDER BY number DESC LIMIT 1`).get(nodeId);
  if (newest) {
    await db.prepare(`UPDATE node_trees SET is_active = 1 WHERE id = ?`).run(newest.id);
    await restampTree(newest.id);
    return { ...newest, is_active: 1 };
  }

  if (!ownerId) return null;
  try {
    const id = await createTree(nodeId, ownerId);
    await adoptUntaggedReadings(nodeId, id);
    return await db.prepare(`SELECT * FROM node_trees WHERE id = ?`).get(id);
  } catch (err) {
    // A concurrent reading created the node's first tree a moment ago
    // (unique index on node_id + number) -- just use that one.
    const winner = await db.prepare(`SELECT * FROM node_trees WHERE node_id = ? ORDER BY number LIMIT 1`).get(nodeId);
    if (winner) return winner;
    throw err;
  }
}

// Deletes a tree together with everything recorded under it (raw log, 15-min
// rollup, piezo notes). Alerts and notifications already raised stay in the
// owner's history -- they are records of what happened, not tree data.
// If it was the tree the device is on, the device moves to its neighbour
// (the previous tree, or the next one for the first) in the SAME atomic
// batch, so there is never a moment with no active tree. Returns the id of
// the tree that became active, or null when the deleted one wasn't active.
// The caller must make sure the node keeps at least one other tree.
export async function deleteTree(tree) {
  const siblings = await db
    .prepare(`SELECT id, number FROM node_trees WHERE node_id = ? AND id != ? ORDER BY number`)
    .all(tree.node_id, tree.id);
  let replacementId = null;
  const statements = [];
  if (tree.is_active && siblings.length) {
    const before = siblings.filter((s) => Number(s.number) < Number(tree.number));
    replacementId = Number((before.length ? before[before.length - 1] : siblings[0]).id);
    statements.push([`UPDATE node_trees SET is_active = 0 WHERE node_id = ?`, [tree.node_id]]);
    statements.push([`UPDATE node_trees SET is_active = 1 WHERE id = ?`, [replacementId]]);
  }
  statements.push([`DELETE FROM vibration_events WHERE node_tree_id = ?`, [tree.id]]);
  statements.push([`DELETE FROM vibration_rollup WHERE node_tree_id = ?`, [tree.id]]);
  statements.push([`DELETE FROM tree_piezo_state WHERE node_tree_id = ?`, [tree.id]]);
  statements.push([`DELETE FROM node_trees WHERE id = ?`, [tree.id]]);
  await db.batch(statements);
  if (replacementId != null) await restampTree(replacementId);
  return replacementId;
}

export const PEST_STATUSES = ['INFECTED', 'CLEARED'];

// The owner's per-piezo notes for one tree, as Map<piezoSensorId, {active, pest}>.
// A piezo with no row is the default: active, no pest status.
export async function piezoStatesForTrees(treeIds) {
  const out = new Map();
  if (!treeIds.length) return out;
  const rows = await db
    .prepare(
      `SELECT node_tree_id, piezo_sensor_id, is_active, pest_status FROM tree_piezo_state
       WHERE node_tree_id IN (${treeIds.map(() => '?').join(',')})`
    )
    .all(...treeIds);
  for (const r of rows) {
    out.set(`${r.node_tree_id}:${r.piezo_sensor_id}`, { active: Number(r.is_active) !== 0, pest: r.pest_status ?? null });
  }
  return out;
}

export const DEFAULT_PIEZO_STATE = { active: true, pest: null };

// Applies a partial change ({active?, pest?}) on top of the stored state.
export async function setPiezoState(treeId, piezoId, patch) {
  const cur = (await piezoStatesForTrees([treeId])).get(`${treeId}:${piezoId}`) ?? DEFAULT_PIEZO_STATE;
  const next = {
    active: patch.active !== undefined ? !!patch.active : cur.active,
    pest: patch.pest !== undefined ? patch.pest : cur.pest,
  };
  await db
    .prepare(
      `INSERT INTO tree_piezo_state (node_tree_id, piezo_sensor_id, is_active, pest_status, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(node_tree_id, piezo_sensor_id) DO UPDATE SET
         is_active = excluded.is_active, pest_status = excluded.pest_status, updated_at = excluded.updated_at`
    )
    .run(treeId, piezoId, next.active ? 1 : 0, next.pest);
  return next;
}

// Makes `treeId` the node's active tree. Atomic, so a reading arriving
// mid-switch never sees zero or two active trees.
export async function activateTree(tree) {
  const prev = await db.prepare(`SELECT id FROM node_trees WHERE node_id = ? AND is_active = 1`).all(tree.node_id);
  await db.batch([
    [`UPDATE node_trees SET is_active = 0 WHERE node_id = ?`, [tree.node_id]],
    [`UPDATE node_trees SET is_active = 1 WHERE id = ?`, [tree.id]],
  ]);
  for (const p of prev) await restampTree(p.id);
  await restampTree(tree.id);
}
