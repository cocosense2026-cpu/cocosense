// Trees a master node has been placed on (table: node_trees, see schema.sql).
//
// An owner typically has far fewer devices than trees, so a device is moved
// from tree to tree. Each tree owns its own readings (vibration_events /
// vibration_rollup carry node_tree_id), and exactly one tree per node is
// "active" -- the one new readings are filed under.
import { db } from './db.js';
import { restampRowHash } from './hash.js';

export const MAX_TREES_PER_NODE = 500;

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

export async function createTree(nodeId, ownerId, { activate = true } = {}) {
  const next = await db
    .prepare(`SELECT COALESCE(MAX(number), 0) + 1 AS n FROM node_trees WHERE node_id = ?`)
    .get(nodeId);
  const number = Number(next.n);
  // Inserted inactive first: if this loses a race on the unique
  // (node_id, number) index it throws BEFORE touching whichever tree is
  // currently active. Activation is a separate atomic step below.
  const result = await db
    .prepare(`INSERT INTO node_trees (node_id, owner_id, number, name, is_active) VALUES (?, ?, ?, ?, 0)`)
    .run(nodeId, ownerId ?? null, number, `Tree ${number}`);
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
