import React, { useState } from 'react';
import { PestAlert } from '../types';
import { downloadTextWithHash } from '../utils/exportHash';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle, 
  Clock, 
  Radio, 
  ShieldCheck, 
  Filter, 
  Download, 
  Sparkles,
  Volume2
} from 'lucide-react';

interface AlertHistoryViewProps {
  alerts: PestAlert[];
  onResolveAlert: (id: number) => void;
  onClearAllReviewed: () => void;
}

export const AlertHistoryView: React.FC<AlertHistoryViewProps> = ({
  alerts,
  onResolveAlert,
  onClearAllReviewed,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'REVIEWED'>('ALL');

  const filteredAlerts = alerts.filter(a => {
    const pestName = a.pest || a.pestType || 'Unknown';
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (a.treeId ?? '').toLowerCase().includes(q) ||
      pestName.toLowerCase().includes(q) ||
      (a.sector ?? '').toLowerCase().includes(q);

    const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'UNRESOLVED' && !a.reviewed) ||
      (statusFilter === 'REVIEWED' && a.reviewed);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const exportAlertsCsv = async () => {
    const headers = ['Alert ID', 'Tree ID', 'Sector', 'Pest Type', 'Severity', 'Frequency Hz', 'Threat %', 'Timestamp', 'Reviewed'];
    const rows = filteredAlerts.map(a => [
      a.id,
      a.treeId,
      a.sector,
      `"${a.pest || a.pestType || 'Pest Anomaly'}"`,
      a.severity,
      a.frequencyHz,
      a.threatScore || 85,
      `"${a.createdAt || a.timestamp}"`,
      a.reviewed ? 'YES' : 'NO'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    await downloadTextWithHash('cocosense-pest-alerts.csv', csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-[#F44336]" />
            Bioacoustic Pest Alert Timeline
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Historical wood-boring pest events classified by Oryctes rhinoceros (Rhinoceros Beetle) vs Rhynchophorus ferrugineus (Red Palm Weevil).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportAlertsCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onClearAllReviewed}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-all"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Clear Reviewed</span>
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
            placeholder="Search by Tree ID, pest species, or sector..."
            className="w-full pl-10 pr-4 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-white placeholder:text-[#808080] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
            <option value="INFO">Info Only</option>
          </select>

          <div className="flex items-center rounded bg-[#0A0A0A] border border-[#262626] p-0.5">
            {(['ALL', 'UNRESOLVED', 'REVIEWED'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded text-xs font-semibold uppercase transition-all ${
                  statusFilter === st ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#808080] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Timeline List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="rounded bg-[#141414] border border-[#262626] p-12 text-center text-[#808080] space-y-2">
            <CheckCircle className="w-10 h-10 text-[#4CAF50] mx-auto" />
            <h3 className="font-bold text-white text-base">No Matching Pest Alerts</h3>
            <p className="text-xs max-w-sm mx-auto">
              All monitored coconut sectors in the current filter criteria are within nominal acoustic resonance ranges.
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCrit = alert.severity === 'CRITICAL';
            const isWarn = alert.severity === 'WARNING';

            return (
              <div
                key={alert.id}
                className={`rounded border p-5 shadow-lg transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  alert.reviewed
                    ? 'bg-[#101010] border-[#262626] opacity-60'
                    : isCrit
                    ? 'bg-[#1C1212] border-[#F44336]/40'
                    : isWarn
                    ? 'bg-[#1C1810] border-[#D4AF37]/40'
                    : 'bg-[#141414] border-[#262626]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-3 rounded flex-shrink-0 ${
                    isCrit ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30' : isWarn ? 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-base">{alert.treeId}</span>
                      <span className="text-xs text-[#808080] font-mono">{alert.sector}</span>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                        isCrit ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30' : 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30'
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.reviewed && (
                        <span className="px-2 py-0.5 rounded bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30 text-[10px] font-mono">
                          REVIEWED
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-[#E0E0E0] mt-1">
                      {alert.pest || alert.pestType || 'Pest Anomaly'} &middot; <span className="font-mono text-[#D4AF37]">{alert.frequencyHz} Hz acoustic vibration</span>
                    </div>
                    <div className="text-[11px] text-[#808080] font-mono mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{alert.createdAt || alert.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right font-mono">
                    <span className={`text-xl font-bold ${isCrit ? 'text-[#F44336]' : 'text-[#D4AF37]'}`}>
                      {alert.threatScore || (isCrit ? 92 : 55)}%
                    </span>
                    <div className="text-[9px] uppercase font-mono text-[#808080]">Threat Index</div>
                  </div>

                  {!alert.reviewed && (
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-md transition-all"
                    >
                      Mark Reviewed
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
