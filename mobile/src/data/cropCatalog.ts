import { Apple, Bean, Carrot, Droplet, Factory, Flame, Wheat } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export type CropCategory = 'cereal' | 'commercial' | 'fruit' | 'oilseed' | 'pulse' | 'spice' | 'vegetable';

/**
 * Mirrors the crop codes and categories seeded on the backend (GET /crops, 19 crops
 * grown across Andhra Pradesh and Telangana). Kept as a static local list, rather than
 * fetched, so crop icons/labels render instantly without waiting on a network call --
 * the catalog itself changes rarely. Each code must have a matching `crops.<code>` key
 * in both locale files.
 */
export const cropCatalog = [
  { code: 'paddy', category: 'cereal' },
  { code: 'maize', category: 'cereal' },
  { code: 'jowar', category: 'cereal' },
  { code: 'cotton', category: 'commercial' },
  { code: 'sugarcane', category: 'commercial' },
  { code: 'banana', category: 'fruit' },
  { code: 'mango', category: 'fruit' },
  { code: 'groundnut', category: 'oilseed' },
  { code: 'castor', category: 'oilseed' },
  { code: 'oil_palm', category: 'oilseed' },
  { code: 'sunflower', category: 'oilseed' },
  { code: 'bengal_gram', category: 'pulse' },
  { code: 'black_gram', category: 'pulse' },
  { code: 'green_gram', category: 'pulse' },
  { code: 'red_gram', category: 'pulse' },
  { code: 'chilli', category: 'spice' },
  { code: 'turmeric', category: 'spice' },
  { code: 'onion', category: 'vegetable' },
  { code: 'tomato', category: 'vegetable' },
] as const satisfies readonly { code: string; category: CropCategory }[];

export type CropCode = (typeof cropCatalog)[number]['code'];

const CATEGORY_ICON: Record<CropCategory, LucideIcon> = {
  cereal: Wheat,
  commercial: Factory, // cotton/sugarcane: goes to a mill, not eaten as-is
  fruit: Apple,
  oilseed: Droplet,
  pulse: Bean,
  spice: Flame,
  vegetable: Carrot,
};

const categoryByCode = new Map<string, CropCategory>(cropCatalog.map((c) => [c.code, c.category]));

export function cropIcon(code: string): LucideIcon {
  const category = categoryByCode.get(code);
  return category ? CATEGORY_ICON[category] : Carrot;
}

export function cropCategory(code: string): CropCategory | undefined {
  return categoryByCode.get(code);
}
