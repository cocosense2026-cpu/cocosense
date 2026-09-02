import React, { useState } from 'react';
import { Radio, AlertTriangle, ShieldCheck, Activity, ChevronRight, Layers, Info, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface PestInfo {
  id: 'rhino-beetle' | 'red-palm-weevil' | 'trunk-anatomy';
  name: string;
  scientificName: string;
  filipinoName: string;
  threatLevel: 'CRITICAL' | 'HIGH';
  acousticFrequency: string;
  vibrationRange: string;
  damageStageDays: number;
  description: string;
  symptoms: string[];
  treatment: string[];
}

export const PEST_DATABASE: Record<string, PestInfo> = {
  'rhino-beetle': {
    id: 'rhino-beetle',
    name: 'Coconut Rhinoceros Beetle',
    scientificName: 'Oryctes rhinoceros (L.)',
    filipinoName: 'Uwang / Salagubang sa Niyog',
    threatLevel: 'CRITICAL',
    acousticFrequency: '280 Hz – 420 Hz',
    vibrationRange: '0.45g – 1.85g',
    damageStageDays: 14,
    description:
      'Adult beetles bore directly into the unopened spear cluster of coconut crowns, chewing fibrous vascular tissue and creating characteristic V-shaped frond notches upon expansion.',
    symptoms: [
      'Geometric V-shaped cuts on emerging coconut fronds',
      'Fibrous frass (chewed wood fibers) pushed out of boreholes',
      'Premature nut fall and central apical bud rot',
      'Acoustic bursts of 340 Hz during nighttime boring (18:00 - 04:00)',
    ],
    treatment: [
      'Install Oryctes pheromone bucket traps (Ethyl 4-methyloctanoate) at 1 trap per 2 hectares',
      'Apply Metarhizium majus green muscardine fungal spores to sawdust breeding heaps',
      'Deploy ASCOT bioacoustic piezoelectric sensor at 1.5m bole height for early pulse alert',
    ],
  },
  'red-palm-weevil': {
    id: 'red-palm-weevil',
    name: 'Red Palm Weevil',
    scientificName: 'Rhynchophorus ferrugineus (Olivier)',
    filipinoName: 'Uod sa Ubod / Bakukang',
    threatLevel: 'CRITICAL',
    acousticFrequency: '320 Hz – 540 Hz',
    vibrationRange: '0.35g – 1.40g',
    damageStageDays: 21,
    description:
      'Voracious grub larvae tunnel deep within the soft coconut trunk and crown tissue. Silent killer: trees often collapse suddenly before external visual symptoms appear.',
    symptoms: [
      'Viscous, fermented brown sap oozing from small trunk bore holes',
      'Audible gnawing sounds detectable by piezoelectric sensor within 1.2m radius',
      'Central crown wilting and asymmetric spear leaf collapse',
      'Internal pupal cocoons constructed from tough coconut fibers',
    ],
    treatment: [
      'Trunk micro-injection of systemic bio-pesticides or Azadirachtin (neem oil)',
      'Ferrolure+ aggregation pheromone lure traps along plantation perimeter',
      'Immediate quarantine and controlled incineration of fatally hollowed trunks',
    ],
  },
};

export const PestVisualizer: React.FC<{ defaultTab?: 'rhino-beetle' | 'red-palm-weevil' | 'trunk-anatomy' }> = ({
  defaultTab = 'rhino-beetle',
}) => {
  const [activeTab, setActiveTab] = useState<'rhino-beetle' | 'red-palm-weevil' | 'trunk-anatomy'>(defaultTab);
  const [activeWaveformMode, setActiveWaveformMode] = useState<'feeding' | 'ambient'>('feeding');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const currentPest = activeTab !== 'trunk-anatomy' ? PEST_DATABASE[activeTab] : null;

  return (
    <div className="rounded-xl bg-[#141414] border border-[#262626] shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-4 border-b border-[#262626] flex flex-wrap items-center justify-between gap-3 bg-[#0E0E0E]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[#16A34A]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Bioacoustic Pest Threat Visualizer
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#16A34A]/20 text-[#22C55E] border border-[#16A34A]/40">
                PCA &bull; ASCOT
              </span>
            </h3>
            <p className="text-xs text-[#808080]">
              Entomological profiles &amp; piezoelectric vibration signatures of coconut borers
            </p>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-lg border border-[#262626]">
          <button
            type="button"
            onClick={() => setActiveTab('rhino-beetle')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'rhino-beetle'
                ? 'bg-[#16A34A] text-black shadow-md'
                : 'text-[#808080] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <span>Rhinoceros Beetle</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('red-palm-weevil')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'red-palm-weevil'
                ? 'bg-[#16A34A] text-black shadow-md'
                : 'text-[#808080] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <span>Red Palm Weevil</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trunk-anatomy')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'trunk-anatomy'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-[#808080] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Trunk &amp; Sensor Cross-Section</span>
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Vector Showcase (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl bg-[#0A0A0A] border border-[#262626] p-5 relative overflow-hidden">
          {/* Subtle Grid / Background Accent */}
          <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

          {activeTab === 'rhino-beetle' && (
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Badge */}
              <div className="self-start mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F44336]/15 border border-[#F44336]/40 text-[#F44336] text-[10px] font-mono font-bold uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                Apex Canopy Threat &bull; Level 4
              </div>

              {/* Vector Illustration: Rhinoceros Beetle */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 relative my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_8px_24px_rgba(34,197,94,0.15)]" fill="none">
                  {/* Concentric Bioacoustic Radar Echoes */}
                  <circle cx="100" cy="100" r="85" stroke="#16A34A" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                  <circle cx="100" cy="100" r="65" stroke="#16A34A" strokeWidth="1.2" opacity="0.4" />
                  <circle cx="100" cy="100" r="45" stroke="#16A34A" strokeWidth="1.5" opacity="0.5" />

                  {/* 6 Beetle Legs */}
                  {/* Front Legs */}
                  <path d="M 75 70 L 40 45 L 30 35 M 30 35 L 26 40" stroke="#404040" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 125 70 L 160 45 L 170 35 M 170 35 L 174 40" stroke="#404040" strokeWidth="3" strokeLinecap="round" />
                  {/* Mid Legs */}
                  <path d="M 70 100 L 35 105 L 20 120 M 20 120 L 18 126" stroke="#404040" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 130 100 L 165 105 L 180 120 M 180 120 L 182 126" stroke="#404040" strokeWidth="3" strokeLinecap="round" />
                  {/* Rear Legs */}
                  <path d="M 75 130 L 45 155 L 35 175 M 35 175 L 32 182" stroke="#404040" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 125 130 L 155 155 L 165 175 M 165 175 L 168 182" stroke="#404040" strokeWidth="3" strokeLinecap="round" />

                  {/* Beetle Body / Elytra (Chitinous Wing Covers) */}
                  {/* Left Elytron */}
                  <path
                    d="M 100 85 C 96 85 70 95 68 140 C 66 168 85 180 100 185 Z"
                    fill="#1A1A1A"
                    stroke="#D4AF37"
                    strokeWidth="1.5"
                  />
                  {/* Right Elytron */}
                  <path
                    d="M 100 85 C 104 85 130 95 132 140 C 134 168 115 180 100 185 Z"
                    fill="#1F1F1F"
                    stroke="#D4AF37"
                    strokeWidth="1.5"
                  />
                  {/* Center Elytra Seam */}
                  <line x1="100" y1="85" x2="100" y2="185" stroke="#D4AF37" strokeWidth="1.5" />

                  {/* Elytra Texture Grooves (Punctures) */}
                  <path d="M 85 105 Q 83 140 88 165" stroke="#333333" strokeWidth="1" strokeDasharray="2 3" />
                  <path d="M 115 105 Q 117 140 112 165" stroke="#333333" strokeWidth="1" strokeDasharray="2 3" />

                  {/* Thorax / Pronotum (Shield) */}
                  <path
                    d="M 75 85 C 72 65 80 55 100 55 C 120 55 128 65 125 85 Z"
                    fill="#111111"
                    stroke="#D4AF37"
                    strokeWidth="2"
                  />
                  {/* Pronotum Horn indentation */}
                  <circle cx="100" cy="70" r="5" fill="#222222" stroke="#404040" strokeWidth="1" />

                  {/* Head */}
                  <path d="M 88 55 C 88 45 94 38 100 38 C 106 38 112 45 112 55 Z" fill="#0A0A0A" stroke="#404040" strokeWidth="1.5" />

                  {/* Signature Cephalic Horn (Curved up & back) */}
                  <path
                    d="M 98 42 Q 95 15 100 5 Q 104 18 102 42 Z"
                    fill="#D4AF37"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                  />
                  {/* Horn Apex Glow */}
                  <circle cx="100" cy="5" r="3" fill="#16A34A" className="animate-ping" opacity="0.75" />

                  {/* Antennae */}
                  <path d="M 90 45 L 78 38 M 78 38 L 72 40 M 78 38 L 74 34" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M 110 45 L 122 38 M 122 38 L 128 40 M 122 38 L 126 34" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="mt-1">
                <span className="text-base font-bold text-white tracking-wide">Oryctes rhinoceros</span>
                <span className="block text-xs text-[#D4AF37] font-serif italic mt-0.5">Asiatic Palm Rhinoceros Beetle</span>
              </div>
            </div>
          )}

          {activeTab === 'red-palm-weevil' && (
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="self-start mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F44336]/15 border border-[#F44336]/40 text-[#F44336] text-[10px] font-mono font-bold uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                Internal Trunk Borer &bull; Level 5
              </div>

              {/* Vector Illustration: Red Palm Weevil */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 relative my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_8px_24px_rgba(244,67,54,0.2)]" fill="none">
                  {/* Concentric Bioacoustic Radar Echoes */}
                  <circle cx="100" cy="100" r="85" stroke="#F44336" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                  <circle cx="100" cy="100" r="65" stroke="#F44336" strokeWidth="1.2" opacity="0.4" />

                  {/* 6 Weevil Legs */}
                  <path d="M 75 75 L 42 50 L 30 40" stroke="#505050" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 125 75 L 158 50 L 170 40" stroke="#505050" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 70 105 L 35 110 L 22 125" stroke="#505050" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 130 105 L 165 110 L 178 125" stroke="#505050" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 75 135 L 48 160 L 38 180" stroke="#505050" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 125 135 L 152 160 L 162 180" stroke="#505050" strokeWidth="3" strokeLinecap="round" />

                  {/* Weevil Elongated Oval Abdomen */}
                  <path
                    d="M 100 90 C 80 90 70 110 70 145 C 70 175 88 188 100 188 C 112 188 130 175 130 145 C 130 110 120 90 100 90 Z"
                    fill="#8B1E14"
                    stroke="#D4AF37"
                    strokeWidth="1.5"
                  />
                  {/* Elytra Line */}
                  <line x1="100" y1="90" x2="100" y2="188" stroke="#1A1A1A" strokeWidth="1.5" />
                  {/* Black Spots on Red Elytra */}
                  <circle cx="85" cy="130" r="4" fill="#1A1A1A" />
                  <circle cx="115" cy="130" r="4" fill="#1A1A1A" />
                  <circle cx="88" cy="155" r="3.5" fill="#1A1A1A" />
                  <circle cx="112" cy="155" r="3.5" fill="#1A1A1A" />

                  {/* Red/Orange Thoracic Shield with signature black markings */}
                  <path
                    d="M 80 90 C 76 70 84 58 100 58 C 116 58 124 70 120 90 Z"
                    fill="#C0392B"
                    stroke="#D4AF37"
                    strokeWidth="2"
                  />
                  {/* Thorax spots */}
                  <circle cx="92" cy="74" r="3.5" fill="#111111" />
                  <circle cx="108" cy="74" r="3.5" fill="#111111" />
                  <circle cx="100" cy="82" r="3" fill="#111111" />

                  {/* Elongated Curving Rostrum (Snout) */}
                  <path
                    d="M 98 58 Q 96 35 100 10 Q 104 35 102 58 Z"
                    fill="#1A1A1A"
                    stroke="#D4AF37"
                    strokeWidth="1"
                  />
                  {/* Elbowed Antennae projecting from midpoint of snout */}
                  <path d="M 98 32 L 80 22 L 72 26" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M 102 32 L 120 22 L 128 26" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="100" cy="10" r="3" fill="#F44336" className="animate-ping" opacity="0.8" />
                </svg>
              </div>

              <div className="mt-1">
                <span className="text-base font-bold text-white tracking-wide">Rhynchophorus ferrugineus</span>
                <span className="block text-xs text-[#F44336] font-serif italic mt-0.5">Red Palm Weevil</span>
              </div>
            </div>
          )}

          {activeTab === 'trunk-anatomy' && (
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="self-start mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-mono font-bold uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Piezo Tap &bull; 40mm Penetration
              </div>

              {/* Vector Illustration: Coconut Trunk & Sensor Cross Section */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 relative my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md" fill="none">
                  {/* Coconut Trunk Bole Section */}
                  <rect x="70" y="20" width="60" height="160" rx="6" fill="#2E1C0C" stroke="#D4AF37" strokeWidth="1.5" />
                  {/* Trunk Bark Rings */}
                  <line x1="70" y1="45" x2="130" y2="45" stroke="#1A0F06" strokeWidth="2" />
                  <line x1="70" y1="75" x2="130" y2="75" stroke="#1A0F06" strokeWidth="2" />
                  <line x1="70" y1="105" x2="130" y2="105" stroke="#1A0F06" strokeWidth="2" />
                  <line x1="70" y1="135" x2="130" y2="135" stroke="#1A0F06" strokeWidth="2" />
                  <line x1="70" y1="165" x2="130" y2="165" stroke="#1A0F06" strokeWidth="2" />

                  {/* Internal Xylem / Soft Heart tissue (Cutaway view) */}
                  <rect x="85" y="40" width="30" height="120" rx="3" fill="#D2B48C" opacity="0.3" stroke="#D4AF37" strokeWidth="1" strokeDasharray="3 3" />

                  {/* Larval Bore Tunnel inside heartwood */}
                  <path d="M 95 60 Q 105 85 92 110 Q 108 135 96 150" stroke="#8B0000" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 4" />
                  <circle cx="96" cy="150" r="4" fill="#F44336" />

                  {/* Piezoelectric Sensor Bolt (Inserted at 1.5m) */}
                  {/* Outer Sensor Enclosure */}
                  <rect x="25" y="95" width="28" height="20" rx="3" fill="#141414" stroke="#16A34A" strokeWidth="1.5" />
                  <circle cx="39" cy="105" r="3" fill="#16A34A" className="animate-pulse" />
                  {/* Steel Waveguide Probe Bolt penetrating 40mm into trunk */}
                  <rect x="53" y="103" width="36" height="4" fill="#D4AF37" stroke="#FFFFFF" strokeWidth="0.5" />

                  {/* Acoustic Soundwave Rings Radiating from Larva to Sensor */}
                  <path d="M 85 100 A 10 10 0 0 1 85 110" stroke="#22C55E" strokeWidth="2" fill="none" />
                  <path d="M 75 95 A 18 18 0 0 1 75 115" stroke="#22C55E" strokeWidth="2" fill="none" />
                  <path d="M 65 90 A 26 26 0 0 1 65 120" stroke="#22C55E" strokeWidth="2" fill="none" />

                  {/* LoRa Antenna on Sensor */}
                  <line x1="32" y1="95" x2="32" y2="70" stroke="#16A34A" strokeWidth="2" />
                  <circle cx="32" cy="70" r="2.5" fill="#22C55E" />
                </svg>
              </div>

              <div className="mt-1">
                <span className="text-base font-bold text-white tracking-wide">Acoustic Transducer Tap</span>
                <span className="block text-xs text-[#22C55E] font-mono mt-0.5">PZT-5H Piezo Ceramic Disk</span>
              </div>
            </div>
          )}

          {/* Quick Stat Pill in Left Box */}
          <div className="mt-4 pt-3 border-t border-[#262626] flex items-center justify-between text-xs font-mono">
            <span className="text-[#808080]">Larval Detection Speed:</span>
            <span className="font-bold text-[#16A34A]">Up to 21 Days Pre-Wilting</span>
          </div>
        </div>

        {/* Right Column: Bioacoustic Spectra & Actionable Specs (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {/* Scientific Bio Details */}
          {currentPest ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <h4 className="text-lg font-black text-white">{currentPest.name}</h4>
                  <span className="text-xs font-mono text-[#D4AF37] font-semibold">{currentPest.filipinoName}</span>
                </div>
                <p className="text-xs text-[#A0A0A0] leading-relaxed mt-1 font-light">{currentPest.description}</p>
              </div>

              {/* Bioacoustic Waveform Simulator */}
              <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#16A34A]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Acoustic Frequency Spectrum</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setActiveWaveformMode('feeding')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        activeWaveformMode === 'feeding'
                          ? 'bg-[#16A34A] text-black font-bold'
                          : 'bg-[#1A1A1A] text-[#808080]'
                      }`}
                    >
                      Larval Chewing (340Hz)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveWaveformMode('ambient')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        activeWaveformMode === 'ambient'
                          ? 'bg-[#D4AF37] text-black font-bold'
                          : 'bg-[#1A1A1A] text-[#808080]'
                      }`}
                    >
                      Wind / Rain (35Hz)
                    </button>
                  </div>
                </div>

                {/* SVG Frequency Visualizer */}
                <div className="h-16 w-full bg-[#111111] rounded-lg border border-[#262626] flex items-center justify-center p-2 relative overflow-hidden">
                  <svg viewBox="0 0 400 60" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#16A34A" />
                        <stop offset="50%" stopColor={activeWaveformMode === 'feeding' ? '#F44336' : '#D4AF37'} />
                        <stop offset="100%" stopColor="#16A34A" />
                      </linearGradient>
                    </defs>
                    {/* Zero Line */}
                    <line x1="0" y1="30" x2="400" y2="30" stroke="#262626" strokeWidth="1" strokeDasharray="4 4" />

                    {activeWaveformMode === 'feeding' ? (
                      /* High frequency spike bursts representing grubs crunching xylem */
                      <path
                        d="M 0 30 Q 20 28 40 30 Q 50 10 55 50 Q 60 5 65 55 Q 70 20 80 30 Q 120 30 140 30 Q 150 2 155 58 Q 160 8 165 52 Q 170 15 180 30 Q 240 30 250 8 Q 255 55 Q 260 4 265 56 Q 275 30 320 30 Q 340 12 345 48 Q 350 18 360 30 L 400 30"
                        fill="none"
                        stroke="url(#waveGrad)"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                    ) : (
                      /* Low frequency rolling wave representing ambient wind */
                      <path
                        d="M 0 30 Q 50 18 100 30 Q 150 42 200 30 Q 250 18 300 30 Q 350 42 400 30"
                        fill="none"
                        stroke="#D4AF37"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#808080] mt-1.5">
                  <span>Vibration Band: {currentPest.vibrationRange}</span>
                  <span className="text-[#16A34A] font-bold">FFT Peak: {currentPest.acousticFrequency}</span>
                </div>
              </div>

              {/* Symptoms & Action Protocols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#141414] border border-[#262626]">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-[#D4AF37]" /> Field Diagnostic Signs:
                  </span>
                  <ul className="space-y-1 text-xs text-[#A0A0A0]">
                    {currentPest.symptoms.slice(0, 2).map((sym, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#D4AF37] mt-0.5">&bull;</span>
                        <span>{sym}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-[#141414] border border-[#262626]">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#16A34A]" /> ASCOT Treatment Protocol:
                  </span>
                  <ul className="space-y-1 text-xs text-[#A0A0A0]">
                    {currentPest.treatment.slice(0, 2).map((t, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#16A34A] mt-0.5">&bull;</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            /* Trunk Anatomy Information */
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-black text-white">Piezoelectric Bioacoustic Transduction</h4>
                <p className="text-xs text-[#A0A0A0] leading-relaxed mt-1 font-light">
                  How ASCOT &amp; PCA hardware isolates wood-boring mastication pulses from ambient typhoon winds and rain.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
                  <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block">Waveguide Coupling</span>
                  <p className="text-xs text-[#808080]">
                    40mm surgical stainless steel probe anchors directly through fibrous outer bark into active xylem conduits.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
                  <span className="text-xs font-bold text-[#16A34A] uppercase tracking-wider block">Edge Bandpass Filter</span>
                  <p className="text-xs text-[#808080]">
                    On-node analog 200Hz–600Hz high-Q bandpass eliminates low-frequency leaf rustling and animal friction.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
                  <span className="text-xs font-bold text-[#22C55E] uppercase tracking-wider block">LoRa Mesh Routing</span>
                  <p className="text-xs text-[#808080]">
                    Vibration metrics broadcast via 433/915 MHz sub-GHz LoRa directly to Sector Master Nodes up to 3.5 km away.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">Early Treatment Window</span>
                  <p className="text-xs text-[#808080]">
                    Enables targeted biological pheromone trapping 2–3 weeks before canopy wilting and irreversible heart death.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
