import { Leaf } from 'lucide-react-native';

export type AdvisoryIcon = typeof Leaf;

export interface OtherAdvisoryCrop {
  key: 'rice' | 'maize' | 'chilli' | 'cotton';
}

/** Placeholder until the advisory API lands (see docs/api). Not live. */
export const mockOtherAdvisories: OtherAdvisoryCrop[] = [
  { key: 'rice' },
  { key: 'maize' },
  { key: 'chilli' },
  { key: 'cotton' },
];
