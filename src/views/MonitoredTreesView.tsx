import React, { useState } from 'react';
import { MonitoredTree } from '../types';
import { downloadTextWithHash } from '../utils/exportHash';
import { 
  Trees, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  Radio, 
  Volume2, 
  VolumeX, 
  X, 
  ShieldCheck, 
  Sliders,
  ExternalLink,
  Sparkles,
  Download
} from 'lucide-react';

interface MonitoredTreesViewProps {
  trees: MonitoredTree[];
  onInspectTree: (tree: MonitoredTree) => void;
  onUpdateTreeStatus: (treeId: string, status: MonitoredTree['status']) => void;
}

export const MonitoredTreesView: React.FC<MonitoredTreesViewProps> = ({
  trees,
  onInspectTree,
  onUpdateTreeStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');
  const [sectorFilter, setSectorFilter] = useState<string>('All Sectors');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [inspectedTree, setInspectedTree] = useState<MonitoredTree | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const filteredTrees = trees.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.piezoSensorId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All Statuses' || t.status === statusFilter;
    const matchesSector = sectorFilter === 'All Sectors' || t.sector === sectorFilter;

    return matchesSearch && matchesStatus && matchesSector;
  });

  const playSynthesizedAcousticTone = (freq: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = freq > 200 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 1200);
    } catch {
      // Audio context might be restricted
    }
  };

  const exportTreesCsv = async () => {
    const headers = ['Tree ID', 'Owner', 'Sector', 'Row', 'Column', 'Status', 'Threat Score %', 'Resonance Hz', 'Vibration g', 'Sensor ID'];
    const rows = filteredTrees.map(t => [
      t.id,
      `"${t.ownerName}"`,
      t.sector,
      t.row,
      t.column,
      t.status,
      t.threatScore,
      t.vibrationFrequencyHz,
      t.vibrationGrams,
      t.piezoSensorId
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    await downloadTextWithHash('cocosense-monitored-trees.csv', csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Trees className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Monitored Coconut Palms &amp; Bioacoustic Sensors
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Real-time piezoelectric vibration telemetry across 12,450 palms. Acoustic signals between 120Hz-600Hz indicate larval boring.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportTreesCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded bg-[#141414] border border-[#262626] shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tree ID (e.g., TR-1048), sensor ID, owner, or sector..."
            className="w-full pl-10 pr-4 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-white placeholder:text-[#808080] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="All Statuses">All Health Statuses</option>
            <option value="No Pests">No Pests (Healthy)</option>
            <option value="Potential Infestation">Potential Infestation</option>
            <option value="Active Infestation">Active Infestation (Critical)</option>
          </select>

          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="All Sectors">All Sectors</option>
            <option value="Sector Alpha">Sector Alpha</option>
            <option value="Sector Bravo">Sector Bravo</option>
            <option value="Sector Charlie">Sector Charlie</option>
            <option value="Sector Delta">Sector Delta</option>
            <option value="Sector Echo">Sector Echo</option>
          </select>

          <div className="flex items-center rounded bg-[#0A0A0A] border border-[#262626] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                viewMode === 'grid' ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#808080] hover:text-white'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#808080] hover:text-white'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrees.map(tree => {
            const isCrit = tree.status === 'Active Infestation';
            const isWarn = tree.status === 'Potential Infestation';

            const statusClass = isCrit
              ? 'bg-[#1C1212] border-[#F44336]/40 hover:border-[#F44336]'
              : isWarn
              ? 'bg-[#1C1810] border-[#D4AF37]/40 hover:border-[#D4AF37]'
              : 'bg-[#141414] border-[#262626] hover:border-[#D4AF37]/50';

            return (
              <div
                key={tree.id}
                className={`rounded border p-5 shadow-xl transition-all cursor-pointer group space-y-4 ${statusClass}`}
                onClick={() => {
                  setInspectedTree(tree);
                  playSynthesizedAcousticTone(tree.vibrationFrequencyHz);
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {isCrit ? (
                        <div className="p-1 rounded bg-[#F44336]/20 text-[#F44336] border border-[#F44336]/40">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                            <path d="M12 2L10 6H14L12 2ZM8 7C7.45 7 7 7.45 7 8V11H4V13H7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V13H20V11H17V8C17 7.45 16.55 7 16 7H8Z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="p-1 rounded bg-[#16A34A]/20 text-[#22C55E] border border-[#16A34A]/40">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                            <path d="M12 2C11 5 8 7 5 7C7 9 10 9 11 11C11 15 11 18 10 22H14C13 18 13 15 13 11C14 9 17 9 19 7C16 7 13 5 12 2Z" />
                          </svg>
                        </div>
                      )}
                      <span className="font-mono font-bold text-base sm:text-lg text-white group-hover:text-[#16A34A] transition-colors">
                        {tree.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                        isCrit ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30' : isWarn ? 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                      }`}>
                        {tree.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#808080] mt-1 font-mono">
                      {tree.sector} &middot; Row {tree.row}, Col {tree.column}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`font-mono text-xl font-bold ${isCrit ? 'text-[#F44336]' : isWarn ? 'text-[#D4AF37]' : 'text-[#4CAF50]'}`}>
                      {tree.threatScore}%
                    </span>
                    <div className="text-[9px] uppercase font-mono text-[#808080]">Threat</div>
                  </div>
                </div>

                {/* Telemetry Metric pill */}
                <div className="grid grid-cols-2 gap-2 bg-[#0A0A0A] p-3 rounded border border-[#262626] font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-[#808080] block uppercase">Bioacoustic Freq</span>
                    <span className="font-bold text-[#D4AF37]">{tree.vibrationFrequencyHz} Hz</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#808080] block uppercase">Vibration</span>
                    <span className="font-bold text-[#E0E0E0]">{tree.vibrationGrams} g</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[11px] text-[#808080]">
                  <span>Owner: <strong className="text-[#E0E0E0]">{tree.ownerName}</strong></span>
                  <span className="text-[#D4AF37] font-semibold group-hover:underline flex items-center gap-1">
                    Inspect Palm &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="rounded bg-[#141414] border border-[#262626] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[#0E0E0E] border-b border-[#262626] text-[#808080] font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Tree ID &amp; Sector</th>
                  <th className="py-3.5 px-4">Owner Name</th>
                  <th className="py-3.5 px-4">Health Status</th>
                  <th className="py-3.5 px-4">Bioacoustic Frequency</th>
                  <th className="py-3.5 px-4">Vibration (g)</th>
                  <th className="py-3.5 px-4">Threat Score</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredTrees.map(tree => (
                  <tr key={tree.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-mono font-bold text-white text-sm">{tree.id}</div>
                      <div className="text-[11px] text-[#808080] font-mono">{tree.sector} &middot; Row {tree.row}, Col {tree.column}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-[#E0E0E0]">{tree.ownerName}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                        tree.status === 'Active Infestation'
                          ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                          : tree.status === 'Potential Infestation'
                          ? 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30'
                          : 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                      }`}>
                        {tree.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-[#D4AF37]">{tree.vibrationFrequencyHz} Hz</td>
                    <td className="py-4 px-4 font-mono font-bold text-[#E0E0E0]">{tree.vibrationGrams} g</td>
                    <td className="py-4 px-4 font-mono font-bold">
                      <span className={tree.threatScore > 70 ? 'text-[#F44336]' : 'text-[#4CAF50]'}>
                        {tree.threatScore}%
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedTree(tree);
                          playSynthesizedAcousticTone(tree.vibrationFrequencyHz);
                        }}
                        className="px-3 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tree Inspection Modal */}
      {inspectedTree && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded bg-[#141414] border border-[#262626] p-6 md:p-8 shadow-2xl my-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded bg-[#0A0A0A] border border-[#262626] text-[#D4AF37]">
                  <Trees className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase serif flex items-center gap-2">
                    Palm Telemetry: {inspectedTree.id}
                  </h3>
                  <p className="text-xs text-[#808080]">
                    {inspectedTree.sector} &middot; Row {inspectedTree.row}, Col {inspectedTree.column} &middot; Owner: {inspectedTree.ownerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTree(null)}
                className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Acoustic Audio & Frequency Analyzer */}
            <div className="p-5 rounded bg-[#0A0A0A] border border-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Bioacoustic Resonance Spectrogram
                </span>
                <button
                  type="button"
                  onClick={() => playSynthesizedAcousticTone(inspectedTree.vibrationFrequencyHz)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider shadow-md hover:bg-[#E5C158]"
                >
                  {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5 animate-bounce" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{isPlayingAudio ? 'Acoustic Playback...' : 'Play Sensor Audio'}</span>
                </button>
              </div>

              {/* Simulated Audio Waveform */}
              <div className="h-16 flex items-end justify-between gap-1 p-2 rounded bg-[#0E0E0E] border border-[#262626]">
                {[40, 65, 80, 45, 90, 75, 60, 85, 95, 70, 50, 60, 78, 92, 45, 88, 70, 60, 40, 50].map((h, i) => (
                  <div
                    key={i}
                    className={`w-full rounded-t transition-all ${
                      inspectedTree.status === 'Active Infestation' ? 'bg-[#F44336]' : 'bg-[#D4AF37]'
                    }`}
                    style={{ height: `${inspectedTree.status === 'Active Infestation' ? h : h * 0.3}%` }}
                  ></div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-xs text-center pt-2">
                <div className="p-2 rounded bg-[#141414] border border-[#262626]">
                  <span className="text-[#808080] text-[10px] block uppercase">PEAK FREQ</span>
                  <span className="font-bold text-[#D4AF37]">{inspectedTree.vibrationFrequencyHz} Hz</span>
                </div>
                <div className="p-2 rounded bg-[#141414] border border-[#262626]">
                  <span className="text-[#808080] text-[10px] block uppercase">ACCELERATION</span>
                  <span className="font-bold text-[#E0E0E0]">{inspectedTree.vibrationGrams} g</span>
                </div>
                <div className="p-2 rounded bg-[#141414] border border-[#262626]">
                  <span className="text-[#808080] text-[10px] block uppercase">THREAT SCORE</span>
                  <span className={`font-bold ${inspectedTree.threatScore > 70 ? 'text-[#F44336]' : 'text-[#4CAF50]'}`}>
                    {inspectedTree.threatScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Intervention Actions */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#808080]">
                Agronomic Field Interventions &amp; Status Override
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTreeStatus(inspectedTree.id, 'No Pests');
                    setInspectedTree({ ...inspectedTree, status: 'No Pests', threatScore: 8, vibrationFrequencyHz: 45, vibrationGrams: 0.1 });
                  }}
                  className="py-2.5 px-3 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#4CAF50]/40 text-[#4CAF50] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark Pest-Free</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTreeStatus(inspectedTree.id, 'Potential Infestation');
                    setInspectedTree({ ...inspectedTree, status: 'Potential Infestation', threatScore: 50, vibrationFrequencyHz: 280 });
                  }}
                  className="py-2.5 px-3 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Flag Warning</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTreeStatus(inspectedTree.id, 'Active Infestation');
                    setInspectedTree({ ...inspectedTree, status: 'Active Infestation', threatScore: 92, vibrationFrequencyHz: 480, vibrationGrams: 1.1 });
                  }}
                  className="py-2.5 px-3 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#F44336]/40 text-[#F44336] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm Infestation</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#262626] flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedTree(null)}
                className="px-5 py-2 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
