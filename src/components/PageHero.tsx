import React from 'react';
import { BrandLogo } from './BrandLogo';

interface PageHeroProps {
  /** Small pill label at the top, e.g. "FARM OWNER PORTAL" */
  eyebrow: string;
  /** Small muted mono line to the right of the eyebrow, e.g. "Bioacoustic LoRa Mesh v2.4" */
  subtitle?: string;
  /** Main page heading */
  title: string;
  /** Supporting description shown under the title */
  description: React.ReactNode;
  /** Accent color for the pulse dot (defaults to CocoSense green, matching the admin dashboard) */
  accent?: string;
  /** Optional right-aligned slot for quick actions / stats */
  actions?: React.ReactNode;
}

/**
 * Rich top-of-page banner used across the Farm Owner and Super Admin
 * portals, mirroring the exact hero treatment on the main Admin
 * dashboard (see src/views/DashboardView.tsx): a CocoSense badge logo,
 * a pulsing status pill, a bold uppercase title, a watermark icon in
 * the corner, and an optional actions slot on the right.
 */
export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  subtitle,
  title,
  description,
  accent = '#16A34A',
  actions,
}) => {
  return (
    <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Background Radar Watermark Accent */}
      <div className="absolute -right-6 -bottom-10 opacity-10 pointer-events-none hidden sm:block">
        <BrandLogo variant="icon-only" size="xl" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="hidden sm:block flex-shrink-0 pt-1">
            <BrandLogo variant="badge" size="sm" />
          </div>
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="px-2.5 py-1 rounded bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5"
                style={{ color: accent }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accent }}></span>
                {eyebrow}
              </span>
              {subtitle && <span className="text-[11px] text-[#808080] font-mono">{subtitle}</span>}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight uppercase font-sans">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-[#A0A0A0] leading-relaxed font-light">{description}</p>
          </div>
        </div>

        {actions && <div className="flex flex-wrap gap-2.5 w-full sm:w-auto flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
