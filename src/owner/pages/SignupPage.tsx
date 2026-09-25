import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, MailCheck, MapPin, Home, Loader2, QrCode, AlertTriangle,
} from 'lucide-react';
import { OwnerAuthLayout, ownerAuthInputClass, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError } from '../api';
import { AddressMapPicker } from '../../components/AddressMapPicker';
import { PHILIPPINES_PSGC_DATA, AURORA_PROVINCE_BOUNDS } from '../../data/mockData';

// CocoSense only registers farms within Aurora province, so the address
// section here is hard-scoped to it -- Region/Province are fixed, and only
// City/Municipality + Barangay actually branch (same scoping the admin's
// "Add Owner" flow uses in src/views/FarmOwnersView.tsx).
const AURORA = PHILIPPINES_PSGC_DATA[0].provinces[0];
const AURORA_REGION_NAME = PHILIPPINES_PSGC_DATA[0].name;
const AURORA_PROVINCE_CODE = AURORA.code; // 037700000

// Live PSGC (Philippine Standard Geographic Code) API -- publicly hosted,
// no key required. Used to populate the Municipality and Barangay dropdowns
// so they always reflect PSA's current boundaries instead of a hardcoded
// list going stale. AURORA (imported above) is kept purely as an offline
// fallback -- its municipality codes match the PSGC API's codes exactly, so
// whichever source is active, downstream lookups (town-center coordinates
// for the map, offline barangay lists) work the same way.
const PSGC_API_BASE = 'https://psgc.gitlab.io/api';

interface MunicipalityOption {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

const OFFLINE_MUNICIPALITIES: MunicipalityOption[] = AURORA.cities.map((c) => ({
  code: c.code,
  name: c.name,
  lat: c.lat,
  lng: c.lng,
}));

// Independent, self-service account creation -- separate from the
// admin's "Add Owner" invite flow (src/views/FarmOwnersView.tsx). The
// owner picks their own password up front here (no forced
// change-password step afterward, unlike an admin-invited owner who
// starts on a shared default password). The account still lands in the
// exact same farm_owners table, so it shows up in the admin's Farm
// Owners list right away -- just unconfirmed, with no hardware assigned
// until an admin gets to it.
export const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  // ---- Master-node QR link (?nodeId=...) --------------------------------
  // Set when this page was opened by scanning a super-admin-printed
  // master node sticker (see src/superadmin/pages/SuperAdminQrCodesPage.tsx).
  // Looked up on mount purely to show the prospective owner which device
  // they're linking (or a clear already-used/not-recognized notice) --
  // the actual link happens server-side on submit either way.
  const [searchParams] = useSearchParams();
  const scannedNodeId = searchParams.get('nodeId');
  const [nodeCheck, setNodeCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    scannedNodeId ? 'checking' : 'idle'
  );
  const [nodeCheckReason, setNodeCheckReason] = useState<'not_found' | 'already_linked' | null>(null);

  useEffect(() => {
    if (!scannedNodeId) return;
    let cancelled = false;
    ownerApi
      .lookupNode(scannedNodeId)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setNodeCheck('valid');
        } else {
          setNodeCheck('invalid');
          setNodeCheckReason(res.reason ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setNodeCheck('invalid');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedNodeId]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // ---- Address (Aurora-only PSGC cascade) ----------------------------------
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>(OFFLINE_MUNICIPALITIES);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);
  const [municipalitiesOffline, setMunicipalitiesOffline] = useState(false);

  const [selectedCityCode, setSelectedCityCode] = useState<string>(OFFLINE_MUNICIPALITIES[0].code);
  const activeCity = municipalities.find((m) => m.code === selectedCityCode) || municipalities[0];

  const [barangays, setBarangays] = useState<string[]>(AURORA.cities[0].barangays);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [barangaysOffline, setBarangaysOffline] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState<string>(AURORA.cities[0].barangays[0] || '');

  const [street, setStreet] = useState('');

  // Exact farm/residence pin -- defaults to the selected municipality's town
  // center, then dragged/clicked into place within the chosen barangay via
  // AddressMapPicker below. This is what actually gets saved as
  // geoCoordinates for the new owner.
  const [pinLat, setPinLat] = useState<number>(OFFLINE_MUNICIPALITIES[0].lat);
  const [pinLng, setPinLng] = useState<number>(OFFLINE_MUNICIPALITIES[0].lng);

  // Drives AddressMapPicker's recenter/pan -- bumped every time the pin
  // is moved *programmatically* (municipality change, or a successful
  // address auto-locate below), never on a manual drag/click, so the
  // visible map actually follows the pin out to wherever it lands
  // instead of just updating the marker while the view stays put.
  const [mapFocus, setMapFocus] = useState<{ token: number; lat: number; lng: number; zoom: number }>({
    token: 0,
    lat: OFFLINE_MUNICIPALITIES[0].lat,
    lng: OFFLINE_MUNICIPALITIES[0].lng,
    zoom: 14,
  });

  // Fetch every municipality of Aurora from the live PSGC API on mount. If
  // it's unreachable (offline, CORS hiccup, rate limit), silently fall back
  // to the bundled offline list -- the codes match either way, so nothing
  // downstream needs to know which source is active.
  useEffect(() => {
    let cancelled = false;
    setLoadingMunicipalities(true);
    fetch(`${PSGC_API_BASE}/provinces/${AURORA_PROVINCE_CODE}/cities-municipalities/`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((rows: Array<{ code: string; name: string }>) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) throw new Error('Empty response');
        // The PSGC API doesn't return lat/lng -- merge in the bundled
        // town-center coordinates (matched by code, falling back to name)
        // so the map picker can still recenter on the selected municipality.
        const merged = rows
          .map((r) => {
            const local = AURORA.cities.find((c) => c.code === r.code || c.name.toLowerCase() === r.name.toLowerCase());
            return { code: r.code, name: r.name, lat: local?.lat ?? AURORA.cities[0].lat, lng: local?.lng ?? AURORA.cities[0].lng };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        if (cancelled) return;
        setMunicipalities(merged);
        setMunicipalitiesOffline(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMunicipalities(OFFLINE_MUNICIPALITIES);
        setMunicipalitiesOffline(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch every barangay of the selected municipality from the live PSGC
  // API whenever it changes -- again falling back to the offline list bundled
  // in src/data/mockData.ts if the request fails.
  useEffect(() => {
    if (!selectedCityCode) return;
    let cancelled = false;
    setLoadingBarangays(true);
    fetch(`${PSGC_API_BASE}/cities-municipalities/${selectedCityCode}/barangays/`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((rows: Array<{ name: string }>) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) throw new Error('Empty response');
        const names = rows.map((r) => r.name).sort((a, b) => a.localeCompare(b));
        if (cancelled) return;
        setBarangays(names);
        setBarangaysOffline(false);
        setSelectedBarangay((prev) => (names.includes(prev) ? prev : names[0]));
      })
      .catch(() => {
        if (cancelled) return;
        const local = AURORA.cities.find((c) => c.code === selectedCityCode);
        const fallback = local?.barangays || [];
        setBarangays(fallback);
        setBarangaysOffline(true);
        setSelectedBarangay(fallback[0] || '');
      })
      .finally(() => {
        if (!cancelled) setLoadingBarangays(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCityCode]);

  const handleCityChange = (code: string) => {
    setSelectedCityCode(code);
    const city = municipalities.find((m) => m.code === code);
    if (city) {
      setPinLat(city.lat);
      setPinLng(city.lng);
      setMapFocus((f) => ({ token: f.token + 1, lat: city.lat, lng: city.lng, zoom: 14 }));
    }
  };

  // Auto-locate the pin from whatever's typed into Street / House Number /
  // Sitio -- debounced, and bounded to Aurora's province box so a match
  // never lands outside the service area. Dragging the pin afterwards
  // always wins over this; it only ever runs off the text field.
  const [isLocatingPin, setIsLocatingPin] = useState(false);
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
          if (requestId !== geocodeRequestId.current) return;
          if (results && results[0]) {
            const matchedLat = parseFloat(results[0].lat);
            const matchedLng = parseFloat(results[0].lon);
            setPinLat(matchedLat);
            setPinLng(matchedLng);
            // Zoom in tight (18) since this is a real street-level match,
            // not just the municipality's town center -- and actually pan
            // the map there, not just move the marker underneath it.
            setMapFocus((f) => ({ token: f.token + 1, lat: matchedLat, lng: matchedLng, zoom: 18 }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, selectedBarangay, selectedCityCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!selectedBarangay) {
      setError('Please select your barangay.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const fullAddress = `${street.trim() || 'Main Farm Compound'}, ${selectedBarangay}, ${activeCity?.name}, Aurora, Philippines`;

    setLoading(true);
    try {
      const res = await ownerApi.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        country: 'Philippines',
        region: AURORA_REGION_NAME,
        province: AURORA.name,
        cityMunicipality: activeCity?.name || AURORA.cities[0].name,
        barangay: selectedBarangay,
        street: street.trim() || undefined,
        address: fullAddress,
        geoCoordinates: `${pinLat.toFixed(6)}, ${pinLng.toFixed(6)}`,
        masterNodeId: nodeCheck === 'valid' && scannedNodeId ? scannedNodeId : undefined,
      });
      setSentTo(res.email);
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen: mirrors ConfirmPage's "you're all set" tone, but
  // for the "check your inbox" step that comes before confirming --
  // this is the page's link back to Sign In the task asked for.
  if (sentTo) {
    return (
      <OwnerAuthLayout
        eyebrow="Almost There"
        title="Check your inbox."
        subtitle={`We sent a confirmation link to ${sentTo}.`}
      >
        <div className="flex items-start gap-2.5 mb-5 text-[#4CAF50]">
          <MailCheck className="w-6 h-6 flex-shrink-0" />
          <p className="text-xs text-[#E0E0E0]">
            Click the link in that email to activate your account. It expires in 24 hours. Once confirmed, sign
            in with the password you just created.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/owner/login', { replace: true, state: { email: sentTo } })}
          className={`${ownerAuthButtonClass} block w-full text-center`}
        >
          Go to Sign In <ArrowRight className="w-4 h-4" />
        </button>
      </OwnerAuthLayout>
    );
  }

  return (
    <OwnerAuthLayout
      eyebrow="Create Account"
      title="Register your plantation."
      subtitle="Set up your own Farm Owner account -- no invitation needed."
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/owner/login" className="text-[#D4AF37] hover:text-[#E5C158]">
            Sign In
          </Link>
        </>
      }
    >
      <Link
        to="/owner/login"
        className="inline-flex items-center gap-1 text-[11px] text-[#808080] hover:text-white mb-5"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Sign In
      </Link>

      {scannedNodeId && nodeCheck === 'checking' && (
        <div className="flex items-center gap-2.5 mb-5 px-3.5 py-3 rounded bg-[#0E0E0E] border border-[#262626] text-[11px] text-[#808080]">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          Checking QR code…
        </div>
      )}
      {scannedNodeId && nodeCheck === 'valid' && (
        <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded bg-[#0F1F12] border border-[#22C55E]/30 text-[11px] text-[#B7EFC5]">
          <QrCode className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
          <span>
            This account will be linked to Master Node{' '}
            <span className="font-mono font-bold text-[#22C55E]">{scannedNodeId}</span> once you finish signing up.
          </span>
        </div>
      )}
      {scannedNodeId && nodeCheck === 'invalid' && (
        <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded bg-[#2B1B1B] border border-[#F44336]/30 text-[11px] text-[#F5B7B1]">
          <AlertTriangle className="w-4 h-4 text-[#F44336] flex-shrink-0 mt-0.5" />
          <span>
            {nodeCheckReason === 'already_linked'
              ? 'This QR code has already been linked to another account.'
              : "This QR code wasn't recognized."}{' '}
            You can still create your account -- an admin will assign hardware afterward.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">First Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.replace(/[^A-Za-z\s'-]/g, ''))}
                className={ownerAuthInputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Last Name</label>
            <input
              type="text"
              autoComplete="family-name"
              placeholder="Dela Cruz"
              value={lastName}
              onChange={(e) => setLastName(e.target.value.replace(/[^A-Za-z\s'-]/g, ''))}
              className={`${ownerAuthInputClass} pl-3.5`}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              autoComplete="username"
              placeholder="owner@plantation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Phone Number (optional)</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="09000000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              className={ownerAuthInputClass}
            />
          </div>
        </div>

        {/* Address -- scoped to Aurora province only (CocoSense's sole
            service area). Municipality and Barangay are populated live from
            the public PSGC API, falling back to the bundled offline list if
            that request fails. */}
        <div className="p-3.5 rounded bg-[#0E0E0E] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#22C55E] uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" /> Farm Address
            </span>
            <span className="text-[9px] text-[#606060] uppercase tracking-wider">Service area: Aurora only</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#808080] text-[10px] uppercase mb-1">Province</label>
              <div className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-[#B0B0B0] text-sm">
                {AURORA.name}
              </div>
            </div>
            <div>
              <label className="block text-[#808080] text-[10px] uppercase mb-1 flex items-center gap-1">
                City / Municipality
                {loadingMunicipalities && <Loader2 className="w-3 h-3 animate-spin text-[#606060]" />}
              </label>
              <select
                value={selectedCityCode}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-white text-sm focus:border-[#22C55E]/60 focus:outline-none"
              >
                {municipalities.map((m) => (
                  <option key={m.code} value={m.code}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#808080] text-[10px] uppercase mb-1 flex items-center gap-1">
              Barangay
              {loadingBarangays && <Loader2 className="w-3 h-3 animate-spin text-[#606060]" />}
            </label>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              disabled={loadingBarangays || barangays.length === 0}
              className="w-full px-3 py-2 rounded bg-[#141414] border border-[#262626] text-white text-sm focus:border-[#22C55E]/60 focus:outline-none disabled:opacity-50"
            >
              {barangays.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {(municipalitiesOffline || barangaysOffline) && (
              <p className="mt-1 text-[10px] text-[#808080]">
                Live PSGC lookup unavailable right now — using CocoSense's bundled Aurora directory instead.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[#808080] text-[10px] uppercase mb-1">Street / House Number / Sitio</label>
            <div className="relative">
              <Home className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g., 123 Mabini St. or Sitio Kinalapan"
                className={`${ownerAuthInputClass} pr-9`}
              />
              {isLocatingPin && (
                <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            {geocodeNotice && <p className="mt-1 text-[10px] text-[#808080]">{geocodeNotice}</p>}
          </div>

          <div>
            <label className="block text-[#808080] text-[10px] uppercase mb-1">
              Pin Exact Location ({selectedBarangay || '—'}, {activeCity?.name})
            </label>
            <AddressMapPicker
              lat={pinLat}
              lng={pinLng}
              focusToken={String(mapFocus.token)}
              focusLat={mapFocus.lat}
              focusLng={mapFocus.lng}
              focusZoom={mapFocus.zoom}
              onChange={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
            />
            <div className="mt-1.5 text-[10px] font-mono text-[#808080]">
              Saved coordinates: {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${ownerAuthInputClass} pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#606060]">
            At least 8 characters, with an uppercase letter, lowercase letter, number, and symbol.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={ownerAuthButtonClass}>
          {loading ? 'Creating Account…' : 'Create Account'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </OwnerAuthLayout>
  );
};
