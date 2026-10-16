import { CloudSun, Droplet, Droplets, HelpCircle } from 'lucide-react-native';

import type { Tint } from '../theme';
import { cropCatalog } from './cropCatalog';

export { cropIcon, cropCategory } from './cropCatalog';
export type { CropCategory } from './cropCatalog';

export const crops = cropCatalog;
export type CropKey = (typeof cropCatalog)[number]['code'];

export const stages = ['sowing', 'growing', 'flowering', 'harvest'] as const;
export type StageKey = (typeof stages)[number];

export const regions = ['ap', 'ts'] as const;
export type RegionKey = (typeof regions)[number];

export const farmDistricts = [
  'guntur',
  'krishna',
  'kurnool',
  'prakasam',
  'warangal',
  'nizamabad',
  'khammam',
  'karimnagar',
] as const;

export const marketDistricts = ['guntur', 'vijayawada', 'warangal', 'nizamabad', 'khammam', 'kurnool'] as const;

export type DistrictKey = (typeof farmDistricts)[number] | (typeof marketDistricts)[number];

export const soilStates: { key: 'dry' | 'moist' | 'wet' | 'unknown'; icon: typeof Droplet; tint: Tint }[] = [
  { key: 'dry', icon: CloudSun, tint: 'sun' },
  { key: 'moist', icon: Droplet, tint: 'leaf' },
  { key: 'wet', icon: Droplets, tint: 'water' },
  { key: 'unknown', icon: HelpCircle, tint: 'stone' },
];
