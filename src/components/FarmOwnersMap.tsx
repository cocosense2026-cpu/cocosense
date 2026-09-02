import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FarmOwner } from '../types';
import { useTheme } from '../context/ThemeContext';
import { AURORA_PROVINCE_CENTER, AURORA_PROVINCE_BOUNDS } from '../data/mockData';
import { MapPin, Trees, Radio, ExternalLink } from 'lucide-react';

interface FarmOwnersMapProps {
  owners: FarmOwner[];
  onViewOwner?: (owner: FarmOwner) => void;
}

interface PinnedOwner extends FarmOwner {
  lat: number;
  lng: number;
}

// FarmOwner.geoCoordinates is stored as a "lat, lng" string (e.g. "13.9311, 121.4233").
// Parse it into a numeric pair the map can actually plot; skip anything malformed
// rather than guessing, so a bad record just doesn't render a pin.
const parseCoordinates = (owner: FarmOwner): PinnedOwner | null => {
  const parts = owner.geoCoordinates?.split(',').map(p => parseFloat(p.trim()));
  if (!parts || parts.length !== 2 || parts.some(n => Number.isNaN(n))) return null;
  const [lat, lng] = parts;
  return { ...owner, lat, lng };
};

// Custom brand-green pin (avoids the default Leaflet marker image path issues
// under Vite bundling, and matches the app's radar-green accent instead).
const createPinIcon = (color: string) =>
  L.divIcon({
    className: 'coco-map-pin',
    html: `
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="#000" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="6" fill="#000"/>
      </svg>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });

const defaultPin = createPinIcon('#16A34A');
const infestedPin = createPinIcon('#F44336');

// Refits the map to whatever pins are currently visible (e.g. after a
// sector filter changes) instead of leaving the view stuck on the old set.
// With no pins at all (e.g. a filter matches nothing, or the roster is
// empty), it falls back to framing the whole of Aurora province -- the
// map's real service area -- rather than sitting on a random default.
const FitToMarkers: React.FC<{ points: PinnedOwner[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.fitBounds(AURORA_PROVINCE_BOUNDS, { padding: [20, 20] });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
};

export const FarmOwnersMap: React.FC<FarmOwnersMapProps> = ({ owners, onViewOwner }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mapRef = useRef<L.Map | null>(null);

  const pins = useMemo(() => owners.map(parseCoordinates).filter((o): o is PinnedOwner => o !== null), [owners]);

  // Light mode uses standard OSM raster tiles -- unlike the old CARTO
  // "light_all" basemap, these keep rendering barangay/place names,
  // residential streets, and highway shields as you zoom in and out,
  // so admins can actually confirm which barangay/road a pin sits on.
  // Dark mode keeps CARTO's dark basemap (no dark-themed OSM equivalent
  // exists without an API key) which still carries road + label detail.
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = isDark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className="relative isolate rounded-xl bg-[#141414] border border-[#262626] overflow-hidden shadow-2xl">
      <MapContainer
        // Aurora province -- CocoSense's actual service area -- instead
        // of the old default view centered south in CALABARZON.
        center={AURORA_PROVINCE_CENTER}
        zoom={10}
        minZoom={8}
        maxZoom={19}
        scrollWheelZoom
        style={{ height: '420px', width: '100%', background: isDark ? '#141414' : '#F1F4F8' }}
        ref={mapRef}
      >
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
        />
        <FitToMarkers points={pins} />
        {pins.map(owner => (
          <Marker
            key={owner.id}
            position={[owner.lat, owner.lng]}
            icon={owner.infectedTreesCount > 0 ? infestedPin : defaultPin}
          >
            <Popup minWidth={240}>
              <div className="text-xs font-sans">
                <div className="font-bold text-sm text-[#0A0A0A]">{owner.name}</div>
                <div className="text-[10px] font-mono text-[#16A34A] font-semibold mt-0.5">{owner.id} &middot; {owner.sector}</div>

                <div className="flex items-start gap-1.5 mt-2 text-[#334155]">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#16A34A]" />
                  <span>{owner.address}</span>
                </div>

                <div className="flex items-center gap-3 mt-2 text-[#334155]">
                  <span className="flex items-center gap-1"><Trees className="w-3.5 h-3.5 text-[#16A34A]" />{owner.treesCount.toLocaleString()} trees</span>
                  <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-[#16A34A]" />{owner.nodesCount} nodes</span>
                </div>

                <div className="mt-1.5 text-[10px] text-[#64748B] font-mono">{owner.lat.toFixed(4)}, {owner.lng.toFixed(4)}</div>

                {onViewOwner && (
                  <button
                    type="button"
                    onClick={() => onViewOwner(owner)}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#16A34A] hover:bg-[#22C55E] text-black text-[11px] font-bold transition-colors"
                  >
                    View Farm Owner <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
