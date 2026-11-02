/**
 * Primitive tokens. Raw values only — never imported by screens or feature
 * components directly. Consumed exclusively by theme.ts to build semantic tokens.
 *
 * Colours, spacing, radius, font sizes and line heights come from design/tokens.json (shared with the ERP
 * website) through tokens.generated.ts. Change them there and run: node design/build-tokens.mjs
 */
import { color } from './tokens.generated';

export { color, fontSize, lineHeight, radius, spacing } from './tokens.generated';

/** Font family names must match the exact export names from @expo-google-fonts packages. */
export const fontFamily = {
  latinRegular: 'Inter_400Regular',
  latinMedium: 'Inter_500Medium',
  latinSemibold: 'Inter_600SemiBold',
  latinBold: 'Inter_700Bold',
  teluguRegular: 'NotoSansTelugu_400Regular',
  teluguMedium: 'NotoSansTelugu_500Medium',
  teluguSemibold: 'NotoSansTelugu_600SemiBold',
  teluguBold: 'NotoSansTelugu_700Bold',
  /** Rounded display face for headings; covers both Telugu and Latin. */
  displaySemibold: 'BalooTammudu2_600SemiBold',
  displayBold: 'BalooTammudu2_700Bold',
  displayExtraBold: 'BalooTammudu2_800ExtraBold',
  /** System fallback shown before fonts finish loading. */
  systemFallback: undefined,
} as const;

export const elevation = {
  level0: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  level1: {
    shadowColor: color.gray900,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  level2: {
    shadowColor: color.gray900,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Cubic-bezier control points, usable with Reanimated's Easing.bezier(...easing.standard). */
export const easing = {
  standard: [0.2, 0, 0, 1] as const,
  decelerate: [0, 0, 0.2, 1] as const,
  accelerate: [0.3, 0, 1, 1] as const,
};

export const zIndex = {
  base: 0,
  raised: 10,
  overlay: 100,
  modal: 200,
  toast: 300,
} as const;

export const breakpoint = {
  phone: 0,
  tablet: 768,
} as const;

export const touchTarget = {
  /** Minimum hit-area side length; below this, low-literacy/outdoor users mis-tap. */
  minimum: 48,
  /** Full-size button. */
  button: 56,
  /** Text and select fields (room for Telugu's tall letters, same height in both languages). */
  field: 60,
  /** Tappable list rows. */
  row: 64,
} as const;

/** Icon sizes, so icons beside the same kind of text match across screens. */
export const iconSize = {
  /** Beside body/caption text and inside buttons. */
  inline: 20,
  /** In list rows, chips and beside headings. */
  row: 24,
  /** Status/hero icons. */
  hero: 32,
} as const;
