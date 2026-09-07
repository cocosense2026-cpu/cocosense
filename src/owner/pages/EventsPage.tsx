import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle, Gauge } from 'lucide-react';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';

interface EventRow {
  id: string | number;
  sector: string;
  nodeId?: string;
  grams: number;
  severity: string;
  timestamp: string;
}

interface EventPanel {
  nodeId: string;
  nodeName: string;
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
  // How many piezo units this owner actually has -- one panel per
  // master node the admin provisioned for them (see "Initial Master
  // Nodes" on the Add Owner form / "Expand Nodes"). Falls back to a
  // single empty panel so the page still renders its normal skeleton
  // shape while the first load is in flight.
  const panels: EventPanel[] = data?.panels?.length
    ? data.panels
    : [{ nodeId: '-', nodeName: 'Sensor 1', status: { grams: 0, severity: 'Normal', sector: '' }, sparkline: [], logs: [] }];

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

      {/* Vibration intensity -- one card per piezo/master node the owner has */}
      <div className="space-y-4">
        {panels.length > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">
              Vibration Intensity ({panels.length} sensors)
            </span>
          </div>
        )}
        <div className={`grid grid-cols-1 ${panels.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
          {panels.map((panel) => {
            const panelMaxGrams = Math.max(1, ...panel.sparkline.map((s) => s.grams), 1);
            const panelBars = panel.sparkline.length ? panel.sparkline : Array(8).fill({ grams: 0, severity: 'Normal' });
            const panelStyle = SEVERITY_STYLES[panel.status.severity] || SEVERITY_STYLES.Normal;
            return (
              <div key={panel.nodeId} className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">
                    {panels.length > 1 ? panel.nodeName : 'Vibration Intensity'}
                  </span>
                  <span className={`px-2 py-0.5 rounded bg-[#1A1A1A] border text-[10px] font-semibold ${panelStyle.text} ${panelStyle.border}`}>
                    {panel.status.grams.toFixed(1)}g · {panel.status.severity}
                  </span>
                </div>
                {loading ? (
                  <div className="h-16 rounded bg-[#0E0E0E] border border-[#262626] animate-pulse" />
                ) : (
                  <div className="flex items-end gap-1.5 h-16">
                    {panelBars.map((pt: EventRow, i: number) => {
                      const h = Math.max(6, Math.round((pt.grams / panelMaxGrams) * 64));
                      const tone = SEVERITY_STYLES[pt.severity] || SEVERITY_STYLES.Normal;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${tone.bg} border-t-2`}
                          style={{ height: h, borderColor: tone.text.replace('text-[', '').replace(']', '') }}
                          title={`${pt.sector ?? ''} · ${pt.grams}g`}
                        />
                      );
                    })}
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
                      {panels.length > 1 && log.nodeId && (
                        <span className="ml-1.5 text-[#808080] font-normal">
                          · {panels.find((p) => p.nodeId === log.nodeId)?.nodeName ?? log.nodeId}
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
