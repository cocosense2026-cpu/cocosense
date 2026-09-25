import { MonitoredTree, FarmOwner, MasterNode, PestAlert, NotificationItem, VibrationEvent, PSGCRegion } from '../types';

// ---------------------------------------------------------------------------
// Initial / fallback state for App.tsx's dashboard. CocoSense pulls real data
// from the backend (server/routes/api.js) right after mount and overwrites
// all of these -- they only matter for the very first paint (or if the
// backend is briefly unreachable), so they're intentionally left empty
// rather than hand-written fake plantation data.
// ---------------------------------------------------------------------------
export const INITIAL_TREES: MonitoredTree[] = [];
export const INITIAL_OWNERS: FarmOwner[] = [];
export const INITIAL_NODES: MasterNode[] = [];
export const INITIAL_ALERTS: PestAlert[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_VIBRATION_EVENTS: VibrationEvent[] = [];

// ---------------------------------------------------------------------------
// PSGC (Philippine Standard Geographic Code) reference data -- CocoSense
// only registers farms within Aurora province, so this is scoped to Aurora's
// 8 municipalities and all 151 barangays (PSA count as of the 2020 census).
// Codes match the official PSGC (https://psa.gov.ph/classification/psgc).
//
// This is used as offline/fallback data by the admin's "Add Owner" flow
// (src/views/FarmOwnersView.tsx) and by AddressMapPicker's map bounds. The
// Owner Portal's self-service Create Account page (src/owner/pages/
// SignupPage.tsx) instead pulls municipalities/barangays live from the
// public PSGC API (https://psgc.gitlab.io/api/) so it always reflects any
// future PSA boundary changes -- see PSGC_API_BASE in that file.
// ---------------------------------------------------------------------------
export const PHILIPPINES_PSGC_DATA: PSGCRegion[] = [
  {
    code: '030000000',
    name: 'Region III (Central Luzon)',
    provinces: [
      {
        code: '037700000',
        name: 'Aurora',
        cities: [
          {
            code: '037701000',
            name: 'Baler',
            lat: 15.7595,
            lng: 121.5627,
            barangays: [
              'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V',
              'Buhangin', 'Calabuanan', 'Obligacion', 'Pingit', 'Reserva', 'Sabang',
              'Suclayin', 'Zabali',
            ],
          },
          {
            code: '037702000',
            name: 'Casiguran',
            lat: 16.2041,
            lng: 122.0400,
            barangays: [
              'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
              'Barangay 6', 'Barangay 7', 'Barangay 8', 'Bianuan', 'Calabgan',
              'Calangcuasan', 'Calantas', 'Cozo', 'Culat', 'Dibacong', 'Dibet',
              'Ditinagyan', 'Esperanza', 'Esteves', 'Lual', 'Marikit', 'San Ildefonso',
              'Tabas', 'Tinib',
            ],
          },
          {
            code: '037703000',
            name: 'Dilasag',
            lat: 16.3898,
            lng: 122.2099,
            barangays: [
              'Diagyan', 'Dicabasan', 'Dilaguidi', 'Dimaseset', 'Diniog', 'Esperanza',
              'Lawang', 'Maligaya', 'Manggitahan', 'Masagana', 'Ura',
            ],
          },
          {
            code: '037704000',
            name: 'Dinalungan',
            lat: 16.1416,
            lng: 121.9560,
            barangays: [
              'Abuleg', 'Dibaraybay', 'Ditawini', 'Mapalad', 'Nipoo', 'Paleg',
              'Simbahan', 'Zone I', 'Zone II',
            ],
          },
          {
            code: '037705000',
            name: 'Dingalan',
            lat: 15.3894,
            lng: 121.3927,
            barangays: [
              'Aplaya', 'Butas na Bato', 'Cabog', 'Caragsacan', 'Davildavilan',
              'Dikapanikian', 'Ibona', 'Paltic', 'Poblacion', 'Tanawan', 'Umiray',
            ],
          },
          {
            code: '037706000',
            name: 'Dipaculao',
            lat: 15.8477,
            lng: 121.5367,
            barangays: [
              'Bayabas', 'Borlongan', 'Buenavista', 'Calaocan', 'Diamanen', 'Dianed',
              'Diarabasin', 'Dibutunan', 'Dimabuno', 'Dinadiawan', 'Ditale', 'Gupa',
              'Ipil', 'Laboy', 'Lipit', 'Lobbot', 'Maligaya', 'Mijares', 'Mucdol',
              'North Poblacion', 'Puangi', 'Salay', 'Sapangkawayan', 'South Poblacion',
              'Toytoyan',
            ],
          },
          {
            code: '037707000',
            name: 'Maria Aurora',
            lat: 15.8000,
            lng: 121.4667,
            barangays: [
              'Alcala', 'Bagtu', 'Bangco', 'Bannawag', 'Barangay I', 'Barangay II',
              'Barangay III', 'Barangay IV', 'Baubo', 'Bayanihan', 'Bazal',
              'Cabituculan East', 'Cabituculan West', 'Cadayacan', 'Debucao',
              'Decoliat', 'Detailen', 'Diaat', 'Dialatman', 'Diaman', 'Dianawan',
              'Dikildit', 'Dimanpudso', 'Diome', 'Estonilo', 'Florida', 'Galintuja',
              'Malasin', 'Ponglo', 'Quirino', 'Ramada', 'San Joaquin', 'San Jose',
              'San Juan', 'San Leonardo', 'Santa Lucia', 'Santo Tomas', 'Suguit',
              'Villa Aurora', 'Wenceslao',
            ],
          },
          {
            code: '037708000',
            name: 'San Luis',
            lat: 15.7191,
            lng: 121.5178,
            barangays: [
              'Bacong', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV',
              'Dibalo', 'Dibayabay', 'Dibut', 'Dikapinisan', 'Dimanayat', 'Diteki',
              'Ditumabo', 'L. Pimentel', 'Nonong Senior', 'Real', 'San Isidro',
              'San Jose', 'Zarah',
            ],
          },
        ],
      },
    ],
  },
];

// Rough bounding box around the whole province (SW corner, NE corner) --
// used to keep AddressMapPicker's pin from being dragged outside Aurora,
// and to bound the Nominatim street-address geocoder to Aurora results only.
export const AURORA_PROVINCE_BOUNDS: [[number, number], [number, number]] = [
  [15.25, 121.30],
  [16.50, 122.30],
];

// Roughly the geographic center of the province (near Baler) -- used to
// center the read-only Farm Owners dashboard map on first load.
export const AURORA_PROVINCE_CENTER: [number, number] = [15.88, 121.60];
