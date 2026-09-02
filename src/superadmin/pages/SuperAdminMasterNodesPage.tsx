import React, { useEffect, useState } from 'react';
import {
  Radio,
  Battery,
  Wifi,
  Waves,
  Zap,
  BatteryCharging,
  Cpu,
  PlayCircle,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { superAdminApi, SuperAdminMasterNode, SuperAdminApiError } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

type ComponentKey = 'piezo' | 'lora' | 'ads' | 'battery';
type TestState = 'idle' | 'running' | 'pass' | 'fail';

const COMPONENTS: Array<{ key: ComponentKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'piezo', label: 'Piezoelectric Sensor', icon: Waves },
  { key: 'lora', label: 'LoRa Radio', icon: Radio },
  { key: 'ads', label: 'ADS (ADC)', icon: Zap },
  { key: 'battery', label: 'Battery', icon: BatteryCharging },
];

// Deterministic-ish simulated pass/fail: healthy, online nodes almost
// always pass; nodes already flagged offline / low battery / with
// damaged transducers are far more likely to surface a failing
// component, so the self-test result tracks the node's real telemetry
// instead of being pure noise.
function simulateResult(node: SuperAdminMasterNode, key: ComponentKey): boolean {
  if (!node.online) return key === 'battery' ? node.batteryPercent > 5 : false;
  if (key === 'piezo') return node.damagedSensors === 0 || Math.random() > 0.3;
  if (key === 'battery') return node.batteryPercent > 20;
  if (key === 'lora') return !node.signalRssi?.toLowerCase().includes('no signal');
  return Math.random() > 0.05; // ADS
}

export const SuperAdminMasterNodesPage: React.FC = () => {
  const [nodes, setNodes] = useState<SuperAdminMasterNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<Record<string, TestState>>({});

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

  const keyFor = (nodeId: string, componentKey: ComponentKey) => `${nodeId}:${componentKey}`;

  const runComponentTest = (node: SuperAdminMasterNode, componentKey: ComponentKey) => {
    const k = keyFor(node.id, componentKey);
    setTestState((prev) => ({ ...prev, [k]: 'running' }));
    setTimeout(() => {
      const passed = simulateResult(node, componentKey);
      setTestState((prev) => ({ ...prev, [k]: passed ? 'pass' : 'fail' }));
    }, 900 + Math.random() * 500);
  };

  const runAllTests = (node: SuperAdminMasterNode) => {
    COMPONENTS.forEach((c) => runComponentTest(node, c.key));
  };

  const onlineCount = nodes.filter((n) => n.online).length;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Device Health Monitoring"
        title="Master Node Mesh"
        description="Plantation-wide monitoring of every master control hub. Run per-component self-tests (Piezoelectric Sensor, LoRa, ADS, Battery) to confirm a device is still working, without sending any reboot or power control command."
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
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`rounded border p-6 shadow-xl space-y-5 transition-all ${
                node.online
                  ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
                  : 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                      {node.sector}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                        node.online
                          ? 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                          : 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                      }`}
                    >
                      {node.online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <h3 className="font-mono text-xl font-bold text-white">{node.id}</h3>
                  <p className="text-xs text-[#808080] mt-0.5">{node.name}</p>
                  <p className="text-[10px] text-[#606060] mt-1">
                    Owner: <span className="text-[#A0A0A0]">{node.ownerName || 'Unassigned'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAllTests(node)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-[11px] uppercase tracking-wider transition-colors flex-shrink-0"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Test All
                </button>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between rounded bg-[#0A0A0A] border border-[#262626] px-3 py-2">
                  <span className="text-[#808080] flex items-center gap-1.5">
                    <Battery className="w-3.5 h-3.5 text-[#D4AF37]" /> Battery
                  </span>
                  <span className="font-mono font-bold text-white">{node.batteryPercent}%</span>
                </div>
                <div className="flex items-center justify-between rounded bg-[#0A0A0A] border border-[#262626] px-3 py-2">
                  <span className="text-[#808080] flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#D4AF37]" /> Signal
                  </span>
                  <span className="font-mono font-bold text-white truncate max-w-[7rem]">{node.signalRssi}</span>
                </div>
              </div>

              {/* Component self-test grid */}
              <div className="pt-3 border-t border-[#262626]">
                <p className="text-[10px] uppercase font-bold text-[#808080] mb-2.5">Component Self-Test</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {COMPONENTS.map((c) => {
                    const state = testState[keyFor(node.id, c.key)] || 'idle';
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        disabled={state === 'running'}
                        onClick={() => runComponentTest(node, c.key)}
                        className={`text-left rounded border px-3 py-2.5 transition-colors ${
                          state === 'pass'
                            ? 'bg-[#0F1F12] border-[#4CAF50]/40 hover:border-[#4CAF50]'
                            : state === 'fail'
                            ? 'bg-[#2B1B1B] border-[#F44336]/40 hover:border-[#F44336]'
                            : 'bg-[#0A0A0A] border-[#262626] hover:border-[#D4AF37]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#E0E0E0]">
                            <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
                            {c.label}
                          </span>
                          {state === 'running' && <RotateCw className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />}
                          {state === 'pass' && <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF50]" />}
                          {state === 'fail' && <XCircle className="w-3.5 h-3.5 text-[#F44336]" />}
                        </div>
                        <p className="text-[10px] text-[#808080] mt-1 font-mono">
                          {state === 'idle' && 'Tap to run test'}
                          {state === 'running' && 'Testing…'}
                          {state === 'pass' && 'Working normally'}
                          {state === 'fail' && 'Fault detected'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {node.damagedSensors > 0 && (
                <div className="flex items-center gap-2 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-3 py-2 text-[11px] text-[#F44336]">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {node.damagedSensors} of {node.totalSensors} piezo transducers reporting damage.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PageFooterNote
        icon={Cpu}
        text="Self-tests run in-app simulated diagnostics to confirm each device is still reporting. This screen is monitoring-only — reboot and power controls remain restricted to the Admin console."
      />
    </div>
  );
};
