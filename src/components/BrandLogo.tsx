import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface BrandLogoProps {
  variant?: 'horizontal' | 'stacked' | 'badge' | 'icon-only';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animateSweep?: boolean; // Kept as optional prop for interface compatibility, but stationary by default as requested
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showTagline = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Height / Text scaling based on size prop
  const sizeMap = {
    xs: { height: 'h-8', text: 'text-sm', sub: 'text-[8px]', iconBox: 'w-8 h-8' },
    sm: { height: 'h-10', text: 'text-base sm:text-lg', sub: 'text-[9px]', iconBox: 'w-10 h-10' },
    md: { height: 'h-12', text: 'text-xl sm:text-2xl', sub: 'text-[10px]', iconBox: 'w-12 h-12' },
    lg: { height: 'h-16', text: 'text-3xl sm:text-4xl', sub: 'text-xs', iconBox: 'w-16 h-16' },
    xl: { height: 'h-24', text: 'text-5xl', sub: 'text-sm', iconBox: 'w-24 h-24' },
  };

  const { height, text, sub, iconBox } = sizeMap[size];

  // SVG Icon representing the authentic CocoSense Palm + Green Radar Emblem (Clean, Stationary, Highly Visible)
  const RadarGraphic = (
    <div className={`relative ${iconBox} flex-shrink-0 flex items-center justify-center select-none`}>
      <svg
        viewBox="0 0 130 130"
        className="w-full h-full drop-shadow-md select-none overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radar Green Gradient - Radiant and Crisp */}
          <radialGradient id="cocoRadarGreenVivid" cx="26" cy="106" r="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="65%" stopColor="#16A34A" />
            <stop offset="100%" stopColor="#15803D" />
          </radialGradient>

          {/* White outline filter to ensure black palms & lines pop with maximum clarity */}
          <filter id="whiteContourHigh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#FFFFFF" floodOpacity="0.95" />
          </filter>
        </defs>

        {/* 1. Radar Green Sector (Quadrant 90-degree fan) */}
        <path
          d="M 26 106 L 38 16 A 92 92 0 0 1 120 106 Z"
          fill="url(#cocoRadarGreenVivid)"
          stroke="#000000"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* 2. Concentric Radar Arc Rings - Clean & Static (No Motion) */}
        <path d="M 26 106 L 29 83 A 24 24 0 0 1 50 106" stroke="#064E3B" strokeWidth="2.2" strokeOpacity="0.8" fill="none" />
        <path d="M 26 106 L 32 60 A 48 48 0 0 1 74 106" stroke="#064E3B" strokeWidth="2.2" strokeOpacity="0.8" fill="none" />
        <path d="M 26 106 L 35 37 A 72 72 0 0 1 98 106" stroke="#064E3B" strokeWidth="2.2" strokeOpacity="0.8" fill="none" />
        <path d="M 26 106 L 38 16 A 92 92 0 0 1 120 106" stroke="#000000" strokeWidth="3" strokeOpacity="0.9" fill="none" />

        {/* 3. Radar Baseline and Axis lines */}
        <line x1="26" y1="106" x2="120" y2="106" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="26" y1="106" x2="38" y2="16" stroke="#000000" strokeWidth="3" strokeLinecap="round" />

        {/* 4. Coconut Palms Silhouette with crisp frond details */}
        <g filter={isDark ? "url(#whiteContourHigh)" : undefined}>
          {/* Secondary Palm Trunk (Angled to the right across the green radar arc) */}
          <path
            d="M 26 106 Q 48 76 68 46 L 72 48 Q 51 78 28 106 Z"
            fill="#000000"
            stroke="#000000"
            strokeWidth="0.5"
          />

          {/* Secondary Palm Fronds Canopy (Right palm) */}
          <path d="M 70 47 C 76 34 88 32 98 38 C 92 42 84 46 70 47 Z" fill="#000000" />
          <path d="M 90 35 L 94 42 M 85 33 L 88 41 M 80 34 L 82 43 M 95 38 L 97 45" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 70 47 C 82 48 94 54 100 64 C 90 62 80 58 70 47 Z" fill="#000000" />
          <path d="M 80 49 L 85 57 M 88 52 L 93 61 M 94 57 L 98 65" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 70 47 C 78 58 84 68 84 78 C 78 70 74 60 70 47 Z" fill="#000000" />
          <path d="M 75 56 L 80 64 M 78 63 L 83 72 M 81 70 L 84 77" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 70 47 C 62 36 54 36 48 40 C 56 42 64 45 70 47 Z" fill="#000000" />
          <path d="M 64 39 L 60 46 M 58 37 L 54 44 M 52 38 L 48 43" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          {/* Primary Palm Trunk (Left Palm - Tall, upright bow) */}
          <path
            d="M 25 106 Q 30 64 34 26 L 38 27 Q 34 65 29 106 Z"
            fill="#000000"
            stroke="#000000"
            strokeWidth="0.5"
          />

          {/* Primary Palm Fronds Canopy (Left palm) */}
          <path d="M 36 26 C 34 14 36 4 36 0 C 38 6 39 16 36 26 Z" fill="#000000" />
          <path d="M 35 8 L 31 4 M 36 12 L 30 9 M 37 16 L 31 14 M 36 8 L 41 5 M 37 13 L 43 10 M 37 18 L 43 15" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 36 26 C 24 14 14 12 2 16 C 12 20 24 24 36 26 Z" fill="#000000" />
          <path d="M 26 18 L 22 25 M 20 16 L 15 23 M 14 14 L 8 20 M 8 15 L 2 20 M 28 17 L 30 11 M 22 15 L 24 9 M 16 13 L 17 8" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 36 26 C 22 26 10 32 0 42 C 10 38 24 34 36 26 Z" fill="#000000" />
          <path d="M 26 28 L 22 36 M 18 30 L 13 38 M 10 33 L 4 41 M 3 39 L 0 46" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 36 26 C 26 38 18 50 14 62 C 20 50 28 40 36 26 Z" fill="#000000" />
          <path d="M 28 36 L 24 44 M 22 43 L 17 51 M 17 50 L 13 58" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 36 26 C 48 14 60 14 70 20 C 60 22 48 24 36 26 Z" fill="#000000" />
          <path d="M 46 18 L 50 25 M 52 16 L 57 23 M 58 16 L 64 22 M 64 18 L 70 24" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 36 26 C 50 26 62 32 72 40 C 60 36 48 32 36 26 Z" fill="#000000" />
          <path d="M 46 28 L 51 35 M 54 30 L 60 38 M 62 33 L 68 41 M 66 37 L 72 44" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* 5. Pivot Joint Node Circle */}
        <circle cx="26" cy="106" r="6.5" fill="#000000" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="26" cy="106" r="3" fill="#22C55E" />
      </svg>
    </div>
  );

  // Variant: App Icon Squircle Badge (Matching Frame 101339.png)
  if (variant === 'badge') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
        <div className="relative p-3.5 rounded-2xl bg-[#0E0E0E] border-2 border-[#333333] shadow-2xl overflow-hidden group hover:border-[#16A34A] transition-all">
          <div className="bg-white/5 p-2 rounded-xl border border-white/10 flex flex-col items-center">
            {RadarGraphic}
            <div className="text-center font-black tracking-tight mt-1.5 leading-none">
              <span className="block text-white text-[14px] font-black tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                COCO
              </span>
              <span className="block text-[#22C55E] text-[14px] font-black tracking-widest uppercase">
                SENSE
              </span>
            </div>
          </div>
        </div>
        {showTagline && (
          <span className="text-[10px] font-mono text-[#808080] uppercase tracking-widest font-semibold">
            Plantation Bioacoustics
          </span>
        )}
      </div>
    );
  }

  // Variant: Icon only
  if (variant === 'icon-only') {
    return <div className={`inline-block ${className}`}>{RadarGraphic}</div>;
  }

  // Variant: Stacked Logo (Matching Frame 101340.png & Frame 101333 1.png)
  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`}>
        {RadarGraphic}
        <div className="mt-2 text-center tracking-tight">
          <div className="leading-tight uppercase font-black flex flex-col items-center">
            <span
              className={`block ${text} tracking-wider font-black ${
                isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : 'text-[#0A0A0A]'
              }`}
              style={{
                letterSpacing: '0.08em',
              }}
            >
              COCO
            </span>
            <span className={`block ${text} tracking-wider text-[#16A34A] font-black`} style={{ letterSpacing: '0.08em' }}>
              SENSE
            </span>
          </div>
          {showTagline && (
            <div className={`${sub} font-semibold text-[#808080] uppercase tracking-widest mt-1`}>
              Bioacoustic Plantation Telemetry
            </div>
          )}
        </div>
      </div>
    );
  }

  // Variant: Horizontal Standard Lockup (Matching Frame 101338.png)
  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3.5 select-none ${height} ${className}`}>
      {RadarGraphic}
      <div className="flex flex-col justify-center">
        <div className={`flex items-baseline gap-1.5 ${text} font-black uppercase leading-none`}>
          <span
            className={`font-black tracking-wider transition-colors ${
              isDark ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]' : 'text-[#0A0A0A]'
            }`}
            style={{
              letterSpacing: '0.05em',
            }}
          >
            COCO
          </span>
          <span className="text-[#16A34A] font-black tracking-wider drop-shadow-sm" style={{ letterSpacing: '0.05em' }}>
            SENSE
          </span>
        </div>
        {showTagline && (
          <span className={`${sub} font-semibold text-[#808080] uppercase tracking-widest mt-0.5`}>
            Bioacoustic IoT Mesh
          </span>
        )}
      </div>
    </div>
  );
};
