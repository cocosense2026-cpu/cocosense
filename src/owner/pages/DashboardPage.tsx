import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Radio,
  Wifi,
  ChevronRight,
  Activity,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { ownerApi } from '../api';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

interface DashboardData {
  ownerName: string;
  sector: string;
  totalTrees: number;
  healthyTrees: number;
  nodesOnline: number;
  nodesTotal: number;
  topAlert: { pest?: string; sector?: string; title?: string; description?: string } | null;
  activeAlertCount: number;
  vibration: { grams: number; severity: string; sector: string };
}

const VIBE_MAX_GRAMS = 10;

export const DashboardPage: React.FC = () => {
  const { owner } = useOwnerAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ownerApi
      .dashboard()
      .then((res) => !cancelled && setData(res))
      .catch(() => void 0)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = (owner?.firstName || owner?.name || 'Farm Owner').split(' ')[0];

  const vibePct = data ? Math.min(100, (data.vibration.grams / VIBE_MAX_GRAMS) * 100) : 0;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - vibePct / 100);
  const vibeTone =
    data?.vibration.severity === 'Critical' ? '#F44336' : data?.vibration.severity === 'Elevated' ? '#E9A23B' : '#4CAF50';

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Dashboard"
        title={`Good day, ${firstName}.`}
        description={`Monitoring active for ${data?.sector || owner?.sector || 'your estate'}. Piezoelectric sensors report live vibration readings across every registered palm so pest activity surfaces before visible damage sets in.`}
        actions={
          <>
            <Link
              to="/owner/events"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold transition-colors"
            >
              <Activity className="w-4 h-4" /> Vibration Events
            </Link>
            <Link
              to="/owner/notifications"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0] text-xs font-semibold transition-colors"
            >
              <Bell className="w-4 h-4" /> Notifications
            </Link>
          </>
        }
      />

      {/* Estate overview */}
      <div className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#808080]">Estate Overview</span>
        </div>

        {loading ? (
          <div className="h-16 rounded bg-[#0E0E0E] border border-[#262626] animate-pulse" />
        ) : data?.topAlert ? (
          <div className="rounded bg-[#2B1B1B] border border-[#F44336]/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#F44336]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {data.topAlert.pest || data.topAlert.title || 'Sensor Alert'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F44336]/15 text-[#F44336] text-[10px] font-mono font-bold">
                {data.activeAlertCount} PRIORITY
              </span>
            </div>
            <p className="text-xs text-[#E0E0E0]">
              {data.topAlert.description ||
                `Sensor reports unusual vibration patterns in ${data.topAlert.sector ?? 'your estate'}. Physical check recommended.`}
            </p>
            <Link
              to="/owner/notifications"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F44336] hover:text-[#ff6b5c]"
            >
              Acknowledge <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="rounded bg-[#142416] border border-[#4CAF50]/30 p-4">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#4CAF50]">
              <CheckCircle className="w-3.5 h-3.5" /> All Clear
            </span>
            <p className="text-xs text-[#E0E0E0] mt-1.5">No active priority alerts right now. Your estate is stable.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded bg-[#0E0E0E] border border-[#262626] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#808080] font-bold">Nodes Online</span>
              <span className="p-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-[#D4AF37]">
                <Radio className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-2 font-mono">
              {data ? `${data.nodesOnline}/${data.nodesTotal}` : '—'}
            </div>
          </div>
          <div className="rounded bg-[#0E0E0E] border border-[#262626] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#808080] font-bold">LoRa Mesh</span>
              <span className="p-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-[#D4AF37]">
                <Wifi className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-2">
              {data && data.nodesTotal > 0 && data.nodesOnline === data.nodesTotal ? 'Strong' : 'Degraded'}
            </div>
          </div>
        </div>

        <div className="rounded bg-[#0E0E0E] border border-[#262626] p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="text-[#808080] uppercase tracking-wider text-[10px]">Tree Health</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{data?.totalTrees ?? '—'}</div>
              <div className="text-[10px] text-[#808080] uppercase">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[#4CAF50] flex items-center gap-1">
                {data?.healthyTrees ?? '—'} <CheckCircle className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-[#808080] uppercase">Healthy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Vibration gauge */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Live Monitoring</div>
        <Link
          to="/owner/events?sort=strongest"
          className="flex items-center gap-4 rounded-lg bg-[#141414] border border-[#262626] p-4 sm:p-5 hover:border-[#D4AF37]/30 transition-colors"
        >
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r={radius} fill="none" stroke="#262626" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={vibeTone}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-white">{(data?.vibration.grams ?? 0).toFixed(1)}</span>
              <span className="text-[9px] text-[#808080]">g</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Vibration Strength</div>
            <div className="text-xs text-[#808080] mt-0.5">
              {data?.vibration.severity ?? 'Normal'} &middot; {data?.vibration.sector ?? 'Your Estate'} &middot; Tap
              for strongest to weakest
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#808080] flex-shrink-0" />
        </Link>
      </div>

      {/* Quick links */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Quick Links</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
          <Link to="/owner/events" className="flex items-center gap-3 p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="p-2 rounded bg-[#0E0E0E] border border-[#262626] text-[#D4AF37]">
              <Activity className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">Vibration Events</div>
              <div className="text-xs text-[#808080]">View live sensor activity log</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#808080]" />
          </Link>
          <Link to="/owner/notifications" className="flex items-center gap-3 p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="p-2 rounded bg-[#0E0E0E] border border-[#262626] text-[#D4AF37]">
              <Bell className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">Notifications</div>
              <div className="text-xs text-[#808080]">Review alerts and system updates</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#808080]" />
          </Link>
        </div>
      </div>

      <PageFooterNote
        icon={RefreshCw}
        text={
          <>
            Estate data refreshes automatically as master nodes push readings over the LoRa mesh &middot; nodes{' '}
            {data ? `${data.nodesOnline}/${data.nodesTotal}` : '—'} online.
          </>
        }
      />
    </div>
  );
};
