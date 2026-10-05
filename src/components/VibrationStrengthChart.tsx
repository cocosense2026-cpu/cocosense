import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface VibrationStrengthPoint {
  grams: number;
  /** Raw timestamp string, e.g. "2024-01-01 09:33:00" (space-separated, UTC). */
  timestamp?: string;
  severity?: string;
}

// Same severity palette used across the Owner Portal (EventsPage /
// PiezoDetailPage SEVERITY_STYLES) so the chart line always matches the
// rest of the system instead of introducing a new color.
const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#F44336',
  Elevated: '#E9A23B',
  Normal: '#4CAF50',
  Offline: '#808080',
};

const DEFAULT_COLOR = '#4CAF50';

function colorFor(severity: string | undefined): string {
  if (!severity) return DEFAULT_COLOR;
  return SEVERITY_COLORS[severity] || DEFAULT_COLOR;
}

function formatClock(timestamp?: string): string {
  if (!timestamp) return '';
  const d = new Date(timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Rounds a raw axis ceiling up to a "nice" step (0.5 / 1 / 2 / 5 g etc.)
// so the y-axis reads cleanly instead of an arbitrary decimal.
function niceMax(rawMax: number): number {
  if (rawMax <= 2) return 2;
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const norm = rawMax / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

interface VibrationStrengthChartProps {
  points: VibrationStrengthPoint[];
  /** Pixel height of the chart's container (Tailwind h-* should match). */
  height?: number;
  /** Internal SVG viewBox width -- higher values reduce horizontal
   * stretch distortion of strokes/text on very wide containers (e.g.
   * the full-detail chart on the single-piezo page). */
  width?: number;
  /** Optional caption centered under the x-axis time ticks, e.g. "Time" --
   * used on the full-detail piezo view to match the reference monitor layout. */
  xAxisLabel?: string;
  className?: string;
  /** Week mode: the plot becomes a horizontally scrollable strip with a
   * fixed y-axis. Newest reading sits at the left edge; scrolling right
   * moves back in time through the points (up to the last 7 days). */
  scrollable?: boolean;
  /** Overrides the hint line under the scrollable strip (defaults to the
   * Vibration Events wording, "last 7 days"). */
  caption?: string;
  /** Scrollable mode only: horizontal room given to each point (default
   * 16). Dense series -- a week of 15-minute windows -- use a smaller value
   * so the strip stays a sensible length to swipe through. */
  pxPerPoint?: number;
}

/**
 * Axis-labeled vibration strength trace: a plain line chart with a
 * gridded 0-to-max "g" y-axis and clock-time x-axis ticks, emphasizing
 * the actual magnitude of each reading rather than a stylized EKG blip.
 * Colors follow the app's existing severity palette (green/amber/red/gray).
 */
export const VibrationStrengthChart: React.FC<VibrationStrengthChartProps> = ({
  points,
  height = 150,
  width = 460,
  xAxisLabel,
  className = '',
  scrollable = false,
  caption,
  pxPerPoint,
}) => {
  if (scrollable) {
    return (
      <ScrollableStrengthChart
        points={points}
        height={height}
        xAxisLabel={xAxisLabel}
        className={className}
        caption={caption}
        pxPerPoint={pxPerPoint}
      />
    );
  }
  const rawId = useId();
  const gradId = `vsc-grad-${rawId.replace(/[:]/g, '')}`;
  const fillId = `vsc-fill-${rawId.replace(/[:]/g, '')}`;

  const marginLeft = 32;
  const marginRight = 10;
  const marginTop = 10;
  const marginBottom = xAxisLabel ? 36 : 22;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const safePoints = points.length ? points : [{ grams: 0 }, { grams: 0 }];
  const maxGrams = useMemo(() => niceMax(Math.max(...safePoints.map((p) => p.grams), 0)), [safePoints]);

  const xFor = (i: number) => marginLeft + (safePoints.length <= 1 ? plotW / 2 : (i / (safePoints.length - 1)) * plotW);
  const yFor = (g: number) => marginTop + plotH - (Math.max(0, g) / maxGrams) * plotH;

  const linePath = useMemo(
    () =>
      safePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.grams).toFixed(1)}`)
        .join(' '),
    [safePoints, maxGrams]
  );

  const areaPath = useMemo(() => {
    if (!safePoints.length) return '';
    const base = marginTop + plotH;
    return `${linePath} L ${xFor(safePoints.length - 1).toFixed(1)} ${base} L ${xFor(0).toFixed(1)} ${base} Z`;
  }, [linePath, safePoints, maxGrams]);

  const lineColor = colorFor(safePoints[safePoints.length - 1]?.severity);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxGrams * f);

  // Show at most 5 evenly-spaced time labels so the x-axis doesn't get
  // crowded when there are more than a handful of samples.
  const maxLabels = 5;
  const labelStep = Math.max(1, Math.ceil((safePoints.length - 1) / (maxLabels - 1)) || 1);
  const xLabelIndices = safePoints.length
    ? Array.from(new Set([
        ...safePoints.map((_, i) => i).filter((i) => i % labelStep === 0),
        safePoints.length - 1,
      ])).sort((a, b) => a - b)
    : [];

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            {safePoints.map((p, i) => (
              <stop
                key={i}
                offset={`${(i / Math.max(1, safePoints.length - 1)) * 100}%`}
                stopColor={colorFor(p.severity)}
              />
            ))}
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {yTicks.map((g, i) => {
          const y = yFor(g);
          return (
            <g key={i}>
              <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="#262626" strokeWidth="1" />
              <text x={marginLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#808080" fontFamily="monospace">
                {g.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* "g" axis unit label */}
        <text x={4} y={marginTop + 4} textAnchor="start" fontSize="9" fill="#606060" fontFamily="monospace">
          g
        </text>

        {/* Area fill under the line */}
        {areaPath && <path d={areaPath} fill={`url(#${fillId})`} stroke="none" />}

        {/* The line itself */}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis time labels */}
        {xLabelIndices.map((i) => (
          <text
            key={i}
            x={xFor(i)}
            y={marginTop + plotH + 14}
            textAnchor="middle"
            fontSize="9"
            fill="#808080"
            fontFamily="monospace"
          >
            {formatClock(safePoints[i].timestamp)}
          </text>
        ))}

        {/* Optional x-axis caption, e.g. "Time" */}
        {xAxisLabel && (
          <text
            x={marginLeft + plotW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#606060"
            fontFamily="monospace"
          >
            {xAxisLabel}
          </text>
        )}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------
// Scrollable week view.
// ---------------------------------------------------------------------

function parseTs(timestamp?: string): Date | null {
  if (!timestamp) return null;
  const d = new Date(timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDayTime(timestamp?: string): string {
  const d = parseTs(timestamp);
  if (!d) return '';
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}

const PX_PER_POINT = 16; // horizontal room given to each reading
const AXIS_W = 34; // fixed y-axis gutter

const ScrollableStrengthChart: React.FC<{
  points: VibrationStrengthPoint[];
  height: number;
  xAxisLabel?: string;
  className?: string;
  caption?: string;
  pxPerPoint?: number;
}> = ({ points, height, xAxisLabel, className = '', caption, pxPerPoint = PX_PER_POINT }) => {
  const rawId = useId().replace(/[:]/g, '');
  const gradId = `vsc-sg-${rawId}`;
  const fillId = `vsc-sf-${rawId}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(300);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setViewW(el.clientWidth || 300);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Newest first so the strip opens on "now" at the left edge and
  // scrolling right walks back through the week.
  const ordered = useMemo(() => (points.length ? [...points].reverse() : [{ grams: 0 }, { grams: 0 }]), [points]);

  const marginTop = 10;
  const marginBottom = xAxisLabel ? 36 : 22;
  const plotH = height - marginTop - marginBottom;
  const padX = 12;
  const plotW = Math.max(viewW, ordered.length * pxPerPoint + padX * 2);
  const maxGrams = useMemo(() => niceMax(Math.max(...ordered.map((p) => p.grams), 0)), [ordered]);

  const xFor = (i: number) => padX + (ordered.length <= 1 ? 0 : (i / (ordered.length - 1)) * (plotW - padX * 2));
  const yFor = (g: number) => marginTop + plotH - (Math.max(0, g) / maxGrams) * plotH;

  const linePath = ordered.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.grams).toFixed(1)}`).join(' ');
  const base = marginTop + plotH;
  const areaPath = `${linePath} L ${xFor(ordered.length - 1).toFixed(1)} ${base} L ${xFor(0).toFixed(1)} ${base} Z`;
  const lineColor = colorFor(ordered[0]?.severity);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxGrams * f);

  // One time label roughly every 90px so day+time labels never overlap.
  const labelEvery = Math.max(1, Math.round(90 / Math.max(1, plotW / Math.max(1, ordered.length - 1))));
  const labelIdx = ordered.map((_, i) => i).filter((i) => i % labelEvery === 0);

  return (
    <div className={className}>
      <div className="flex" style={{ height }}>
        {/* Fixed y-axis: stays put while the plot scrolls */}
        <svg width={AXIS_W} height={height} className="flex-shrink-0">
          {yTicks.map((g, i) => (
            <text key={i} x={AXIS_W - 6} y={yFor(g) + 3} textAnchor="end" fontSize="9" fill="#808080" fontFamily="monospace">
              {g.toFixed(1)}
            </text>
          ))}
          <text x={4} y={marginTop + 4} fontSize="9" fill="#606060" fontFamily="monospace">
            g
          </text>
        </svg>

        <div ref={wrapRef} className="flex-1 min-w-0 overflow-x-auto overscroll-x-contain" style={{ height }}>
          <svg width={plotW} height={height} viewBox={`0 0 ${plotW} ${height}`} style={{ display: 'block' }}>
            <defs>
              <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={padX} y1="0" x2={plotW - padX} y2="0">
                {ordered.map((p, i) => (
                  <stop key={i} offset={`${(i / Math.max(1, ordered.length - 1)) * 100}%`} stopColor={colorFor(p.severity)} />
                ))}
              </linearGradient>
            </defs>

            {yTicks.map((g, i) => (
              <line key={i} x1={0} y1={yFor(g)} x2={plotW} y2={yFor(g)} stroke="#262626" strokeWidth="1" />
            ))}

            <path d={areaPath} fill={`url(#${fillId})`} stroke="none" />
            <path d={linePath} fill="none" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {labelIdx.map((i) => (
              <text key={i} x={xFor(i)} y={base + 14} textAnchor="middle" fontSize="9" fill="#808080" fontFamily="monospace">
                {formatDayTime(ordered[i].timestamp)}
              </text>
            ))}
            {xAxisLabel && (
              <text x={Math.min(plotW / 2, viewW / 2)} y={height - 6} textAnchor="middle" fontSize="9" fill="#606060" fontFamily="monospace">
                {xAxisLabel}
              </text>
            )}
          </svg>
        </div>
      </div>
      <p className="text-[10px] text-[#606060] font-mono mt-1.5 text-center">
        {caption ?? <>Latest at left &middot; scroll right for earlier readings (last 7 days)</>}
      </p>
    </div>
  );
};

export default VibrationStrengthChart;
