// One shared severity palette for every alert / notification list in the
// system (Admin console + Farm Owner portal):
//   green  = Normal
//   yellow = Elevated
//   red    = Critical
// Stored values vary by age/source ("CRITICAL", "ELEVATED", and older rows
// "WARNING" / "INFO"), so everything is normalised to one of three levels.

export type SeverityLevel = 'normal' | 'elevated' | 'critical';

export function levelFromSeverity(severity?: string | null): SeverityLevel | null {
  const s = String(severity ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'CRITICAL' || s === 'HIGH') return 'critical';
  if (s === 'ELEVATED' || s === 'WARNING' || s === 'WARN' || s === 'MEDIUM') return 'elevated';
  if (s === 'NORMAL' || s === 'INFO' || s === 'LOW') return 'normal';
  return null;
}

// Notification rows don't carry a severity column, so fall back to what the
// server wrote into the title ("Elevated Impact Detected", "Pest Feeding
// Pattern Detected", ...). Pest detections are always critical.
export function levelOfNotification(n: { severity?: string | null; title?: string; message?: string; category?: string }): SeverityLevel {
  const direct = levelFromSeverity(n.severity);
  if (direct) return direct;
  const text = `${n.title ?? ''} ${n.message ?? ''}`.toLowerCase();
  if (text.includes('critical')) return 'critical';
  if (text.includes('elevated') || text.includes('warning')) return 'elevated';
  if (text.includes('pest') || String(n.category ?? '').toUpperCase() === 'PEST') return 'critical';
  if (text.includes('normal')) return 'normal';
  return 'critical';
}

export const LEVEL_LABEL: Record<SeverityLevel, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  critical: 'Critical',
};

export const LEVEL_STYLE: Record<SeverityLevel, { card: string; iconBox: string; badge: string; text: string }> = {
  normal: {
    card: 'bg-[#101A12] border-[#4CAF50]/40',
    iconBox: 'bg-[#142416] text-[#4CAF50] border border-[#4CAF50]/30',
    badge: 'bg-[#142416] text-[#4CAF50] border border-[#4CAF50]/30',
    text: 'text-[#4CAF50]',
  },
  elevated: {
    card: 'bg-[#1F1B0A] border-[#FFC107]/40',
    iconBox: 'bg-[#2A2308] text-[#FFC107] border border-[#FFC107]/30',
    badge: 'bg-[#2A2308] text-[#FFC107] border border-[#FFC107]/30',
    text: 'text-[#FFC107]',
  },
  critical: {
    card: 'bg-[#1C1212] border-[#F44336]/40',
    iconBox: 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30',
    badge: 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30',
    text: 'text-[#F44336]',
  },
};
