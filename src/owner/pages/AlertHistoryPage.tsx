import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
  Download,
  Upload,
  Loader2,
  WifiOff,
  History,
  TreePalm,
  ChevronDown,
} from 'lucide-react';
import { PestAlert } from '../../types';
import { ownerApi } from '../api';
import { usePasswordProtectedExport } from '../../hooks/usePasswordProtectedExport';
import { usePolling } from '../../hooks/usePolling';
import { PasswordPromptModal } from '../../components/PasswordPromptModal';
import { DecryptedPreviewModal } from '../../components/DecryptedPreviewModal';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

// Alert History: pest / impact alerts raised on THIS owner's devices, newest
// first. Every tree has its OWN history, and inside a tree every piezo has its
// own too: the owner picks a tree (like on Vibration Events), then picks a
// piezo from a dropdown, and only that piezo's alerts are listed -- nothing
// from another piezo or tree is mixed in. (server: GET /owner/alerts?treeId&piezoId)
// Picking a tree here only changes what is VIEWED; unlike Vibration Events it
// never moves the device onto that tree.
interface TreeInfo {
  id: number;
  nodeId: string;
  name: string;
  number: number;
  isActive: boolean;
}

const PIEZO_PINS = ['A0', 'A1', 'A2', 'A3'];

export const AlertHistoryPage: React.FC = () => {
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [trees, setTrees] = useState<TreeInfo[]>([]);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<number | null>(null);
  const [pin, setPin] = useState<string>('A0');
  const [treesReady, setTreesReady] = useState(false);
  const [counts, setCounts] = useState<{ treeId: number; piezoId: string; total: number; unreviewed: number }[]>([]);
  const selectedChipRef = useRef<HTMLButtonElement | null>(null);

  const [alerts, setAlerts] = useState<PestAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  // "Clear Reviewed" only tidies THIS view -- the alerts themselves stay in
  // the owner's history on the server (they are shared records), so the
  // cleared ids are remembered here and filtered out of every refresh.
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'REVIEWED'>('ALL');

  const piezoId = nodeId ? `${nodeId}-${pin}` : null;
  const askedRef = useRef<string>('');
  askedRef.current = `${treeId}|${piezoId}`;

  // Trees: read-only here (never activates one), default to the tree the
  // device is on now.
  useEffect(() => {
    let cancelled = false;
    ownerApi
      .trees()
      .then((res) => {
        if (cancelled) return;
        setNodes(res.nodes);
        setTrees(res.trees);
        const first = res.nodes[0]?.id ?? null;
        setNodeId(first);
        const own = res.trees.filter((t: TreeInfo) => t.nodeId === first);
        setTreeId((own.find((t: TreeInfo) => t.isActive) ?? own[0])?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your trees.');
      })
      .finally(() => !cancelled && setTreesReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [treeId, trees.length]);

  const nodeTrees = trees.filter((t) => t.nodeId === nodeId);
  const currentTree = trees.find((t) => t.id === treeId) ?? null;

  const loadCounts = useCallback(() => {
    ownerApi
      .alertSummary()
      .then((res) => setCounts(res.counts))
      .catch(() => void 0);
  }, []);

  const load = useCallback(() => {
    if (!treesReady) return;
    if (treeId == null || !piezoId) {
      setAlerts([]);
      setLoaded(true);
      return;
    }
    const asked = `${treeId}|${piezoId}`;
    ownerApi
      .alerts(treeId, piezoId)
      .then((res) => {
        // The owner may have picked another tree/piezo while this was in flight.
        if (askedRef.current !== asked) return;
        setAlerts(res.alerts.map((a: any) => ({ ...a, reviewed: !!a.reviewed })));
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (askedRef.current === asked) setLoadError(err instanceof Error ? err.message : 'Could not load your alerts.');
      })
      .finally(() => {
        if (askedRef.current === asked) setLoaded(true);
      });
    loadCounts();
  }, [treesReady, treeId, piezoId, loadCounts]);

  // Switching tree / piezo starts from an empty list so the previous one never lingers.
  useEffect(() => {
    setAlerts([]);
    setLoaded(false);
    setLoadError(null);
    setHiddenIds(new Set());
    setSearchQuery('');
    setSeverityFilter('ALL');
    setStatusFilter('ALL');
  }, [treeId, piezoId]);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 10000);

  const selectNode = (id: string) => {
    if (id === nodeId) return;
    const own = trees.filter((t) => t.nodeId === id);
    setNodeId(id);
    setTreeId((own.find((t) => t.isActive) ?? own[0])?.id ?? null);
  };

  const unreviewedFor = (tId: number, pId?: string) =>
    counts.filter((c) => c.treeId === tId && (!pId || c.piezoId === pId)).reduce((n, c) => n + c.unreviewed, 0);

  const markReviewed = async (id: number) => {
    if (reviewingId != null) return;
    setReviewingId(id);
    setActionError(null);
    try {
      await ownerApi.reviewAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, reviewed: true } : a)));
      loadCounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't mark that alert as reviewed.");
    } finally {
      setReviewingId(null);
    }
  };

  const clearReviewed = () => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => a.reviewed && next.add(a.id));
      return next;
    });
  };

  const visibleAlerts = useMemo(() => alerts.filter((a) => !hiddenIds.has(a.id)), [alerts, hiddenIds]);
  const reviewedCount = visibleAlerts.filter((a) => a.reviewed).length;
  const unresolvedCount = visibleAlerts.length - reviewedCount;

  const filteredAlerts = visibleAlerts.filter((a) => {
    const pestName = a.pest || a.pestType || 'Unknown';
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      pestName.toLowerCase().includes(q) ||
      (a.sector ?? '').toLowerCase().includes(q);
    const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'UNRESOLVED' && !a.reviewed) ||
      (statusFilter === 'REVIEWED' && a.reviewed);
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const {
    fileInputRef: importFileInputRef,
    isExportModalOpen,
    isImportModalOpen,
    decrypted,
    busy: pwBusy,
    error: pwError,
    requestExport,
    requestImport,
    cancel: cancelPasswordFlow,
    submitExportPassword,
    submitImportPassword,
    closePreview,
  } = usePasswordProtectedExport();

  const exportAlertsCsv = () => {
    const headers = ['Alert ID', 'Tree', 'Piezo', 'Node', 'Sector', 'Pest Type', 'Severity', 'Frequency Hz', 'Threat %', 'Timestamp', 'Reviewed'];
    const rows = filteredAlerts.map((a) => [
      a.id,
      `"${currentTree?.name ?? ''}"`,
      `Piezo ${PIEZO_PINS.indexOf(pin) + 1}`,
      a.nodeId ?? '',
      `"${a.sector ?? ''}"`,
      `"${a.pest || a.pestType || 'Pest Anomaly'}"`,
      a.severity,
      a.frequencyHz,
      a.threatScore || 85,
      `"${a.createdAt || a.timestamp}"`,
      a.reviewed ? 'YES' : 'NO',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    requestExport(`cocosense-alerts-${(currentTree?.name ?? 'tree').replace(/[^a-z0-9]+/gi, '-')}-piezo-${PIEZO_PINS.indexOf(pin) + 1}.csv`, csvContent, 'text/csv;charset=utf-8');
  };

  const actionBtn =
    'flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0] text-xs font-bold transition-colors';

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Alert History"
        title="Alert History"
        description="Every tree keeps its own alert history, and every piezo on it keeps its own too. Pick a tree, then a piezo, to see only that sensor's alerts, newest first. Historical wood-boring events are classified as Oryctes rhinoceros (Rhinoceros Beetle) or Rhynchophorus ferrugineus (Red Palm Weevil). Mark an alert reviewed once you have checked the tree."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={exportAlertsCsv} className={actionBtn}>
              <Download className="w-4 h-4 text-[#D4AF37]" />
              <span>Export CSV</span>
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) requestImport(file);
              }}
            />
            <button type="button" onClick={() => importFileInputRef.current?.click()} className={actionBtn}>
              <Upload className="w-4 h-4 text-[#D4AF37]" />
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={clearReviewed}
              disabled={reviewedCount === 0}
              title={reviewedCount === 0 ? 'No reviewed alerts to clear' : 'Hide reviewed alerts from this list'}
              className={`${actionBtn} text-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Clear Reviewed</span>
            </button>
          </div>
        }
      />

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-4 py-3 text-xs text-[#F44336]"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-[#F44336]/80 hover:text-[#F44336] font-bold">
            Dismiss
          </button>
        </div>
      )}

      {loadError && !loaded && (
        <div className="flex items-start gap-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-4 py-3 text-xs text-[#F44336]">
          <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Tree picker (same look as Vibration Events) + piezo dropdown. */}
      {nodes.length > 0 && (
        <div className="space-y-3">
          {nodes.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">Master node</span>
              {nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectNode(n.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                    n.id === nodeId
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-[#141414] text-[#A0A0A0] border-[#262626] hover:text-white'
                  }`}
                >
                  {n.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {nodeTrees.map((t) => {
              const selected = t.id === treeId;
              const pending = unreviewedFor(t.id);
              return (
                <button
                  key={t.id}
                  ref={selected ? selectedChipRef : undefined}
                  type="button"
                  onClick={() => setTreeId(t.id)}
                  aria-pressed={selected}
                  title={t.name}
                  className={`flex-shrink-0 max-w-[220px] flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                    selected
                      ? 'bg-[#1F1B0E] border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#141414] border-[#262626] text-[#A0A0A0] hover:text-white hover:border-[#404040]'
                  }`}
                >
                  <TreePalm className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{t.name}</span>
                  {pending > 0 && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-[#F44336] text-white text-[9px] font-bold leading-none">
                      {pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {currentTree && (
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="alert-piezo" className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">
                Piezo sensor
              </label>
              <div className="relative">
                <select
                  id="alert-piezo"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="appearance-none pl-3.5 pr-9 py-2 rounded-lg bg-[#141414] border border-[#262626] text-xs font-semibold text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
                >
                  {PIEZO_PINS.map((p, i) => {
                    const pending = nodeId ? unreviewedFor(currentTree.id, `${nodeId}-${p}`) : 0;
                    return (
                      <option key={p} value={p}>
                        Piezo {i + 1}
                        {pending > 0 ? ` (${pending} to review)` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-[#808080] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <span className="text-[11px] text-[#808080]">
                Showing only <span className="text-white font-semibold">Piezo {PIEZO_PINS.indexOf(pin) + 1}</span> alerts for{' '}
                <span className="text-white font-semibold break-all">{currentTree.name}</span>.
              </span>
            </div>
          )}
        </div>
      )}

      {treesReady && nodes.length === 0 && !loadError && (
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-8 text-center text-xs text-[#808080]">
          Link a master node to start monitoring trees — each tree's alerts will be listed here.
        </div>
      )}

      {/* Filter and search bar */}
      <div className="p-4 rounded-lg bg-[#141414] border border-[#262626] flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pest species or sector..."
            className="w-full pl-10 pr-4 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-white placeholder:text-[#808080] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="INFO">Info Only</option>
          </select>

          <div className="flex items-center rounded bg-[#0A0A0A] border border-[#262626] p-0.5">
            {(['ALL', 'UNRESOLVED', 'REVIEWED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded text-xs font-semibold uppercase transition-all ${
                  statusFilter === st ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#808080] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts timeline */}
      <div className="space-y-3">
        {!loaded && !loadError ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-[#808080]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your alerts…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-lg bg-[#141414] border border-[#262626] p-12 text-center text-[#808080] space-y-2">
            <CheckCircle className="w-10 h-10 text-[#4CAF50] mx-auto" />
            <h3 className="font-bold text-white text-base">
              {visibleAlerts.length === 0 ? 'No Alerts Yet' : 'No Matching Alerts'}
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              {visibleAlerts.length === 0
                ? `Nothing has been flagged by Piezo ${PIEZO_PINS.indexOf(pin) + 1}${currentTree ? ` on ${currentTree.name}` : ''}. If it picks up pest activity, it will be listed here.`
                : 'No alerts match your current search and filters.'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'CRITICAL';
            const isWarn = alert.severity === 'WARNING';
            return (
              <div
                key={alert.id}
                className={`rounded-lg border p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  alert.reviewed
                    ? 'bg-[#101010] border-[#262626] opacity-60'
                    : isCrit
                    ? 'bg-[#1C1212] border-[#F44336]/40'
                    : isWarn
                    ? 'bg-[#1C1810] border-[#D4AF37]/40'
                    : 'bg-[#141414] border-[#262626]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`p-3 rounded flex-shrink-0 ${
                      isCrit
                        ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                        : isWarn
                        ? 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30'
                        : 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-base break-all">{currentTree?.name ?? alert.treeId ?? alert.nodeId ?? 'Unassigned'} &middot; Piezo {PIEZO_PINS.indexOf(pin) + 1}</span>
                      {alert.sector && <span className="text-xs text-[#808080] font-mono">{alert.sector}</span>}
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                          isCrit
                            ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                            : 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      {alert.reviewed && (
                        <span className="px-2 py-0.5 rounded bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30 text-[10px] font-mono">
                          REVIEWED
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-[#E0E0E0] mt-1">
                      {alert.pest || alert.pestType || 'Pest Anomaly'} &middot;{' '}
                      <span className="font-mono text-[#D4AF37]">{alert.frequencyHz} Hz acoustic vibration</span>
                    </div>
                    <div className="text-[11px] text-[#808080] font-mono mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{alert.createdAt || alert.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center flex-shrink-0">
                  <div className="text-right font-mono">
                    <span className={`text-xl font-bold ${isCrit ? 'text-[#F44336]' : 'text-[#D4AF37]'}`}>
                      {alert.threatScore || (isCrit ? 92 : 55)}%
                    </span>
                    <div className="text-[9px] uppercase font-mono text-[#808080]">Threat Index</div>
                  </div>

                  {!alert.reviewed && (
                    <button
                      type="button"
                      onClick={() => markReviewed(alert.id)}
                      disabled={reviewingId != null}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE4A] disabled:opacity-60 text-black font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                      {reviewingId === alert.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Mark Reviewed
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <PageFooterNote
        icon={History}
        text={`${unresolvedCount} alert${unresolvedCount === 1 ? '' : 's'} on this piezo still need${unresolvedCount === 1 ? 's' : ''} your review. Clearing reviewed alerts only tidies this list — they remain in your records.`}
      />

      {isExportModalOpen && (
        <PasswordPromptModal
          mode="set"
          title="Protect Alert History Export"
          description="Choose a password to encrypt this CSV. Anyone opening the downloaded file will need it."
          busy={pwBusy}
          error={pwError}
          onCancel={cancelPasswordFlow}
          onSubmit={submitExportPassword}
        />
      )}

      {isImportModalOpen && (
        <PasswordPromptModal
          mode="enter"
          title="Unlock Imported File"
          description="Enter the password this Alert History export was protected with."
          busy={pwBusy}
          error={pwError}
          onCancel={cancelPasswordFlow}
          onSubmit={submitImportPassword}
        />
      )}

      {decrypted && (
        <DecryptedPreviewModal
          filename={decrypted.originalFilename}
          mimeType={decrypted.mimeType}
          content={decrypted.content}
          exportedAt={decrypted.exportedAt}
          onClose={closePreview}
        />
      )}
    </div>
  );
};

export default AlertHistoryPage;
