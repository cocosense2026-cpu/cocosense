import React, { useState, useMemo } from 'react';
import { MonitoredTree, FarmOwner, MasterNode, PestAlert, VibrationEvent } from '../types';
import { FarmOwnersMap } from '../components/FarmOwnersMap';
import { BrandLogo } from '../components/BrandLogo';
import { PestVisualizer } from '../components/PestVisualizer';
import { 
  Trees, 
  ShieldCheck, 
  Radio, 
  Activity, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus, 
  ChevronRight,
  Sparkles,
  MapPin
} from 'lucide-react';

interface DashboardViewProps {
  trees: MonitoredTree[];
  owners: FarmOwner[];
  nodes: MasterNode[];
  alerts: PestAlert[];
  vibrationEvents: VibrationEvent[];
  onNavigate: (view: any) => void;
  onSelectTree: (tree: MonitoredTree) => void;
  onResolveAlert: (alertId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  trees,
  owners,
  nodes,
  alerts,
  vibrationEvents,
  onNavigate,
  onSelectTree,
  onResolveAlert,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('All Sectors');

  const sectorFilterOptions = useMemo(
    () => ['All Sectors', ...Array.from(new Set(owners.map(o => o.sector))).sort()],
    [owners]
  );
  const sectorFilteredOwners = useMemo(
    () => (selectedSector === 'All Sectors' ? owners : owners.filter(o => o.sector === selectedSector)),
    [owners, selectedSector]
  );

  const totalTrees = 12450;
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.reviewed);
  const activeInfestedTrees = trees.filter(t => t.status === 'Active Infestation').length;
  const nodesOnline = nodes.filter(n => n.online).length;
  const totalSensors = nodes.reduce((acc, n) => acc + n.totalSensors, 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Welcome Banner with Brand Lockup & Coconut Telemetry Accents */}
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
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold text-[#16A34A] tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
                  ASCOT AGRO-FORESTRY &middot; QUEZON COCONUT MESH
                </span>
                <span className="text-[11px] text-[#808080] font-mono">Bioacoustic LoRa Mesh v2.4</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight uppercase font-sans">
                Plantation Telemetry &amp; Bioacoustics
              </h1>
              <p className="text-xs sm:text-sm text-[#A0A0A0] leading-relaxed font-light">
                Continuous bioacoustic monitoring of 12,450 coconut palms. Piezoelectric acoustic sensors detect internal wood-boring vibrations (Rhinoceros Beetle &amp; Red Palm Weevil) up to 21 days before visual canopy wilting occurs.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('owners')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#16A34A]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Farm Owner</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('trees')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0] font-semibold text-xs transition-all"
            >
              <Trees className="w-4 h-4 text-[#16A34A]" />
              <span>Tree Registry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert Warning Bar (if critical alerts exist) */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#F44336] text-black shadow-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 font-bold text-[#FFCDD2] text-xs sm:text-sm">
                <span>{criticalAlerts.length} Critical Bioacoustic Pest Alerts Detected</span>
                <span className="px-2 py-0.5 rounded bg-[#141414] text-[#F44336] text-[10px] font-mono border border-[#F44336]/40">
                  BEETLE ACTIVITY DETECTED
                </span>
              </div>
              <p className="text-xs text-[#E0E0E0]/80 mt-0.5">
                Tree <strong>{criticalAlerts[0].treeId}</strong> ({criticalAlerts[0].sector}) recorded <strong>{criticalAlerts[0].frequencyHz}Hz</strong> vibration pulse exceeding safety threshold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onResolveAlert(criticalAlerts[0].id)}
              className="flex-1 md:flex-initial px-4 py-2 rounded-lg bg-[#F44336] hover:bg-[#D32F2F] text-white font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Mark Investigated
            </button>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="flex-1 md:flex-initial px-4 py-2 rounded-lg bg-[#141414] hover:bg-[#1A1A1A] border border-[#404040] text-[#E0E0E0] text-xs font-semibold"
            >
              View Alerts
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Telemetry Stat Cards Grid with Coconut & Beetle Motifs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Monitored Trees */}
        <div 
          onClick={() => onNavigate('trees')}
          className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-lg hover:border-[#16A34A]/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#808080]">Total Monitored Palms</span>
            <div className="p-2.5 rounded-lg bg-[#1A1A1A] text-[#16A34A] border border-[#262626]">
              {/* Coconut Palm Icon */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M12 2C11 5 8 7 5 7C7 9 10 9 11 11C11 15 11 18 10 22H14C13 18 13 15 13 11C14 9 17 9 19 7C16 7 13 5 12 2Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl sm:text-3xl font-black text-white tracking-tight">
            {totalTrees.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#808080]">
            <span>+150 added this month</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#16A34A]" />
          </div>
        </div>

        {/* Active Pest Alerts (Rhinoceros Beetle / Weevil) */}
        <div 
          onClick={() => onNavigate('alerts')}
          className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-lg hover:border-[#F44336]/60 transition-all cursor-pointer group relative overflow-hidden"
        >
          {criticalAlerts.length > 0 && (
            <span className="absolute top-3 right-3 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F44336] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F44336]"></span>
            </span>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#808080]">Active Beetle Alerts</span>
            <div className="p-2.5 rounded-lg bg-[#1A1A1A] text-[#F44336] border border-[#262626]">
              {/* Beetle Silhouette Icon */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M12 2L10 6H14L12 2ZM8 7C7.45 7 7 7.45 7 8V11H4V13H7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V13H20V11H17V8C17 7.45 16.55 7 16 7H8Z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl sm:text-3xl font-black text-[#F44336] tracking-tight">
            {alerts.length}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#808080]">
            <span>{criticalAlerts.length} Critical Infestations</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#F44336]" />
          </div>
        </div>

        {/* Flagged Infected Trees */}
        <div 
          onClick={() => onNavigate('trees')}
          className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-lg hover:border-[#16A34A]/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#808080]">Protected Palms</span>
            <div className="p-2.5 rounded-lg bg-[#1A1A1A] text-[#16A34A] border border-[#262626]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl sm:text-3xl font-black text-white tracking-tight">
            {(totalTrees - activeInfestedTrees).toLocaleString()}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#808080]">
            <span>99.8% Healthy Canopy</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#16A34A]" />
          </div>
        </div>

        {/* Master Node Mesh Health */}
        <div 
          onClick={() => onNavigate('nodes')}
          className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-lg hover:border-[#16A34A]/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#808080]">Node Mesh Online</span>
            <div className="p-2.5 rounded-lg bg-[#1A1A1A] text-[#16A34A] border border-[#262626]">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl sm:text-3xl font-black text-white tracking-tight">
            {nodesOnline} <span className="text-sm font-normal text-[#808080]">/ {nodes.length}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#808080]">
            <span>{totalSensors} Transducers</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#16A34A]" />
          </div>
        </div>
      </div>

      {/* Main Split: Farm Owner Location Map (Left) & Real-time Vibration Telemetry Stream (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Farm Owner Map Section */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#16A34A]" />
              Farm Owner Locations
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {sectorFilterOptions.map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSector(sec)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedSector === sec
                      ? 'bg-[#16A34A] text-black font-bold'
                      : 'bg-[#141414] text-[#808080] hover:text-white border border-[#262626]'
                  }`}
                >
                  {sec.replace('Sector ', '')}
                </button>
              ))}
            </div>
          </div>

          <FarmOwnersMap
            owners={sectorFilteredOwners}
            onViewOwner={() => onNavigate('owners')}
          />
          <p className="text-[11px] text-[#606060] px-1">
            Pins mark each registered farm's address. Click a pin to see the owner and exact
            location, or "View Farm Owner" to open their full profile.
          </p>
        </div>

        {/* Real-Time Vibration Telemetry Stream & Recent Anomaly Log */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#16A34A]" />
              Vibration Telemetry
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-bold text-[#16A34A] hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
            <div className="space-y-2.5">
              {vibrationEvents.map(evt => {
                const isCrit = evt.severity === 'Critical';
                const isWarn = evt.severity === 'Warning';

                return (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                      isCrit
                        ? 'bg-[#2B1B1B] border-[#F44336]/40 text-[#FFCDD2]'
                        : isWarn
                        ? 'bg-[#2B2B1B] border-[#D4AF37]/40 text-[#FFF9C4]'
                        : 'bg-[#1A1A1A] border-[#262626] text-[#E0E0E0]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-md flex-shrink-0 ${isCrit ? 'bg-[#F44336] text-white' : isWarn ? 'bg-[#D4AF37] text-black' : 'bg-[#141414] text-[#A0A0A0] border border-[#333333]'}`}>
                        {isCrit ? (
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                            <path d="M12 2L10 6H14L12 2ZM8 7C7.45 7 7 7.45 7 8V11H4V13H7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V13H20V11H17V8C17 7.45 16.55 7 16 7H8Z" />
                          </svg>
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white">{evt.treeId}</span>
                          <span className="text-[11px] text-[#808080] truncate">{evt.sector}</span>
                        </div>
                        <div className="text-[11px] text-[#808080] flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[#16A34A] font-bold">{evt.frequencyHz} Hz</span>
                          <span>&middot;</span>
                          <span className="font-mono text-[#E0E0E0]">{evt.grams} g</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isCrit ? 'bg-[#141414] text-[#F44336] border border-[#F44336]/40' : isWarn ? 'bg-[#141414] text-[#D4AF37] border border-[#D4AF37]/40' : 'bg-[#141414] text-[#808080] border border-[#333333]'
                      }`}>
                        {evt.severity}
                      </span>
                      <div className="text-[10px] text-[#808080] font-mono mt-1">{evt.timestamp}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Diagnostic self-test CTA */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-xs">
              <span className="text-[#808080]">Sampling: <strong className="text-white font-mono">1,000 Hz</strong></span>
              <button
                type="button"
                onClick={() => onNavigate('diagnostics')}
                className="font-bold text-[#16A34A] hover:underline"
              >
                Diagnostic Test &rarr;
              </button>
            </div>
          </div>

          {/* Quick Farm Owners Summary */}
          <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-widest text-[#808080]">Managed Plantations ({owners.length})</h3>
              <button
                type="button"
                onClick={() => onNavigate('owners')}
                className="text-xs font-bold text-[#16A34A] hover:underline uppercase tracking-wider"
              >
                Directory
              </button>
            </div>

            <div className="space-y-2">
              {owners.slice(0, 3).map(o => (
                <div key={o.id} className="p-2.5 rounded-lg bg-[#1A1A1A] border border-[#262626] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0" style={{ backgroundColor: o.color }}>
                      {o.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{o.name}</div>
                      <div className="text-[10px] text-[#808080] truncate">{o.cityMunicipality}, {o.province}</div>
                    </div>
                  </div>
                  <div className="text-right font-mono flex-shrink-0">
                    <span className="font-bold text-[#16A34A]">{o.nodesCount} Nodes</span>
                    <div className="text-[10px] text-[#808080]">{o.treesCount.toLocaleString()} palms</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entomological Pest Visualizer & Trunk Bioacoustic Anatomy */}
      <div className="mt-8">
        <PestVisualizer defaultTab="rhino-beetle" />
      </div>
    </div>
  );
};
