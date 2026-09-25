import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle, PowerOff, Gauge, Activity } from 'lucide-react';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';
import { VibrationStrengthChart } from '../../components/VibrationStrengthChart';

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
  pin: string;
  sensorLabel: string;
  sensorStatus: string;
  enabled: boolean;
  status: { grams: number; severity: string; sector: string };
  sparkline: EventRow[];
  logs: EventRow[];
}

interface EventsData {
  sort: 'recent' | 'strongest';
  status: { grams: number; severity: string; sector: string };
  sparkline: EventRow[];
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
  const [data, setData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ownerApi
      .events(sort)
      .then((res) => !cancelled && setData(res))
      .catch(() => void 0)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort]);

  // Keeps this page current with new device readings as they arrive,
  // without the visible loading spinner flashing on every refresh --
  // only the initial load (above) shows that.
  const refresh = useCallback(() => {
    ownerApi.events(sort).then(setData).catch(() => void 0);
  }, [sort]);
  usePolling(refresh, 10000);

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Vibration Events"
        title="Vibration Events"
        description="Live sensor activity across your monitored trees. Every reading is stamped as it arrives over the mesh so you can spot a spike the moment it happens, not after canopy damage becomes visible."
      />

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
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">
            Vibration Intensity ({enabledCount}/{panels.length} sensors active)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {panels.map((panel, index) => {
            const panelBars = panel.sparkline.length ? panel.sparkline : Array(8).fill({ grams: 0, severity: 'Normal' });
            const panelStyle = SEVERITY_STYLES[panel.status.severity] || SEVERITY_STYLES.Normal;
            const PanelStatusIcon = panelStyle.icon;
            const notConnected = panel.sensorStatus === 'NOT_CONNECTED';
            const badgeLabel = `P${index + 1}`;
            const statusLabel = panel.enabled ? panel.status.severity || 'Normal' : 'Offline';
            const statusMessage = panel.enabled
              ? SEVERITY_MESSAGES[panel.status.severity] || SEVERITY_MESSAGES.Normal
              : notConnected
              ? SEVERITY_MESSAGES.Offline
              : 'Sensor is disabled or not responding.';
            return (
              <Link
                key={panel.piezoId}
                to={`/owner/events/piezo/${encodeURIComponent(panel.piezoId)}`}
                className={`block rounded-lg border p-5 sm:p-6 transition-all ${
                  panel.enabled
                    ? 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50'
                    : 'bg-[#111111] border-[#262626] opacity-70 hover:opacity-90'
                }`}
              >
                {/* Header: piezo badge + name + active/inactive pill, and
                    vibration strength readout on the right -- mirrors the
                    reference 2x2 monitor layout. */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${
                        panel.enabled ? 'bg-[#4CAF50] text-black' : 'bg-[#333333] text-[#A0A0A0]'
                      }`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-sm font-bold text-white truncate">{panel.sensorLabel}</span>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        panel.enabled
                          ? 'bg-[#142416] text-[#4CAF50] border border-[#4CAF50]/30'
                          : 'bg-[#1A1A1A] text-[#808080] border border-[#333333]'
                      }`}
                    >
                      {panel.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Activity className={`w-3.5 h-3.5 ${panel.enabled ? 'text-[#4CAF50]' : 'text-[#606060]'}`} />
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-[#808080] font-semibold whitespace-nowrap">
                        Vibration Strength
                      </div>
                      <div className="text-sm font-bold text-white font-mono">
                        {panel.enabled ? panel.status.grams.toFixed(2) : '0.00'}
                        <span className="text-[10px] text-[#808080] font-normal"> g</span>
                      </div>
                    </div>
                    <span
                      className={`w-3 h-4 rounded-sm flex-shrink-0 ${
                        panel.enabled ? 'bg-[#4CAF50]' : 'border border-[#404040] bg-transparent'
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
                    <VibrationStrengthChart points={panelBars} height={150} />
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
              onClick={() => setSearchParams({ sort: 'recent' })}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                sort === 'recent' ? 'bg-[#D4AF37] text-black' : 'text-[#808080] hover:text-white'
              }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ sort: 'strongest' })}
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
            <div className="p-8 text-center text-xs text-[#808080]">No vibration events recorded yet.</div>
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
