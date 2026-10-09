import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle, PowerOff, Gauge, Activity, Plus, TreePalm, Loader2, Pencil, Trash2, Power, Bug, ShieldCheck, Radio, Wifi, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { TreeNameModal } from '../components/TreeNameModal';
import { TreeDeleteModal } from '../components/TreeDeleteModal';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';
import { VibrationStrengthChart } from '../../components/VibrationStrengthChart';
import { WeekSeries, Thresholds, weekToPoints } from '../weekSeries';

interface EventRow {
  id: string | number;
  sector: string;
  nodeId?: string;
  piezoSensorId?: string;
  grams: number;
  severity: string;
  timestamp: string;
}

// One card per PHYSICAL PIEZO TRANSDUCER. A master node always carries
// exactly 4 of these, one per analog input (A0-A3, labeled "Piezo 1"
// through "Piezo 4") -- an owner with 2 master nodes sees 8 cards
// total, each detecting/reporting vibration independently. `enabled`
// is false when that specific transducer is DAMAGED, or when
// sensorStatus is NOT_CONNECTED (no piezo physically wired to that
// pin yet -- A3 ships unconnected by default). Either way the card is
// grayed out and shows no readings.
interface EventPanel {
  piezoId: string;
  nodeId: string;
  nodeName: string;
  treeId?: number | null;
  /** The owner's own notes for this piezo on this tree (Active / Infected / Cleared). */
  treeState?: PiezoTreeState;
  pin: string;
  sensorLabel: string;
  sensorStatus: string;
  enabled: boolean;
  status: { grams: number; severity: string; sector: string };
  /** Newest raw readings -- only a fallback if an older server sends no `week`. */
  sparkline: EventRow[];
  /** Strongest reading in each hour of the last 7 days. */
  week?: WeekSeries | null;
  logs: EventRow[];
}

type PestStatus = 'INFECTED' | 'CLEARED' | null;
interface PiezoTreeState {
  active: boolean;
  pest: PestStatus;
}

interface TreeInfo {
  id: number;
  nodeId: string;
  nodeName: string | null;
  number: number;
  name: string;
  isActive: boolean;
}

// Full master-node card data (same shape the Master Node Mesh page uses),
// shown on the "which master node?" step when the owner has 2+ devices.
interface PickerNode {
  id: string;
  name: string;
  online: boolean;
  signalRssi: string | null;
  totalSensors: number;
  workingSensors: number;
  sensors: Array<{ id: string; status: string }>;
}

function pinOf(sensorId: string): string {
  return sensorId.split('-').pop() ?? '';
}

interface EventsData {
  sort: 'recent' | 'strongest';
  tree?: TreeInfo | null;
  status: { grams: number; severity: string; sector: string };
  sparkline: EventRow[];
  thresholds?: Thresholds;
  logs: EventRow[];
  panels: EventPanel[];
}

const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  Critical: { text: 'text-[#F44336]', bg: 'bg-[#2B1B1B]', border: 'border-[#F44336]/30', icon: AlertTriangle },
  Elevated: { text: 'text-[#E9A23B]', bg: 'bg-[#261F0E]', border: 'border-[#E9A23B]/30', icon: AlertCircle },
  Normal: { text: 'text-[#4CAF50]', bg: 'bg-[#142416]', border: 'border-[#4CAF50]/30', icon: CheckCircle },
  Offline: { text: 'text-[#808080]', bg: 'bg-[#1A1A1A]', border: 'border-[#333333]', icon: PowerOff },
};

// One-line explanation shown under the "Status: X" line on each piezo
// card, mirroring the plain-language footer copy from the reference
// vibration-monitor layout (e.g. "No unusual vibration detected.").
const SEVERITY_MESSAGES: Record<string, string> = {
  Critical: 'Active vibration event detected — immediate attention recommended.',
  Elevated: 'Vibration levels are elevated — keep an eye on this tree.',
  Normal: 'No unusual vibration detected.',
  Offline: 'Sensor not connected or no data received.',
};

function relativeTime(iso: string): string {
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const EventsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') === 'strongest' ? 'strongest' : 'recent';
  // `?node=` is the master node the owner picked on the first step. With 2+
  // master nodes the page shows a picker (Master Node 1, Master Node 2...)
  // until one is chosen; with a single node it goes straight to that node.
  const nodeParam = searchParams.get('node');
  const [data, setData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);
  // "Live" = the newest raw, per-second readings (zoomed in, scrollable --
  // every individual report is its own point). "Week" = the strongest
  // reading per 15-minute window over the last 7 days (zoomed out). Live
  // is the default since seeing every second is the point of this toggle.
  const [chartMode, setChartMode] = useState<'live' | 'week'>('live');

  // ---- Trees -------------------------------------------------------
  // The owner's device is moved from tree to tree. Each tree keeps its own
  // monitor + recent log, and the SELECTED tree is the one the device is
  // placed on: picking it tells the server to file new readings under it.
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [trees, setTrees] = useState<TreeInfo[]>([]);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<number | null>(null);
  const [treesReady, setTreesReady] = useState(false);
  const [treeBusy, setTreeBusy] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  // The "name this tree" dialog: opened by "+ Tree" or by renaming the selected tree.
  const [nameDialog, setNameDialog] = useState<
    { mode: 'add' } | { mode: 'rename'; tree: TreeInfo } | { mode: 'delete'; tree: TreeInfo } | null
  >(null);
  const treeIdRef = useRef<number | null>(null);
  treeIdRef.current = treeId;
  const selectedChipRef = useRef<HTMLButtonElement | null>(null);

  // Detailed node cards for the picker step.
  const [pickerNodes, setPickerNodes] = useState<PickerNode[]>([]);
  const [pickerLoaded, setPickerLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ownerApi
      .trees()
      .then((res) => {
        if (cancelled) return;
        setNodes(res.nodes);
        setTrees(res.trees);
      })
      .catch(() => void 0)
      .finally(() => !cancelled && setTreesReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the selected tree's chip in view -- with 50 trees the row scrolls.
  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [treeId, trees.length]);

  const multiNode = nodes.length > 1;
  const validNodeParam = nodeParam && nodes.some((n) => n.id === nodeParam) ? nodeParam : null;
  // Show the "which master node?" step until the owner has picked one.
  const pickerOpen = treesReady && multiNode && !validNodeParam;
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;

  // Follow the picked node (or the only node) -- select its active tree.
  useEffect(() => {
    if (!treesReady) return;
    const target = validNodeParam ?? (nodes.length === 1 ? nodes[0].id : null);
    if (target === nodeId) return;
    setNodeId(target);
    if (target) {
      const own = trees.filter((t) => t.nodeId === target);
      setData(null);
      setLoading(true);
      setTreeId((own.find((t) => t.isActive) ?? own[0])?.id ?? null);
    } else {
      setTreeId(null);
    }
  }, [treesReady, validNodeParam, nodes, trees, nodeId]);

  const loadPickerNodes = useCallback(() => {
    if (!pickerOpenRef.current && pickerLoaded) return;
    ownerApi
      .nodes()
      .then((res: any) => {
        setPickerNodes(res || []);
        setPickerLoaded(true);
      })
      .catch(() => setPickerLoaded(true));
  }, [pickerLoaded]);
  useEffect(() => {
    if (pickerOpen) loadPickerNodes();
  }, [pickerOpen, loadPickerNodes]);
  usePolling(loadPickerNodes, 3000);

  const chooseNode = (id: string) => setSearchParams({ sort, node: id });
  const changeNode = () => setSearchParams({ sort });

  const nodeTrees = trees.filter((t) => t.nodeId === nodeId);
  const currentTree = trees.find((t) => t.id === treeId) ?? null;

  const selectTree = async (tree: TreeInfo) => {
    if (treeBusy || tree.id === treeId) return;
    const previous = treeId;
    setTreeError(null);
    setTreeBusy(true);
    setData(null);
    setLoading(true);
    setTreeId(tree.id);
    try {
      await ownerApi.activateTree(tree.id);
      setTrees((all) => all.map((t) => (t.nodeId === tree.nodeId ? { ...t, isActive: t.id === tree.id } : t)));
    } catch (err: any) {
      setTreeId(previous);
      setTreeError(err?.message || "Couldn't switch trees. Please try again.");
    } finally {
      setTreeBusy(false);
    }
  };

  // Called by the name dialog. Errors (duplicate name, too long...) are
  // thrown back to the dialog so they show next to the field.
  const submitNewTree = async (name: string) => {
    const res = await ownerApi.addTree(nodeId ?? undefined, name || undefined);
    setNameDialog(null);
    setTreeError(null);
    setData(null);
    setLoading(true);
    setNodes(res.nodes);
    setTrees(res.trees);
    setNodeId(res.tree.nodeId);
    setTreeId(res.tree.id);
  };

  const submitRename = async (tree: TreeInfo, name: string) => {
    const res = await ownerApi.renameTree(tree.id, name);
    setNameDialog(null);
    setTrees(res.trees);
    setData((d) => (d && d.tree && d.tree.id === tree.id ? { ...d, tree: { ...d.tree, name: res.tree.name } } : d));
  };

  const selectNode = (id: string) => {
    if (id === nodeId || treeBusy) return;
    const target = trees.find((t) => t.nodeId === id && t.isActive) ?? trees.find((t) => t.nodeId === id);
    setNodeId(id);
    if (target) {
      setData(null);
      setLoading(true);
      setTreeId(target.id);
    }
  };

  // Delete the selected tree. The server moves the device to a neighbouring
  // tree if this was the one it was on, and tells us which.
  const submitDelete = async (tree: TreeInfo) => {
    const res = await ownerApi.deleteTree(tree.id);
    setNameDialog(null);
    setTreeError(null);
    setNodes(res.nodes);
    setTrees(res.trees);
    if (tree.id === treeId) {
      const fallback =
        res.activeTreeId ?? res.trees.find((t: TreeInfo) => t.nodeId === tree.nodeId && t.isActive)?.id ?? null;
      setData(null);
      setLoading(true);
      setTreeId(fallback);
    }
  };

  // Active / Infected / Cleared buttons under each piezo. Shown instantly
  // (optimistic) and rolled back if the server refuses. `stateVersion`
  // makes the 10-second refresh drop any response that was already on its
  // way when the owner clicked, so it can't flip a button back for a moment.
  const stateVersion = useRef(0);
  const stateInFlight = useRef(0);
  const patchPanelState = (piezoId: string, state: PiezoTreeState) =>
    setData((d) =>
      d ? { ...d, panels: d.panels.map((p) => (p.piezoId === piezoId ? { ...p, treeState: state } : p)) } : d
    );
  const updatePiezoState = async (panel: EventPanel, patch: { active?: boolean; pest?: PestStatus }) => {
    if (panel.treeId == null) return;
    const prev: PiezoTreeState = panel.treeState ?? { active: true, pest: null };
    stateVersion.current += 1;
    stateInFlight.current += 1;
    setTreeError(null);
    patchPanelState(panel.piezoId, { ...prev, ...patch });
    try {
      const res = await ownerApi.setPiezoState(panel.treeId, panel.piezoId, patch);
      patchPanelState(panel.piezoId, { active: res.state.active, pest: res.state.pest });
    } catch (err: any) {
      patchPanelState(panel.piezoId, prev);
      setTreeError(err?.message || "Couldn't save that change. Please try again.");
    } finally {
      stateInFlight.current -= 1;
      stateVersion.current += 1;
    }
  };

  useEffect(() => {
    if (!treesReady || pickerOpen || (multiNode && !nodeId)) return;
    let cancelled = false;
    setLoading(true);
    ownerApi
      .events(sort, treeId)
      .then((res) => !cancelled && setData(res))
      .catch(() => void 0)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort, treeId, treesReady, pickerOpen]);

  // Keeps this page current with new device readings as they arrive,
  // without the visible loading spinner flashing on every refresh --
  // only the initial load (above) shows that. A response for a tree the
  // owner has since switched away from is dropped, never shown.
  const refresh = useCallback(() => {
    if (!treesReady || pickerOpenRef.current || stateInFlight.current > 0) return;
    const asked = treeId;
    const version = stateVersion.current;
    ownerApi
      .events(sort, asked)
      .then((res) => {
        if (treeIdRef.current === asked && stateVersion.current === version) setData(res);
      })
      .catch(() => void 0);
  }, [sort, treeId, treesReady]);
  usePolling(refresh, 1000);

  const style = SEVERITY_STYLES[data?.status.severity ?? 'Normal'] || SEVERITY_STYLES.Normal;
  const StatusIcon = style.icon;
  // Always 4 panels per master node -- one per physical piezo
  // transducer wired to analog pins A0-A3, each detecting vibration
  // independently and disabled whenever that specific sensor isn't
  // working or has no piezo connected to its pin. Falls back to 4
  // empty placeholder panels so the page still renders its normal
  // skeleton shape while the first load is in flight.
  const PIN_LABELS = ['A0', 'A1', 'A2', 'A3'];
  const panels: EventPanel[] = data?.panels?.length
    ? data.panels
    : PIN_LABELS.map((pin, i) => ({
        piezoId: `-${i}`,
        nodeId: '-',
        nodeName: 'Sensor 1',
        pin,
        sensorLabel: `Piezo ${i + 1}`,
        sensorStatus: 'OPTIMAL',
        enabled: true,
        status: { grams: 0, severity: 'Normal', sector: '' },
        sparkline: [],
        logs: [],
      }));
  const enabledCount = panels.filter((p) => p.enabled).length;

  // ---- Step 1 (only with 2+ master nodes): which master node? ---------
  if (pickerOpen) {
    const list: PickerNode[] = pickerNodes.length
      ? pickerNodes
      : nodes.map((n) => ({ id: n.id, name: n.name, online: false, signalRssi: null, totalSensors: 4, workingSensors: 0, sensors: [] }));
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHero
          eyebrow="Farm Owner Portal"
          subtitle="Vibration Events"
          title="Choose a Master Node"
          description="You have more than one master node. Pick the one whose vibration events you want to open."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((node, i) => (
            <button
              key={node.id}
              type="button"
              onClick={() => chooseNode(node.id)}
              className={`text-left rounded border p-6 shadow-xl flex flex-col justify-between space-y-5 transition-all ${
                node.online
                  ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/60'
                  : 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">Master Node {i + 1}</span>
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

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-[#808080] flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-[#D4AF37]" /> Signal RSSI
                  </span>
                  <span className="font-mono text-[#E0E0E0] font-semibold">{node.signalRssi ?? 'No data yet'}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#262626]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#808080] mb-2">
                    <span>Piezo Transducers</span>
                    <span className="font-mono text-[#D4AF37]">
                      {node.workingSensors} / {node.totalSensors} Active
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(node.sensors.length ? node.sensors : PIN_LABELS.map((pin) => ({ id: `${node.id}-${pin}`, status: 'OPTIMAL' }))).map((sensor) => {
                      const damaged = sensor.status === 'DAMAGED';
                      const notConnected = sensor.status === 'NOT_CONNECTED';
                      return (
                        <div
                          key={sensor.id}
                          className={`h-7 rounded border flex items-center justify-center font-mono text-[9px] font-bold ${
                            damaged
                              ? 'bg-[#2B1B1B] border-[#F44336]/40 text-[#F44336]'
                              : notConnected
                              ? 'bg-[#151515] border-[#333333] text-[#666666]'
                              : 'bg-[#0A0A0A] border-[#262626] text-[#D4AF37]'
                          }`}
                        >
                          {pinOf(sensor.id)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#262626] flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#D4AF37] text-black font-bold text-xs">
                <span>Open Vibration Events</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
        <PageFooterNote icon={Radio} text="Each master node has its own trees and its own four piezo transducers. You can switch master nodes at any time from the Vibration Events page." />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Vibration Events"
        title="Vibration Events"
        description="Live sensor activity across your monitored trees. Every reading is stamped as it arrives over the mesh so you can spot a spike the moment it happens, not after canopy damage becomes visible."
      />

      {/* Tree selector -- "+ Tree" first, then every tree this device has
          been placed on. Choosing one puts the device on that tree. */}
      {nodes.length > 0 && (
        <div className="space-y-3">
          {multiNode && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">Master node</span>
              <span className="px-2.5 py-1 rounded text-[11px] font-semibold border bg-[#D4AF37] text-black border-[#D4AF37]">
                Master Node {Math.max(1, nodes.findIndex((n) => n.id === nodeId) + 1)} · {nodes.find((n) => n.id === nodeId)?.name ?? nodeId}
              </span>
              <button
                type="button"
                onClick={changeNode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border bg-[#141414] text-[#A0A0A0] border-[#262626] hover:text-white transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" /> Change
              </button>
            </div>
          )}

          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setNameDialog({ mode: 'add' })}
              disabled={treeBusy}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE4A] disabled:opacity-60 text-black text-xs font-bold transition-colors"
            >
              {treeBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tree
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {nodeTrees.map((t) => {
                const selected = t.id === treeId;
                return (
                  <button
                    key={t.id}
                    ref={selected ? selectedChipRef : undefined}
                    type="button"
                    onClick={() => selectTree(t)}
                    disabled={treeBusy}
                    aria-pressed={selected}
                    title={t.name}
                    className={`flex-shrink-0 max-w-[220px] flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-[#1F1B0E] border-[#D4AF37] text-[#D4AF37]'
                        : 'bg-[#141414] border-[#262626] text-[#A0A0A0] hover:text-white hover:border-[#404040]'
                    }`}
                  >
                    <TreePalm className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Rename / Delete act on the tree that's selected. Always shown;
                Delete is disabled (with a reason) while it's the device's
                only tree, because a device needs at least one. */}
            {currentTree && (
              <div className="flex-shrink-0 flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setNameDialog({ mode: 'rename', tree: currentTree })}
                  disabled={treeBusy}
                  title={`Rename ${currentTree.name}`}
                  aria-label={`Rename ${currentTree.name}`}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg border border-[#262626] bg-[#141414] text-[#E0E0E0] text-xs font-semibold whitespace-nowrap hover:border-[#D4AF37]/60 hover:text-[#D4AF37] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rename</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNameDialog({ mode: 'delete', tree: currentTree })}
                  disabled={treeBusy || nodeTrees.length < 2}
                  title={
                    nodeTrees.length < 2
                      ? 'A device needs at least one tree. Add another tree first.'
                      : `Delete ${currentTree.name}`
                  }
                  aria-label={`Delete ${currentTree.name}`}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg border border-[#F44336]/30 bg-[#141414] text-[#F44336] text-xs font-semibold whitespace-nowrap hover:bg-[#2B1B1B] hover:border-[#F44336]/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#141414] disabled:hover:border-[#F44336]/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            )}
          </div>

          {treeError && <p className="text-[11px] text-[#F44336]">{treeError}</p>}
          {currentTree && (
            <p className="text-[11px] text-[#808080]">
              Your device is monitoring <span className="text-white font-semibold break-all">{currentTree.name}</span>.{' '}
              New readings are saved to this tree; tap another tree to move the device back to it and see its earlier
              data.
            </p>
          )}
        </div>
      )}

      {nameDialog?.mode === 'add' && (
        <TreeNameModal
          mode="add"
          suggestedName={`Tree ${Math.max(0, ...nodeTrees.map((t) => t.number)) + 1}`}
          nodeLabel={nodes.length > 1 ? nodes.find((n) => n.id === nodeId)?.name ?? nodeId : null}
          onClose={() => setNameDialog(null)}
          onSubmit={submitNewTree}
        />
      )}
      {nameDialog?.mode === 'delete' && (
        <TreeDeleteModal
          treeName={nameDialog.tree.name}
          onClose={() => setNameDialog(null)}
          onConfirm={() => submitDelete(nameDialog.tree)}
        />
      )}
      {nameDialog?.mode === 'rename' && (
        <TreeNameModal
          mode="rename"
          initialName={nameDialog.tree.name}
          onClose={() => setNameDialog(null)}
          onSubmit={(name) => submitRename(nameDialog.tree, name)}
        />
      )}

      {/* Current status */}
      <div className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">Current Status</span>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
            <StatusIcon className="w-3 h-3" /> {data?.status.severity ?? 'Normal'}
          </span>
        </div>
        <div className="text-3xl font-bold text-white">
          {(data?.status.grams ?? 0).toFixed(1)}
          <span className="text-sm text-[#808080] font-normal ml-1.5">g [Peak]</span>
        </div>
        <p className="text-xs text-[#808080] mt-1">Latest reading from {data?.status.sector ?? 'your estate'}.</p>
      </div>

      {/* Vibration intensity -- always 4 cards per master node, one per
          physical piezo transducer wired to A0-A3, each detecting
          vibration on its own and grayed out whenever that specific
          sensor is disabled or not connected. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">
            Vibration Intensity ({enabledCount}/{panels.length} sensors active)
          </span>
          {/* Live (every second, zoomed in / scrollable) vs Week (15-min
              peaks over 7 days, zoomed out) -- applies to all cards below. */}
          <div className="flex rounded-lg border border-[#333333] overflow-hidden text-[10px] font-bold uppercase tracking-wide">
            <button
              type="button"
              onClick={() => setChartMode('live')}
              className={`px-3 py-1.5 transition-colors ${
                chartMode === 'live' ? 'bg-[#D4AF37] text-black' : 'bg-[#1A1A1A] text-[#808080] hover:text-[#E0E0E0]'
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setChartMode('week')}
              className={`px-3 py-1.5 transition-colors ${
                chartMode === 'week' ? 'bg-[#D4AF37] text-black' : 'bg-[#1A1A1A] text-[#808080] hover:text-[#E0E0E0]'
              }`}
            >
              Week
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {panels.map((panel, index) => {
            // Full 7 days (15-min windows) when the server sent it; the
            // raw per-second readings otherwise. chartMode picks which one
            // to prefer when both are available -- Live always wins unless
            // there's simply no raw data yet, Week always wins unless
            // there's no rollup yet, so a card never goes blank.
            const weekPoints = panel.week ? weekToPoints(panel.week, data?.thresholds) : [];
            const livePoints = panel.sparkline;
            const preferred = chartMode === 'live' ? livePoints : weekPoints;
            const fallback = chartMode === 'live' ? weekPoints : livePoints;
            const panelBars = preferred.length
              ? preferred
              : fallback.length
              ? fallback
              : Array(8).fill({ grams: 0, severity: 'Normal' });
            const usingWeek = panelBars === weekPoints && weekPoints.length > 0;
            // Two separate "off" states: `enabled` is the HARDWARE (piezo
            // damaged / not wired); `piezoOn` is the owner's switch for THIS
            // tree (e.g. the tree is dead). A switched-off piezo keeps its
            // history on screen but is not receiving new readings.
            const piezoState = panel.treeState ?? { active: true, pest: null };
            const piezoOn = piezoState.active;
            const live = panel.enabled && piezoOn;
            const switchedOff = panel.enabled && !piezoOn;
            const panelStyle = switchedOff
              ? SEVERITY_STYLES.Offline
              : SEVERITY_STYLES[panel.status.severity] || SEVERITY_STYLES.Normal;
            const PanelStatusIcon = panelStyle.icon;
            const notConnected = panel.sensorStatus === 'NOT_CONNECTED';
            const badgeLabel = `P${index + 1}`;
            const statusLabel = switchedOff ? 'Switched off' : panel.enabled ? panel.status.severity || 'Normal' : 'Offline';
            const statusMessage = switchedOff
              ? "You switched this piezo off for this tree, so new readings from it aren't being recorded."
              : panel.enabled
              ? SEVERITY_MESSAGES[panel.status.severity] || SEVERITY_MESSAGES.Normal
              : notConnected
              ? SEVERITY_MESSAGES.Offline
              : 'Sensor is disabled or not responding.';
            return (
              <div
                key={panel.piezoId}
                className={`rounded-lg border transition-all ${
                  live
                    ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
                    : 'bg-[#111111] border-[#262626]'
                }`}
              >
              <Link
                to={`/owner/events/piezo/${encodeURIComponent(panel.piezoId)}${panel.treeId != null ? `?tree=${panel.treeId}` : ''}`}
                className={`block p-5 sm:p-6 transition-opacity ${live ? '' : 'opacity-70 hover:opacity-90'}`}
              >
                {/* Header: piezo badge + name + active/inactive pill, and
                    vibration strength readout on the right -- mirrors the
                    reference 2x2 monitor layout. */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${
                        live ? 'bg-[#4CAF50] text-black' : 'bg-[#333333] text-[#A0A0A0]'
                      }`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-sm font-bold text-white truncate">{panel.sensorLabel}</span>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        live
                          ? 'bg-[#142416] text-[#4CAF50] border border-[#4CAF50]/30'
                          : 'bg-[#1A1A1A] text-[#808080] border border-[#333333]'
                      }`}
                    >
                      {live ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Activity className={`w-3.5 h-3.5 ${live ? 'text-[#4CAF50]' : 'text-[#606060]'}`} />
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-[#808080] font-semibold whitespace-nowrap">
                        Vibration Strength
                      </div>
                      <div className="text-sm font-bold text-white font-mono">
                        {live ? panel.status.grams.toFixed(2) : '0.00'}
                        <span className="text-[10px] text-[#808080] font-normal"> g</span>
                      </div>
                    </div>
                    <span
                      className={`w-3 h-4 rounded-sm flex-shrink-0 ${
                        live ? 'bg-[#4CAF50]' : 'border border-[#404040] bg-transparent'
                      }`}
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="h-[150px] rounded bg-[#0E0E0E] border border-[#262626] animate-pulse" />
                ) : !panel.enabled ? (
                  <div className="h-[150px] rounded-lg bg-[#0E0E0E] border border-[#262626] flex items-center justify-center text-[11px] text-[#808080] gap-1.5 text-center px-2">
                    <PowerOff className="w-3.5 h-3.5 flex-shrink-0" />
                    {notConnected ? `No piezo wired to ${panel.pin} yet` : 'Sensor not working'}
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#0E0E0E] border border-[#262626]">
                    <VibrationStrengthChart
                      points={panelBars}
                      height={150}
                      scrollable
                      // Week peaks are already spaced events, 12px reads
                      // fine; raw per-second points get more room (20px)
                      // so each individual second stays visually distinct
                      // instead of blurring together -- that spacing is
                      // what makes "every second visible" actually work.
                      pxPerPoint={usingWeek ? 12 : 20}
                    />
                  </div>
                )}

                {/* Footer status strip */}
                <div
                  className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded ${panelStyle.bg} border ${panelStyle.border}`}
                >
                  <PanelStatusIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${panelStyle.text}`} />
                  <div className="min-w-0">
                    <div className={`text-[11px] font-bold ${panelStyle.text}`}>Status: {statusLabel}</div>
                    <div className="text-[10px] text-[#808080] leading-snug">{statusMessage}</div>
                  </div>
                </div>
              </Link>

              {/* Owner controls for THIS piezo on THIS tree. Shown on ALL four
                  piezos (including 3 and 4, even if not wired yet). Infected and
                  Cleared are one setting, so turning one on turns the
                  other off; clicking the one that's on clears both. */}
              {panel.treeId != null && (
                <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                  <div className="flex items-stretch gap-2 pt-4 border-t border-[#262626]">
                    <button
                      type="button"
                      aria-pressed={piezoOn}
                      onClick={() => updatePiezoState(panel, { active: !piezoOn })}
                      title={piezoOn ? 'Switch this piezo off (e.g. the tree is dead)' : 'Switch this piezo back on'}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-bold transition-colors ${
                        piezoOn
                          ? 'bg-[#142416] border-[#4CAF50]/40 text-[#4CAF50] hover:bg-[#1A2E1D]'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#808080] hover:text-white'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" /> {piezoOn ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={piezoState.pest === 'INFECTED'}
                      onClick={() => updatePiezoState(panel, { pest: piezoState.pest === 'INFECTED' ? null : 'INFECTED' })}
                      title="Mark this tree as infected with pests"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-bold transition-colors ${
                        piezoState.pest === 'INFECTED'
                          ? 'bg-[#2B1B1B] border-[#F44336]/50 text-[#F44336]'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#808080] hover:text-white'
                      }`}
                    >
                      <Bug className="w-3.5 h-3.5" /> Infected
                    </button>
                    <button
                      type="button"
                      aria-pressed={piezoState.pest === 'CLEARED'}
                      onClick={() => updatePiezoState(panel, { pest: piezoState.pest === 'CLEARED' ? null : 'CLEARED' })}
                      title="Mark this tree as free of pests again"
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-bold transition-colors ${
                        piezoState.pest === 'CLEARED'
                          ? 'bg-[#142416] border-[#4CAF50]/50 text-[#4CAF50]'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#808080] hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Cleared
                    </button>
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Log list */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">
            {sort === 'strongest' ? 'Strongest to Weakest' : 'Recent Logs'}
          </span>
          <div className="flex items-center gap-1 bg-[#141414] border border-[#262626] rounded p-0.5">
            <button
              type="button"
              onClick={() => setSearchParams(nodeId ? { sort: 'recent', node: nodeId } : { sort: 'recent' })}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                sort === 'recent' ? 'bg-[#D4AF37] text-black' : 'text-[#808080] hover:text-white'
              }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setSearchParams(nodeId ? { sort: 'strongest', node: nodeId } : { sort: 'strongest' })}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                sort === 'strongest' ? 'bg-[#D4AF37] text-black' : 'text-[#808080] hover:text-white'
              }`}
            >
              Strongest
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded bg-[#0E0E0E] border border-[#262626] animate-pulse" />
              ))}
            </div>
          ) : !data?.logs.length ? (
            <div className="p-8 text-center text-xs text-[#808080]">No vibration events recorded yet{currentTree ? ` for ${currentTree.name}` : ''}.</div>
          ) : (
            data.logs.map((log) => {
              const tone = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.Normal;
              const Icon = tone.icon;
              return (
                <div key={log.id} className="flex items-center gap-3 p-3.5">
                  <span className={`p-1.5 rounded ${tone.bg} border ${tone.border} ${tone.text} flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {log.sector}
                      {log.piezoSensorId && (
                        <span className="ml-1.5 text-[#808080] font-normal">
                          · {panels.find((p) => p.piezoId === log.piezoSensorId)?.sensorLabel ?? log.piezoSensorId}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#808080]">{relativeTime(log.timestamp)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-white">{log.grams.toFixed(1)}g</div>
                    <div className={`text-[10px] font-semibold ${tone.text}`}>{log.severity}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <PageFooterNote
        icon={Gauge}
        text="Piezoelectric transducers sample continuously; readings above 6g sustained for more than a few seconds typically indicate active boring activity."
      />
    </div>
  );
};
