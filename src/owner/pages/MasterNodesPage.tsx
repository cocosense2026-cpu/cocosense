import React, { useEffect, useState, useCallback } from 'react';
import {
  Radio,
  Battery,
  Wifi,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Cpu,
  Hash,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';

interface OwnerNode {
  id: string;
  name: string;
  sector: string;
  online: boolean;
  batteryPercent: number;
  signalRssi: string;
  note?: string;
  totalSensors: number;
  workingSensors: number;
  damagedSensors: number;
  lastPing: string;
  firmwareVersion: string;
  sensors: Array<{ id: string; treeId: string; status: string; frequencyHz: number; voltageMv: number }>;
}

// Sensor ids are "{nodeId}-{pin}" (A0-A3) -- pull the pin back out so
// each tile can show a meaningful label ("Piezo 1 (A0)") instead of a
// bare index, and so a NOT_CONNECTED tile (no piezo wired to that pin
// yet, e.g. A3 out of the box) can read differently from an actual
// hardware fault (DAMAGED).
function pinOf(sensorId: string): string {
  return sensorId.split('-').pop() ?? '';
}
function piezoLabel(sensorId: string): string {
  const pin = pinOf(sensorId);
  const num = ['A0', 'A1', 'A2', 'A3'].indexOf(pin) + 1;
  return `Piezo ${num > 0 ? num : '?'} (${pin})`;
}

// Read-only mirror of the Admin console's Master Node Mesh screen
// (src/views/MasterNodesView.tsx), scoped to just this owner's hubs via
// GET /api/owner/nodes. No reboot/power controls here -- owners can only
// view the health of their own hardware, same as the Admin console now
// only exposes a "View" detail action.
export const MasterNodesPage: React.FC = () => {
  const [nodes, setNodes] = useState<OwnerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedNode, setViewedNode] = useState<OwnerNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ownerApi
      .nodes()
      .then((res: any) => !cancelled && setNodes(res || []))
      .catch(() => void 0)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    ownerApi.nodes().then((res: any) => setNodes(res || [])).catch(() => void 0);
  }, []);
  usePolling(refresh, 10000);

  const onlineCount = nodes.filter((n) => n.online).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Bioacoustic LoRa Mesh v2.4"
        title="Master Node Mesh"
        description="Live health of the master control hubs and piezoelectric transducers monitoring your estate. This screen is view-only."
        actions={
          <div className="px-3.5 py-1.5 rounded bg-[#1A1A1A] border border-[#333333] text-xs font-mono text-[#D4AF37] flex items-center gap-2">
            <Radio className="w-3.5 h-3.5" />
            <span>
              <strong className="text-white">{onlineCount}</strong> / {nodes.length} Hubs Online
            </span>
          </div>
        }
      />

      {loading ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          Loading your master node mesh…
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          No master nodes are assigned to your estate yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`rounded border p-6 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-5 transition-all ${
                node.online
                  ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
                  : 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                    {node.sector}
                  </span>
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

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#808080] flex items-center gap-1.5">
                      <Battery className={`w-4 h-4 ${node.batteryPercent > 25 ? 'text-[#D4AF37]' : 'text-[#F44336]'}`} />
                      <span>Battery Level</span>
                    </span>
                    <span className="font-mono font-bold text-white">{node.batteryPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-[#0A0A0A] overflow-hidden border border-[#262626]">
                    <div
                      className={`h-full transition-all duration-500 ${
                        node.batteryPercent > 50 ? 'bg-[#D4AF37]' : node.batteryPercent > 20 ? 'bg-[#D4AF37]/60' : 'bg-[#F44336]'
                      }`}
                      style={{ width: `${node.batteryPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#808080] flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-[#D4AF37]" />
                      <span>Signal RSSI</span>
                    </span>
                    <span className="font-mono text-[#E0E0E0] font-semibold">{node.signalRssi}</span>
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

              <div className="pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setViewedNode(node)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>View</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PageFooterNote
        icon={Radio}
        text="Master Node Mesh is view-only in the Farm Owner Portal. Reboot and power controls remain restricted to the Admin console."
      />

      {viewedNode && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    <Battery className="w-3 h-3" /> Battery
                  </p>
                  <p className="text-sm font-mono font-bold text-white">{viewedNode.batteryPercent}%</p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Wifi className="w-3 h-3" /> Signal
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.signalRssi}</p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3" /> Last Ping
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.lastPing}</p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Cpu className="w-3 h-3" /> Firmware
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.firmwareVersion}</p>
                </div>
                <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3">
                  <p className="text-[10px] uppercase text-[#808080] font-bold flex items-center gap-1.5 mb-1">
                    <Hash className="w-3 h-3" /> Sector
                  </p>
                  <p className="text-sm font-mono font-bold text-white truncate">{viewedNode.sector}</p>
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
                        <span>
                          {isNotConnected ? 'Not Connected' : `${sensor.status} · ${sensor.voltageMv}mV`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#262626] flex items-center gap-1.5 text-[10px] text-[#808080]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>Display-only view. Remote control actions are not available from the Owner Portal.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
