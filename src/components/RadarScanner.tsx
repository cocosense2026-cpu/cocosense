import React, { useState } from 'react';
import { MonitoredTree } from '../types';
import { Radio, Volume2, VolumeX, Pause, Play } from 'lucide-react';

interface RadarScannerProps {
  trees: MonitoredTree[];
  activeSector: string;
  onSelectTree?: (tree: MonitoredTree) => void;
  selectedTreeId?: string | null;
}

export const RadarScanner: React.FC<RadarScannerProps> = ({
  trees,
  activeSector,
  onSelectTree,
  selectedTreeId,
}) => {
  const [hoveredTree, setHoveredTree] = useState<MonitoredTree | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [activeFrequency, setActiveFrequency] = useState<number>(45);
  const [isScanning, setIsScanning] = useState<boolean>(false); // Stopped/Stationary by default as requested

  const sectorTrees = trees.filter(t => t.sector === activeSector || activeSector === 'All Sectors');
  const criticalCount = sectorTrees.filter(t => t.status === 'Active Infestation').length;
  const warningCount = sectorTrees.filter(t => t.status === 'Potential Infestation').length;
  const healthyCount = sectorTrees.filter(t => t.status === 'No Pests').length;

  // Web Audio API synthesizer simulation for bioacoustic larval chewing sound
  const playAudioTone = (freq: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = freq > 200 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
      setActiveFrequency(freq);
      setIsAudioPlaying(true);
      setTimeout(() => setIsAudioPlaying(false), 800);
    } catch {
      // Audio context might be restricted
    }
  };

  return (
    <div className="relative rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 overflow-hidden shadow-2xl">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"></div>

      {/* Top Header Controls */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-[#262626]">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-[#16A34A] animate-ping' : 'bg-[#D4AF37]'}`}></span>
          <div>
            <h3 className="text-xs uppercase tracking-widest font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#16A34A]" />
              Bioacoustic Radar Map &middot; {activeSector}
            </h3>
            <p className="text-[11px] text-[#808080] font-light mt-0.5">
              Vector coordinates &middot; {isScanning ? 'Live Sweep Active' : 'Static High-Precision View'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Pause/Play Radar & Audio Test */}
        <div className="flex items-center gap-2">
          {/* Radar Motion Toggle (Stopped by default) */}
          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
              isScanning
                ? 'bg-[#16A34A] text-black border-[#16A34A]'
                : 'bg-[#1A1A1A] text-white border-[#333333] hover:border-[#16A34A]'
            }`}
            title={isScanning ? 'Pause radar sweep animation' : 'Start radar sweep animation'}
          >
            {isScanning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#16A34A]" />}
            <span>{isScanning ? 'Radar Sweeping' : 'Radar Stopped'}</span>
          </button>

          {/* Audio Simulator */}
          <button
            type="button"
            onClick={() => {
              const testFreq = criticalCount > 0 ? 380 : 45;
              playAudioTone(testFreq);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-all"
            title="Simulate bioacoustic piezo acoustic pickup tone"
          >
            {isAudioPlaying ? <Volume2 className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" /> : <VolumeX className="w-3.5 h-3.5 opacity-70" />}
            <span>{isAudioPlaying ? 'Larva Pulse...' : 'Audio Test'}</span>
          </button>
        </div>
      </div>

      {/* Main Radar Screen Visualizer */}
      <div className="relative w-full aspect-square max-w-[420px] mx-auto my-2 rounded-full border-2 border-[#333333] bg-[#0A0A0A] overflow-hidden flex items-center justify-center shadow-[inset_0_0_50px_rgba(22,163,74,0.12)]">
        {/* Radar Concentric Green / Gold Rings */}
        <div className="absolute inset-8 rounded-full border border-[#16A34A]/25"></div>
        <div className="absolute inset-20 rounded-full border border-[#16A34A]/35"></div>
        <div className="absolute inset-32 rounded-full border border-[#16A34A]/45"></div>
        <div className="absolute inset-44 rounded-full border border-[#16A34A]/55"></div>

        {/* Coordinate Axis Lines */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-[#262626]"></div>
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#262626]"></div>
        <div className="absolute inset-0 rotate-45 border-t border-b border-[#262626]/40 pointer-events-none"></div>
        <div className="absolute inset-0 -rotate-45 border-l border-r border-[#262626]/40 pointer-events-none"></div>

        {/* Distance Range Markers */}
        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#808080] font-semibold">100m</span>
        <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#808080] font-semibold">75m</span>
        <span className="absolute top-20 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#808080] font-semibold">50m</span>
        <span className="absolute top-32 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#808080] font-semibold">25m</span>

        {/* Sweeper Beam (Only active when isScanning === true) */}
        {isScanning && (
          <div 
            className="absolute inset-0 origin-center pointer-events-none animate-radar-sweep"
          >
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-[#16A34A]/50 via-[#16A34A]/15 to-transparent transform -rotate-45 origin-bottom-right rounded-tl-full"></div>
          </div>
        )}

        {/* Central Master Node Hub */}
        <div className="absolute w-6 h-6 rounded-full bg-[#16A34A]/30 border-2 border-[#22C55E] flex items-center justify-center z-10">
          <div className="w-2 h-2 rounded-full bg-white"></div>
        </div>

        {/* Plotted Coconut Tree Points with Beetle & Palm Motifs */}
        {sectorTrees.map(tree => {
          const isSelected = selectedTreeId === tree.id;
          const isCrit = tree.status === 'Active Infestation';
          const isWarn = tree.status === 'Potential Infestation';

          return (
            <div
              key={tree.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group/dot"
              style={{ left: `${tree.x}%`, top: `${tree.y}%` }}
              onMouseEnter={() => {
                setHoveredTree(tree);
                playAudioTone(tree.vibrationFrequencyHz);
              }}
              onMouseLeave={() => setHoveredTree(null)}
              onClick={() => onSelectTree && onSelectTree(tree)}
            >
              {/* Pulse ring for pest infestation */}
              {isCrit && (
                <span className="absolute -inset-2.5 rounded-full bg-[#F44336] animate-ping opacity-75"></span>
              )}
              {isWarn && (
                <span className="absolute -inset-2 rounded-full bg-[#D4AF37] animate-pulse opacity-60"></span>
              )}

              {/* Tree Marker: Stylized Rhinoceros Beetle for critical pest, Palm node for healthy */}
              <div
                className={`relative w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  isCrit
                    ? 'bg-[#F44336] border-2 border-white shadow-[0_0_12px_rgba(244,67,54,0.9)] scale-110'
                    : isWarn
                    ? 'bg-[#D4AF37] border border-white shadow-[0_0_8px_rgba(212,175,55,0.8)]'
                    : 'bg-[#16A34A] border border-[#86EFAC] shadow-[0_0_6px_rgba(22,163,74,0.7)]'
                } group-hover/dot:scale-150 ${isSelected ? 'scale-150 ring-2 ring-white' : ''}`}
                title={`${tree.id} - ${tree.status}`}
              >
                {isCrit ? (
                  /* Miniature Beetle Silhouette */
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-black text-black">
                    <path d="M12 2L10 6H14L12 2ZM8 7C7.45 7 7 7.45 7 8V11H4V13H7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V13H20V11H17V8C17 7.45 16.55 7 16 7H8Z" />
                  </svg>
                ) : isWarn ? (
                  /* Miniature Warning Dot */
                  <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                ) : (
                  /* Miniature Coconut Palm Center Dot */
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hovered Tree Tooltip Box */}
      {hoveredTree && (
        <div className="mt-3 p-3.5 rounded-xl bg-[#0E0E0E] border border-[#262626] shadow-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${hoveredTree.status === 'Active Infestation' ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/40' : hoveredTree.status === 'Potential Infestation' ? 'bg-[#2B2B1B] text-[#D4AF37] border border-[#D4AF37]/40' : 'bg-[#1B2B1B] text-[#22C55E] border border-[#16A34A]/40'}`}>
              {hoveredTree.status === 'Active Infestation' ? (
                /* Beetle Icon */
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 2L10 6H14L12 2ZM8 7C7.45 7 7 7.45 7 8V11H4V13H7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V13H20V11H17V8C17 7.45 16.55 7 16 7H8Z" />
                </svg>
              ) : (
                /* Coconut Palm Icon */
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 2C11 5 8 7 5 7C7 9 10 9 11 11C11 15 11 18 10 22H14C13 18 13 15 13 11C14 9 17 9 19 7C16 7 13 5 12 2Z" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-xs">{hoveredTree.id}</span>
                <span className="text-[11px] text-[#A0A0A0]">Row {hoveredTree.row}, Col {hoveredTree.column}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${hoveredTree.status === 'Active Infestation' ? 'bg-[#F44336]/20 text-[#F44336] border border-[#F44336]/40' : 'bg-[#16A34A]/20 text-[#22C55E] border border-[#16A34A]/40'}`}>
                  {hoveredTree.pestDetected || hoveredTree.status}
                </span>
              </div>
              <p className="text-[11px] text-[#808080] mt-0.5">
                Owner: <strong className="text-white font-medium">{hoveredTree.ownerName}</strong> &middot; Sensor: {hoveredTree.piezoSensorId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-right">
            <div>
              <span className="text-[#808080] block text-[9px] uppercase tracking-wider">PULSE FREQ</span>
              <span className="font-bold text-[#16A34A]">{hoveredTree.vibrationFrequencyHz} Hz</span>
            </div>
            <div>
              <span className="text-[#808080] block text-[9px] uppercase tracking-wider">ACCEL</span>
              <span className="font-bold text-white">{hoveredTree.vibrationGrams} g</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Legend */}
      <div className="mt-4 pt-3 border-t border-[#262626] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[#E0E0E0]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></span>
            <span>Healthy Palms ({healthyCount})</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#D4AF37]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
            <span>Suspicious Vibration ({warningCount})</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#F44336] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F44336]"></span>
            <span>Active Beetle Borer ({criticalCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
