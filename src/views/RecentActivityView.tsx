import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Eye,
  KeyRound,
  Loader2,
  MousePointerClick,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { Avatar } from '../components/Avatar';
import { usePolling } from '../hooks/usePolling';
import {
  adminApi,
  ActivityItem,
  ActivityKind,
  OwnerActivityDetail,
  OwnerActivitySummary,
  OwnerPresence,
} from '../admin/api';

// How often the page re-fetches while it's open and the tab is visible.
const POLL_MS = 5000;
const PAGE_SIZE = 50;
// How long a just-arrived event keeps its highlight.
const FRESH_MS = 6000;

type Tab = 'all' | string; // 'all', or a farm owner's id

// ---------- Presentation helpers ----------

const PRESENCE: Record<OwnerPresence, { label: string; color: string }> = {
  online: { label: 'Online now', color: '#16A34A' },
  away: { label: 'Away', color: '#D4AF37' },
  offline: { label: 'Offline', color: '#505050' },
};

const KIND_META: Record<ActivityKind, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { label: 'Opened', color: '#38BDF8', icon: Eye },
  action: { label: 'Action', color: '#D4AF37', icon: MousePointerClick },
  account: { label: 'Account', color: '#A78BFA', icon: KeyRound },
  alert: { label: 'Alert', color: '#F44336', icon: AlertTriangle },
  registration: { label: 'Registered', color: '#16A34A', icon: UserPlus },
};

const KIND_FILTERS: Array<{ id: ActivityKind | null; label: string }> = [
  { id: null, label: 'Everything' },
  { id: 'open', label: 'Opened' },
  { id: 'action', label: 'Actions' },
  { id: 'account', label: 'Account' },
  { id: 'alert', label: 'Alerts' },
];

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

function fullTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function presenceLine(o: OwnerActivitySummary, now: number): string {
  if (o.presence === 'online') return 'Online now';
  if (o.lastSeenAt) return `${PRESENCE[o.presence].label} · seen ${timeAgo(o.lastSeenAt, now)}`;
  if (o.lastActivityAt) return `Offline · last active ${timeAgo(o.lastActivityAt, now)}`;
  return 'Never signed in';
}

const PresenceDot: React.FC<{ presence: OwnerPresence; className?: string }> = ({ presence, className = '' }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${presence === 'online' ? 'animate-pulse' : ''} ${className}`}
    style={{ backgroundColor: PRESENCE[presence].color }}
    aria-label={PRESENCE[presence].label}
  />
);

const OwnerAvatar: React.FC<{
  owner: { name: string; initials: string | null; color: string | null; avatarUrl: string | null };
  presence?: OwnerPresence;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = ({ owner, presence, size = 'sm' }) => (
  <div className="relative flex-shrink-0">
    <Avatar avatarUrl={owner.avatarUrl} initials={owner.initials} color={owner.color} name={owner.name} size={size} />
    {presence && (
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#141414] ${
          presence === 'online' ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: PRESENCE[presence].color }}
      />
    )}
  </div>
);

// ---------- Small building blocks ----------

const StatTile: React.FC<{ label: string; value: number | string; hint?: string; color?: string }> = ({
  label,
  value,
  hint,
  color,
}) => (
  <div className="rounded bg-[#141414] border border-[#262626] p-4">
    <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">{label}</p>
    <p className="mt-1.5 text-2xl font-black text-white font-mono" style={color ? { color } : undefined}>
      {value}
    </p>
    {hint && <p className="text-[11px] text-[#808080] mt-0.5">{hint}</p>}
  </div>
);

const SevenDayBars: React.FC<{ days: OwnerActivityDetail['last7Days'] }> = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.opens));
  return (
    <div className="flex items-end gap-2">
      {days.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-[#808080]">{d.opens}</span>
          <div className="w-full h-14 flex items-end">
            <div
              className="w-full rounded-sm"
              style={{
                // Pixel heights: a percentage here has no definite parent
                // height to resolve against inside the flex column.
                height: d.opens === 0 ? 3 : Math.max(8, Math.round((d.opens / max) * 56)),
                backgroundColor: d.opens === 0 ? '#333333' : '#D4AF37',
              }}
              title={`${d.opens} page opens on ${d.day}`}
            />
          </div>
          <span className="text-[10px] text-[#808080]">
            {new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
          </span>
        </div>
      ))}
    </div>
  );
};

const EventRow: React.FC<{
  item: ActivityItem;
  now: number;
  fresh: boolean;
  showOwner: boolean;
  onOpenOwner: (id: string) => void;
}> = ({ item, now, fresh, showOwner, onOpenOwner }) => {
  const meta = KIND_META[item.kind] ?? KIND_META.account;
  const Icon = meta.icon;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors duration-700 ${
        fresh ? 'bg-[#D4AF37]/15' : 'bg-transparent'
      }`}
    >
      <div
        className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#E0E0E0] leading-relaxed">
          {showOwner && (
            <button
              type="button"
              onClick={() => onOpenOwner(item.owner.id)}
              className="font-semibold text-white hover:text-[#D4AF37] transition-colors"
            >
              {item.owner.name}
            </button>
          )}
          {showOwner && ' · '}
          <span>{item.action}</span>
          {item.kind === 'alert' && item.meta && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30">
              {item.meta}
            </span>
          )}
        </p>
        {item.detail && <p className="text-[11px] text-[#808080] mt-0.5 truncate">{item.detail}</p>}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-[11px] text-[#808080] font-mono" title={fullTime(item.at)}>
          {timeAgo(item.at, now)}
        </p>
        <p className="text-[9px] uppercase tracking-wider font-bold mt-0.5" style={{ color: meta.color }}>
          {meta.label}
        </p>
      </div>
    </div>
  );
};

const FeedPanel: React.FC<{
  title: string;
  items: ActivityItem[];
  loading: boolean;
  hasMore: boolean;
  now: number;
  freshIds: Set<string>;
  kindFilter: ActivityKind | null;
  searching?: boolean;
  onKindFilter: (k: ActivityKind | null) => void;
  showOwner: boolean;
  onOpenOwner: (id: string) => void;
  onLoadMore: () => void;
}> = ({ title, items, loading, hasMore, now, freshIds, kindFilter, searching, onKindFilter, showOwner, onOpenOwner, onLoadMore }) => (
  <section className="rounded bg-[#141414] border border-[#262626] overflow-hidden">
    <div className="px-4 py-3 border-b border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#D4AF37]" />
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => {
          const active = f.id === kindFilter;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => onKindFilter(f.id)}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors border ${
                active
                  ? 'text-[#D4AF37] border-[#D4AF37]/40 bg-[#1A1A1A] font-medium'
                  : 'text-[#808080] border-[#262626] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>

    {loading && items.length === 0 ? (
      <div className="p-10 flex items-center justify-center gap-2 text-xs text-[#808080]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
      </div>
    ) : items.length === 0 ? (
      <div className="p-10 text-center">
        <Radio className="w-9 h-9 text-[#808080]/40 mx-auto mb-3" />
        <h3 className="font-bold text-white text-sm">{searching ? 'No matching activity' : 'No activity yet'}</h3>
        <p className="text-xs text-[#808080] mt-1">
          {searching
            ? 'Nothing matches your search. Try a different name, page or action.'
            : 'Events appear here the moment an owner opens a page or does something in their portal.'}
        </p>
      </div>
    ) : (
      <div className="divide-y divide-[#262626]">
        {items.map((item) => (
          <EventRow
            key={item.id}
            item={item}
            now={now}
            fresh={freshIds.has(item.id)}
            showOwner={showOwner}
            onOpenOwner={onOpenOwner}
          />
        ))}
      </div>
    )}

    {hasMore && (
      <div className="p-3 border-t border-[#262626] text-center">
        <button
          type="button"
          onClick={onLoadMore}
          className="px-4 py-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-xs text-[#D4AF37] hover:text-white transition-colors"
        >
          Load older activity
        </button>
      </div>
    )}
  </section>
);

// ---------- Main view ----------

export const RecentActivityView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('all');
  const [kindFilter, setKindFilter] = useState<ActivityKind | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced value actually sent to the server
  const [paused, setPaused] = useState(false);

  const [owners, setOwners] = useState<OwnerActivitySummary[]>([]);
  const [ownersLoaded, setOwnersLoaded] = useState(false);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<OwnerActivityDetail | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Debounce typing so every keystroke doesn't fire a request.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (next !== prev) {
          setLimit(PAGE_SIZE);
          setFeedLoading(true);
        }
        return next;
      });
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Ticks every 10s so "2m ago" labels keep moving between fetches.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // Events that arrived since the last poll get a brief highlight. The
  // first load for a given tab/filter never flashes (everything would
  // look "new"), and neither does switching tabs.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const feedKeyRef = useRef<string>('');
  const flagFresh = useCallback((items: ActivityItem[], key: string) => {
    if (feedKeyRef.current !== key) {
      feedKeyRef.current = key;
      seenRef.current = new Set(items.map((i) => i.id));
      setFreshIds(new Set());
      return;
    }
    const arrived = items.filter((i) => !seenRef.current.has(i.id)).map((i) => i.id);
    if (arrived.length === 0) return;
    arrived.forEach((id) => seenRef.current.add(id));
    setFreshIds((prev) => new Set([...prev, ...arrived]));
    setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        arrived.forEach((id) => next.delete(id));
        return next;
      });
    }, FRESH_MS);
  }, []);

  // Guards against an older, slower response overwriting a newer one
  // (e.g. the admin switches tabs while a poll is still in flight).
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const [ownersRes, feedRes, detailRes] = await Promise.all([
        adminApi.activityOwners(),
        adminApi.activityFeed({ ownerId: tab === 'all' ? null : tab, kind: kindFilter, q: search, limit }),
        tab === 'all' ? Promise.resolve(null) : adminApi.activityOwner(tab).catch(() => null),
      ]);
      if (requestId !== requestRef.current) return;

      setOwners(ownersRes.owners);
      setOwnersLoaded(true);
      setFeed(feedRes.items);
      setHasMore(feedRes.hasMore);
      setDetail(detailRes ? { owner: detailRes.owner, topPages: detailRes.topPages, last7Days: detailRes.last7Days } : null);
      flagFresh(feedRes.items, `${tab}|${kindFilter ?? ''}|${search}`);
      setError(null);
      setLastUpdated(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load activity.');
    } finally {
      if (requestId === requestRef.current) {
        setFeedLoading(false);
        setRefreshing(false);
      }
    }
  }, [tab, kindFilter, search, limit, flagFresh]);

  // Fetch immediately whenever the tab / filter / page size changes...
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ...and keep it live afterwards.
  usePolling(() => {
    if (!paused) refresh();
  }, POLL_MS);

  // An owner who gets deleted while their tab is open shouldn't leave the
  // admin staring at an empty panel.
  useEffect(() => {
    if (ownersLoaded && tab !== 'all' && !owners.some((o) => o.id === tab)) setTab('all');
  }, [owners, ownersLoaded, tab]);

  const selectTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setKindFilter(null);
    setLimit(PAGE_SIZE);
    setFeed([]);
    setDetail(null);
    setFeedLoading(true);
  };

  const selectKind = (next: ActivityKind | null) => {
    if (next === kindFilter) return;
    setKindFilter(next);
    setLimit(PAGE_SIZE);
    setFeed([]);
    setFeedLoading(true);
  };

  const onlineCount = owners.filter((o) => o.presence === 'online').length;
  const awayCount = owners.filter((o) => o.presence === 'away').length;
  const opens24h = owners.reduce((sum, o) => sum + o.opens24h, 0);
  const actions24h = owners.reduce((sum, o) => sum + o.actions24h, 0);
  const q = searchInput.trim().toLowerCase();
  const visibleOwners = q
    ? owners.filter((o) =>
        [o.name, o.id, o.email, o.sector].some((v) => (v ?? '').toLowerCase().includes(q))
      )
    : owners;
  const selectedOwner = tab === 'all' ? null : owners.find((o) => o.id === tab) ?? null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow={paused ? 'Live feed paused' : 'Live · every owner account'}
        subtitle={lastUpdated ? `Updated ${timeAgo(new Date(lastUpdated).toISOString(), now)}` : 'Connecting…'}
        title="Recent Activity"
        description="Everything happening across every farm owner's account — who is signed in, which pages they open, and what they do — updating live."
        actions={
          <>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-[#D4AF37] transition-colors"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-[#E0E0E0] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-4 py-3 text-xs text-[#F44336]">
          <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Online now" value={onlineCount} hint="seen in the last 90s" color="#16A34A" />
        <StatTile label="Away" value={awayCount} hint="idle up to 15 min" color="#D4AF37" />
        <StatTile label="Pages opened" value={opens24h} hint="last 24 hours" />
        <StatTile label="Actions taken" value={actions24h} hint="last 24 hours" />
      </div>

      {/* Search across owners and their activity */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={
            tab === 'all'
              ? 'Search by owner, page, action or detail…'
              : `Search ${selectedOwner?.name ?? "this owner"}'s activity…`
          }
          aria-label="Search recent activity"
          className="w-full rounded bg-[#141414] border border-[#262626] focus:border-[#D4AF37]/50 outline-none pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-[#606060] transition-colors"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[#808080] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Sub-navigation: All owners + one tab per registered owner */}
      <nav
        aria-label="Activity by owner"
        className="rounded bg-[#141414] border border-[#262626] p-1.5 flex gap-1 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => selectTab('all')}
          className={`flex items-center gap-2 px-3 py-2 rounded text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
            tab === 'all'
              ? 'text-[#D4AF37] font-medium bg-[#1A1A1A] border border-[#262626]'
              : 'text-[#808080] hover:text-white border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          All owners
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#0A0A0A] text-[#808080] border border-[#333333]">
            {owners.length}
          </span>
        </button>

        <span className="w-px bg-[#262626] mx-1 flex-shrink-0" />

        {owners.filter((o) => o.id === tab || visibleOwners.includes(o)).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => selectTab(o.id)}
            title={`${o.name} (${o.id}) — ${presenceLine(o, now)}`}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
              tab === o.id
                ? 'text-[#D4AF37] font-medium bg-[#1A1A1A] border border-[#262626]'
                : 'text-[#808080] hover:text-white border border-transparent'
            }`}
          >
            <OwnerAvatar owner={o} presence={o.presence} size="xs" />
            <span className="max-w-[140px] truncate">{o.name}</span>
            {o.opens24h > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#0A0A0A] text-[#808080] border border-[#333333]">
                {o.opens24h}
              </span>
            )}
          </button>
        ))}

        {ownersLoaded && owners.length === 0 && (
          <span className="px-3 py-2 text-xs text-[#808080]">No farm owners registered yet.</span>
        )}
        {ownersLoaded && owners.length > 0 && visibleOwners.length === 0 && tab === 'all' && (
          <span className="px-3 py-2 text-xs text-[#808080]">No owners match "{searchInput.trim()}".</span>
        )}
      </nav>

      {tab === 'all' ? (
        <>
          {/* One card per owner -- their own live part of the page */}
          {visibleOwners.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleOwners.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectTab(o.id)}
                  className="text-left rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#D4AF37]/30 p-4 transition-colors space-y-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <OwnerAvatar owner={o} presence={o.presence} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{o.name}</p>
                      <p className="text-[11px] text-[#808080] truncate">
                        {o.id}
                        {o.sector ? ` · ${o.sector}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <PresenceDot presence={o.presence} />
                    <span className={o.presence === 'online' ? 'text-[#4CAF50] font-medium' : 'text-[#808080]'}>
                      {presenceLine(o, now)}
                    </span>
                  </div>

                  <div className="rounded bg-[#0A0A0A] border border-[#262626] px-3 py-2">
                    <p className="text-[9px] uppercase font-bold tracking-widest text-[#808080]">
                      {o.presence === 'online' ? 'Viewing now' : 'Last opened'}
                    </p>
                    {o.lastOpened ? (
                      <p className="text-xs text-[#E0E0E0] mt-0.5 truncate">
                        {o.lastOpened.label}
                        {o.lastOpened.detail ? ` · ${o.lastOpened.detail}` : ''}
                        <span className="text-[#808080]"> · {timeAgo(o.lastOpened.at, now)}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-[#808080] mt-0.5">Nothing opened yet</p>
                    )}
                  </div>

                  <p className="text-[11px] text-[#808080] font-mono">
                    {o.opens24h} opens · {o.actions24h} actions <span className="text-[#606060]">(24h)</span>
                  </p>
                </button>
              ))}
            </section>
          )}

          <FeedPanel
            title="Live activity — all owners"
            items={feed}
            loading={feedLoading}
            hasMore={hasMore}
            now={now}
            freshIds={freshIds}
            kindFilter={kindFilter}
            searching={search !== ''}
            onKindFilter={selectKind}
            showOwner
            onOpenOwner={selectTab}
            onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
          />
        </>
      ) : (
        selectedOwner && (
          <>
            <section className="rounded bg-[#141414] border border-[#262626] p-4 sm:p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <OwnerAvatar owner={selectedOwner} presence={selectedOwner.presence} size="lg" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white truncate">{selectedOwner.name}</h2>
                    <p className="text-[11px] text-[#808080] truncate">
                      {selectedOwner.id}
                      {selectedOwner.email ? ` · ${selectedOwner.email}` : ''}
                      {selectedOwner.sector ? ` · ${selectedOwner.sector}` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded bg-[#0A0A0A] border border-[#262626] text-xs"
                  style={{ color: PRESENCE[selectedOwner.presence].color }}
                >
                  <PresenceDot presence={selectedOwner.presence} />
                  {presenceLine(selectedOwner, now)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Last signed in', value: timeAgo(selectedOwner.lastSignInAt, now) },
                  { label: 'Last opened', value: selectedOwner.lastOpened?.label ?? '—' },
                  { label: 'Opens (24h)', value: String(selectedOwner.opens24h) },
                  { label: 'Actions (24h)', value: String(selectedOwner.actions24h) },
                  { label: 'Master nodes', value: String(selectedOwner.nodesCount) },
                ].map((s) => (
                  <div key={s.label} className="rounded bg-[#0A0A0A] border border-[#262626] px-3 py-2.5 min-w-0">
                    <p className="text-[9px] uppercase font-bold tracking-widest text-[#808080]">{s.label}</p>
                    <p className="text-sm text-white font-semibold mt-1 truncate">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-3">
                    Pages opened — last 7 days
                  </p>
                  {detail ? (
                    <SevenDayBars days={detail.last7Days} />
                  ) : (
                    <div className="h-24 flex items-center justify-center text-xs text-[#808080]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-3">
                    Most opened — last 7 days
                  </p>
                  {detail && detail.topPages.length > 0 ? (
                    <ul className="space-y-2">
                      {detail.topPages.map((p) => {
                        const max = detail.topPages[0].count;
                        return (
                          <li key={p.label} className="text-xs">
                            <div className="flex justify-between text-[#E0E0E0] mb-1">
                              <span className="truncate">{p.label}</span>
                              <span className="font-mono text-[#808080] ml-2">{p.count}</span>
                            </div>
                            <div className="h-1 rounded bg-[#262626]">
                              <div
                                className="h-1 rounded"
                                style={{ width: `${(p.count / max) * 100}%`, backgroundColor: '#D4AF37' }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#808080]">
                      {detail ? 'No pages opened in the last 7 days.' : 'Loading…'}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <FeedPanel
              title={`Activity — ${selectedOwner.name}`}
              items={feed}
              loading={feedLoading}
              hasMore={hasMore}
              now={now}
              freshIds={freshIds}
              kindFilter={kindFilter}
              searching={search !== ''}
              onKindFilter={selectKind}
              showOwner={false}
              onOpenOwner={selectTab}
              onLoadMore={() => setLimit((l) => l + PAGE_SIZE)}
            />
          </>
        )
      )}
    </div>
  );
};

export default RecentActivityView;
