import React from 'react';
import { downloadTextWithHash } from '../utils/exportHash';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const exportFullReport = async () => {
    const reportContent = `COCOSENSE BIOACOUSTIC TELEMETRY AUDIT REPORT
Generated: ${new Date().toLocaleString()}
Institution: Aurora State College of Technology (ASCOT) & PCA Quezon

1. EXECUTIVE SUMMARY:
- Total Monitored Palms: 12,450
- Active Master Nodes: 5 (98.4% Uptime)
- Piezoelectric Acoustic Transducers: 20 (4 per Master Node: A0-A3)
- Confirmed Pest Infestations: 1 (Tree TR-1048, Sector Alpha, 88% Threat)
- Early Detection Lead Time: 19.4 Days average prior to visual frond damage

2. SECTOR BREAKDOWN:
- Sector Alpha: 3,420 trees (1 Active, 1 Warning)
- Sector Bravo: 2,280 trees (0 Active, 0 Warning)
- Sector Charlie: 2,850 trees (0 Active, 1 Warning)
- Sector Delta (ASCOT): 2,760 trees (0 Active, 0 Warning)
- Sector Echo: 1,140 trees (0 Active, 0 Warning)

3. PHYTOPATHOLOGY FINDINGS:
Acoustic signatures matching 345 Hz - 480 Hz indicate Oryctes rhinoceros (Coconut Rhinoceros Beetle) larval boring. Biocontrol (Metarhizium anisopliae fungus / Oryctes virus) recommended for Sector Alpha.
`;
    await downloadTextWithHash('cocosense-bioacoustic-audit.txt', reportContent, 'text/plain;charset=utf-8', '--');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Bioacoustic Monitoring Reports &amp; Analytics
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Aggregated pest pressure indices, acoustic frequency distributions, and Philippine Coconut Authority (PCA) compliance records.
          </p>
        </div>

        <button
          type="button"
          onClick={exportFullReport}
          className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Download Audit Summary</span>
        </button>
      </div>

      {/* Monthly Pest Pressure Chart Visualizer */}
      <div className="rounded bg-[#141414] border border-[#262626] p-6 md:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white uppercase serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              6-Month Pest Pressure &amp; Early Detection Index
            </h3>
            <p className="text-xs text-[#808080]">Monthly acoustic vibration spikes vs treated tree recoveries</p>
          </div>
          <span className="font-mono text-xs text-[#D4AF37] font-bold">94.2% Control Rate</span>
        </div>

        {/* CSS Bar Chart */}
        <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-4 bg-[#0A0A0A] rounded border border-[#262626]">
          {[
            { month: 'Sep', alerts: 14, healthy: 95 },
            { month: 'Oct', alerts: 22, healthy: 92 },
            { month: 'Nov', alerts: 38, healthy: 86 },
            { month: 'Dec', alerts: 18, healthy: 96 },
            { month: 'Jan', alerts: 9, healthy: 98 },
            { month: 'Feb', alerts: 4, healthy: 99 },
          ].map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                <div
                  className="w-1/2 bg-[#F44336]/80 rounded-t transition-all hover:bg-[#F44336]"
                  style={{ height: `${(m.alerts / 40) * 100}%` }}
                  title={`${m.month} Pest Alerts: ${m.alerts}`}
                ></div>
                <div
                  className="w-1/2 bg-[#D4AF37]/80 rounded-t transition-all hover:bg-[#D4AF37]"
                  style={{ height: `${m.healthy}%` }}
                  title={`${m.month} Healthy Index: ${m.healthy}%`}
                ></div>
              </div>
              <span className="font-mono text-xs text-[#808080] font-semibold">{m.month}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F44336]"></span>
            <span className="text-[#808080]">Pest Vibrations Detected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
            <span className="text-[#808080]">Palms Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
