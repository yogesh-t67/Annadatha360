import { color, duration, easing, elevation, fontSize, lineHeight, radius, spacing, touchTarget, zIndex } from './tokens';

/**
 * Semantic tokens. Components import ONLY from this file, never from tokens.ts
 * directly, so a palette change never requires touching a screen.
 */
export const theme = {
  color: {
    text: {
      primary: color.gray900,
      secondary: color.gray700,
      muted: color.gray600,
      tertiary: color.gray400,
      inverse: color.white,
      inverseMuted: color.green100,
      link: color.green700,
      disabled: color.gray300,
    },
    surface: {
      base: color.white,
      canvas: color.canvas,
      sunken: color.gray50,
      raised: color.white,
      brand: color.green600,
      brandDeep: color.green700,
      brandBright: color.green400,
      brandSoft: color.green50,
      brandMid: color.green100,
      overlay: 'rgba(23, 28, 20, 0.5)',
      onBrandGlass: 'rgba(255, 255, 255, 0.14)',
      onBrandLine: 'rgba(255, 255, 255, 0.35)',
    },
    border: {
      default: color.gray200,
      strong: color.gray300,
      focus: color.green600,
      brand: color.green100,
    },
    interactive: {
      primaryBg: color.green600,
      primaryBgHover: color.green700,
      primaryBgPressed: color.green700,
      primaryLip: color.green700,
      primaryBgDisabled: color.gray200,
      primaryText: color.white,
      primaryTextDisabled: color.gray400,
      secondaryBorder: color.green100,
      secondaryText: color.green700,
      softBg: color.green50,
      ghostText: color.green700,
    },
    status: {
      successText: color.green700,
      successBg: color.green50,
      warningText: color.amber800,
      warningBg: color.amber50,
      warningBorder: color.amber200,
      warningDot: color.amber500,
      dangerText: color.red700,
      dangerBg: color.red50,
      infoText: color.blue700,
      infoBg: color.blue50,
    },
    /** Each feature keeps one tint everywhere it appears, so it can be found by color. */
    tint: {
      leaf: { bg: color.green50, border: color.green100 },
      sky: { bg: color.blue50, border: color.blue200 },
      water: { bg: color.teal50, border: color.teal200 },
      sun: { bg: color.amber50, border: color.amber200 },
      clay: { bg: color.clay50, border: color.clay200 },
      stone: { bg: color.gray100, border: color.gray200 },
    },
    priceUp: color.green600,
    priceDown: color.red500,
  },
  spacing,
  radius,
  elevation,
  duration,
  easing,
  zIndex,
  touchTarget,
  typography: {
    hero: { fontSize: fontSize.hero, lineHeight: lineHeight.hero, weight: 'bold' as const, display: true },
    display: { fontSize: fontSize.display, lineHeight: lineHeight.display, weight: 'bold' as const, display: true },
    h1: { fontSize: fontSize.h1, lineHeight: lineHeight.h1, weight: 'bold' as const, display: true },
    h2: { fontSize: fontSize.h2, lineHeight: lineHeight.h2, weight: 'bold' as const, display: true },
    label: { fontSize: fontSize.label, lineHeight: lineHeight.label, weight: 'semibold' as const, display: false },
    body: { fontSize: fontSize.body, lineHeight: lineHeight.body, weight: 'regular' as const, display: false },
    bodyStrong: { fontSize: fontSize.body, lineHeight: lineHeight.body, weight: 'semibold' as const, display: false },
    caption: { fontSize: fontSize.caption, lineHeight: lineHeight.caption, weight: 'regular' as const, display: false },
    micro: { fontSize: fontSize.micro, lineHeight: lineHeight.micro, weight: 'medium' as const, display: false },
  },
} as const;

export type Theme = typeof theme;
export type TextVariant = keyof Theme['typography'];
export type FontWeightKey = 'regular' | 'medium' | 'semibold' | 'bold';
export type Tint = keyof Theme['color']['tint'];
