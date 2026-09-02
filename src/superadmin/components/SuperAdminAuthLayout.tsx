import React from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Crown, ShieldAlert, UserCog, AlertCircle } from 'lucide-react';

interface SuperAdminAuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  error?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SuperAdminAuthLayout: React.FC<SuperAdminAuthLayoutProps> = ({
  eyebrow,
  title,
  subtitle,
  error,
  children,
  footer,
}) => {
  return (
    <div className="min-h-screen w-full auth-shell text-[#E0E0E0] flex items-center justify-center font-sans selection:bg-[#16A34A] selection:text-black p-4 sm:p-8">
      {/* Ambient green glow behind the card */}
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-[900px] h-[600px] rounded-full bg-[#16A34A]/10 blur-[120px]" />
      </div>

      {/* The rounded "side rectangle" card -- green stroke + green shadow glow */}
      <div
        className="relative w-full max-w-5xl rounded-[28px] bg-[#0A0A0A] border border-[#16A34A]/50 overflow-hidden flex flex-col"
        style={{
          boxShadow:
            '0 0 0 1px rgba(22,163,74,0.15), 0 0 60px rgba(34,197,94,0.25), 0 0 140px rgba(22,163,74,0.12), 0 25px 60px -20px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header inside the rectangle */}
        <div className="flex items-center justify-between gap-4 px-6 sm:px-10 py-5 border-b border-[#16A34A]/20 auth-shell-header">
          <BrandLogo variant="horizontal" size="sm" animateSweep={false} />
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E0E0E] border border-[#16A34A]/40 text-[10px] font-mono text-[#22C55E] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
              Super Admin Console
            </span>
            <ThemeToggle variant="icon" />
          </div>
        </div>

        {/* Body: information (left) + login form (right) */}
        <div className="flex flex-col lg:flex-row">
          {/* Left -- information panel */}
          <div className="lg:w-[46%] flex flex-col justify-between gap-8 p-6 sm:p-10 lg:border-r border-[#16A34A]/15">
            <div className="space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight serif">
                Govern the administrators behind the network.
              </h2>
              <p className="text-sm text-[#A0A0A0] leading-relaxed max-w-sm">
                Provision and deactivate Administrator accounts, and keep a bird's-eye view of every farm owner,
                master node, and admin across the CocoSense deployment.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  { icon: UserCog, text: 'Create & deactivate admin console accounts' },
                  { icon: Crown, text: 'Network-wide plantation rollup, read-only' },
                  { icon: ShieldAlert, text: 'Restricted to authorized super admins only' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-xs text-[#808080]">
                    <span className="p-1.5 rounded bg-[#0E0E0E] border border-[#16A34A]/30 text-[#22C55E] flex-shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    {text}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-[#404040] font-mono">ASCOT &amp; PCA LoRa Mesh &middot; v2.4.8-STABLE</p>
          </div>

          {/* Right -- login form panel */}
          <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-6">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#22C55E]">
                  {eyebrow}
                </span>
                <h1 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{title}</h1>
                <p className="text-xs text-[#808080] mt-1.5">{subtitle}</p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-lg bg-[#111111] border border-[#16A34A]/25 p-6 sm:p-7 shadow-xl">
                {children}
              </div>

              {footer && <div className="mt-5 text-center text-xs text-[#808080]">{footer}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const superAdminAuthInputClass =
  'w-full pl-10 pr-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#22C55E]/60 focus:ring-1 focus:ring-[#22C55E]/30 transition-colors';

export const superAdminAuthButtonClass =
  'w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#16A34A] hover:bg-[#22C55E] text-black text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
