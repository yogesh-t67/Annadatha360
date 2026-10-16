import { fontFamily } from './tokens';
import type { FontWeightKey } from './theme';

export { theme } from './theme';
export type { Theme, TextVariant, FontWeightKey, Tint } from './theme';

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

const displayWeights: Record<FontWeightKey, string> = {
  regular: fontFamily.displaySemibold,
  medium: fontFamily.displaySemibold,
  semibold: fontFamily.displaySemibold,
  bold: fontFamily.displayBold,
};

/**
 * Headings use the rounded display face in every language. Body copy needs
 * NotoSansTelugu for Telugu; every other supported language renders in Inter.
 */
export function resolveFontFamily(languageCode: string, weight: FontWeightKey, display = false): string {
  if (display) return displayWeights[weight];
  return languageCode === 'te' ? teluguWeights[weight] : latinWeights[weight];
}
