import type { VibrationStrengthPoint } from '../components/VibrationStrengthChart';

// The server sends a week of vibration as a bare array of "strongest
// reading (g) in each window" plus the start time, instead of one object
// per reading -- these pages poll every 10 seconds, and this keeps the
// 7-day payload to a few KB. Windows with no vibration are 0, so the line
// goes flat like a seismograph. (server: rollup.js weekPeaks)
export interface WeekSeries {
  /** ISO instant at the start of peaks[0]. */
  startsAt: string;
  bucketMinutes: number;
  /** Oldest -> newest; the last entry is the current window. */
  peaks: number[];
}

export interface Thresholds {
  elevated: number;
  critical: number;
}

const DEFAULT_THRESHOLDS: Thresholds = { elevated: 1.5, critical: 5 };

export function weekToPoints(week: WeekSeries, thresholds?: Thresholds | null): VibrationStrengthPoint[] {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const start = new Date(week.startsAt).getTime();
  const step = week.bucketMinutes * 60000;
  return week.peaks.map((grams, i) => ({
    grams,
    timestamp: new Date(start + i * step).toISOString(),
    severity: grams >= t.critical ? 'Critical' : grams >= t.elevated ? 'Elevated' : 'Normal',
  }));
}

export function weekHasVibration(week?: WeekSeries | null): boolean {
  return !!week && week.peaks.some((g) => g > 0);
}
