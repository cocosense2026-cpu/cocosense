import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Download, FileText, Loader2, Lock, MapPin, Radio, WifiOff } from 'lucide-react';
import { adminApi } from '../admin/api';
import { PageHero } from '../components/PageHero';
import { PageFooterNote } from '../components/PageFooterNote';
import { usePolling } from '../hooks/usePolling';
import { VibrationStrengthChart, VibrationStrengthPoint } from '../components/VibrationStrengthChart';

// Monthly Report -- month-by-month vibration for ONE municipality at a time
// (picked at the top of the page; server: GET /admin/reports/vibration).
// Every month can be downloaded for the municipality on screen OR as an
// overall file covering all municipalities together.
//
// The list is always newest first: the CURRENT month sits at the top and
// is still collecting readings; every earlier month is closed and sits
// below it. Nothing is stored or rolled over by a job -- the server
// derives the months from the readings' timestamps, so when a new month
// begins the page simply gets a new top card and the old one slides down.
// The page re-checks every minute so that happens while it's left open.
//
// Every month can be downloaded as a CSV (server: GET
// /admin/reports/vibration/export): a button in the page header for the
// current month, and one at the top of each month's expanded view.

interface PiezoRow {
  piezoId: string;
  nodeId: string;
  nodeName: string;
  label: string;
  readings: number;
  avgGrams: number;
  peakGrams: number;
  /** Trees on this sensor marked Infected / Cleared as of the end of the month. */
  infected: number;
  cleared: number;
}
interface MonthReport {
  key: string;
  year: number;
  month: number; // 1-12
  isCurrent: boolean;
  daysInMonth: number;
  daysElapsed: number;
  totals: {
    readings: number;
    avgGrams: number;
    peakGrams: number;
    avgFrequencyHz: number;
    pestDetections: number;
    critical: number;
    elevated: number;
    normal: number;
  };
  /** UTC instant of local midnight on the 1st; series[i] starts at startsAt + i * bucketMinutes. */
  startsAt: string;
  bucketMinutes: number;
  /** Strongest reading (g) in each time window, oldest -> newest; 0 = quiet. */
  series: number[];
  piezos: PiezoRow[];
}
interface MunicipalityInfo {
  name: string;
  owners: number;
  nodes: number;
}
interface ReportData {
  /** The municipality this report is for (null when no farm owner exists yet). */
  municipality: string | null;
  municipalities: MunicipalityInfo[];
  currentMonth: string;
  nodesCount: number;
  thresholds: { elevated: number; critical: number };
  months: MonthReport[];
}

const COLORS = { normal: '#4CAF50', elevated: '#E9A23B', critical: '#F44336' };

function monthLabel(m: MonthReport): string {
  return new Date(m.year, m.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const DownloadButton: React.FC<{
  label: string;
  busy: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}> = ({ label, busy, disabled, title, variant = 'secondary', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    title={title}
    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${
      variant === 'primary'
        ? 'bg-[#16A34A] hover:bg-[#22C55E] text-black'
        : 'bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0]'
    }`}
  >
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
    {busy ? 'Preparing…' : label}
  </button>
);

const StatTile: React.FC<{ label: string; value: string; hint?: string; color?: string }> = ({
  label,
  value,
  hint,
  color,
}) => (
  <div className="rounded bg-[#0A0A0A] border border-[#262626] p-3.5 min-w-0">
    <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">{label}</p>
    <p className="mt-1 text-xl font-black text-white font-mono truncate" style={color ? { color } : undefined}>
      {value}
    </p>
    {hint && <p className="text-[11px] text-[#808080] mt-0.5">{hint}</p>}
  </div>
);

const SeverityBar: React.FC<{ totals: MonthReport['totals'] }> = ({ totals }) => {
  const { normal, elevated, critical, readings } = totals;
  const parts = [
    { key: 'normal', label: 'Normal', n: normal, color: COLORS.normal },
    { key: 'elevated', label: 'Elevated', n: elevated, color: COLORS.elevated },
    { key: 'critical', label: 'Critical', n: critical, color: COLORS.critical },
  ];
  return (
    <div>
      <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2">Severity breakdown</p>
      <div className="h-2.5 w-full rounded overflow-hidden flex bg-[#262626]">
        {parts.map(
          (p) =>
            p.n > 0 && (
              <div
                key={p.key}
                style={{ width: `${(p.n / Math.max(1, readings)) * 100}%`, backgroundColor: p.color }}
                title={`${p.label}: ${p.n}`}
              />
            )
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px] text-[#A0A0A0]">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.label} <span className="font-mono text-white">{p.n.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// Same seismograph-style trace as the Vibration Events page (the shared
// VibrationStrengthChart in its scrollable mode). Each point is the strongest
// reading in one time window; quiet windows sit at 0, so the line goes flat.
const SeismographTrace: React.FC<{ month: MonthReport; thresholds: ReportData['thresholds'] }> = ({
  month,
  thresholds,
}) => {
  const points = useMemo<VibrationStrengthPoint[]>(() => {
    const start = new Date(month.startsAt).getTime();
    const step = month.bucketMinutes * 60000;
    return month.series.map((grams, i) => ({
      grams,
      timestamp: new Date(start + i * step).toISOString(),
      severity: grams >= thresholds.critical ? 'Critical' : grams >= thresholds.elevated ? 'Elevated' : 'Normal',
    }));
  }, [month.startsAt, month.bucketMinutes, month.series, thresholds.critical, thresholds.elevated]);

  const hours = Math.round(month.bucketMinutes / 60);
  return (
    <div>
      <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2">
        Vibration trace — strongest reading every {hours} hours
      </p>
      <div className="rounded-lg bg-[#0E0E0E] border border-[#262626]">
        <VibrationStrengthChart
          points={points}
          height={150}
          scrollable
          caption={
            month.isCurrent
              ? 'Latest at left · scroll right to go back through the month'
              : 'End of month at left · scroll right to go back to the 1st'
          }
        />
      </div>
    </div>
  );
};

const MonthCard: React.FC<{
  month: MonthReport;
  open: boolean;
  onToggle: () => void;
  data: ReportData;
  onDownload: (all: boolean) => void;
  /** Which download of this month is running: 'muni', 'all' or null. */
  downloading: 'muni' | 'all' | null;
  /** Some download is already running. */
  downloadLocked: boolean;
}> = ({ month, open, onToggle, data, onDownload, downloading, downloadLocked }) => {
  const t = month.totals;
  const multiNode = data.nodesCount > 1;
  const empty = t.readings === 0;

  return (
    <section
      className={`rounded-lg bg-[#141414] border overflow-hidden ${
        month.isCurrent ? 'border-[#16A34A]/40' : 'border-[#262626]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left hover:bg-[#1A1A1A]/60 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-bold text-white">{monthLabel(month)}</h2>
            {month.isCurrent ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#142416] border border-[#16A34A]/40 text-[10px] font-mono font-bold uppercase tracking-wider text-[#4CAF50]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                In progress · day {month.daysElapsed} of {month.daysInMonth}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#808080]">
                <Lock className="w-3 h-3" /> Closed
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#808080] mt-1">
            {empty ? (
              'No readings yet this month'
            ) : (
              <>
                <span className="font-mono text-[#E0E0E0]">{t.readings.toLocaleString()}</span> readings · peak{' '}
                <span className="font-mono text-[#E0E0E0]">{t.peakGrams} g</span>
                {t.critical > 0 && (
                  <>
                    {' '}
                    · <span style={{ color: COLORS.critical }}>{t.critical.toLocaleString()} critical</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#808080] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-5 border-t border-[#262626]">
          {empty ? (
            <div className="py-8 text-center">
              <Radio className="w-8 h-8 text-[#808080]/40 mx-auto mb-2" />
              <p className="text-xs text-[#808080]">
                {month.isCurrent
                  ? 'No vibration readings have been recorded this month yet. They will appear here as they arrive.'
                  : 'No vibration readings were recorded this month.'}
              </p>
            </div>
          ) : (
            <>
              {/* Download this whole month -- sits at the top of the opened card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
                <p className="text-[11px] text-[#808080] leading-snug">
                  {month.isCurrent
                    ? `${monthLabel(month)} so far — everything recorded up to now.`
                    : `Full vibration record for ${monthLabel(month)}.`}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <DownloadButton
                    label={`Download ${data.municipality ?? 'municipality'}`}
                    busy={downloading === 'muni'}
                    disabled={downloadLocked}
                    title={`Download the ${monthLabel(month)} vibration report for ${data.municipality ?? 'this municipality'} (CSV)`}
                    onClick={() => onDownload(false)}
                  />
                  <DownloadButton
                    label="Download all municipalities"
                    busy={downloading === 'all'}
                    disabled={downloadLocked}
                    title={`Download the overall ${monthLabel(month)} vibration report for all municipalities (CSV)`}
                    onClick={() => onDownload(true)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatTile label="Readings" value={t.readings.toLocaleString()} hint={data.municipality ?? 'all sensors'} />
                <StatTile label="Average strength" value={`${t.avgGrams} g`} hint={`${t.avgFrequencyHz} Hz avg`} />
                <StatTile
                  label="Peak strength"
                  value={`${t.peakGrams} g`}
                  color={
                    t.peakGrams >= data.thresholds.critical
                      ? COLORS.critical
                      : t.peakGrams >= data.thresholds.elevated
                      ? COLORS.elevated
                      : undefined
                  }
                />
              </div>

              <SeverityBar totals={t} />
              <SeismographTrace month={month} thresholds={data.thresholds} />

              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2">By sensor</p>
                <div className="overflow-x-auto rounded border border-[#262626]">
                  <table className="w-full text-xs min-w-[440px]">
                    <thead>
                      <tr className="bg-[#0A0A0A] text-[10px] uppercase tracking-wider text-[#808080]">
                        <th className="text-left font-bold px-3 py-2">Sensor</th>
                        <th className="text-right font-bold px-3 py-2">Readings</th>
                        <th className="text-right font-bold px-3 py-2">Average</th>
                        <th className="text-right font-bold px-3 py-2">Peak</th>
                        <th className="text-right font-bold px-3 py-2">Infected</th>
                        <th className="text-right font-bold px-3 py-2">Cleared</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626]">
                      {month.piezos.map((p) => (
                        <tr key={p.piezoId} className="text-[#E0E0E0]">
                          <td className="px-3 py-2">
                            {p.label}
                            {multiNode && <span className="text-[#808080]"> · {p.nodeName}</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{p.readings.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.avgGrams} g</td>
                          <td
                            className="px-3 py-2 text-right font-mono"
                            style={{
                              color:
                                p.peakGrams >= data.thresholds.critical
                                  ? COLORS.critical
                                  : p.peakGrams >= data.thresholds.elevated
                                  ? COLORS.elevated
                                  : undefined,
                            }}
                          >
                            {p.peakGrams} g
                          </td>
                          <td
                            className="px-3 py-2 text-right font-mono"
                            style={{ color: p.infected > 0 ? COLORS.critical : undefined }}
                          >
                            {p.infected}
                          </td>
                          <td
                            className="px-3 py-2 text-right font-mono"
                            style={{ color: p.cleared > 0 ? COLORS.normal : undefined }}
                          >
                            {p.cleared}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export const MonthlyReportView: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which month cards are expanded. The current month starts open; closed
  // months start collapsed so the list stays short.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const lastCurrentRef = useRef<string | null>(null);
  // Which month (report key) is being downloaded right now, and the last
  // download failure, if any.
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Which municipality is on screen. null until the first load, which lets the
  // server pick the first one alphabetically.
  const [municipality, setMunicipality] = useState<string | null>(null);
  const municipalityRef = useRef<string | null>(null);
  municipalityRef.current = municipality;

  const load = useCallback(() => {
    adminApi
      .vibrationReport(municipalityRef.current)
      .then((res: ReportData) => {
        setData(res);
        setError(null);
        // First load, or the page was left open past midnight on the 1st:
        // expand the new current month and fold the one that just closed.
        if (lastCurrentRef.current !== res.currentMonth) {
          const justClosed = lastCurrentRef.current;
          lastCurrentRef.current = res.currentMonth;
          setOpenKeys((prev) => {
            const next = new Set(prev);
            if (justClosed) next.delete(justClosed); // the month that just ended folds away
            next.add(res.currentMonth);
            return next;
          });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the report.'));
  }, []);

  useEffect(() => {
    load();
  }, [load, municipality]);
  // Picks up new readings, and the 1st-of-the-month rollover, without a refresh.
  usePolling(load, 60000);

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const pickMunicipality = (name: string) => {
    if (name === municipality) return;
    setData(null);
    setMunicipality(name);
  };

  const handleDownload = useCallback(
    async (key: string, all: boolean) => {
      if (downloadingKey) return;
      setDownloadingKey(`${key}|${all ? 'all' : 'muni'}`);
      setDownloadError(null);
      const muni = all ? null : data?.municipality ?? null;
      try {
        const blob = await adminApi.downloadVibrationReport(key, muni);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const slug = muni ? '-' + muni.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
        a.download = `cocosense-monthly-report-${key}${slug}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        setDownloadError(err instanceof Error ? err.message : 'Could not download the report.');
      } finally {
        setDownloadingKey(null);
      }
    },
    [downloadingKey, data?.municipality]
  );

  const currentMonth = data?.months.find((m) => m.isCurrent);
  const currentEmpty = !currentMonth || currentMonth.totals.readings === 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Admin Console"
        subtitle="Monthly Report"
        title="Monthly Report"
        description="A month-by-month summary of the vibration picked up in one municipality at a time. Choose a municipality below. The current month stays at the top while readings come in; when a month ends it is closed and moves down the list. Download a month for the municipality you picked, or for all municipalities together."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <DownloadButton
              variant="primary"
              label={`Download current: ${data?.municipality ?? 'municipality'}`}
              busy={!!currentMonth && downloadingKey === `${currentMonth.key}|muni`}
              disabled={!currentMonth || currentEmpty || !!downloadingKey}
              title={
                currentEmpty
                  ? 'No vibration readings have been recorded this month yet'
                  : `Download the ${monthLabel(currentMonth!)} vibration report for ${data?.municipality ?? 'this municipality'} (CSV)`
              }
              onClick={() => currentMonth && handleDownload(currentMonth.key, false)}
            />
            <DownloadButton
              label="Download current: all municipalities"
              busy={!!currentMonth && downloadingKey === `${currentMonth.key}|all`}
              disabled={!currentMonth || !!downloadingKey}
              title={`Download the overall ${monthLabel(currentMonth ?? ({ year: 0, month: 1 } as MonthReport))} vibration report for all municipalities (CSV)`}
              onClick={() => currentMonth && handleDownload(currentMonth.key, true)}
            />
          </div>
        }
      />

      {downloadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-4 py-3 text-xs text-[#F44336]"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{downloadError}</span>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="text-[#F44336]/80 hover:text-[#F44336] font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {data && data.municipalities.length > 0 && (
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-4 sm:p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#16A34A]" /> Municipality
          </p>
          <div className="flex flex-wrap gap-2">
            {data.municipalities.map((m) => {
              const active = m.name === data.municipality;
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => pickMunicipality(m.name)}
                  aria-pressed={active}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    active
                      ? 'bg-[#16A34A] border-[#16A34A] text-black'
                      : 'bg-[#1A1A1A] border-[#333333] text-[#E0E0E0] hover:bg-[#222222]'
                  }`}
                >
                  {m.name}
                  <span className={`ml-2 font-mono text-[10px] ${active ? 'text-black/70' : 'text-[#808080]'}`}>
                    {m.owners} {m.owners === 1 ? 'owner' : 'owners'} · {m.nodes} {m.nodes === 1 ? 'node' : 'nodes'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data && data.municipalities.length === 0 && (
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          No farm owners are registered yet, so there is no municipality to report on.
        </div>
      )}

      {error && !data && (
        <div className="flex items-start gap-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 px-4 py-3 text-xs text-[#F44336]">
          <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!data && !error && (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-[#808080]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
        </div>
      )}

      {data && data.municipalities.length > 0 && (
        <div className="space-y-3">
          {data.months.map((m) => (
            <MonthCard
              key={m.key}
              month={m}
              open={openKeys.has(m.key)}
              onToggle={() => toggle(m.key)}
              data={data}
              onDownload={(all) => handleDownload(m.key, all)}
              downloading={
                downloadingKey === `${m.key}|muni` ? 'muni' : downloadingKey === `${m.key}|all` ? 'all' : null
              }
              downloadLocked={!!downloadingKey}
            />
          ))}
          {data.months.length === 1 && (
            <p className="text-[11px] text-[#606060] px-1">
              Earlier months will appear below the current one as soon as this month ends.
            </p>
          )}
        </div>
      )}

      <PageFooterNote
        icon={FileText}
        text="Months follow your local calendar. The page shows the municipality you picked. You can download a month for that municipality alone, or the overall file for all municipalities (totals, a per-municipality breakdown, per-sensor breakdown and the full log). Only readings from working sensors are counted, and a month's figures are final once it closes. Files open in Excel or Google Sheets."
      />
    </div>
  );
};

export default MonthlyReportView;
