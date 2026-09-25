import React, { useId, useMemo } from 'react';

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
}) => {
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

export default VibrationStrengthChart;
