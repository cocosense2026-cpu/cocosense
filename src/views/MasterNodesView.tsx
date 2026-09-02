import React, { useState } from 'react';
import { MasterNode } from '../types';
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
  Terminal,
  ShieldCheck,
  Sparkles,
  Clock,
  Hash
} from 'lucide-react';

interface MasterNodesViewProps {
  nodes: MasterNode[];
}

export const MasterNodesView: React.FC<MasterNodesViewProps> = ({ nodes }) => {
  const [viewedNode, setViewedNode] = useState<MasterNode | null>(null);
  const [terminalLogs] = useState<string[]>([
    '[07:15:02] Mesh Gateway: Connected to 5 master control hubs across Quezon & Aurora.',
    '[07:18:44] NODE-001 (Sector Alpha): Piezoelectric calibration OK. 6 transducers online.',
    '[07:19:12] NODE-004 (Sector Delta ASCOT): Solar battery charging at 99.2% (14.2V).',
    '[07:20:00] NODE-003 (Sector Charlie): Heartbeat timed out. Switching to local buffer mode.',
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Master Node Mesh Network &amp; Control Hubs
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            LoRaWAN &amp; Cellular mesh hubs aggregating 6 piezoelectric acoustic sensors each with solar battery storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded bg-[#141414] border border-[#262626] text-xs font-mono text-[#D4AF37] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
            <span>Mesh Status: <strong className="text-white">98% OPTIMAL</strong></span>
          </div>
        </div>
      </div>

      {/* Nodes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map(node => (
          <div
            key={node.id}
            className={`rounded border p-6 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-5 transition-all ${
              node.online
                ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
                : 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
            }`}
          >
            <div>
              {/* Header: Sector & Status */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                  {node.sector}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                  node.online
                    ? 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                    : 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                }`}>
                  {node.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* Node ID & Name */}
              <h3 className="font-mono text-xl sm:text-2xl font-bold text-white">{node.id}</h3>
              <p className="text-xs text-[#808080] mt-0.5">{node.name}</p>

              {/* Battery & Signal Stats */}
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

              {/* 6 Connected Piezo Transducers Matrix */}
              <div className="mt-4 pt-3 border-t border-[#262626]">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#808080] mb-2">
                  <span>Piezo Transducers (6)</span>
                  <span className="font-mono text-[#D4AF37]">{node.workingSensors} / {node.totalSensors} Active</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {node.sensors.map((sensor, i) => {
                    const isDamaged = sensor.status === 'DAMAGED';
                    return (
                      <div
                        key={sensor.id}
                        className={`h-7 rounded border flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                          isDamaged
                            ? 'bg-[#2B1B1B] border-[#F44336]/40 text-[#F44336]'
                            : 'bg-[#0A0A0A] border-[#262626] text-[#D4AF37]'
                        }`}
                        title={`${sensor.id} - Tree ${sensor.treeId} (${sensor.status})`}
                      >
                        P{i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions Bar -- view-only: display detail, no remote control */}
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

      {/* Real-Time LoRaWAN / Cellular Gateway Terminal */}
      <div className="rounded bg-[#141414] border border-[#262626] p-5 shadow-2xl space-y-3 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
            <Terminal className="w-4 h-4" />
            <span>Master Mesh Gateway Telemetry Terminal</span>
          </div>
          <span className="text-[10px] text-[#808080]">Auto-Polling (15s Window)</span>
        </div>

        <div className="space-y-1.5 text-xs text-[#E0E0E0] leading-relaxed overflow-x-auto">
          {terminalLogs.map((log, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#D4AF37] select-none">&gt;</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>

      {/* View (Display-Only) Detail Modal */}
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
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className="font-mono text-lg font-bold text-white">{viewedNode.id}</h3>
                  <p className="text-[11px] text-[#808080]">{viewedNode.name}</p>
                </div>
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
                  <span className="font-mono text-[#D4AF37]">{viewedNode.workingSensors} / {viewedNode.totalSensors} Active</span>
                </div>
                <div className="space-y-1.5">
                  {viewedNode.sensors.map((sensor) => {
                    const isDamaged = sensor.status === 'DAMAGED';
                    return (
                      <div
                        key={sensor.id}
                        className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono ${
                          isDamaged
                            ? 'bg-[#2B1B1B] border-[#F44336]/30 text-[#F44336]'
                            : 'bg-[#0A0A0A] border-[#262626] text-[#E0E0E0]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isDamaged ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF50]" />}
                          {sensor.id} <span className="text-[#808080]">· Tree {sensor.treeId}</span>
                        </span>
                        <span>{sensor.status} · {sensor.voltageMv}mV</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#262626] flex items-center gap-1.5 text-[10px] text-[#808080]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>Display-only view. Remote control actions are not available from this screen.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
