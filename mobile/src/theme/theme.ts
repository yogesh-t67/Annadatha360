import { semanticColor } from './tokens.generated';
import { duration, easing, elevation, fontSize, iconSize, lineHeight, radius, spacing, touchTarget, zIndex } from './tokens';

/**
 * Semantic tokens. Components import ONLY from this file, never from tokens.ts
 * directly, so a palette change never requires touching a screen.
 */
export const theme = {
  /** Meanings of colours (text, surfaces, buttons, status…), from design/tokens.json. */
  color: semanticColor,
  spacing,
  radius,
  elevation,
  duration,
  easing,
  zIndex,
  touchTarget,
  iconSize,
  typography: {
    hero: { fontSize: fontSize.hero, lineHeight: lineHeight.hero, weight: 'bold' as const, display: true },
    display: { fontSize: fontSize.display, lineHeight: lineHeight.display, weight: 'bold' as const, display: true },
    h1: { fontSize: fontSize.h1, lineHeight: lineHeight.h1, weight: 'bold' as const, display: true },
    h2: { fontSize: fontSize.h2, lineHeight: lineHeight.h2, weight: 'bold' as const, display: true },
    // Brand name in the header: body font (not the display face) so it sits level beside the logo.
    title: { fontSize: fontSize.title, lineHeight: lineHeight.title, weight: 'bold' as const, display: false },
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
