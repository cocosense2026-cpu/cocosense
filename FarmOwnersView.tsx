import React, { useState, useEffect, useRef } from 'react';
import { FarmOwner, PSGCRegion } from '../types';
import { PHILIPPINES_PSGC_DATA, AURORA_PROVINCE_BOUNDS } from '../data/mockData';
import { downloadTextWithHash } from '../utils/exportHash';
import { Avatar } from '../components/Avatar';
import { AddressMapPicker } from '../components/AddressMapPicker';
import { 
  Users, 
  UserPlus, 
  Search, 
  MapPin, 
  Radio, 
  ShieldCheck, 
  Mail, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  CheckCircle, 
  X,
  Download,
  AlertTriangle,
  Cpu,
  Loader2
} from 'lucide-react';

interface FarmOwnersViewProps {
  owners: FarmOwner[];
  onAddOwner: (newOwner: Omit<FarmOwner, 'id' | 'registeredAt' | 'color' | 'initials' | 'accountConfirmed'>) => Promise<void>;
  onDeleteOwner: (id: string) => void;
  onExpandNodes: (id: string, additionalNodes: number) => void;
  onResendInvite: (owner: FarmOwner) => void;
  onNavigateDiagnostics: (ownerId: string) => void;
}

export const FarmOwnersView: React.FC<FarmOwnersViewProps> = ({
  owners,
  onAddOwner,
  onDeleteOwner,
  onExpandNodes,
  onResendInvite,
  onNavigateDiagnostics
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('All Sectors');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedOwnerForExpansion, setSelectedOwnerForExpansion] = useState<FarmOwner | null>(null);
  const [expandCount, setExpandCount] = useState<number>(2);

  // Add Owner submit state -- kept separate from the field state below so
  // a rejection (e.g. duplicate account) can show its message without
  // clearing whatever the admin already typed.
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState<boolean>(false);

  // Add Owner Form State (with PSGC cascade)
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [nodesCount, setNodesCount] = useState<number>(2);

  // PSGC Cascade State -- scoped entirely to Aurora province (CocoSense's
  // only service area), so Region/Province are effectively fixed and
  // only City/Municipality + Barangay actually branch.
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>(PHILIPPINES_PSGC_DATA[0].code);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>(PHILIPPINES_PSGC_DATA[0].provinces[0].code);
  const [selectedCityCode, setSelectedCityCode] = useState<string>(PHILIPPINES_PSGC_DATA[0].provinces[0].cities[0].code);
  const [selectedBarangay, setSelectedBarangay] = useState<string>(PHILIPPINES_PSGC_DATA[0].provinces[0].cities[0].barangays[0]);

  const activeRegion = PHILIPPINES_PSGC_DATA.find(r => r.code === selectedRegionCode) || PHILIPPINES_PSGC_DATA[0];
  const activeProvince = activeRegion.provinces.find(p => p.code === selectedProvinceCode) || activeRegion.provinces[0];
  const activeCity = activeProvince?.cities.find(c => c.code === selectedCityCode) || activeProvince?.cities[0];

  // Exact farm pin -- defaults to the selected municipality's town
  // center (so it always starts *somewhere inside the right barangay's
  // general area*) and is then dragged/clicked into place by the admin
  // via the AddressMapPicker below. THIS is what actually gets saved
  // as geoCoordinates and is what makes the new owner show up in the
  // right spot on the Dashboard's Farm Owners map -- previously this
  // was a hardcoded fallback value that never changed no matter what
  // address was selected.
  const [pinLat, setPinLat] = useState<number>(activeCity?.lat ?? 15.7583);
  const [pinLng, setPinLng] = useState<number>(activeCity?.lng ?? 121.5625);

  // Auto-locate the pin from whatever the admin types into Street /
  // House Number / Sitio -- debounced so it doesn't fire on every
  // keystroke, and scoped ("bounded") to Aurora's province box so a
  // match never lands outside the service area. Dragging the pin
  // afterwards always wins; this only ever runs off the text field.
  const [isLocatingPin, setIsLocatingPin] = useState<boolean>(false);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestId = useRef(0);

  useEffect(() => {
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    const trimmedStreet = street.trim();
    if (!trimmedStreet || !activeCity) {
      setGeocodeNotice(null);
      return;
    }

    geocodeDebounceRef.current = setTimeout(() => {
      const requestId = ++geocodeRequestId.current;
      const query = `${trimmedStreet}, ${selectedBarangay}, ${activeCity.name}, Aurora, Philippines`;
      const [swLat, swLng] = AURORA_PROVINCE_BOUNDS[0];
      const [neLat, neLng] = AURORA_PROVINCE_BOUNDS[1];
      const params = new URLSearchParams({
        format: 'json',
        q: query,
        viewbox: `${swLng},${neLat},${neLng},${swLat}`,
        bounded: '1',
        limit: '1',
      });

      setIsLocatingPin(true);
      fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((results: Array<{ lat: string; lon: string }>) => {
          if (requestId !== geocodeRequestId.current) return; // a newer keystroke superseded this request
          if (results && results[0]) {
            setPinLat(parseFloat(results[0].lat));
            setPinLng(parseFloat(results[0].lon));
            setGeocodeNotice('Pin auto-placed from the address you typed — drag it to fine-tune.');
          } else {
            setGeocodeNotice("Couldn't match that exact address in Aurora — pin left at the barangay center. Drag it into place.");
          }
        })
        .catch(() => {
          if (requestId !== geocodeRequestId.current) return;
          setGeocodeNotice('Auto-locate is unavailable right now — drag the pin into place manually.');
        })
        .finally(() => {
          if (requestId === geocodeRequestId.current) setIsLocatingPin(false);
        });
    }, 900);

    return () => {
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    };
    // Deliberately excludes activeCity/selectedBarangay object identity --
    // selectedCityCode + selectedBarangay (both primitives) already
    // capture every case that should re-trigger a lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, selectedBarangay, selectedCityCode]);

  const handleRegionChange = (code: string) => {
    setSelectedRegionCode(code);
    const reg = PHILIPPINES_PSGC_DATA.find(r => r.code === code);
    if (reg && reg.provinces.length > 0) {
      setSelectedProvinceCode(reg.provinces[0].code);
      if (reg.provinces[0].cities.length > 0) {
        const city = reg.provinces[0].cities[0];
        setSelectedCityCode(city.code);
        setSelectedBarangay(city.barangays[0] || '');
        setPinLat(city.lat);
        setPinLng(city.lng);
      }
    }
  };

  const handleProvinceChange = (code: string) => {
    setSelectedProvinceCode(code);
    const prov = activeRegion.provinces.find(p => p.code === code);
    if (prov && prov.cities.length > 0) {
      const city = prov.cities[0];
      setSelectedCityCode(city.code);
      setSelectedBarangay(city.barangays[0] || '');
      setPinLat(city.lat);
      setPinLng(city.lng);
    }
  };

  const handleCityChange = (code: string) => {
    setSelectedCityCode(code);
    const city = activeProvince.cities.find(c => c.code === code);
    if (city) {
      setSelectedBarangay(city.barangays[0] || '');
      // Recenter the pin on the newly selected municipality -- the map
      // picker below will also re-focus its view to match.
      setPinLat(city.lat);
      setPinLng(city.lng);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;

    const fullAddress = `${street || 'Main Farm Compound'}, ${selectedBarangay}, ${activeCity?.name}, ${activeProvince?.name}, Philippines`;

    setAddError(null);
    setIsSubmittingOwner(true);
    try {
      await onAddOwner({
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        middleName,
        email,
        phone: phone || '+63 917 000 0000',
        country: 'Philippines',
        region: activeRegion.name,
        province: activeProvince?.name || 'Quezon',
        cityMunicipality: activeCity?.name || 'Candelaria',
        barangay: selectedBarangay,
        street: street || 'Main Farm Compound',
        address: fullAddress,
        // Sector is no longer a manual pick at registration -- with
        // every owner now addressed down to an exact Aurora barangay
        // and map pin, the municipality itself IS the meaningful
        // grouping, so it's derived automatically instead of asking
        // the admin to choose an arbitrary "Sector Alpha/Bravo/…"
        // label that had no real relationship to where the farm is.
        sector: activeCity?.name || 'Baler',
        geoCoordinates: `${pinLat.toFixed(6)}, ${pinLng.toFixed(6)}`,
        nodesCount: Math.max(1, nodesCount),
        treesCount: Math.max(1, nodesCount) * 1140,
        infectedTreesCount: 0,
        piezoHealth: 'Working',
        status: 'Active'
      });

      // Only close and reset on success -- a rejection (e.g. duplicate
      // name/address/email) leaves the modal open with the admin's
      // input intact so they can see the error and correct it.
      setIsAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setStreet('');
      setGeocodeNotice(null);
      setPinLat(activeCity?.lat ?? 15.7583);
      setPinLng(activeCity?.lng ?? 121.5625);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to register owner. Please try again.');
    } finally {
      setIsSubmittingOwner(false);
    }
  };

  // Sector is now derived from the farm's municipality rather than a
  // manually-picked "Sector Alpha/Bravo/…" label, so the filter's
  // options are built from whatever sector values actually exist in
  // the roster instead of a hardcoded, now-stale list.
  const availableSectors = Array.from(new Set(owners.map(o => o.sector).filter(Boolean))).sort();

  const filteredOwners = owners.filter(o => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (o.name ?? '').toLowerCase().includes(q) ||
      (o.id ?? '').toLowerCase().includes(q) ||
      (o.province ?? '').toLowerCase().includes(q) ||
      (o.sector ?? '').toLowerCase().includes(q);

    const matchesSector = sectorFilter === 'All Sectors' || o.sector === sectorFilter;
    const matchesStatus = statusFilter === 'All Status' || o.status === statusFilter;

    return matchesSearch && matchesSector && matchesStatus;
  });

  const exportOwnersCsv = async () => {
    const headers = ['Owner ID', 'Name', 'Email', 'Phone', 'Sector', 'Province', 'City', 'Barangay', 'Master Nodes', 'Monitored Trees', 'Status'];
    const rows = filteredOwners.map(o => [
      o.id,
      `"${o.name}"`,
      o.email,
      o.phone,
      o.sector,
      o.province,
      o.cityMunicipality,
      o.barangay,
      o.nodesCount,
      o.treesCount,
      o.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    // Stamps a SHA-256 integrity hash as the last line of the file, so
    // this export can be verified against tampering or a corrupted
    // download later -- see src/utils/exportHash.ts.
    await downloadTextWithHash('cocosense-farm-owners.csv', csvContent, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Farm Owners &amp; Plantation Directory
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Supervise registered coconut growers, hardware transducer allocation, and PSGC geographic records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportOwnersCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => { setAddError(null); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/10 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Owner</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded bg-[#141414] border border-[#262626] shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by owner name, ID, sector, or province..."
            className="w-full pl-10 pr-4 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-white placeholder:text-[#808080] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="All Sectors">All Sectors</option>
            {availableSectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-xs text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="All Status">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Farm Owners Desktop Table & Mobile Cards */}
      <div className="rounded bg-[#141414] border border-[#262626] overflow-hidden shadow-2xl">
        {/* Mobile View: Cards Layout */}
        <div className="sm:hidden divide-y divide-[#262626]">
          {filteredOwners.map(owner => (
            <div key={owner.id} className="p-4 space-y-3">
              {/* Header: Avatar, Name, Actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 flex-shrink-0"
                  >
                    <Avatar
                      avatarUrl={owner.avatarUrl}
                      initials={owner.initials}
                      color={owner.color}
                      name={owner.name}
                      size="md"
                      shape="square"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{owner.name}</div>
                    <div className="font-mono text-[11px] text-[#D4AF37]">{owner.id}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onNavigateDiagnostics(owner.id)}
                    className="p-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] hover:text-[#D4AF37]"
                    title="Hardware Diagnostics"
                  >
                    <Cpu className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOwnerForExpansion(owner);
                      setExpandCount(2);
                    }}
                    className="p-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-[#D4AF37]"
                    title="Add Nodes"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onResendInvite(owner)}
                    className="p-1.5 rounded bg-[#1A1A1A] border border-[#262626] text-[#808080]"
                    title="Resend Invite"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteOwner(owner.id)}
                    className="p-1.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336]"
                    title="Remove Owner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Location & Email */}
              <div className="flex items-center justify-between text-xs text-[#E0E0E0] pt-1">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                  <span className="truncate">{owner.cityMunicipality}, {owner.province} ({owner.sector})</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-xs font-mono text-center">
                <div>
                  <div className="text-[10px] text-[#808080] uppercase font-sans">Palms</div>
                  <div className="font-bold text-white text-sm">{owner.treesCount.toLocaleString()}</div>
                  <div className="text-[9px] text-[#808080]">
                    {owner.infectedTreesCount > 0 ? (
                      <span className="text-[#F44336]">{owner.infectedTreesCount} sick</span>
                    ) : (
                      <span className="text-[#4CAF50]">0 pest</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#808080] uppercase font-sans">Hubs</div>
                  <div className="font-bold text-[#D4AF37] text-sm">{owner.nodesCount}</div>
                  <div className="text-[9px] text-[#808080]">{owner.nodesCount * 6} sens.</div>
                </div>

                <div>
                  <div className="text-[10px] text-[#808080] uppercase font-sans">Account</div>
                  <div className="mt-1">
                    {owner.accountConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4CAF50]">
                        <CheckCircle className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4AF37]">
                        <span className="w-1 h-1 rounded-full bg-[#D4AF37] animate-pulse"></span>
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-[#0E0E0E] border-b border-[#262626] text-[#808080] font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Owner Name &amp; ID</th>
                <th className="py-3.5 px-4">PSGC Location</th>
                <th className="py-3.5 px-4">Monitored Trees</th>
                <th className="py-3.5 px-4">Master Nodes</th>
                <th className="py-3.5 px-4">Piezo Sensor Status</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {filteredOwners.map(owner => (
                <tr key={owner.id} className="hover:bg-[#1A1A1A] transition-colors">
                  {/* Name & ID */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 flex-shrink-0"
                      >
                        <Avatar
                          avatarUrl={owner.avatarUrl}
                          initials={owner.initials}
                          color={owner.color}
                          name={owner.name}
                          size="sm"
                          shape="square"
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{owner.name}</div>
                        <div className="font-mono text-[11px] text-[#D4AF37]">{owner.id} &middot; {owner.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* PSGC Location */}
                  <td className="py-4 px-4 text-[#E0E0E0]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
                      <span>{owner.cityMunicipality}, {owner.province}</span>
                    </div>
                    <div className="text-[11px] text-[#808080] font-mono mt-0.5">{owner.sector}</div>
                  </td>

                  {/* Monitored Trees */}
                  <td className="py-4 px-4 font-mono">
                    <div className="font-bold text-white text-sm">{owner.treesCount.toLocaleString()}</div>
                    <div className="text-[10px] text-[#808080]">
                      {owner.infectedTreesCount > 0 ? (
                        <span className="text-[#F44336] font-bold">{owner.infectedTreesCount} flagged</span>
                      ) : (
                        <span className="text-[#4CAF50]">Pest-Free</span>
                      )}
                    </div>
                  </td>

                  {/* Master Nodes */}
                  <td className="py-4 px-4 font-mono font-bold text-[#D4AF37]">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{owner.nodesCount} Hubs</span>
                    </div>
                    <div className="text-[10px] text-[#808080] font-normal">
                      {owner.nodesCount * 6} Sensors
                    </div>
                  </td>

                  {/* Piezo Sensor Health */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                      owner.piezoHealth === 'Working'
                        ? 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                        : 'bg-[#141414] text-[#D4AF37] border border-[#D4AF37]/30'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {owner.piezoHealth}
                    </span>
                  </td>

                  {/* Status & Confirmation */}
                  <td className="py-4 px-4">
                    {owner.accountConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4CAF50]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Confirmed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
                        <span>Pending</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigateDiagnostics(owner.id)}
                        className="p-1.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] hover:text-[#D4AF37] transition-colors"
                        title="View Hardware Diagnostics"
                      >
                        <Cpu className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOwnerForExpansion(owner);
                          setExpandCount(2);
                        }}
                        className="p-1.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] transition-colors"
                        title="Add Master Nodes"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onResendInvite(owner)}
                        className="p-1.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#808080] hover:text-white transition-colors"
                        title="Resend Invite / Credentials"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteOwner(owner.id)}
                        className="p-1.5 rounded bg-[#2B1B1B] hover:bg-[#3B1B1B] border border-[#F44336]/40 text-[#F44336] transition-colors"
                        title="Remove Owner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Farm Owner (With Philippine PSGC Selector) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded bg-[#141414] border border-[#262626] p-6 md:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div>
                <h3 className="text-lg font-bold text-white uppercase serif flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                  Register New Farm Owner
                </h3>
                <p className="text-xs text-[#808080] mt-0.5">
                  Provisions environmental ledger, hardware credentials, and PSGC address record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setAddError(null); setIsAddModalOpen(false); }}
                className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-6 space-y-4 text-xs">
              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g., Antonio"
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="e.g., Silva"
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={e => setMiddleName(e.target.value)}
                    placeholder="e.g., Reyes"
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="antonio.silva@agrimail.com"
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+63 917 842 1920"
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {/* PSGC Address Cascade -- scoped to Aurora province only */}
              <div className="p-4 rounded bg-[#0A0A0A] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                    Aurora Province Geographic Location
                  </span>
                  <span className="text-[9px] text-[#606060] uppercase tracking-wider">Service area: Aurora only</span>
                </div>

                {/* Region and Province are fixed -- CocoSense only registers
                    farms within Aurora, Region III, so these are shown as
                    read-only context instead of dropdowns with one option. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#808080] text-[10px] uppercase mb-1">Region</label>
                    <div className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-[#B0B0B0]">
                      {activeRegion.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#808080] text-[10px] uppercase mb-1">Province</label>
                    <div className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-[#B0B0B0]">
                      {activeProvince?.name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#808080] text-[10px] uppercase mb-1">City / Municipality</label>
                    <select
                      value={selectedCityCode}
                      onChange={e => handleCityChange(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      {activeProvince.cities.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#808080] text-[10px] uppercase mb-1">Barangay</label>
                    <select
                      value={selectedBarangay}
                      onChange={e => setSelectedBarangay(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      {(activeCity?.barangays || []).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#808080] text-[10px] uppercase mb-1">Street / House Number / Sitio</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      placeholder="e.g., 123 Mabini St. or Sitio Kinalapan"
                      className="w-full px-3 py-2 pr-9 rounded bg-[#141414] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                    {isLocatingPin && (
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {geocodeNotice && (
                    <p className="mt-1 text-[10px] text-[#808080]">{geocodeNotice}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[#808080] text-[10px] uppercase mb-1">
                    Pin Exact Farm Location ({selectedBarangay}, {activeCity?.name})
                  </label>
                  <AddressMapPicker
                    lat={pinLat}
                    lng={pinLng}
                    focusToken={selectedCityCode}
                    focusLat={activeCity?.lat ?? pinLat}
                    focusLng={activeCity?.lng ?? pinLng}
                    onChange={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
                  />
                  <div className="mt-1.5 text-[10px] font-mono text-[#808080]">
                    Saved coordinates: {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Hardware Allocation */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">Initial Master Nodes ({nodesCount * 6} Sensors)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={nodesCount}
                    onChange={e => setNodesCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[#808080]">
                    Each Master Node shows up as its own Vibration Intensity panel in the owner's portal.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#262626] space-y-3">
                {addError && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{addError}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setAddError(null); setIsAddModalOpen(false); }}
                    className="px-4 py-2 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOwner}
                    className="px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingOwner ? 'Registering…' : 'Register & Dispatch Email'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Hardware Expansion */}
      {selectedOwnerForExpansion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded bg-[#141414] border border-[#262626] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div>
                <h3 className="text-base font-bold text-white uppercase serif">Expand Hardware Allocation</h3>
                <p className="text-xs text-[#808080]">{selectedOwnerForExpansion.name} ({selectedOwnerForExpansion.id})</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOwnerForExpansion(null)}
                className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1.5">Additional Master Control Hubs</label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 5].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setExpandCount(cnt)}
                      className={`flex-1 py-2 rounded font-mono font-bold text-sm border transition-all ${
                        expandCount === cnt
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-[#0A0A0A] text-[#E0E0E0] border-[#262626] hover:border-[#D4AF37]/50'
                      }`}
                    >
                      +{cnt} Node{cnt > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded bg-[#0A0A0A] border border-[#262626] font-mono space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#808080]">Current Allocation:</span>
                  <span className="text-white font-bold">{selectedOwnerForExpansion.nodesCount} Nodes ({selectedOwnerForExpansion.nodesCount * 6} Sensors)</span>
                </div>
                <div className="flex justify-between text-[#D4AF37]">
                  <span>Additional Sensors:</span>
                  <span className="font-bold">+{expandCount * 6} Piezo Transducers</span>
                </div>
                <div className="pt-2 border-t border-[#262626] flex justify-between font-bold text-white text-sm">
                  <span>New Total:</span>
                  <span>{selectedOwnerForExpansion.nodesCount + expandCount} Master Nodes</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOwnerForExpansion(null)}
                  className="px-4 py-2 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExpandNodes(selectedOwnerForExpansion.id, expandCount);
                    setSelectedOwnerForExpansion(null);
                  }}
                  className="px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/10"
                >
                  Confirm Hardware Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
