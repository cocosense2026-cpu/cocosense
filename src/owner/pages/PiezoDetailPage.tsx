import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  PowerOff,
  Gauge,
  Radio,
} from 'lucide-react';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';
import { VibrationStrengthChart } from '../../components/VibrationStrengthChart';
import { WeekSeries, Thresholds, weekToPoints, weekHasVibration } from '../weekSeries';

interface EventRow {
  id: string | number;
  sector: string;
  grams: number;
  severity: string;
  timestamp: string;
}

interface PiezoDetail {
  piezoId: string;
  nodeId: string;
  nodeName: string;
  treeId?: number | null;
  treeName?: string | null;
  treeState?: { active: boolean; pest: 'INFECTED' | 'CLEARED' | null };
  pin: string;
  piezoNumber: number;
  sensorLabel: string;
  sensorStatus: string;
  enabled: boolean;
  status: { grams: number; severity: string; sector: string };
  /** Newest raw readings -- only a fallback if an older server sends no `week`. */
  sparkline: EventRow[];
  /** Strongest reading in each 15-minute window of the last 7 days. */
  week?: WeekSeries | null;
  thresholds?: Thresholds;
  logs: EventRow[];
}

const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  Critical: { text: 'text-[#F44336]', bg: 'bg-[#2B1B1B]', border: 'border-[#F44336]/30', icon: AlertTriangle },
  Elevated: { text: 'text-[#E9A23B]', bg: 'bg-[#261F0E]', border: 'border-[#E9A23B]/30', icon: AlertCircle },
  Normal: { text: 'text-[#4CAF50]', bg: 'bg-[#142416]', border: 'border-[#4CAF50]/30', icon: CheckCircle },
  Offline: { text: 'text-[#808080]', bg: 'bg-[#1A1A1A]', border: 'border-[#333333]', icon: PowerOff },
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

// Detail view for exactly ONE piezo transducer -- reached by tapping a
// "Piezo N" card on /owner/events. Shows only that sensor's own
// vibration readings (never mixed with any other piezo) plus its
// recent log, capped at 10 entries by the backend
// (GET /owner/events/piezo/:piezoId). The chart covers the last 7 days:
// swipe/scroll right to go back through the week -- the server sends the
// strongest reading in each 15-minute window, so the whole week is there.
export const PiezoDetailPage: React.FC = () => {
  const { piezoId } = useParams<{ piezoId: string }>();
  // Which tree's readings to show (set by the tree the owner came from).
  const [searchParams] = useSearchParams();
  const treeParam = searchParams.get('tree');
  const treeId = treeParam && Number.isFinite(Number(treeParam)) ? Number(treeParam) : null;
  const [data, setData] = useState<PiezoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // "Live" = newest raw, per-second readings, zoomed in and scrollable so
  // each individual report is its own point. "Week" = strongest reading
  // per 15-minute window over the last 7 days, zoomed out. Defaults to
  // Live since seeing every second is the point of this toggle.
  const [chartMode, setChartMode] = useState<'live' | 'week'>('live');

  const load = useCallback(() => {
    if (!piezoId) return;
    ownerApi
      .piezoEvents(piezoId, treeId)
      .then((res: any) => {
        setData(res);
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }, [piezoId, treeId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setNotFound(false);
    ownerApi
      .piezoEvents(piezoId ?? '', treeId)
      .then((res: any) => setData(res))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [piezoId, treeId]);

  usePolling(load, 1000);

  const style = SEVERITY_STYLES[data?.status.severity ?? 'Normal'] || SEVERITY_STYLES.Normal;
  const StatusIcon = style.icon;
  const notConnected = data?.sensorStatus === 'NOT_CONNECTED';


  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Vibration Events"
        title={data ? data.sensorLabel : 'Piezo Transducer'}
        description={
          data
            ? `Live readings from ${data.sensorLabel} (${data.pin}) on ${data.nodeName}${data.treeName ? ` · ${data.treeName}` : ''}. This view shows only this sensor's own vibration activity.${data.treeState && !data.treeState.active ? ' You switched this piezo off for this tree, so it is not recording new readings.' : ''}${data.treeState?.pest === 'INFECTED' ? ' Marked as infected.' : data.treeState?.pest === 'CLEARED' ? ' Marked as pest-cleared.' : ''}`
            : 'Live readings from this individual piezo transducer.'
        }
        actions={
          <Link
            to="/owner/events"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0] text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Piezos
          </Link>
        }
      />

      {loading ? (
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          Loading sensor data…
        </div>
      ) : notFound || !data ? (
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          This piezo transducer couldn't be found on your estate.
        </div>
      ) : (
        <>
          {/* Current status */}
          <div className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">
                {data.sensorLabel} · Current Status
              </span>
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
                <StatusIcon className="w-3 h-3" /> {data.status.severity}
              </span>
            </div>
            <div className="text-3xl font-bold text-white">
              {data.status.grams.toFixed(1)}
              <span className="text-sm text-[#808080] font-normal ml-1.5">g [Peak]</span>
            </div>
            <p className="text-xs text-[#808080] mt-1">
              {data.nodeName} · Pin {data.pin} · {data.status.sector}
            </p>
          </div>

          {/* Vibration chart -- this piezo only */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">Vibration Intensity</span>
              {/* Live (every second, zoomed in / scrollable) vs Week
                  (15-min peaks over 7 days, zoomed out). */}
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
            <div
              className={`rounded-lg border p-5 sm:p-6 transition-opacity ${
                data.enabled ? 'bg-[#141414] border-[#262626]' : 'bg-[#111111] border-[#262626] opacity-60'
              }`}
            >
              {(() => {
                const placeholderPoints = Array.from({ length: 8 }, () => ({ grams: 0, severity: 'Offline' }));
                // Full 7 days (15-min windows) when the server sent it; the
                // raw per-second readings otherwise. chartMode picks which
                // one to prefer when both exist -- the other is still the
                // fallback so the chart never goes blank just because the
                // preferred series hasn't loaded yet.
                const weekPoints = data.week ? weekToPoints(data.week, data.thresholds) : [];
                const livePoints = data.sparkline;
                const preferred = chartMode === 'live' ? livePoints : weekPoints;
                const fallback = chartMode === 'live' ? weekPoints : livePoints;
                const chartPoints = preferred.length ? preferred : fallback.length ? fallback : placeholderPoints;
                const usingWeek = chartPoints === weekPoints && weekPoints.length > 0;
                const noReadingsYet = !data.week && data.sparkline.length === 0;
                const quietWeek = !!data.week && !weekHasVibration(data.week);
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[#0E0E0E] border border-[#262626]">
                      <VibrationStrengthChart
                        points={chartPoints}
                        height={280}
                        xAxisLabel="Time"
                        scrollable
                        // Week peaks are already spaced-out events, 8px
                        // reads fine; raw per-second points get more room
                        // (20px) so every individual second stays visually
                        // distinct instead of blurring together.
                        pxPerPoint={usingWeek ? 8 : 20}
                      />
                    </div>
                    {!data.enabled ? (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#808080]">
                        <PowerOff className="w-3.5 h-3.5 flex-shrink-0" />
                        {notConnected ? `No piezo wired to ${data.pin} yet` : 'Sensor not working'}
                      </div>
                    ) : noReadingsYet ? (
                      <div className="text-center text-[11px] text-[#808080]">No readings recorded yet.</div>
                    ) : quietWeek ? (
                      <div className="text-center text-[11px] text-[#808080]">
                        No vibration recorded by this sensor in the last 7 days.
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Recent log -- capped at 10 by the backend */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">
                {data.sensorLabel} · Recent Log
              </span>
              <span className="text-[10px] text-[#808080]">Last {data.logs.length}</span>
            </div>
            <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
              {!data.logs.length ? (
                <div className="p-8 text-center text-xs text-[#808080]">
                  No vibration events recorded yet for this sensor.
                </div>
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
                        <div className="text-sm font-semibold text-white truncate">{log.sector}</div>
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
            icon={Radio}
            text={`This page only shows readings from ${data.sensorLabel} on ${data.nodeName}. Head back to All Piezos to see every sensor on your estate.`}
          />
        </>
      )}

      {!loading && !data && !notFound && (
        <PageFooterNote icon={Gauge} text="Piezoelectric transducers sample continuously." />
      )}
    </div>
  );
};
