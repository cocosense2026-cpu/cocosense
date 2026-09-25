import React, { useMemo, useState } from 'react';
import { FarmOwner } from '../types';
import { PHILIPPINES_PSGC_DATA } from '../data/mockData';
import { FarmOwnersMap } from '../components/FarmOwnersMap';
import { usePasswordProtectedExport } from '../hooks/usePasswordProtectedExport';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { DecryptedPreviewModal } from '../components/DecryptedPreviewModal';
import {
  MapPin,
  Users,
  Building2,
  LayoutGrid,
  Download,
  Upload,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface MunicipalityMapViewProps {
  owners: FarmOwner[];
  onNavigateOwners: () => void;
}

// A registered owner's coordinate string is only usable as a pin if it
// parses to two real numbers -- see FarmOwnersMap's own parser, which
// this mirrors so the "pinned" count here always matches what the map
// actually renders.
const hasValidPin = (owner: FarmOwner): boolean => {
  const parts = owner.geoCoordinates?.split(',').map((p) => parseFloat(p.trim()));
  return !!parts && parts.length === 2 && parts.every((n) => !Number.isNaN(n));
};

export const MunicipalityMapView: React.FC<MunicipalityMapViewProps> = ({ owners, onNavigateOwners }) => {
  // Aurora is CocoSense's only service area -- these are its real 8
  // municipalities (see src/data/mockData.ts), always shown in full
  // regardless of whether a given one has any registered owners yet, so
  // coverage gaps across the province are visible at a glance.
  const municipalities = PHILIPPINES_PSGC_DATA[0].provinces[0].cities;

  const [selected, setSelected] = useState<string | null>(null); // null = every municipality

  const ownersByMunicipality = useMemo(() => {
    const grouped = new Map<string, FarmOwner[]>();
    for (const m of municipalities) grouped.set(m.name, []);
    const unmatched: FarmOwner[] = [];
    for (const owner of owners) {
      const match = municipalities.find(
        (m) => m.name.toLowerCase() === (owner.cityMunicipality || '').trim().toLowerCase()
      );
      if (match) grouped.get(match.name)!.push(owner);
      else unmatched.push(owner);
    }
    return { grouped, unmatched };
  }, [owners, municipalities]);

  const coveredCount = [...ownersByMunicipality.grouped.values()].filter((list) => list.length > 0).length;
  const pinnedCount = owners.filter(hasValidPin).length;

  const visibleOwners = selected ? ownersByMunicipality.grouped.get(selected) ?? [] : owners;

  const {
    fileInputRef: importFileInputRef,
    isExportModalOpen,
    isImportModalOpen,
    decrypted,
    busy: pwBusy,
    error: pwError,
    requestExport,
    requestImport,
    cancel: cancelPasswordFlow,
    submitExportPassword,
    submitImportPassword,
    closePreview,
  } = usePasswordProtectedExport();

  const exportMunicipalitiesCsv = async () => {
    const headers = ['Municipality', 'Registered Owners', 'Pinned on Map', 'Total Nodes', 'Total Trees'];
    const rows = municipalities.map((m) => {
      const list = ownersByMunicipality.grouped.get(m.name) ?? [];
      return [
        `"${m.name}"`,
        list.length,
        list.filter(hasValidPin).length,
        list.reduce((sum, o) => sum + (o.nodesCount || 0), 0),
        list.reduce((sum, o) => sum + (o.treesCount || 0), 0),
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    requestExport('cocosense-municipality-coverage.csv', csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Municipality Map &amp; Farm Owner Coverage
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Every municipality in Aurora province, with the exact registered location of every farm owner pinned.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportMunicipalitiesCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>Export CSV</span>
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) requestImport(file);
            }}
          />
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Upload className="w-4 h-4 text-[#D4AF37]" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded bg-[#141414] border border-[#262626]">
          <div className="flex items-center gap-2 text-[#808080] text-[10px] uppercase font-bold tracking-wider">
            <Building2 className="w-3.5 h-3.5" /> Municipalities
          </div>
          <div className="mt-1.5 text-xl font-bold text-white font-mono">{municipalities.length}</div>
        </div>
        <div className="p-4 rounded bg-[#141414] border border-[#262626]">
          <div className="flex items-center gap-2 text-[#808080] text-[10px] uppercase font-bold tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> With Registered Owners
          </div>
          <div className="mt-1.5 text-xl font-bold text-[#4CAF50] font-mono">
            {coveredCount} / {municipalities.length}
          </div>
        </div>
        <div className="p-4 rounded bg-[#141414] border border-[#262626]">
          <div className="flex items-center gap-2 text-[#808080] text-[10px] uppercase font-bold tracking-wider">
            <Users className="w-3.5 h-3.5" /> Registered Owners
          </div>
          <div className="mt-1.5 text-xl font-bold text-white font-mono">{owners.length}</div>
        </div>
        <div className="p-4 rounded bg-[#141414] border border-[#262626]">
          <div className="flex items-center gap-2 text-[#808080] text-[10px] uppercase font-bold tracking-wider">
            <MapPin className="w-3.5 h-3.5" /> Pinned on Map
          </div>
          <div className="mt-1.5 text-xl font-bold text-[#D4AF37] font-mono">{pinnedCount}</div>
        </div>
      </div>

      {/* Municipality grid -- all 8, every time */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" /> Aurora Province &middot; 8 Municipalities
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] font-semibold text-[#D4AF37] hover:underline"
            >
              Clear filter &middot; show all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {municipalities.map((m) => {
            const list = ownersByMunicipality.grouped.get(m.name) ?? [];
            const isSelected = selected === m.name;
            const hasOwners = list.length > 0;
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => setSelected(isSelected ? null : m.name)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-[#262010] border-[#D4AF37]'
                    : hasOwners
                    ? 'bg-[#141414] border-[#262626] hover:border-[#404040]'
                    : 'bg-[#0E0E0E] border-[#262626]/60 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{m.name}</div>
                    <div className="text-[10px] text-[#808080] font-mono mt-0.5">{m.code}</div>
                  </div>
                  {hasOwners ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF50] flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#404040] flex-shrink-0" />
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className={`text-lg font-bold font-mono ${hasOwners ? 'text-[#D4AF37]' : 'text-[#404040]'}`}>
                    {list.length}
                  </span>
                  <span className="text-[10px] text-[#808080]">
                    owner{list.length === 1 ? '' : 's'} registered
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {ownersByMunicipality.unmatched.length > 0 && !selected && (
          <p className="text-[11px] text-[#808080] mt-2.5 px-1">
            {ownersByMunicipality.unmatched.length} registered owner
            {ownersByMunicipality.unmatched.length === 1 ? '' : 's'} on file with a municipality that doesn't match
            Aurora's 8 -- still shown on the map below, just not counted in any card above.
          </p>
        )}
      </div>

      {/* Map -- pins every owner in the current filter at their exact
          registered coordinates. Reuses the same FarmOwnersMap component
          (and the same coordinate parsing / pin styling) as the
          Dashboard's Farm Owner Locations map, so a pin means the same
          thing everywhere in the console. */}
      <div className="space-y-2">
        <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#D4AF37]" />
          {selected ? `${selected} — Exact Farm Locations` : 'All Municipalities — Exact Farm Locations'}
        </h2>
        <FarmOwnersMap owners={visibleOwners} onViewOwner={onNavigateOwners} />
        <p className="text-[11px] text-[#606060] px-1">
          Each pin is a registered farm owner's exact saved coordinates. Click a pin for details, or "View Farm
          Owner" to open their full profile. Click a municipality card above to zoom to just that town.
        </p>
      </div>

      {isExportModalOpen && (
        <PasswordPromptModal
          mode="set"
          title="Protect Coverage Export"
          description="Choose a password to encrypt this CSV. Anyone opening the downloaded file will need it."
          busy={pwBusy}
          error={pwError}
          onCancel={cancelPasswordFlow}
          onSubmit={submitExportPassword}
        />
      )}

      {isImportModalOpen && (
        <PasswordPromptModal
          mode="enter"
          title="Unlock Imported File"
          description="Enter the password this Municipality Coverage export was protected with."
          busy={pwBusy}
          error={pwError}
          onCancel={cancelPasswordFlow}
          onSubmit={submitImportPassword}
        />
      )}

      {decrypted && (
        <DecryptedPreviewModal
          filename={decrypted.originalFilename}
          mimeType={decrypted.mimeType}
          content={decrypted.content}
          exportedAt={decrypted.exportedAt}
          onClose={closePreview}
        />
      )}
    </div>
  );
};
