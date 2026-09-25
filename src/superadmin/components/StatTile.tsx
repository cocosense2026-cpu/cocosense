import React from 'react';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  accent?: 'gold' | 'green' | 'red';
  onClick?: () => void;
}

// Every value here must be one of the exact hex tokens the app's
// light-mode override map in src/index.css already covers (see the
// "Light Theme Color Classes Overrides" section) -- using an
// off-palette shade (e.g. #16A34A instead of the established #4CAF50
// success token) means it has no light-mode equivalent and renders as
// a near-black/mismatched swatch once the site is switched to light
// mode, instead of adapting like the rest of the design system.
const ACCENT_TEXT: Record<string, string> = {
  gold: 'text-[#D4AF37]',
  green: 'text-[#4CAF50]',
  red: 'text-[#F44336]',
};

const ACCENT_BORDER: Record<string, string> = {
  gold: 'hover:border-[#D4AF37]/40',
  green: 'hover:border-[#4CAF50]/40',
  red: 'hover:border-[#F44336]/40',
};

export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon, accent = 'gold', onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-lg transition-all ${ACCENT_BORDER[accent]} ${
      onClick ? 'cursor-pointer' : ''
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#808080]">{label}</span>
      <div className={`p-2.5 rounded-lg bg-[#1A1A1A] border border-[#262626] ${ACCENT_TEXT[accent]}`}>{icon}</div>
    </div>
    <div className="mt-3 font-mono text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</div>
    {hint && <div className="mt-2 text-xs text-[#808080]">{hint}</div>}
  </div>
);
