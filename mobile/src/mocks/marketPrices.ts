export type CropCategory = 'cereals' | 'pulses' | 'oilseeds';

export interface CropPrice {
  key: string;
  category: CropCategory;
  pricePerQuintal: number;
  trendPercent: number;
}

/** Placeholder data until the market-prices API lands (see docs/api). Not live. */
export const mockCropPrices: CropPrice[] = [
  { key: 'paddy', category: 'cereals', pricePerQuintal: 2320, trendPercent: 2.1 },
  { key: 'maize', category: 'cereals', pricePerQuintal: 2180, trendPercent: 1.5 },
  { key: 'redChilli', category: 'oilseeds', pricePerQuintal: 12500, trendPercent: 3.2 },
  { key: 'cotton', category: 'oilseeds', pricePerQuintal: 6800, trendPercent: -1.0 },
  { key: 'groundnut', category: 'oilseeds', pricePerQuintal: 9200, trendPercent: 2.8 },
  { key: 'blackGram', category: 'pulses', pricePerQuintal: 6150, trendPercent: 1.9 },
];
