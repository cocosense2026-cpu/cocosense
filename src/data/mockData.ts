import { FarmOwner, MonitoredTree, MasterNode, PestAlert, VibrationEvent, NotificationItem, PSGCRegion, LaravelComponentDef } from '../types';

export const INITIAL_OWNERS: FarmOwner[] = [
  {
    id: 'COCO-7842',
    name: 'Antonio Silva',
    firstName: 'Antonio',
    lastName: 'Silva',
    middleName: 'Reyes',
    email: 'antonio.silva@agrimail.com',
    phone: '+63 917 842 1920',
    country: 'Philippines',
    region: 'Region IV-A (CALABARZON)',
    province: 'Quezon',
    cityMunicipality: 'Candelaria',
    barangay: 'Malabanban Norte',
    street: '123 Mabini St.',
    address: '123 Mabini St., Malabanban Norte, Candelaria, Quezon, Philippines',
    sector: 'Sector Alpha',
    geoCoordinates: '13.9311, 121.4233',
    nodesCount: 3,
    treesCount: 3420,
    infectedTreesCount: 2,
    piezoHealth: 'Working',
    status: 'Active',
    color: '#059669',
    initials: 'AS',
    registeredAt: '2025-11-14',
    accountConfirmed: true,
  },
  {
    id: 'COCO-5120',
    name: 'Maria Elena Santos',
    firstName: 'Maria Elena',
    lastName: 'Santos',
    middleName: 'Cruz',
    email: 'elena.santos@quezoncoconuts.ph',
    phone: '+63 920 512 8841',
    country: 'Philippines',
    region: 'Region IV-A (CALABARZON)',
    province: 'Quezon',
    cityMunicipality: 'Sariaya',
    barangay: 'Balubal',
    street: 'Km 122 Maharlika Highway',
    address: 'Km 122 Maharlika Highway, Balubal, Sariaya, Quezon, Philippines',
    sector: 'Sector Bravo',
    geoCoordinates: '13.9634, 121.5255',
    nodesCount: 4,
    treesCount: 4180,
    infectedTreesCount: 0,
    piezoHealth: 'Working',
    status: 'Active',
    color: '#047857',
    initials: 'MS',
    registeredAt: '2025-12-02',
    accountConfirmed: true,
  },
  {
    id: 'COCO-9304',
    name: 'Rodrigo Macaraeg',
    firstName: 'Rodrigo',
    lastName: 'Macaraeg',
    email: 'rodrigo.m@bicolpalm.com',
    phone: '+63 949 930 4211',
    country: 'Philippines',
    region: 'Region V (Bicol Region)',
    province: 'Camarines Sur',
    cityMunicipality: 'Pili',
    barangay: 'San Agustin',
    street: 'Zone 4 Agro Industrial Zone',
    address: 'Zone 4 Agro Industrial Zone, San Agustin, Pili, Camarines Sur, Philippines',
    sector: 'Sector Charlie',
    geoCoordinates: '13.5833, 123.2833',
    nodesCount: 2,
    treesCount: 2150,
    infectedTreesCount: 4,
    piezoHealth: 'Needs Maintenance',
    status: 'Active',
    color: '#D97706',
    initials: 'RM',
    registeredAt: '2026-01-18',
    accountConfirmed: false,
  },
  {
    id: 'COCO-3189',
    name: 'Cheska Cate Victorio',
    firstName: 'Cheska Cate',
    lastName: 'Victorio',
    email: 'cheskacatevictorio@ascot.edu.ph',
    phone: '+63 918 318 9002',
    country: 'Philippines',
    region: 'Region III (Central Luzon)',
    province: 'Aurora',
    cityMunicipality: 'Baler',
    barangay: 'Suklayin',
    street: 'Sitio Kinalapan, ASCOT Agro-Forestry Campus',
    address: 'Sitio Kinalapan, Suklayin, Baler, Aurora, Philippines',
    sector: 'Sector Delta',
    geoCoordinates: '15.7594, 121.5625',
    nodesCount: 5,
    treesCount: 5200,
    infectedTreesCount: 1,
    piezoHealth: 'Working',
    status: 'Active',
    color: '#10B981',
    initials: 'CV',
    registeredAt: '2026-02-10',
    accountConfirmed: true,
  },
  {
    id: 'COCO-1104',
    name: 'Danilo Bautista',
    firstName: 'Danilo',
    lastName: 'Bautista',
    email: 'danilo.bautista@lagunaagri.org',
    phone: '+63 928 110 4910',
    country: 'Philippines',
    region: 'Region IV-A (CALABARZON)',
    province: 'Laguna',
    cityMunicipality: 'San Pablo City',
    barangay: 'Concepcion',
    street: 'Sampaloc Lake Road',
    address: 'Sampaloc Lake Road, Concepcion, San Pablo City, Laguna, Philippines',
    sector: 'Sector Echo',
    geoCoordinates: '14.0683, 121.3256',
    nodesCount: 2,
    treesCount: 1980,
    infectedTreesCount: 0,
    piezoHealth: 'Working',
    status: 'Active',
    color: '#065F46',
    initials: 'DB',
    registeredAt: '2026-02-22',
    accountConfirmed: true,
  }
];

export const INITIAL_TREES: MonitoredTree[] = [
  {
    id: 'TR-1048',
    ownerId: 'COCO-7842',
    ownerName: 'Antonio Silva',
    sector: 'Sector Alpha',
    row: 4,
    column: 12,
    x: 42,
    y: 28,
    status: 'Active Infestation',
    threatScore: 88,
    pestDetected: 'Rhinoceros Beetle',
    vibrationFrequencyHz: 345,
    vibrationGrams: 0.94,
    lastInspected: '12 mins ago',
    assignedNodeId: 'NODE-001',
    piezoSensorId: 'PZ-001-A4',
    soilMoisturePercent: 68,
    ambientTempC: 29.4
  },
  {
    id: 'TR-1049',
    ownerId: 'COCO-7842',
    ownerName: 'Antonio Silva',
    sector: 'Sector Alpha',
    row: 4,
    column: 13,
    x: 48,
    y: 32,
    status: 'Potential Infestation',
    threatScore: 62,
    pestDetected: 'Rhinoceros Beetle',
    vibrationFrequencyHz: 290,
    vibrationGrams: 0.58,
    lastInspected: '1 hour ago',
    assignedNodeId: 'NODE-001',
    piezoSensorId: 'PZ-001-A5',
    soilMoisturePercent: 71,
    ambientTempC: 29.2
  },
  {
    id: 'TR-1050',
    ownerId: 'COCO-7842',
    ownerName: 'Antonio Silva',
    sector: 'Sector Alpha',
    row: 5,
    column: 1,
    x: 25,
    y: 45,
    status: 'No Pests',
    threatScore: 12,
    pestDetected: 'None',
    vibrationFrequencyHz: 48,
    vibrationGrams: 0.12,
    lastInspected: '3 hours ago',
    assignedNodeId: 'NODE-001',
    piezoSensorId: 'PZ-001-A6',
    soilMoisturePercent: 74,
    ambientTempC: 28.8
  },
  {
    id: 'TR-2101',
    ownerId: 'COCO-5120',
    ownerName: 'Maria Elena Santos',
    sector: 'Sector Bravo',
    row: 8,
    column: 6,
    x: 75,
    y: 22,
    status: 'No Pests',
    threatScore: 8,
    pestDetected: 'None',
    vibrationFrequencyHz: 52,
    vibrationGrams: 0.09,
    lastInspected: '45 mins ago',
    assignedNodeId: 'NODE-002',
    piezoSensorId: 'PZ-002-B1',
    soilMoisturePercent: 65,
    ambientTempC: 30.1
  },
  {
    id: 'TR-2102',
    ownerId: 'COCO-5120',
    ownerName: 'Maria Elena Santos',
    sector: 'Sector Bravo',
    row: 8,
    column: 7,
    x: 82,
    y: 35,
    status: 'No Pests',
    threatScore: 15,
    pestDetected: 'None',
    vibrationFrequencyHz: 65,
    vibrationGrams: 0.15,
    lastInspected: '2 hours ago',
    assignedNodeId: 'NODE-002',
    piezoSensorId: 'PZ-002-B2',
    soilMoisturePercent: 67,
    ambientTempC: 30.3
  },
  {
    id: 'TR-3301',
    ownerId: 'COCO-9304',
    ownerName: 'Rodrigo Macaraeg',
    sector: 'Sector Charlie',
    row: 2,
    column: 4,
    x: 35,
    y: 72,
    status: 'Active Infestation',
    threatScore: 94,
    pestDetected: 'Red Palm Weevil',
    vibrationFrequencyHz: 480,
    vibrationGrams: 1.12,
    lastInspected: '5 mins ago',
    assignedNodeId: 'NODE-003',
    piezoSensorId: 'PZ-003-C1',
    soilMoisturePercent: 59,
    ambientTempC: 31.0
  },
  {
    id: 'TR-3302',
    ownerId: 'COCO-9304',
    ownerName: 'Rodrigo Macaraeg',
    sector: 'Sector Charlie',
    row: 2,
    column: 5,
    x: 42,
    y: 78,
    status: 'Active Infestation',
    threatScore: 82,
    pestDetected: 'Red Palm Weevil',
    vibrationFrequencyHz: 420,
    vibrationGrams: 0.89,
    lastInspected: '15 mins ago',
    assignedNodeId: 'NODE-003',
    piezoSensorId: 'PZ-003-C2',
    soilMoisturePercent: 60,
    ambientTempC: 31.1
  },
  {
    id: 'TR-4401',
    ownerId: 'COCO-3189',
    ownerName: 'Cheska Cate Victorio',
    sector: 'Sector Delta',
    row: 11,
    column: 3,
    x: 68,
    y: 65,
    status: 'Potential Infestation',
    threatScore: 54,
    pestDetected: 'Rhinoceros Beetle',
    vibrationFrequencyHz: 280,
    vibrationGrams: 0.49,
    lastInspected: '20 mins ago',
    assignedNodeId: 'NODE-004',
    piezoSensorId: 'PZ-004-D1',
    soilMoisturePercent: 78,
    ambientTempC: 27.9
  },
  {
    id: 'TR-4402',
    ownerId: 'COCO-3189',
    ownerName: 'Cheska Cate Victorio',
    sector: 'Sector Delta',
    row: 11,
    column: 4,
    x: 74,
    y: 70,
    status: 'No Pests',
    threatScore: 11,
    pestDetected: 'None',
    vibrationFrequencyHz: 45,
    vibrationGrams: 0.10,
    lastInspected: '1 hour ago',
    assignedNodeId: 'NODE-004',
    piezoSensorId: 'PZ-004-D2',
    soilMoisturePercent: 76,
    ambientTempC: 28.0
  },
  {
    id: 'TR-5501',
    ownerId: 'COCO-1104',
    ownerName: 'Danilo Bautista',
    sector: 'Sector Echo',
    row: 7,
    column: 9,
    x: 20,
    y: 20,
    status: 'No Pests',
    threatScore: 6,
    pestDetected: 'None',
    vibrationFrequencyHz: 38,
    vibrationGrams: 0.08,
    lastInspected: '4 hours ago',
    assignedNodeId: 'NODE-005',
    piezoSensorId: 'PZ-005-E1',
    soilMoisturePercent: 81,
    ambientTempC: 27.5
  }
];

export const INITIAL_NODES: MasterNode[] = [
  {
    id: 'NODE-001',
    name: 'Control Hub Alpha-1',
    sector: 'Sector Alpha',
    online: true,
    batteryPercent: 94,
    signalRssi: '-62 dBm (Strong)',
    note: 'Mesh Master Active',
    totalSensors: 4,
    workingSensors: 3,
    damagedSensors: 0,
    lastPing: 'Just now',
    firmwareVersion: 'v2.4.8-STABLE',
    coordinates: [13.9311, 121.4233],
    sensors: [
      { id: 'NODE-001-A0', treeId: 'TR-1045', status: 'OPTIMAL', frequencyHz: 42, voltageMv: 3290 },
      { id: 'NODE-001-A1', treeId: 'TR-1046', status: 'OPTIMAL', frequencyHz: 38, voltageMv: 3280 },
      { id: 'NODE-001-A2', treeId: 'TR-1047', status: 'WORKING', frequencyHz: 345, voltageMv: 3250 },
      { id: 'NODE-001-A3', treeId: 'TR-1048', status: 'NOT_CONNECTED', frequencyHz: 0, voltageMv: 0 },
    ]
  },
  {
    id: 'NODE-002',
    name: 'Control Hub Bravo-1',
    sector: 'Sector Bravo',
    online: true,
    batteryPercent: 88,
    signalRssi: '-68 dBm (Good)',
    note: 'Optimal Routing',
    totalSensors: 4,
    workingSensors: 4,
    damagedSensors: 0,
    lastPing: '2 mins ago',
    firmwareVersion: 'v2.4.8-STABLE',
    coordinates: [13.9634, 121.5255],
    sensors: [
      { id: 'NODE-002-A0', treeId: 'TR-2101', status: 'OPTIMAL', frequencyHz: 52, voltageMv: 3285 },
      { id: 'NODE-002-A1', treeId: 'TR-2102', status: 'OPTIMAL', frequencyHz: 65, voltageMv: 3270 },
      { id: 'NODE-002-A2', treeId: 'TR-2103', status: 'OPTIMAL', frequencyHz: 41, voltageMv: 3290 },
      { id: 'NODE-002-A3', treeId: 'TR-2104', status: 'OPTIMAL', frequencyHz: 39, voltageMv: 3300 },
    ]
  },
  {
    id: 'NODE-003',
    name: 'Control Hub Charlie-1',
    sector: 'Sector Charlie',
    online: false,
    batteryPercent: 12,
    signalRssi: 'No Signal',
    note: 'Battery Low / Inactive',
    totalSensors: 4,
    workingSensors: 2,
    damagedSensors: 1,
    lastPing: '14 hours ago',
    firmwareVersion: 'v2.4.6-LEGACY',
    coordinates: [13.5833, 123.2833],
    sensors: [
      { id: 'NODE-003-A0', treeId: 'TR-3301', status: 'WORKING', frequencyHz: 480, voltageMv: 2890 },
      { id: 'NODE-003-A1', treeId: 'TR-3302', status: 'WORKING', frequencyHz: 420, voltageMv: 2910 },
      { id: 'NODE-003-A2', treeId: 'TR-3303', status: 'DAMAGED', frequencyHz: 0, voltageMv: 1100 },
      { id: 'NODE-003-A3', treeId: 'TR-3304', status: 'NOT_CONNECTED', frequencyHz: 0, voltageMv: 0 },
    ]
  },
  {
    id: 'NODE-004',
    name: 'Control Hub Delta-1 (ASCOT)',
    sector: 'Sector Delta',
    online: true,
    batteryPercent: 99,
    signalRssi: '-54 dBm (Excellent)',
    note: 'Solar Array Active',
    totalSensors: 4,
    workingSensors: 4,
    damagedSensors: 0,
    lastPing: 'Just now',
    firmwareVersion: 'v2.5.0-BETA',
    coordinates: [15.7594, 121.5625],
    sensors: [
      { id: 'NODE-004-A0', treeId: 'TR-4401', status: 'WORKING', frequencyHz: 280, voltageMv: 3310 },
      { id: 'NODE-004-A1', treeId: 'TR-4402', status: 'OPTIMAL', frequencyHz: 45, voltageMv: 3320 },
      { id: 'NODE-004-A2', treeId: 'TR-4403', status: 'OPTIMAL', frequencyHz: 40, voltageMv: 3315 },
      { id: 'NODE-004-A3', treeId: 'TR-4404', status: 'OPTIMAL', frequencyHz: 48, voltageMv: 3310 },
    ]
  },
  {
    id: 'NODE-005',
    name: 'Control Hub Echo-1',
    sector: 'Sector Echo',
    online: true,
    batteryPercent: 76,
    signalRssi: '-71 dBm (Fair)',
    note: 'Optimal Routing',
    totalSensors: 4,
    workingSensors: 3,
    damagedSensors: 0,
    lastPing: '4 mins ago',
    firmwareVersion: 'v2.4.8-STABLE',
    coordinates: [14.0683, 121.3256],
    sensors: [
      { id: 'NODE-005-A0', treeId: 'TR-5501', status: 'OPTIMAL', frequencyHz: 38, voltageMv: 3260 },
      { id: 'NODE-005-A1', treeId: 'TR-5502', status: 'OPTIMAL', frequencyHz: 42, voltageMv: 3265 },
      { id: 'NODE-005-A2', treeId: 'TR-5503', status: 'OPTIMAL', frequencyHz: 39, voltageMv: 3270 },
      { id: 'NODE-005-A3', treeId: 'TR-5504', status: 'NOT_CONNECTED', frequencyHz: 0, voltageMv: 0 },
    ]
  }
];

export const INITIAL_ALERTS: PestAlert[] = [
  {
    id: 101,
    title: 'High-Frequency Larval Boring Vibration',
    sector: 'Sector Charlie',
    treeId: 'TR-3301',
    nodeId: 'NODE-003',
    pest: 'Red Palm Weevil',
    severity: 'CRITICAL',
    desc: 'Piezoelectric sensor detected continuous 480Hz acoustic pulses exceeding 1.1g threshold inside the trunk crown.',
    grams: 1.12,
    frequencyHz: 480,
    createdAt: '10 minutes ago',
    reviewed: false,
  },
  {
    id: 102,
    title: 'Acoustic Resonance Anomaly in Sector Alpha',
    sector: 'Sector Alpha',
    treeId: 'TR-1048',
    nodeId: 'NODE-001',
    pest: 'Rhinoceros Beetle',
    severity: 'CRITICAL',
    desc: 'Boring pattern matches Rhinoceros Beetle mastication signatures (345Hz, 0.94g acceleration).',
    grams: 0.94,
    frequencyHz: 345,
    createdAt: '25 minutes ago',
    reviewed: false,
  },
  {
    id: 103,
    title: 'Moderate Vibration Spike Recorded',
    sector: 'Sector Delta',
    treeId: 'TR-4401',
    nodeId: 'NODE-004',
    pest: 'Rhinoceros Beetle',
    severity: 'WARNING',
    desc: 'Intermittent boring activity recorded during twilight feeding window.',
    grams: 0.49,
    frequencyHz: 280,
    createdAt: '2 hours ago',
    reviewed: false,
  },
  {
    id: 104,
    title: 'Node 003 Offline & Low Battery Alert',
    sector: 'Sector Charlie',
    treeId: 'TR-3303',
    nodeId: 'NODE-003',
    pest: 'Hardware Fault',
    severity: 'WARNING',
    desc: 'Master node 003 missed 3 consecutive heartbeat windows. Last battery voltage 2.89V.',
    grams: 0.0,
    frequencyHz: 0,
    createdAt: '14 hours ago',
    reviewed: true,
    reviewedAt: '12 hours ago',
    reviewedBy: 'Admin (Cheska V.)'
  },
  {
    id: 105,
    title: 'Routine Bioacoustic Sweep Baseline Cleared',
    sector: 'Sector Bravo',
    treeId: 'TR-2101',
    nodeId: 'NODE-002',
    pest: 'Stem Borer',
    severity: 'INFO',
    desc: 'All 6 trees in row 8 passed the automated 24-hour acoustic spectrum verification.',
    grams: 0.09,
    frequencyHz: 52,
    createdAt: '1 day ago',
    reviewed: true,
    reviewedAt: '1 day ago',
    reviewedBy: 'System Auto-Audit'
  }
];

export const INITIAL_VIBRATION_EVENTS: VibrationEvent[] = [
  { id: 'VIB-9921', sector: 'Sector Charlie', treeId: 'TR-3301', nodeId: 'NODE-003', grams: 1.12, frequencyHz: 480, severity: 'Critical', timestamp: 'Just now', pestProbability: 98 },
  { id: 'VIB-9920', sector: 'Sector Alpha', treeId: 'TR-1048', nodeId: 'NODE-001', grams: 0.94, frequencyHz: 345, severity: 'Critical', timestamp: '12m ago', pestProbability: 92 },
  { id: 'VIB-9919', sector: 'Sector Delta', treeId: 'TR-4401', nodeId: 'NODE-004', grams: 0.49, frequencyHz: 280, severity: 'Warning', timestamp: '24m ago', pestProbability: 64 },
  { id: 'VIB-9918', sector: 'Sector Alpha', treeId: 'TR-1049', nodeId: 'NODE-001', grams: 0.58, frequencyHz: 290, severity: 'Warning', timestamp: '48m ago', pestProbability: 68 },
  { id: 'VIB-9917', sector: 'Sector Bravo', treeId: 'TR-2102', nodeId: 'NODE-002', grams: 0.15, frequencyHz: 65, severity: 'Normal', timestamp: '1h ago', pestProbability: 8 },
  { id: 'VIB-9916', sector: 'Sector Echo', treeId: 'TR-5501', nodeId: 'NODE-005', grams: 0.08, frequencyHz: 38, severity: 'Normal', timestamp: '2h ago', pestProbability: 4 },
];

// Notifications are pest-detection-only (see server/routes/ingest.js,
// which is the sole source of real notification rows) -- this demo/
// offline-fallback list mirrors that.
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: 1, icon: 'alert-triangle', title: 'Critical Pest Signature in Sector Charlie', message: 'Red Palm Weevil detected in tree TR-3301 with 98% bioacoustic match.', category: 'PEST', createdAt: '10m ago', isRead: false },
  { id: 2, icon: 'alert-triangle', title: 'Pest Feeding Pattern Detected', message: 'Sector Delta (NODE-004) matched a sustained feeding-pattern signature.', category: 'PEST', createdAt: '14h ago', isRead: true },
];

// CocoSense only operates in Aurora province (Region III / Central
// Luzon), so the PSGC cascade used by the "Register Farm Owner" form
// is scoped to exactly that -- all 8 municipalities and all 151
// barangays of Aurora (PSA/PSGC-aligned, cross-checked against
// PhilAtlas' barangay list -- https://www.philatlas.com/luzon/r03/aurora.html),
// instead of the old scattered demo entries across five provinces.
// Each municipality carries an approximate town-center lat/lng so the
// map picker in the registration form can jump straight to the right
// area before the admin fine-tunes the exact farm pin.
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
            code: '037701000', name: 'Baler', lat: 15.7583, lng: 121.5625,
            barangays: ['Barangay I (Poblacion)', 'Barangay II (Poblacion)', 'Barangay III (Poblacion)', 'Barangay IV (Poblacion)', 'Barangay V (Poblacion)', 'Buhangin', 'Calabuanan', 'Obligacion', 'Pingit', 'Reserva', 'Sabang', 'Suklayin', 'Zabali']
          },
          {
            code: '037702000', name: 'Casiguran', lat: 16.2800, lng: 122.1200,
            barangays: ['Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)', 'Barangay 3 (Poblacion)', 'Barangay 4 (Poblacion)', 'Barangay 5 (Poblacion)', 'Barangay 6 (Poblacion)', 'Barangay 7 (Poblacion)', 'Barangay 8 (Poblacion)', 'Bianuan', 'Calabgan', 'Calangcuasan', 'Calantas', 'Cozo', 'Culat', 'Dibacong', 'Dibet', 'Ditinagyan', 'Esperanza', 'Esteves', 'Lual', 'Marikit', 'San Ildefonso', 'Tabas', 'Tinib']
          },
          {
            code: '037703000', name: 'Dilasag', lat: 16.4000, lng: 122.2200,
            barangays: ['Diagyan', 'Dicabasan', 'Dilaguidi', 'Dimaseset', 'Diniog', 'Esperanza', 'Lawang', 'Maligaya', 'Manggitahan', 'Masagana', 'Ura']
          },
          {
            code: '037705000', name: 'Dinalungan', lat: 16.1000, lng: 121.7700,
            barangays: ['Abuleg', 'Dibaraybay', 'Ditawini', 'Mapalad', 'Nipoo', 'Paleg', 'Simbahan', 'Zone I (Poblacion)', 'Zone II (Poblacion)']
          },
          {
            code: '037707000', name: 'Dingalan', lat: 15.3800, lng: 121.4000,
            barangays: ['Aplaya', 'Butas na Bato', 'Cabog', 'Caragsacan', 'Davildavilan', 'Dikapanikian', 'Ibona', 'Paltic', 'Poblacion', 'Tanawan', 'Umiray']
          },
          {
            code: '037704000', name: 'Dipaculao', lat: 15.9800, lng: 121.6300,
            barangays: ['Bayabas', 'Borlongan', 'Buenavista', 'Calaocan', 'Diamanen', 'Dianed', 'Diarabasin', 'Dibutunan', 'Dimabuno', 'Dinadiawan', 'Ditale', 'Gupa', 'Ipil', 'Laboy', 'Lipit', 'Lobbot', 'Maligaya', 'Mijares', 'Mucdol', 'North Poblacion', 'Puangi', 'Salay', 'Sapangkawayan', 'South Poblacion', 'Toytoyan']
          },
          {
            code: '037706000', name: 'Maria Aurora', lat: 15.7967, lng: 121.4737,
            barangays: ['Alcala', 'Bagtu', 'Bangco', 'Bannawag', 'Barangay I (Poblacion)', 'Barangay II (Poblacion)', 'Barangay III (Poblacion)', 'Barangay IV (Poblacion)', 'Baubo', 'Bayanihan', 'Bazal', 'Cabituculan East', 'Cabituculan West', 'Cadayacan', 'Debucao', 'Decoliat', 'Detailen', 'Diaat', 'Dialatman', 'Diaman', 'Dianawan', 'Dikildit', 'Dimanpudso', 'Diome', 'Estonilo', 'Florida', 'Galintuja', 'Malasin', 'Ponglo', 'Quirino', 'Ramada', 'San Joaquin', 'San Jose', 'San Juan', 'San Leonardo', 'Santa Lucia', 'Santo Tomas', 'Suguit', 'Villa Aurora', 'Wenceslao']
          },
          {
            code: '037708000', name: 'San Luis', lat: 15.7200, lng: 121.5200,
            barangays: ['Bacong', 'Barangay I (Poblacion)', 'Barangay II (Poblacion)', 'Barangay III (Poblacion)', 'Barangay IV (Poblacion)', 'Dibalo', 'Dibayabay', 'Dibut', 'Dikapinisan', 'Dimanayat', 'Diteki', 'Ditumabo', 'L. Pimentel', 'Nonong Senior', 'Real', 'San Isidro', 'San Jose', 'Zarah']
          }
        ]
      }
    ]
  }
];

// Approximate bounding box around the whole province -- used to center
// the dashboard's Farm Owners map on Aurora by default and to keep the
// registration map picker from wandering off into a different province.
export const AURORA_PROVINCE_CENTER: [number, number] = [15.88, 121.55];
export const AURORA_PROVINCE_BOUNDS: [[number, number], [number, number]] = [
  [15.15, 121.05], // SW
  [16.55, 122.45], // NE
];

export const LARAVEL_COMPONENTS: LaravelComponentDef[] = [
  {
    id: 'radar-scanner',
    name: 'Radar Scanner & Bioacoustic Map',
    tag: '<x-cocosense.radar-scanner :sector="$sector" :trees="$trees" :activeRadar="true" />',
    category: 'Telemetry & Radar',
    description: 'An interactive SVG/Canvas bioacoustic radar screen with animated sweeping beam, plotted tree nodes, and threat-level color codings.',
    props: [
      { name: 'sector', type: 'string', default: 'Sector Alpha', description: 'Active plantation sector name or ID' },
      { name: 'trees', type: 'Collection|array', default: '[]', description: 'Collection of monitored coconut trees with X/Y coordinates' },
      { name: 'sweepSpeed', type: 'int', default: '4', description: 'Radar sweep cycle duration in seconds' },
      { name: 'showPulse', type: 'bool', default: 'true', description: 'Enable radar acoustic pulse animations' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/radar-scanner.blade.php --}}
@props([
    'sector' => 'Sector Alpha',
    'trees' => [],
    'sweepSpeed' => 4,
    'showPulse' => true,
])

<div class="relative w-full aspect-square max-w-md mx-auto rounded-3xl bg-[#06100B] border-2 border-emerald-500/40 p-6 overflow-hidden shadow-2xl shadow-emerald-950/60 group">
    {{-- Radar Concentric Rings --}}
    <div class="absolute inset-4 rounded-full border border-emerald-500/20 pointer-events-none"></div>
    <div class="absolute inset-14 rounded-full border border-emerald-500/25 pointer-events-none"></div>
    <div class="absolute inset-24 rounded-full border border-emerald-500/30 pointer-events-none"></div>
    <div class="absolute inset-36 rounded-full border border-emerald-500/40 pointer-events-none"></div>

    {{-- Crosshairs --}}
    <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-emerald-500/20"></div>
    <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-emerald-500/20"></div>

    {{-- Animated Radar Sweeper Beam --}}
    <div class="absolute inset-0 origin-center pointer-events-none" style="animation: radar-sweep {{ $sweepSpeed }}s linear infinite;">
        <div class="w-1/2 h-1/2 bg-gradient-to-br from-emerald-500/40 via-emerald-400/10 to-transparent transform -rotate-45 origin-bottom-right rounded-tl-full"></div>
    </div>

    {{-- Plotted Coconut Trees --}}
    @foreach($trees as $tree)
        @php
            $dotColor = match($tree->status ?? $tree['status']) {
                'Active Infestation' => 'bg-red-500 shadow-red-500/80 animate-ping',
                'Potential Infestation' => 'bg-amber-400 shadow-amber-400/80',
                default => 'bg-emerald-400 shadow-emerald-400/80'
            };
        @endphp
        <button 
            type="button"
            wire:click="selectTree('{{ $tree->id ?? $tree['id'] }}')"
            class="absolute w-3.5 h-3.5 rounded-full {{ $dotColor }} shadow-lg transition-transform hover:scale-150 z-20 cursor-pointer -translate-x-1/2 -translate-y-1/2"
            style="left: {{ $tree->x ?? $tree['x'] }}%; top: {{ $tree->y ?? $tree['y'] }}%;"
            title="{{ $tree->id ?? $tree['id'] }} - {{ $tree->status ?? $tree['status'] }}"
        ></button>
    @endforeach

    {{-- Radar Overlay Info --}}
    <div class="absolute top-4 left-4 z-30 flex items-center gap-2">
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="font-mono text-xs font-bold text-emerald-400 tracking-wider uppercase">{{ $sector }} BIO-RADAR</span>
    </div>
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;

class RadarScanner extends Component
{
    public function __construct(
        public string $sector = 'Sector Alpha',
        public mixed $trees = [],
        public int $sweepSpeed = 4,
        public bool $showPulse = true
    ) {}

    public function render(): View
    {
        return view('components.cocosense.radar-scanner');
    }
}`,
    usageExample: `<x-cocosense.radar-scanner 
    :sector="$activeSector" 
    :trees="$monitoredTrees" 
    :sweepSpeed="3" 
/>`
  },
  {
    id: 'brand-logo',
    name: 'CocoSense Official Brand Mark',
    tag: '<x-cocosense.brand-logo variant="stacked" size="lg" />',
    category: 'Branding & Visuals',
    description: 'The authentic vector logo featuring the green radar quadrant arc with concentric waves, coconut palm tree silhouette, and high-contrast typography.',
    props: [
      { name: 'variant', type: 'string', default: 'horizontal', description: 'Logo layout lockup', options: ['horizontal', 'stacked', 'badge-icon', 'mark-only'] },
      { name: 'size', type: 'string', default: 'md', description: 'Render size scale', options: ['sm', 'md', 'lg', 'xl'] },
      { name: 'animateRadar', type: 'bool', default: 'false', description: 'Enable subtle pulse glow on radar arc' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/brand-logo.blade.php --}}
@props([
    'variant' => 'horizontal',
    'size' => 'md',
    'animateRadar' => false,
])

@php
    $sizeClasses = match($size) {
        'sm' => 'h-7 text-sm',
        'lg' => 'h-14 text-2xl',
        'xl' => 'h-20 text-3xl',
        default => 'h-10 text-lg',
    };
@endphp

<div {{ $attributes->merge(['class' => "inline-flex items-center gap-3 font-sans select-none {$sizeClasses}"]) }}>
    {{-- Vector Radar Palm Symbol --}}
    <svg viewBox="0 0 120 120" class="h-full aspect-square flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        {{-- Radar 90-degree quadrant --}}
        <path d="M20 100 A80 80 0 0 1 100 100 L20 100 Z" fill="#10B981" class="{{ $animateRadar ? 'animate-pulse' : '' }}" />
        
        {{-- Radar Concentric Arc Rings --}}
        <path d="M20 100 A20 20 0 0 1 40 100" stroke="#047857" stroke-width="2" fill="none" />
        <path d="M20 100 A40 40 0 0 1 60 100" stroke="#047857" stroke-width="2" fill="none" />
        <path d="M20 100 A60 60 0 0 1 80 100" stroke="#047857" stroke-width="2" fill="none" />
        <path d="M20 100 A80 80 0 0 1 100 100" stroke="#064E3B" stroke-width="2.5" fill="none" />
        
        {{-- Radar Needle & Pivot --}}
        <line x1="20" y1="100" x2="60" y2="30" stroke="#0B130E" stroke-width="4" stroke-linecap="round" />
        <circle cx="20" cy="100" r="4" fill="#0B130E" />

        {{-- Coconut Palm Tree Silhouettes --}}
        <path d="M20 100 Q 25 50 30 18 L 33 19 Q 28 50 22 100 Z" fill="#0B130E" />
        {{-- Left palm fronds --}}
        <path d="M30 18 C 15 10 5 22 4 28 C 12 25 24 22 30 18 Z" fill="#0B130E" />
        <path d="M30 18 C 18 2 28 -4 38 -2 C 34 8 32 14 30 18 Z" fill="#0B130E" />
        <path d="M30 18 C 42 6 52 14 55 24 C 45 20 36 19 30 18 Z" fill="#0B130E" />
        <path d="M30 18 C 38 28 42 36 40 45 C 34 35 32 26 30 18 Z" fill="#0B130E" />
        <path d="M30 18 C 18 28 12 36 10 44 C 18 36 24 28 30 18 Z" fill="#0B130E" />

        {{-- Secondary palm --}}
        <path d="M20 100 Q 40 65 58 35 L 61 36 Q 42 66 22 100 Z" fill="#0B130E" />
        <path d="M58 35 C 50 25 42 28 38 32 C 45 32 52 34 58 35 Z" fill="#0B130E" />
        <path d="M58 35 C 64 22 72 24 76 28 C 70 30 64 33 58 35 Z" fill="#0B130E" />
        <path d="M58 35 C 68 40 70 48 68 54 C 62 46 60 40 58 35 Z" fill="#0B130E" />
    </svg>

    @if($variant !== 'mark-only')
        <div class="flex {{ $variant === 'stacked' ? 'flex-col -space-y-1' : 'items-baseline gap-1' }} font-extrabold tracking-tight">
            <span class="text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)]">COCO</span>
            <span class="text-emerald-400 font-black">SENSE</span>
        </div>
    @endif
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;

class BrandLogo extends Component
{
    public function __construct(
        public string $variant = 'horizontal',
        public string $size = 'md',
        public bool $animateRadar = false
    ) {}

    public function render(): View
    {
        return view('components.cocosense.brand-logo');
    }
}`,
    usageExample: `<x-cocosense.brand-logo variant="horizontal" size="lg" :animateRadar="true" />`
  },
  {
    id: 'stat-card',
    name: 'Plantation KPI Telemetry Card',
    tag: '<x-cocosense.stat-card icon="bug" label="Active Pest Alerts" value="34" delta="+5 from yesterday" tone="danger" />',
    category: 'UI & Forms',
    description: 'High-contrast telemetry card designed for plantation dashboards, supporting tone variants (emerald, warning, danger) and live pulse indicators.',
    props: [
      { name: 'icon', type: 'string', default: 'activity', description: 'Lucide icon identifier' },
      { name: 'label', type: 'string', default: 'Metric Label', description: 'KPI title label' },
      { name: 'value', type: 'string|int', default: '0', description: 'Primary numeric value' },
      { name: 'delta', type: 'string', default: 'null', description: 'Contextual change string' },
      { name: 'tone', type: 'string', default: 'emerald', description: 'Color theme tone', options: ['emerald', 'warning', 'danger', 'slate'] },
      { name: 'pulse', type: 'bool', default: 'false', description: 'Alert breathing ring indicator' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/stat-card.blade.php --}}
@props([
    'icon' => 'activity',
    'label' => 'Metric Label',
    'value' => '0',
    'delta' => null,
    'tone' => 'emerald',
    'pulse' => false,
])

@php
    $toneClasses = match($tone) {
        'danger' => 'bg-rose-950/40 border-rose-500/30 text-rose-300 ring-rose-500/20',
        'warning' => 'bg-amber-950/40 border-amber-500/30 text-amber-300 ring-amber-500/20',
        'slate' => 'bg-slate-900/60 border-slate-800 text-slate-300 ring-slate-700/20',
        default => 'bg-[#0B1E13]/80 border-emerald-500/30 text-emerald-300 ring-emerald-500/20',
    };
@endphp

<div {{ $attributes->merge(['class' => "relative rounded-2xl border p-5 transition-all hover:border-emerald-400/50 hover:shadow-lg {$toneClasses}"]) }}>
    @if($pulse)
        <div class="absolute -top-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </div>
    @endif

    <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ $label }}</span>
        <div class="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-current">
            <x-icon :name="$icon" class="w-4 h-4" />
        </div>
    </div>

    <div class="mt-3 font-mono text-3xl font-extrabold text-white tracking-tight">
        {{ $value }}
    </div>

    @if($delta)
        <div class="mt-2 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <span>{{ $delta }}</span>
        </div>
    @endif
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;

class StatCard extends Component
{
    public function __construct(
        public string $icon = 'activity',
        public string $label = 'Metric Label',
        public string|int $value = '0',
        public ?string $delta = null,
        public string $tone = 'emerald',
        public bool $pulse = false
    ) {}

    public function render(): View
    {
        return view('components.cocosense.stat-card');
    }
}`,
    usageExample: `<x-cocosense.stat-card 
    icon="bug" 
    label="Active Pest Alerts" 
    value="34" 
    delta="+5 from yesterday" 
    tone="danger" 
    :pulse="true" 
/>`
  },
  {
    id: 'tree-card',
    name: 'Monitored Tree Acoustic Inspector Card',
    tag: '<x-cocosense.tree-card :tree="$tree" />',
    category: 'Hardware & Nodes',
    description: 'Displays a coconut tree with its piezoelectric sensor resonance frequency (Hz), threat score, row/column location, and action triggers.',
    props: [
      { name: 'tree', type: 'App\\Models\\MonitoredTree|array', description: 'Tree model instance with bioacoustic telemetry data' },
      { name: 'showSpectrogram', type: 'bool', default: 'false', description: 'Render mini acoustic frequency graph' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/tree-card.blade.php --}}
@props([
    'tree',
    'showSpectrogram' => false
])

@php
    $statusBadge = match($tree->status ?? $tree['status']) {
        'Active Infestation' => 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        'Potential Infestation' => 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        default => 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };
@endphp

<div class="rounded-2xl bg-[#0F1E15] border border-emerald-500/20 p-5 hover:border-emerald-400/60 transition-all shadow-md">
    <div class="flex items-start justify-between">
        <div>
            <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-lg text-white">{{ $tree->id ?? $tree['id'] }}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border {{ $statusBadge }}">
                    {{ $tree->status ?? $tree['status'] }}
                </span>
            </div>
            <p class="text-xs text-slate-400 mt-1">
                {{ $tree->sector ?? $tree['sector'] }} &middot; Row {{ $tree->row ?? $tree['row'] }}, Col {{ $tree->column ?? $tree['column'] }}
            </p>
        </div>
        <div class="text-right">
            <span class="font-mono text-xl font-bold {{ ($tree->threatScore ?? $tree['threatScore']) > 70 ? 'text-rose-400' : 'text-emerald-400' }}">
                {{ $tree->threatScore ?? $tree['threatScore'] }}%
            </span>
            <div class="text-[10px] uppercase font-bold text-slate-500">Threat Score</div>
        </div>
    </div>

    {{-- Acoustic Frequency & Piezo Reading --}}
    <div class="mt-4 grid grid-cols-2 gap-2 bg-[#08120B] p-3 rounded-xl border border-emerald-950 font-mono text-xs">
        <div>
            <span class="text-slate-500 block text-[10px]">RESONANCE</span>
            <span class="font-bold text-emerald-300">{{ $tree->vibrationFrequencyHz ?? $tree['vibrationFrequencyHz'] }} Hz</span>
        </div>
        <div>
            <span class="text-slate-500 block text-[10px]">VIBRATION</span>
            <span class="font-bold text-emerald-300">{{ $tree->vibrationGrams ?? $tree['vibrationGrams'] }} g</span>
        </div>
    </div>
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;
use App\\Models\\MonitoredTree;

class TreeCard extends Component
{
    public function __construct(
        public MonitoredTree|array $tree,
        public bool $showSpectrogram = false
    ) {}

    public function render(): View
    {
        return view('components.cocosense.tree-card');
    }
}`,
    usageExample: `<x-cocosense.tree-card :tree="$tree" />`
  },
  {
    id: 'psgc-address-picker',
    name: 'Philippine PSGC Address Cascade Select',
    tag: '<x-cocosense.psgc-address-picker :regions="$regions" />',
    category: 'UI & Forms',
    description: 'Full 4-level Philippine Standard Geographic Code cascade (Region -> Province -> City/Municipality -> Barangay) with auto-synced readable names for database persistence.',
    props: [
      { name: 'regions', type: 'array', default: '[]', description: 'PSGC Geographic hierarchy dataset' },
      { name: 'selectedRegion', type: 'string', default: 'null', description: 'Preselected Region name' },
      { name: 'selectedProvince', type: 'string', default: 'null', description: 'Preselected Province name' },
      { name: 'selectedCity', type: 'string', default: 'null', description: 'Preselected City name' },
      { name: 'selectedBarangay', type: 'string', default: 'null', description: 'Preselected Barangay name' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/psgc-address-picker.blade.php --}}
@props([
    'regions' => [],
    'selectedRegion' => null,
    'selectedProvince' => null,
    'selectedCity' => null,
    'selectedBarangay' => null,
])

<div x-data="psgcPicker({{ json_encode($regions) }})" class="space-y-4">
    {{-- Street Address --}}
    <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Street / House No.</label>
        <input type="text" name="street" class="w-full rounded-xl bg-[#09150E] border border-emerald-500/30 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none" placeholder="e.g., 123 Mabini St." required />
    </div>

    {{-- Region & Province --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Region</label>
            <select x-model="selectedRegionCode" @change="onRegionChange" class="w-full rounded-xl bg-[#09150E] border border-emerald-500/30 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none">
                <option value="">Select Region</option>
                <template x-for="r in regions" :key="r.code">
                    <option :value="r.code" x-text="r.name"></option>
                </template>
            </select>
            <input type="hidden" name="region_name" :value="selectedRegionName" />
        </div>

        <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Province</label>
            <select x-model="selectedProvinceCode" @change="onProvinceChange" :disabled="!availableProvinces.length" class="w-full rounded-xl bg-[#09150E] border border-emerald-500/30 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none disabled:opacity-50">
                <option value="">Select Province</option>
                <template x-for="p in availableProvinces" :key="p.code">
                    <option :value="p.code" x-text="p.name"></option>
                </template>
            </select>
            <input type="hidden" name="province_name" :value="selectedProvinceName" />
        </div>
    </div>

    {{-- City & Barangay --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">City / Municipality</label>
            <select x-model="selectedCityCode" @change="onCityChange" :disabled="!availableCities.length" class="w-full rounded-xl bg-[#09150E] border border-emerald-500/30 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none disabled:opacity-50">
                <option value="">Select City / Municipality</option>
                <template x-for="c in availableCities" :key="c.code">
                    <option :value="c.code" x-text="c.name"></option>
                </template>
            </select>
            <input type="hidden" name="city_name" :value="selectedCityName" />
        </div>

        <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Barangay</label>
            <select x-model="selectedBarangayName" :disabled="!availableBarangays.length" class="w-full rounded-xl bg-[#09150E] border border-emerald-500/30 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none disabled:opacity-50">
                <option value="">Select Barangay</option>
                <template x-for="b in availableBarangays" :key="b">
                    <option :value="b" x-text="b"></option>
                </template>
            </select>
            <input type="hidden" name="barangay_name" :value="selectedBarangayName" />
        </div>
    </div>
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;

class PsgcAddressPicker extends Component
{
    public function __construct(
        public array $regions = [],
        public ?string $selectedRegion = null,
        public ?string $selectedProvince = null,
        public ?string $selectedCity = null,
        public ?string $selectedBarangay = null
    ) {}

    public function render(): View
    {
        return view('components.cocosense.psgc-address-picker');
    }
}`,
    usageExample: `<x-cocosense.psgc-address-picker :regions="$psgcRegions" />`
  },
  {
    id: 'master-node-card',
    name: 'Master Node Mesh Controller',
    tag: '<x-cocosense.master-node-card :node="$node" />',
    category: 'Hardware & Nodes',
    description: 'Hardware control hub monitoring 4 piezoelectric sensors per node (A0-A3) with battery level, signal RSSI, live Reboot, and Take Offline action endpoints.',
    props: [
      { name: 'node', type: 'App\\Models\\MasterNode|array', description: 'Master Node model instance' }
    ],
    bladeCode: `{{-- resources/views/components/cocosense/master-node-card.blade.php --}}
@props(['node'])

<div class="rounded-2xl bg-[#0D1D13] border {{ ($node->online ?? $node['online']) ? 'border-emerald-500/30' : 'border-rose-500/40' }} p-6 shadow-xl relative overflow-hidden">
    <div class="flex items-center justify-between mb-4">
        <span class="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">{{ $node->sector ?? $node['sector'] }}</span>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider {{ ($node->online ?? $node['online']) ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40' }}">
            {{ ($node->online ?? $node['online']) ? 'ONLINE' : 'OFFLINE' }}
        </span>
    </div>

    <h3 class="font-mono text-xl font-bold text-white">{{ $node->id ?? $node['id'] }}</h3>
    <p class="text-xs text-slate-400">{{ $node->name ?? $node['name'] }} &middot; {{ $node->firmwareVersion ?? $node['firmwareVersion'] }}</p>

    {{-- Battery & Signal --}}
    <div class="mt-4 space-y-2">
        <div class="flex justify-between text-xs font-semibold">
            <span class="text-slate-400">Battery Level</span>
            <span class="font-mono text-white">{{ $node->batteryPercent ?? $node['batteryPercent'] }}%</span>
        </div>
        <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full {{ ($node->batteryPercent ?? $node['batteryPercent']) > 20 ? 'bg-emerald-500' : 'bg-rose-500' }}" style="width: {{ $node->batteryPercent ?? $node['batteryPercent'] }}%"></div>
        </div>
    </div>

    <div class="mt-5 pt-4 border-t border-emerald-900/40 flex items-center justify-between">
        <div class="text-xs text-slate-400">
            <span class="font-bold text-emerald-300">{{ $node->workingSensors ?? $node['workingSensors'] }}/{{ $node->totalSensors ?? $node['totalSensors'] }}</span> Sensors Active
        </div>
        <form method="POST" action="{{ route('master-nodes.reboot', $node->id ?? $node['id']) }}">
            @csrf
            <button type="submit" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline">
                Reboot Node
            </button>
        </form>
    </div>
</div>`,
    phpClassCode: `<?php

namespace App\\View\\Components\\CocoSense;

use Illuminate\\View\\Component;
use Illuminate\\Contracts\\View\\View;

class MasterNodeCard extends Component
{
    public function __construct(public mixed $node) {}

    public function render(): View
    {
        return view('components.cocosense.master-node-card');
    }
}`,
    usageExample: `<x-cocosense.master-node-card :node="$node" />`
  }
];

export const LARAVEL_ROUTES_SNIPPET = `<?php
// routes/web.php

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\CocoSense\\DashboardController;
use App\\Http\\Controllers\\CocoSense\\FarmOwnerController;
use App\\Http\\Controllers\\CocoSense\\MonitoredTreeController;
use App\\Http\\Controllers\\CocoSense\\MasterNodeController;
use App\\Http\\Controllers\\CocoSense\\AlertHistoryController;
use App\\Http\\Controllers\\CocoSense\\TelemetryReportController;

Route::middleware(['auth'])->prefix('cocosense')->name('cocosense.')->group(function () {
    // Dashboard & Bioacoustic Radar
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/telemetry/stream', [DashboardController::class, 'stream'])->name('telemetry.stream');

    // Farm Owners Management
    Route::resource('owners', FarmOwnerController::class);
    Route::post('owners/{id}/expand-nodes', [FarmOwnerController::class, 'expandNodes'])->name('owners.expand-nodes');
    Route::post('owners/{id}/resend-invitation', [FarmOwnerController::class, 'resendInvitation'])->name('owners.resend-invitation');

    // Monitored Trees & Acoustic Sensors
    Route::get('trees', [MonitoredTreeController::class, 'index'])->name('trees.index');
    Route::get('trees/{id}/spectrogram', [MonitoredTreeController::class, 'spectrogram'])->name('trees.spectrogram');
    Route::post('trees/{id}/inspect', [MonitoredTreeController::class, 'logInspection'])->name('trees.inspect');

    // Master Nodes & Hardware Mesh
    Route::get('nodes', [MasterNodeController::class, 'index'])->name('nodes.index');
    Route::post('nodes/{id}/reboot', [MasterNodeController::class, 'reboot'])->name('nodes.reboot');
    Route::post('nodes/{id}/toggle-status', [MasterNodeController::class, 'toggleStatus'])->name('nodes.toggle-status');
    Route::post('nodes/{id}/self-test', [MasterNodeController::class, 'triggerSelfTest'])->name('nodes.self-test');

    // Alert History & Pest Intervention
    Route::get('alerts', [AlertHistoryController::class, 'index'])->name('alerts.index');
    Route::post('alerts/{id}/resolve', [AlertHistoryController::class, 'resolve'])->name('alerts.resolve');

    // Telemetry Reports & CSV Export
    Route::get('reports', [TelemetryReportController::class, 'index'])->name('reports.index');
    Route::get('reports/export/csv', [TelemetryReportController::class, 'exportCsv'])->name('reports.export.csv');
});
`;

export const LARAVEL_MIGRATION_SNIPPET = `<?php
// database/migrations/2026_02_26_000001_create_cocosense_tables.php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farm_owners', function (Blueprint $table) {
            $table->string('id')->primary(); // e.g. COCO-7842
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('country')->default('Philippines');
            $table->string('region')->nullable();
            $table->string('province')->nullable();
            $table->string('city_municipality')->nullable();
            $table->string('barangay')->nullable();
            $table->string('street')->nullable();
            $table->string('sector')->default('Sector Alpha');
            $table->string('geo_coordinates')->nullable();
            $table->integer('nodes_count')->default(1);
            $table->integer('trees_count')->default(0);
            $table->integer('infected_trees_count')->default(0);
            $table->enum('piezo_health', ['Working', 'Needs Maintenance'])->default('Working');
            $table->enum('status', ['Active', 'Inactive'])->default('Active');
            $table->boolean('account_confirmed')->default(false);
            $table->timestamps();
        });

        Schema::create('master_nodes', function (Blueprint $table) {
            $table->string('id')->primary(); // e.g. NODE-001
            $table->string('name');
            $table->string('sector');
            $table->boolean('online')->default(true);
            $table->integer('battery_percent')->default(100);
            $table->string('signal_rssi')->default('-65 dBm');
            $table->integer('total_sensors')->default(6);
            $table->integer('working_sensors')->default(6);
            $table->integer('damaged_sensors')->default(0);
            $table->string('firmware_version')->default('v2.4.8-STABLE');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();
        });

        Schema::create('monitored_trees', function (Blueprint $table) {
            $table->string('id')->primary(); // e.g. TR-1048
            $table->string('farm_owner_id');
            $table->string('master_node_id');
            $table->string('sector');
            $table->integer('row');
            $table->integer('column');
            $table->integer('radar_x')->default(50);
            $table->integer('radar_y')->default(50);
            $table->enum('status', ['No Pests', 'Potential Infestation', 'Active Infestation'])->default('No Pests');
            $table->integer('threat_score')->default(0); // 0-100%
            $table->string('pest_detected')->nullable();
            $table->decimal('vibration_frequency_hz', 8, 2)->default(45.0);
            $table->decimal('vibration_grams', 6, 3)->default(0.100);
            $table->timestamp('last_inspected_at')->nullable();
            $table->timestamps();

            $table->foreign('farm_owner_id')->references('id')->on('farm_owners')->cascadeOnDelete();
            $table->foreign('master_node_id')->references('id')->on('master_nodes')->cascadeOnDelete();
        });

        Schema::create('pest_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('tree_id');
            $table->string('master_node_id');
            $table->string('sector');
            $table->string('pest_type');
            $table->enum('severity', ['CRITICAL', 'WARNING', 'INFO'])->default('WARNING');
            $table->text('description');
            $table->decimal('vibration_grams', 6, 3);
            $table->decimal('frequency_hz', 8, 2);
            $table->boolean('reviewed')->default(false);
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestamps();

            $table->foreign('tree_id')->references('id')->on('monitored_trees')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pest_alerts');
        Schema::dropIfExists('monitored_trees');
        Schema::dropIfExists('master_nodes');
        Schema::dropIfExists('farm_owners');
    }
};
`;
