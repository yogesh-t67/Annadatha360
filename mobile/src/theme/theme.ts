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
      tertiary: color.gray400,
      inverse: color.white,
      link: color.green700,
      disabled: color.gray300,
    },
    surface: {
      base: color.white,
      sunken: color.gray50,
      raised: color.white,
      brand: color.green600,
      overlay: 'rgba(23, 28, 20, 0.5)',
    },
    border: {
      default: color.gray200,
      strong: color.gray300,
      focus: color.green600,
    },
    interactive: {
      primaryBg: color.green600,
      primaryBgHover: color.green700,
      primaryBgPressed: color.green700,
      primaryBgDisabled: color.gray200,
      primaryText: color.white,
      primaryTextDisabled: color.gray400,
      secondaryBorder: color.green600,
      secondaryText: color.green700,
      ghostText: color.green700,
    },
    status: {
      successText: color.green700,
      successBg: color.green50,
      warningText: color.amber700,
      warningBg: color.amber50,
      dangerText: color.red700,
      dangerBg: color.red50,
      infoText: color.blue700,
      infoBg: color.blue50,
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
    display: { fontSize: fontSize.display, lineHeight: lineHeight.display, weight: 'bold' as const },
    h1: { fontSize: fontSize.h1, lineHeight: lineHeight.h1, weight: 'semibold' as const },
    h2: { fontSize: fontSize.h2, lineHeight: lineHeight.h2, weight: 'semibold' as const },
    body: { fontSize: fontSize.body, lineHeight: lineHeight.body, weight: 'regular' as const },
    bodyStrong: { fontSize: fontSize.body, lineHeight: lineHeight.body, weight: 'semibold' as const },
    caption: { fontSize: fontSize.caption, lineHeight: lineHeight.caption, weight: 'regular' as const },
    micro: { fontSize: fontSize.micro, lineHeight: lineHeight.micro, weight: 'medium' as const },
  },
} as const;

export type Theme = typeof theme;
export type TextVariant = keyof Theme['typography'];
export type FontWeightKey = 'regular' | 'medium' | 'semibold' | 'bold';
