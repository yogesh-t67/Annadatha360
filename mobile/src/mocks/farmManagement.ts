export interface MyCrop {
  key: 'paddy' | 'maize' | 'cotton';
  acres: number;
  stage: 'growing' | 'sowing' | 'planning';
}

/** Placeholder until the farm-records API lands (see docs/api). Not live. */
export const mockMyCrops: MyCrop[] = [
  { key: 'paddy', acres: 2.5, stage: 'growing' },
  { key: 'maize', acres: 1.2, stage: 'sowing' },
  { key: 'cotton', acres: 1.0, stage: 'planning' },
];

export const mockPrimaryField = {
  name: 'Field 1',
  acres: 2.5,
  cropKey: 'paddy' as const,
};
