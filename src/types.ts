export type PestSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type TreeHealthStatus = 'No Pests' | 'Potential Infestation' | 'Active Infestation';
export type NodeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
export type PiezoStatus = 'OPTIMAL' | 'WORKING' | 'DAMAGED' | 'CALIBRATING' | 'NOT_CONNECTED';

export interface FarmOwner {
  id: string; // e.g. COCO-7842
  name: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  province: string;
  cityMunicipality: string;
  barangay: string;
  street: string;
  address: string;
  sector: string;
  geoCoordinates: string;
  nodesCount: number;
  treesCount: number;
  infectedTreesCount: number;
  piezoHealth: 'Working' | 'Needs Maintenance';
  status: 'Active' | 'Inactive';
  color: string;
  initials: string;
  avatarUrl?: string | null;
  registeredAt: string;
  accountConfirmed: boolean;
}

export interface MonitoredTree {
  id: string; // e.g. TR-2041
  ownerId: string;
  ownerName: string;
  sector: string;
  row: number;
  column: number;
  x: number; // For radar plotting (0 - 100)
  y: number; // For radar plotting (0 - 100)
  status: TreeHealthStatus;
  threatScore: number; // 0 - 100%
  pestDetected?: 'Rhinoceros Beetle' | 'Red Palm Weevil' | 'None';
  vibrationFrequencyHz: number; // e.g. 340 Hz (larval feeding signature)
  vibrationGrams: number; // e.g. 0.84g
  lastInspected: string;
  assignedNodeId: string;
  piezoSensorId: string;
  soilMoisturePercent?: number;
  ambientTempC?: number;
}

export interface MasterNode {
  id: string; // e.g. NODE-001
  name: string;
  sector: string;
  online: boolean;
  batteryPercent: number;
  signalRssi: string; // e.g. -68 dBm (Strong)
  note: string;
  totalSensors: number;
  workingSensors: number;
  damagedSensors: number;
  lastPing: string;
  firmwareVersion: string;
  coordinates: [number, number];
  sensors: Array<{
    id: string;
    treeId: string;
    status: PiezoStatus;
    frequencyHz: number;
    voltageMv: number;
  }>;
}

export interface PestAlert {
  id: number;
  title: string;
  sector: string;
  treeId: string;
  nodeId?: string;
  pest: 'Rhinoceros Beetle' | 'Red Palm Weevil' | 'Stem Borer' | 'Hardware Fault' | string;
  pestType?: string;
  severity: PestSeverity | 'CRITICAL' | 'WARNING' | 'INFO';
  desc?: string;
  grams?: number;
  frequencyHz: number;
  threatScore?: number;
  createdAt: string;
  timestamp?: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface VibrationEvent {
  id: string;
  sector: string;
  treeId: string;
  nodeId?: string;
  piezoSensorId?: string;
  grams: number;
  frequencyHz: number;
  severity: 'Critical' | 'Warning' | 'Normal' | string;
  timestamp: string;
  pestProbability?: number;
}

export interface NotificationItem {
  id: number | string;
  icon?: string;
  title: string;
  message: string;
  // Notifications are now pest-detection-only (see server/routes/ingest.js),
  // but the string fallback is kept for older rows already sitting in the
  // database from before this change.
  category: 'PEST' | string;
  createdAt?: string;
  timestamp?: string;
  isRead?: boolean;
  read?: boolean;
}

export interface PSGCRegion {
  code: string;
  name: string;
  provinces: PSGCProvince[];
}

export interface PSGCProvince {
  code: string;
  name: string;
  cities: PSGCCity[];
}

export interface PSGCCity {
  code: string;
  name: string;
  barangays: string[];
  // Approximate town-center coordinates -- used to recenter/zoom the
  // farm-location map picker onto the right municipality as soon as
  // it's selected, before the admin fine-tunes the exact pin.
  lat: number;
  lng: number;
}

export interface LaravelComponentDef {
  id: string;
  name: string;
  tag: string; // e.g. <x-cocosense.radar-scanner />
  category: 'Branding & Visuals' | 'Telemetry & Radar' | 'Hardware & Nodes' | 'UI & Forms' | 'Layouts & Architecture';
  description: string;
  props: Array<{
    name: string;
    type: string;
    default?: string;
    description: string;
    options?: string[];
  }>;
  bladeCode: string;
  phpClassCode: string;
  usageExample: string;
}
