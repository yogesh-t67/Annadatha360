import { Droplets, FlaskConical, ShieldCheck, TrendingUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { Tint } from '../theme';
import type { FeatureScreen } from '../navigation/types';

export interface Ad {
  /** Text lives in i18n under `ads.items.<id>` (title, body, cta) in both languages. */
  id: string;
  icon: LucideIcon;
  tint: Tint;
  /** Screen opened when the farmer taps the ad. */
  target: FeatureScreen;
}

/**
 * Home banner ads, shown in this order. DUMMY content for now: replace when real ads come from the backend.
 * To add an ad: add an entry here and its `ads.items.<id>` texts in en.json and te.json.
 */
export const ADS: Ad[] = [
  { id: 'dripSubsidy', icon: Droplets, tint: 'water', target: 'Schemes' },
  { id: 'soilTest', icon: FlaskConical, tint: 'leaf', target: 'Expert' },
  { id: 'mandiPrice', icon: TrendingUp, tint: 'sun', target: 'Market' },
  { id: 'cropInsurance', icon: ShieldCheck, tint: 'sky', target: 'Schemes' },
];
