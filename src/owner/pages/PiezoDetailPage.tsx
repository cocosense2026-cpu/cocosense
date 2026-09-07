import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  pin: string;
  piezoNumber: number;
  sensorLabel: string;
  sensorStatus: string;
  enabled: boolean;
  status: { grams: number; severity: string; sector: string };
  sparkline: EventRow[];
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
// (GET /owner/events/piezo/:piezoId).
export const PiezoDetailPage: React.FC = () => {
  const { piezoId } = useParams<{ piezoId: string }>();
  const [data, setData] = useState<PiezoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!piezoId) return;
    ownerApi
      .piezoEvents(piezoId)
      .then((res: any) => {
        setData(res);
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }, [piezoId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setNotFound(false);
    ownerApi
      .piezoEvents(piezoId ?? '')
      .then((res: any) => setData(res))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [piezoId]);

  usePolling(load, 10000);

  const style = SEVERITY_STYLES[data?.status.severity ?? 'Normal'] || SEVERITY_STYLES.Normal;
  const StatusIcon = style.icon;
  const notConnected = data?.sensorStatus === 'NOT_CONNECTED';
  const maxGrams = Math.max(1, ...(data?.sparkline.map((s) => s.grams) ?? []), 1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Vibration Events"
        title={data ? data.sensorLabel : 'Piezo Transducer'}
        description={
          data
            ? `Live readings from ${data.sensorLabel} (${data.pin}) on ${data.nodeName}. This view shows only this sensor's own vibration activity.`
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">Vibration Intensity</span>
            </div>
            <div
              className={`rounded-lg border p-5 sm:p-6 transition-opacity ${
                data.enabled ? 'bg-[#141414] border-[#262626]' : 'bg-[#111111] border-[#262626] opacity-60'
              }`}
            >
              {!data.enabled ? (
                <div className="h-28 flex items-center justify-center text-[11px] text-[#808080] gap-1.5 text-center px-2">
                  <PowerOff className="w-3.5 h-3.5 flex-shrink-0" />
                  {notConnected ? `No piezo wired to ${data.pin} yet` : 'Sensor not working'}
                </div>
              ) : data.sparkline.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-[11px] text-[#808080]">
                  No readings recorded yet.
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-28">
                  {data.sparkline.map((pt, i) => {
                    const h = Math.max(6, Math.round((pt.grams / maxGrams) * 112));
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
