import React, { useId, useMemo } from 'react';

export interface VibrationPulsePoint {
  grams: number;
  severity?: string;
}

// Same severity palette already used across the Owner Portal
// (EventsPage / PiezoDetailPage SEVERITY_STYLES) so the pulse trace
// always matches the rest of the system instead of introducing a new color.
export const PULSE_SEVERITY_COLORS: Record<string, string> = {
  Critical: '#F44336',
  Elevated: '#E9A23B',
  Normal: '#4CAF50',
  Offline: '#808080',
};

const DEFAULT_COLOR = '#D4AF37'; // system gold accent

function colorFor(severity: string | undefined): string {
  if (!severity) return DEFAULT_COLOR;
  return PULSE_SEVERITY_COLORS[severity] || DEFAULT_COLOR;
}

/**
 * Builds a heart-monitor-style trace: a flat baseline that spikes into a
 * sharp EKG "blip" at each data point, with the blip height scaled to
 * that reading's magnitude -- visually the same language as the
 * reference heartbeat monitor image, but driven by real vibration data.
 */
function buildPulsePath(amplitudes: number[], width: number, height: number): string {
  const n = amplitudes.length;
  if (n === 0) return `M 0 ${height / 2} L ${width} ${height / 2}`;
  const mid = height / 2;
  const segW = width / n;
  const maxAmp = mid - 6;

  let d = `M 0 ${mid.toFixed(1)}`;
  amplitudes.forEach((v, i) => {
    const cx = i * segW + segW / 2;
    const amp = Math.max(0.06, v) * maxAmp;
    // small pre/post baseline noise so a resting trace doesn't look dead-flat
    const noise = (i % 2 === 0 ? 1 : -1) * mid * 0.03;

    const p0x = i * segW + segW * 0.12;
    const p1x = cx - segW * 0.16;
    const p2x = cx - segW * 0.04;
    const p3x = cx + segW * 0.1;
    const p4x = cx + segW * 0.22;
    const p5x = i * segW + segW;

    d += ` L ${p0x.toFixed(1)} ${(mid + noise).toFixed(1)}`;
    d += ` L ${p1x.toFixed(1)} ${(mid - amp * 0.18).toFixed(1)}`;
    d += ` L ${p2x.toFixed(1)} ${(mid - amp).toFixed(1)}`;
    d += ` L ${p3x.toFixed(1)} ${(mid + amp * 0.38).toFixed(1)}`;
    d += ` L ${p4x.toFixed(1)} ${mid.toFixed(1)}`;
    d += ` L ${p5x.toFixed(1)} ${mid.toFixed(1)}`;
  });
  return d;
}

interface VibrationPulseChartProps {
  points: VibrationPulsePoint[];
  /** Pixel height of the chart's container (Tailwind h-* should match). */
  height?: number;
  className?: string;
}

/**
 * Glowing EKG / heart-monitor style vibration trace, replacing the plain
 * bar sparkline. Colors follow the app's existing severity palette
 * (gold/green/amber/red) rather than a fixed color, so a run of Critical
 * readings glows red, Elevated glows amber, Normal glows green/gold --
 * matching CocoSense's own system palette instead of the reference image's red.
 */
export const VibrationPulseChart: React.FC<VibrationPulseChartProps> = ({ points, height = 64, className = '' }) => {
  const rawId = useId();
  const gradId = `pulse-grad-${rawId.replace(/[:]/g, '')}`;
  const glowId = `pulse-glow-${rawId.replace(/[:]/g, '')}`;

  const width = 400;
  const maxGrams = Math.max(1, ...points.map((p) => p.grams), 1);

  const amplitudes = useMemo(() => points.map((p) => p.grams / maxGrams), [points, maxGrams]);
  const path = useMemo(() => buildPulsePath(amplitudes, width, height), [amplitudes, height]);

  const colors = points.length
    ? points.map((p) => colorFor(p.severity))
    : [DEFAULT_COLOR, DEFAULT_COLOR];
  const lineColor = colors[colors.length - 1] || DEFAULT_COLOR;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            {colors.map((c, i) => (
              <stop key={i} offset={`${(i / Math.max(1, colors.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
          <filter id={glowId} x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* faint baseline grid */}
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#262626" strokeWidth="1" strokeDasharray="4 4" />

        {/* soft outer glow pass */}
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.45"
          filter={`url(#${glowId})`}
        />
        {/* crisp core line */}
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${lineColor}99)` }}
        />
      </svg>
    </div>
  );
};

export default VibrationPulseChart;
