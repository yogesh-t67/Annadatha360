export interface SchemeEntry {
  key: 'pmKisan' | 'pmfby' | 'kcc' | 'soilHealthCard' | 'equipmentSubsidy' | 'stateAgriSchemes';
  tier: 'central' | 'state';
}

/** Placeholder until the schemes API lands (see docs/api). Not live. */
export const mockSchemes: SchemeEntry[] = [
  { key: 'pmKisan', tier: 'central' },
  { key: 'pmfby', tier: 'central' },
  { key: 'kcc', tier: 'central' },
  { key: 'soilHealthCard', tier: 'central' },
  { key: 'equipmentSubsidy', tier: 'state' },
  { key: 'stateAgriSchemes', tier: 'state' },
];
