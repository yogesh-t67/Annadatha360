/**
 * Primitive tokens. Raw values only — never imported by screens or feature
 * components directly. Consumed exclusively by theme.ts to build semantic tokens.
 */

export const color = {
  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F7F8F6',
  gray100: '#EEF0EB',
  gray200: '#DCE0D6',
  gray300: '#B9C0B0',
  gray400: '#8A9480',
  gray600: '#5B6652',
  gray700: '#424B3B',
  gray800: '#2B3226',
  gray900: '#171C14',

  canvas: '#F6F8F3',

  green50: '#EBF5EC',
  green100: '#CFE8D2',
  green400: '#36A35E',
  green500: '#2F8F4E',
  green600: '#1F7A3F',
  green700: '#145C2F',

  amber50: '#FDF3E2',
  amber200: '#EFD9AE',
  amber500: '#C97F0A',
  amber700: '#8A5607',
  amber800: '#7A4C06',

  red50: '#FBEAEA',
  red500: '#C53A3A',
  red700: '#8E2525',

  blue50: '#E6F0F7',
  blue200: '#C9DDEB',
  blue500: '#2A6F9E',
  blue700: '#1C4E70',

  teal50: '#E1F3F2',
  teal200: '#BFE3E1',

  clay50: '#FBECE4',
  clay200: '#F0D2C3',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
} as const;

export const fontSize = {
  micro: 12,
  caption: 14,
  body: 16,
  label: 17,
  h2: 20,
  h1: 26,
  display: 30,
  hero: 54,
} as const;

export const lineHeight = {
  micro: 16,
  caption: 20,
  body: 24,
  label: 24,
  h2: 28,
  h1: 36,
  display: 40,
  hero: 64,
} as const;

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
} as const;
