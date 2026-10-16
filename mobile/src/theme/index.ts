import { fontFamily } from './tokens';
import type { FontWeightKey } from './theme';

export { theme } from './theme';
export type { Theme, TextVariant, FontWeightKey } from './theme';

const teluguWeights: Record<FontWeightKey, string> = {
  regular: fontFamily.teluguRegular,
  medium: fontFamily.teluguMedium,
  semibold: fontFamily.teluguSemibold,
  bold: fontFamily.teluguBold,
};

const latinWeights: Record<FontWeightKey, string> = {
  regular: fontFamily.latinRegular,
  medium: fontFamily.latinMedium,
  semibold: fontFamily.latinSemibold,
  bold: fontFamily.latinBold,
};

/**
 * Telugu script needs NotoSansTelugu; every other supported language renders
 * fine in Inter. Keyed by i18next language code.
 */
export function resolveFontFamily(languageCode: string, weight: FontWeightKey): string {
  return languageCode === 'te' ? teluguWeights[weight] : latinWeights[weight];
}
