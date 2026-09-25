import React, { useMemo } from 'react';
import { usePasswordProtectedExport } from '../hooks/usePasswordProtectedExport';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { DecryptedPreviewModal } from '../components/DecryptedPreviewModal';
import { FarmOwner, MasterNode, MonitoredTree, PestAlert, VibrationEvent } from '../types';
import {
  FileText,
  Download,
  Upload,
  TrendingUp,
  Radio,
  CheckCircle2,
} from 'lucide-react';

interface ReportsViewProps {
  owners: FarmOwner[];
  nodes: MasterNode[];
  trees: MonitoredTree[];
  alerts: PestAlert[];
  vibrationEvents: VibrationEvent[];
}

// SQLite's datetime('now') writes "YYYY-MM-DD HH:MM:SS" (UTC, no
// timezone/'T'), which some engines mis-parse as local time if handed
// straight to `new Date(...)`. Normalize it into something every
// browser reads the same way before doing any month bucketing below.
function parseServerTimestamp(raw?: string | null): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// Every alert row (both `alert_type = 'pest'` and the tamper/hard-knock
// `'impact'` rows -- see server/schema.sql) comes through the API in
// the same PestAlert shape, distinguished by `pest === 'Hardware Fault'`
// for impact rows. Splitting on that here is what lets the chart show
// genuine pest detections separately from device-health events instead
// of lumping every row from `alerts` together.
function isPestDetection(a: PestAlert): boolean {
  return a.pest !== 'Hardware Fault';
}

export const ReportsView: React.FC<ReportsViewProps> = ({ owners, nodes, trees, alerts, vibrationEvents }) => {
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

  // Real telemetry only -- no fabricated fallback numbers. If nothing
  // has come in from a device yet, hasTelemetry is false and the whole
  // chart is swapped for an honest "nothing reported yet" state instead
  // of drawing a chart out of made-up data.
  const hasTelemetry = alerts.length > 0 || vibrationEvents.length > 0;

  const pestAlerts = useMemo(() => alerts.filter(isPestDetection), [alerts]);
  const reviewedPestAlerts = useMemo(() => pestAlerts.filter((a) => a.reviewed), [pestAlerts]);
  const reviewRate = pestAlerts.length > 0 ? Math.round((reviewedPestAlerts.length / pestAlerts.length) * 100) : null;

  const nodesOnline = nodes.filter((n) => n.online).length;
  const totalSensors = nodes.reduce((sum, n) => sum + (n.totalSensors || 0), 0);
  const activeInfestations = trees.filter((t) => t.status === 'Active Infestation').length;

  // Last 6 calendar months ending this month, each with its real
  // pest-alert count and real raw-reading (device activity) count for
  // that month -- built from the actual timestamps on the rows the
  // backend returned, not a hardcoded array of numbers.
  const monthly = useMemo(() => {
    const buckets: { key: string; label: string; pestAlerts: number; readings: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: d.toLocaleString('en-US', { month: 'short' }), pestAlerts: 0, readings: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));

    for (const a of pestAlerts) {
      const d = parseServerTimestamp(a.createdAt || a.timestamp);
      if (!d) continue;
      const bucket = byKey.get(monthKey(d));
      if (bucket) bucket.pestAlerts++;
    }
    for (const v of vibrationEvents) {
      const d = parseServerTimestamp(v.timestamp);
      if (!d) continue;
      const bucket = byKey.get(monthKey(d));
      if (bucket) bucket.readings++;
    }
    return buckets;
  }, [pestAlerts, vibrationEvents]);

  const maxValue = Math.max(1, ...monthly.map((m) => Math.max(m.pestAlerts, m.readings)));

  const exportFullReport = async () => {
    const sectorMap = new Map<string, { trees: number; active: number; warning: number }>();
    for (const t of trees) {
      const entry = sectorMap.get(t.sector) || { trees: 0, active: 0, warning: 0 };
      entry.trees++;
      if (t.status === 'Active Infestation') entry.active++;
      if (t.status === 'Potential Infestation') entry.warning++;
      sectorMap.set(t.sector, entry);
    }
    const sectorLines = [...sectorMap.entries()]
      .map(([sector, s]) => `- ${sector}: ${s.trees} trees (${s.active} Active, ${s.warning} Warning)`)
      .join('\n') || '- No sectors with monitored trees yet.';

    const pestTypeCounts = new Map<string, number>();
    for (const a of pestAlerts) pestTypeCounts.set(a.pest, (pestTypeCounts.get(a.pest) || 0) + 1);
    const findingsLines = [...pestTypeCounts.entries()]
      .map(([pest, count]) => `${pest}: ${count} acoustic detection(s) logged`)
      .join('\n') || 'No pest acoustic signatures detected yet.';

    const reportContent = `COCOSENSE BIOACOUSTIC TELEMETRY AUDIT REPORT
Generated: ${new Date().toLocaleString()}

1. EXECUTIVE SUMMARY:
- Total Monitored Palms: ${trees.length}
- Registered Farm Owners: ${owners.length}
- Active Master Nodes: ${nodesOnline} / ${nodes.length} Online
- Piezoelectric Acoustic Transducers: ${totalSensors}
- Confirmed Pest Infestations: ${activeInfestations}
- Pest Alerts Logged: ${pestAlerts.length} (${reviewRate == null ? 'no reviews yet' : `${reviewRate}% reviewed`})

2. SECTOR BREAKDOWN:
${sectorLines}

3. PHYTOPATHOLOGY FINDINGS:
${findingsLines}
`;
    requestExport('cocosense-bioacoustic-audit.txt', reportContent, 'text/plain;charset=utf-8');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Bioacoustic Monitoring Reports &amp; Analytics
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Pest pressure and acoustic frequency trends, computed live from your master nodes' actual telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportFullReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Audit Summary</span>
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
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Upload className="w-4 h-4 text-[#D4AF37]" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Monthly Pest Pressure Chart -- driven by real alerts + vibration_events rows */}
      <div className="rounded bg-[#141414] border border-[#262626] p-6 md:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white uppercase serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              6-Month Pest Pressure &amp; Device Activity
            </h3>
            <p className="text-xs text-[#808080]">Pest alerts vs. total sensor readings logged, by month</p>
          </div>
          {reviewRate != null && (
            <span className="font-mono text-xs text-[#D4AF37] font-bold">{reviewRate}% of pest alerts reviewed</span>
          )}
        </div>

        {!hasTelemetry ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 bg-[#0A0A0A] rounded border border-[#262626] text-center px-6">
            <Radio className="w-6 h-6 text-[#404040]" />
            <p className="text-xs text-[#808080]">
              No device telemetry recorded yet.{' '}
              {nodes.length > 0
                ? `${nodesOnline} of ${nodes.length} master node(s) provisioned -- once they report readings, trends appear here automatically.`
                : 'Add a master node to start receiving readings.'}
            </p>
          </div>
        ) : (
          <>
            <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-4 bg-[#0A0A0A] rounded border border-[#262626]">
              {monthly.map((m) => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full">
                    <div
                      className="w-1/2 bg-[#F44336]/80 rounded-t transition-all hover:bg-[#F44336]"
                      style={{ height: `${(m.pestAlerts / maxValue) * 100}%` }}
                      title={`${m.label} Pest Alerts: ${m.pestAlerts}`}
                    ></div>
                    <div
                      className="w-1/2 bg-[#D4AF37]/80 rounded-t transition-all hover:bg-[#D4AF37]"
                      style={{ height: `${(m.readings / maxValue) * 100}%` }}
                      title={`${m.label} Sensor Readings: ${m.readings}`}
                    ></div>
                  </div>
                  <span className="font-mono text-xs text-[#808080] font-semibold">{m.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F44336]"></span>
                <span className="text-[#808080]">Pest Alerts Detected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
                <span className="text-[#808080]">Sensor Readings Logged</span>
              </div>
            </div>
          </>
        )}
      </div>

      {hasTelemetry && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded bg-[#141414] border border-[#262626] p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-white font-mono">{pestAlerts.length}</p>
              <p className="text-[10px] text-[#808080] uppercase tracking-wider">Pest Alerts Logged</p>
            </div>
          </div>
          <div className="rounded bg-[#141414] border border-[#262626] p-4 flex items-center gap-3">
            <Radio className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-white font-mono">{nodesOnline}/{nodes.length}</p>
              <p className="text-[10px] text-[#808080] uppercase tracking-wider">Master Nodes Online</p>
            </div>
          </div>
          <div className="rounded bg-[#141414] border border-[#262626] p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
            <div>
              <p className="text-lg font-bold text-white font-mono">{activeInfestations}</p>
              <p className="text-[10px] text-[#808080] uppercase tracking-wider">Active Infestations</p>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <PasswordPromptModal
          mode="set"
          title="Protect Audit Summary Export"
          description="Choose a password to encrypt this report. Anyone opening the downloaded file will need it."
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
          description="Enter the password this Bioacoustic Audit Summary was protected with."
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
