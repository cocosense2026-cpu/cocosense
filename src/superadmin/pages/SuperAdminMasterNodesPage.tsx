import React, { useEffect, useMemo, useState } from 'react';
import {
  Radio,
  Wifi,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
  Sparkles,
  Cpu,
  Layers,
  Crown,
} from 'lucide-react';
import { superAdminApi, SuperAdminMasterNode, SuperAdminApiError } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

// Sensor ids are "{nodeId}-{pin}" (A0-A3) -- pull the pin back out so
// each tile can show a meaningful label ("Piezo 1 (A0)"), and so a
// NOT_CONNECTED tile (no piezo wired to that pin yet) reads differently
// from an actual hardware fault (DAMAGED). Same helpers as the owner portal.
function pinOf(sensorId: string): string {
  return sensorId.split('-').pop() ?? '';
}
function piezoLabel(sensorId: string): string {
  const pin = pinOf(sensorId);
  const num = ['A0', 'A1', 'A2', 'A3'].indexOf(pin) + 1;
  return `Piezo ${num > 0 ? num : '?'} (${pin})`;
}

// One owner's hubs, oldest link first. A node's linkedAt is when its
// owner_id was actually set (see server/db.js's migration comment) --
// not when the row was created -- so an admin-provisioned owner's
// initial hardware and a hub a farm owner links later via QR
// (POST /owner/nodes/link) sort correctly relative to each other even
// though the SQL row itself might have been inserted well before either
// timestamp. Rows never assigned a linkedAt (nothing has claimed them
// yet) sort last and only ever appear on their own, never grouped --
// grouping only applies once a node actually belongs to somebody.
interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  nodes: SuperAdminMasterNode[]; // sorted, [0] is the "first" master node
}

function groupNodesByOwner(nodes: SuperAdminMasterNode[]): { groups: OwnerGroup[]; unassigned: SuperAdminMasterNode[] } {
  const byOwner = new Map<string, SuperAdminMasterNode[]>();
  const unassigned: SuperAdminMasterNode[] = [];

  for (const node of nodes) {
    if (!node.ownerId) {
      unassigned.push(node);
      continue;
    }
    const list = byOwner.get(node.ownerId) || [];
    list.push(node);
    byOwner.set(node.ownerId, list);
  }

  const groups: OwnerGroup[] = [];
  for (const [ownerId, list] of byOwner) {
    const sorted = [...list].sort((a, b) => {
      const at = a.linkedAt ? new Date(a.linkedAt).getTime() : Infinity;
      const bt = b.linkedAt ? new Date(b.linkedAt).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    });
    groups.push({ ownerId, ownerName: sorted[0].ownerName || ownerId, nodes: sorted });
  }
  groups.sort((a, b) => a.ownerName.localeCompare(b.ownerName));

  return { groups, unassigned };
}

export const SuperAdminMasterNodesPage: React.FC = () => {
  const [nodes, setNodes] = useState<SuperAdminMasterNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedNode, setViewedNode] = useState<SuperAdminMasterNode | null>(null);
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    superAdminApi
      .nodes()
      .then((res) => setNodes(res || []))
      .catch((err) => setError(err instanceof SuperAdminApiError ? err.message : 'Failed to load master node mesh.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onlineCount = nodes.filter((n) => n.online).length;

  const { groups, unassigned } = useMemo(() => groupNodesByOwner(nodes), [nodes]);
  const expandedGroup = groups.find((g) => g.ownerId === expandedOwnerId) || null;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Device Health Monitoring"
        title="Master Node Mesh"
        description="Plantation-wide monitoring of every master control hub, one card per farm owner. An owner's hubs added later (via QR self-service) are grouped under their first master node -- open a card to see the rest of that owner's mesh. Health data is view-only."
        accent="#D4AF37"
        actions={
          <div className="px-3.5 py-1.5 rounded bg-[#1A1A1A] border border-[#333333] text-xs font-mono text-[#D4AF37] flex items-center gap-2">
            <Radio className="w-3.5 h-3.5" />
            <span>
              <strong className="text-white">{onlineCount}</strong> / {nodes.length} Hubs Online
            </span>
          </div>
        }
      />

      {error && <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 text-xs text-[#F44336]">{error}</div>}

      {loading ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          Loading master node mesh…
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          No master nodes registered on the network yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map((group) => (
            <NodeCard
              key={group.ownerId}
              node={group.nodes[0]}
              onView={setViewedNode}
              extraCount={group.nodes.length - 1}
              onViewAll={group.nodes.length > 1 ? () => setExpandedOwnerId(group.ownerId) : undefined}
            />
          ))}
          {unassigned.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onView={setViewedNode}
              extraCount={0}
            />
          ))}
        </div>
      )}

      <PageFooterNote
        icon={Cpu}
        text="Health data here is view-only — reboot and power controls remain restricted to the Admin console."
      />

      {viewedNode && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewedNode(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded bg-[#141414] border border-[#262626] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] sticky top-0 bg-[#141414]">
              <div>
                <h3 className="font-mono text-lg font-bold text-white">{viewedNode.id}</h3>
                <p className="text-[11px] text-[#808080]">{viewedNode.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewedNode(null)}
                className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Activity className="w-3 h-3" /> Status
                  </p>
                  <p className={`text-sm font-mono font-bold ${viewedNode.online ? 'text-[#4CAF50]' : 'text-[#F44336]'}`}>
                    {viewedNode.online ? 'ONLINE' : 'OFFLINE'}
                  </p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Wifi className="w-3 h-3" /> Signal
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.signalRssi ?? 'No data yet'}</p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3" /> Last Ping
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.lastPing ?? 'Never connected'}</p>
                </div>
              </div>

              {viewedNode.note && (
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold mb-1">Note</p>
                  <p className="text-xs text-[#E0E0E0]">{viewedNode.note}</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#808080] mb-2">
                  <span>Piezo Transducers</span>
                  <span className="font-mono text-[#D4AF37]">
                    {viewedNode.workingSensors} / {viewedNode.totalSensors} Active
                  </span>
                </div>
                <div className="space-y-1.5">
                  {viewedNode.sensors.map((sensor) => {
                    const isDamaged = sensor.status === 'DAMAGED';
                    const isNotConnected = sensor.status === 'NOT_CONNECTED';
                    const isDisabled = isDamaged || isNotConnected;
                    return (
                      <div
                        key={sensor.id}
                        className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono ${
                          isDamaged
                            ? 'bg-[#2B1B1B] border-[#F44336]/30 text-[#F44336]'
                            : isNotConnected
                            ? 'bg-[#141414] border-[#333333] text-[#666666]'
                            : 'bg-[#0A0A0A] border-[#262626] text-[#E0E0E0]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isDamaged ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : isNotConnected ? (
                            <X className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF50]" />
                          )}
                          {piezoLabel(sensor.id)}
                          {!isDisabled && <span className="text-[#808080]">· Tree {sensor.treeId}</span>}
                        </span>
                        <span>{isNotConnected ? 'Not Connected' : `${sensor.status} · ${sensor.voltageMv}mV`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#262626] flex items-center gap-1.5 text-[10px] text-[#808080]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>Display-only view. Remote control actions are not available from the Super Admin console.</span>
            </div>
          </div>
        </div>
      )}

      {expandedGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpandedOwnerId(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded bg-[#141414] border border-[#262626] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] sticky top-0 bg-[#141414] z-10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D4AF37]" />
                <div>
                  <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                    {expandedGroup.ownerName}'s Master Node Mesh
                  </h3>
                  <p className="text-[11px] text-[#808080]">{expandedGroup.nodes.length} master nodes linked to this owner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpandedOwnerId(null)}
                className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {expandedGroup.nodes.map((node, i) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onView={setViewedNode}
                  isPrimary={i === 0}
                  extraCount={0}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// One hub's monitoring card, laid out like the Owner Portal's Master Node
// Mesh card: status badge, id/name, signal RSSI, piezo pin tiles and a
// View button. Shared by the main grid (an owner's first node) and the
// "view all" modal (every node in that owner's group).
const NodeCard: React.FC<{
  node: SuperAdminMasterNode;
  onView: (node: SuperAdminMasterNode) => void;
  isPrimary?: boolean;
  extraCount: number;
  onViewAll?: () => void;
}> = ({ node, onView, isPrimary, extraCount, onViewAll }) => {
  return (
    <div
      className={`rounded border p-6 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-5 transition-all ${
        node.online
          ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
          : 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
      }`}
    >
      <div>
        <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
          {isPrimary && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#1A1508] text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" /> First Node
            </span>
          )}
          <span
            className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
              node.online
                ? 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                : 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
            }`}
          >
            {node.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <h3 className="font-mono text-xl sm:text-2xl font-bold text-white">{node.id}</h3>
        <p className="text-xs text-[#808080] mt-0.5">{node.name}</p>
        <p className="text-[10px] text-[#606060] mt-1">
          Owner: <span className="text-[#A0A0A0]">{node.ownerName || 'Unassigned'}</span>
        </p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#808080] flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-[#D4AF37]" />
              <span>Signal RSSI</span>
            </span>
            <span className="font-mono text-[#E0E0E0] font-semibold">{node.signalRssi ?? 'No data yet'}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#262626]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#808080] mb-2">
            <span>Piezo Transducers</span>
            <span className="font-mono text-[#D4AF37]">
              {node.workingSensors} / {node.totalSensors} Active
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {node.sensors.map((sensor) => {
              const isDamaged = sensor.status === 'DAMAGED';
              const isNotConnected = sensor.status === 'NOT_CONNECTED';
              const isDisabled = isDamaged || isNotConnected;
              return (
                <div
                  key={sensor.id}
                  className={`h-7 rounded border flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                    isDamaged
                      ? 'bg-[#2B1B1B] border-[#F44336]/40 text-[#F44336]'
                      : isNotConnected
                      ? 'bg-[#151515] border-[#333333] text-[#666666]'
                      : 'bg-[#0A0A0A] border-[#262626] text-[#D4AF37]'
                  }`}
                  title={`${sensor.id} (${pinOf(sensor.id)}) - Tree ${sensor.treeId} · ${
                    isDisabled ? (isNotConnected ? 'Not Connected' : 'Damaged') : sensor.status
                  }`}
                >
                  {pinOf(sensor.id)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#262626] space-y-2">
        <button
          type="button"
          onClick={() => onView(node)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>View</span>
        </button>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            View all {extraCount + 1} master nodes for this owner
          </button>
        )}
      </div>
    </div>
  );
};
