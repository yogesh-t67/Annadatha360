import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveFontFamily, theme, TextVariant, FontWeightKey } from '../../theme';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: FontWeightKey;
  color?: string;
  align?: TextStyle['textAlign'];
  children: React.ReactNode;
}

const TELUGU = /[ఀ-౿]/;

function hasTelugu(node: React.ReactNode): boolean {
  if (typeof node === 'string') return TELUGU.test(node);
  if (Array.isArray(node)) return node.some(hasTelugu);
  return false;
}

/**
 * Telugu stacks vowel signs above and conjuncts below the base letter, so its glyphs are much taller
 * than Latin at the same size. Android clips anything outside the line box, so Telugu text gets a
 * taller line (~1.8x font size). Applied by language and by content, because Telugu also appears
 * inside the English UI (language names, district names).
 */
function teluguLineHeight(fontSize: number, base: number): number {
  return Math.max(base, Math.round(fontSize * 1.8));
}

/**
 * The only component allowed to set fontFamily/fontSize/lineHeight directly.
 * Every other component renders copy through this one so the Telugu/Latin
 * font switch and the type scale stay centralized.
 */
export function Text({ variant = 'body', weight, color, align, style, children, ...rest }: TextProps) {
  const { i18n } = useTranslation();
  const variantConfig = theme.typography[variant];
  const resolvedWeight = weight ?? variantConfig.weight;
  const fontFamily = resolveFontFamily(i18n.language, resolvedWeight, variantConfig.display);
  const telugu = variant !== 'hero' && (i18n.language === 'te' || hasTelugu(children));
  // Headings (display font, Baloo Tammudu 2) draw Telugu vowel signs above the font's declared ascent, and
  // Android clips anything outside a fixed line box no matter how tall we make it. So for Telugu headings
  // set no lineHeight at all: Android then sizes the line from the real glyph bounds (font padding on).
  const lineHeight = telugu
    ? variantConfig.display
      ? undefined
      : teluguLineHeight(variantConfig.fontSize, variantConfig.lineHeight)
    : variantConfig.lineHeight;

  return (
    <RNText
      style={[
        {
          fontFamily,
          fontSize: variantConfig.fontSize,
          lineHeight,
          includeFontPadding: true,
          color: color ?? theme.color.text.primary,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
