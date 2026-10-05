import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Eye, Loader2, Radio, WifiOff } from 'lucide-react';
import { Avatar } from './Avatar';
import { usePolling } from '../hooks/usePolling';
import { adminApi, OwnerActivitySummary, OwnerPresence } from '../admin/api';

// Dashboard card: every owner who has opened their system, most recent
// first. Capped so the card stays short; it scrolls on its own.
const MAX_ROWS = 10;
const POLL_MS = 10000;

const PRESENCE_COLOR: Record<OwnerPresence, string> = {
  online: '#16A34A',
  away: '#D4AF37',
  offline: '#505050',
};

function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return 'never';
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  onNavigate: (view: any) => void;
}

export const DashboardRecentActivity: React.FC<Props> = ({ onNavigate }) => {
  const [owners, setOwners] = useState<OwnerActivitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await adminApi.activityOwners();
      setOwners(res.owners);
      setError(null);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, POLL_MS);

  // Only owners who have actually opened something; newest first.
  const opened = (owners ?? [])
    .filter((o) => o.lastOpened)
    .sort((a, b) => new Date(b.lastOpened!.at).getTime() - new Date(a.lastOpened!.at).getTime());
  const rows = opened.slice(0, MAX_ROWS);

  return (
    <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase tracking-widest text-[#808080] flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-[#16A34A]" />
          Recent Activity{owners ? ` (${rows.length}${opened.length > MAX_ROWS ? ` of ${opened.length}` : ''})` : ''}
        </h3>
        <button
          type="button"
          onClick={() => onNavigate('activity')}
          className="text-xs font-bold text-[#16A34A] hover:underline flex items-center gap-1 uppercase tracking-wider"
        >
          View All
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && owners === null ? (
        <div className="flex items-center gap-2 text-xs text-[#F44336] py-4">
          <WifiOff className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      ) : owners === null ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#808080]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <Radio className="w-8 h-8 text-[#808080]/40 mx-auto mb-2" />
          <p className="text-xs text-[#808080]">No owner has opened their system yet.</p>
        </div>
      ) : (
        // Fixed max height + its own scrollbar keeps the card short.
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 overscroll-contain">
          {rows.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onNavigate('activity')}
              className="w-full text-left p-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#202020] border border-[#262626] flex items-center justify-between gap-3 text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <Avatar avatarUrl={o.avatarUrl} initials={o.initials} color={o.color} name={o.name} size="xs" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1A1A] ${
                      o.presence === 'online' ? 'animate-pulse' : ''
                    }`}
                    style={{ backgroundColor: PRESENCE_COLOR[o.presence] }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{o.name}</div>
                  <div className="text-[10px] text-[#808080] truncate">
                    {o.presence === 'online' ? 'Viewing' : 'Opened'} {o.lastOpened!.label}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 font-mono text-[10px]">
                {o.presence === 'online' ? (
                  <span className="font-bold text-[#16A34A]">Online</span>
                ) : (
                  <span className="text-[#808080]">{timeAgo(o.lastOpened!.at, now)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
