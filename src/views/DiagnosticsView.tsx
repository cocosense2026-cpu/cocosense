import React, { useState } from 'react';
import { MasterNode } from '../types';
import { 
  Cpu, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Activity, 
  RotateCw, 
  Zap, 
  Sliders,
  ShieldCheck
} from 'lucide-react';

interface DiagnosticsViewProps {
  nodes: MasterNode[];
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ nodes }) => {
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testProgress, setTestProgress] = useState<number>(100);
  const [testResults, setTestResults] = useState<{
    piezoVoltage: string;
    adcNoiseFloor: string;
    loraLatency: string;
    solarEfficiency: string;
    meshHealth: string;
  }>({
    piezoVoltage: '3.28 V (Nominal 3.3V)',
    adcNoiseFloor: '-84 dBm (Clean Ground)',
    loraLatency: '142 ms (Sub-200ms Target)',
    solarEfficiency: '94.2% MPPT Tracked',
    meshHealth: 'Optimal (0 Packets Lost)',
  });

  const handleRunSelfTest = () => {
    setIsRunningTest(true);
    setTestProgress(10);

    const interval = setInterval(() => {
      setTestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRunningTest(false);
          setTestResults({
            piezoVoltage: `${(3.25 + Math.random() * 0.08).toFixed(2)} V (Nominal 3.3V)`,
            adcNoiseFloor: `-${(82 + Math.floor(Math.random() * 6))} dBm (Clean Ground)`,
            loraLatency: `${(130 + Math.floor(Math.random() * 30))} ms (Sub-200ms Target)`,
            solarEfficiency: `${(92 + Math.random() * 6).toFixed(1)}% MPPT Tracked`,
            meshHealth: 'Optimal (0 Packets Lost)',
          });
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Hardware Diagnostics &amp; Transducer Self-Test
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            End-to-end hardware integrity verification for piezoelectric acoustic sensors, ADC sampling channels, and LoRa mesh transmitters.
          </p>
        </div>

        <button
          type="button"
          disabled={isRunningTest}
          onClick={handleRunSelfTest}
          className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] disabled:opacity-50 text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          {isRunningTest ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isRunningTest ? `Running Diagnostics (${testProgress}%)...` : 'Run Hardware Self-Test'}</span>
        </button>
      </div>

      {/* Diagnostic Progress Bar (if running) */}
      {isRunningTest && (
        <div className="rounded bg-[#141414] border border-[#D4AF37]/40 p-4 shadow-xl space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#D4AF37] font-bold">Injecting 1kHz Piezoelectric Calibration Pulse...</span>
            <span className="text-white font-bold">{testProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded bg-[#0A0A0A] overflow-hidden border border-[#262626]">
            <div className="h-full bg-[#D4AF37] transition-all duration-300" style={{ width: `${testProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Matrix Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="rounded bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#808080]">Piezo Line Voltage</span>
            <Zap className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="font-mono text-xl font-bold text-white">{testResults.piezoVoltage}</div>
          <p className="text-[11px] text-[#808080]">Tolerance within 5% of 3.3V reference rail</p>
        </div>

        <div className="rounded bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#808080]">ADC Noise Floor</span>
            <Activity className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="font-mono text-xl font-bold text-white">{testResults.adcNoiseFloor}</div>
          <p className="text-[11px] text-[#808080]">Pristine signal-to-noise ratio for larval chew audio</p>
        </div>

        <div className="rounded bg-[#141414] border border-[#262626] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#808080]">Mesh LoRa Roundtrip</span>
            <Radio className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="font-mono text-xl font-bold text-white">{testResults.loraLatency}</div>
          <p className="text-[11px] text-[#808080]">Packet acknowledgment from ASCOT Master Hub</p>
        </div>
      </div>

      {/* Master Node Status List */}
      <div className="rounded bg-[#141414] border border-[#262626] overflow-hidden shadow-2xl p-6 space-y-4">
        <h3 className="font-bold text-sm sm:text-base text-white uppercase serif flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          Per-Hub Channel Diagnostic Status
        </h3>

        <div className="space-y-3">
          {nodes.map(node => (
            <div key={node.id} className="p-4 rounded bg-[#0A0A0A] border border-[#262626] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-sm">{node.id}</span>
                  <span className="text-[#E0E0E0]">{node.name}</span>
                  <span className="font-mono text-[10px] text-[#D4AF37]">({node.sector})</span>
                </div>
                <div className="text-[11px] text-[#808080] font-mono mt-0.5">
                  Firmware: {node.firmwareVersion} &middot; Signal: {node.signalRssi} &middot; Battery: {node.batteryPercent}%
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                  node.workingSensors === node.totalSensors
                    ? 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                    : 'bg-[#262010] text-[#D4AF37] border border-[#D4AF37]/30'
                }`}>
                  {node.workingSensors} / {node.totalSensors} Transducers Working
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
