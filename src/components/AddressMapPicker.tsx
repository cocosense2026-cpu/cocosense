import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AURORA_PROVINCE_BOUNDS } from '../data/mockData';
import { MapPin } from 'lucide-react';

interface AddressMapPickerProps {
  lat: number;
  lng: number;
  /** Changes whenever the selected municipality changes, so the map recenters there. */
  focusToken: string;
  focusLat: number;
  focusLng: number;
  onChange: (lat: number, lng: number) => void;
}

const pinIcon = L.divIcon({
  className: 'coco-map-pin-picker',
  html: `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="#D4AF37" stroke="#000" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="6" fill="#000"/>
    </svg>
  `,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

// Recenters on the selected municipality's town center every time the
// admin picks a different City/Municipality -- but never on drag/click,
// so their manual fine-tuning is never fought with.
const RecenterOnFocus: React.FC<{ focusToken: string; lat: number; lng: number }> = ({ focusToken, lat, lng }) => {
  const map = useMap();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      map.setView([lat, lng], 14);
      return;
    }
    map.setView([lat, lng], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);
  return null;
};

const ClickToPlace: React.FC<{ onChange: (lat: number, lng: number) => void }> = ({ onChange }) => {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Lets an admin drop/drag a precise pin for exactly where the farm sits
// within the selected barangay, instead of the whole "Register Farm
// Owner" flow silently reusing one hardcoded coordinate for every
// owner (which is why new registrations never actually showed up in
// the right spot on the Dashboard's Farm Owners map).
export const AddressMapPicker: React.FC<AddressMapPickerProps> = ({ lat, lng, focusToken, focusLat, focusLng, onChange }) => {
  return (
    <div className="rounded border border-[#262626] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] border-b border-[#262626] text-[10px] uppercase tracking-wider text-[#808080]">
        <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
        Click or drag the pin to the exact farm location within the selected barangay
      </div>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        minZoom={9}
        maxZoom={19}
        maxBounds={AURORA_PROVINCE_BOUNDS}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        style={{ height: '260px', width: '100%' }}
      >
        {/* Standard OSM raster tiles -- unlike the minimal CARTO basemap
            used on the read-only dashboard map, these render barangay
            place labels, residential streets, and highways all the way
            down to house-level detail as you zoom in, which is what
            actually lets an admin verify they've pinned the right spot. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <RecenterOnFocus focusToken={focusToken} lat={focusLat} lng={focusLng} />
        <ClickToPlace onChange={onChange} />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              onChange(pos.lat, pos.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
};
