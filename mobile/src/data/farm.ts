import { CloudSun, Droplet, Droplets, HelpCircle } from 'lucide-react-native';

import type { Tint } from '../theme';
import { cropCatalog } from './cropCatalog';

export { cropIcon, cropCategory } from './cropCatalog';
export { cropImages } from './cropImages';
export type { CropCategory } from './cropCatalog';

export const crops = cropCatalog;
export type CropKey = (typeof cropCatalog)[number]['code'];

export const stages = ['sowing', 'growing', 'flowering', 'harvest'] as const;
export type StageKey = (typeof stages)[number];

export const regions = ['ap', 'ts'] as const;
export type RegionKey = (typeof regions)[number];

export { districtList, districtsOf, getDistrict, LEGACY_DISTRICT } from './districts';
export type { District, DistrictKey } from './districts';

/** API state code for our region key. */
export const STATE_CODE: Record<RegionKey, 'AP' | 'TG'> = { ap: 'AP', ts: 'TG' };

export const soilStates: { key: 'dry' | 'moist' | 'wet' | 'unknown'; icon: typeof Droplet; tint: Tint }[] = [
  { key: 'dry', icon: CloudSun, tint: 'sun' },
  { key: 'moist', icon: Droplet, tint: 'leaf' },
  { key: 'wet', icon: Droplets, tint: 'water' },
  { key: 'unknown', icon: HelpCircle, tint: 'stone' },
];
