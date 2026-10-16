import type { Tint } from '../theme';

export const crops = [
  { key: 'paddy', emoji: '🌾' },
  { key: 'chilli', emoji: '🌶️' },
  { key: 'cotton', emoji: '☁️' },
  { key: 'maize', emoji: '🌽' },
  { key: 'tomato', emoji: '🍅' },
  { key: 'groundnut', emoji: '🥜' },
] as const;
export type CropKey = (typeof crops)[number]['key'];

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

export const soilStates: { key: 'dry' | 'moist' | 'wet' | 'unknown'; emoji: string; tint: Tint }[] = [
  { key: 'dry', emoji: '🏜️', tint: 'sun' },
  { key: 'moist', emoji: '🌱', tint: 'leaf' },
  { key: 'wet', emoji: '🌊', tint: 'water' },
  { key: 'unknown', emoji: '❓', tint: 'stone' },
];

export function cropEmoji(key: CropKey): string {
  return crops.find((c) => c.key === key)?.emoji ?? '🌾';
}
