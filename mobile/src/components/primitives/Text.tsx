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

/**
 * Telugu stacks vowel signs above and conjuncts below the base letter, so its glyphs are much taller
 * than Latin at the same size. Android clips anything outside the line box, so text gets a taller line
 * (~1.8x font size). Applied in every language, not only Telugu, so cards and rows keep the same size
 * when the farmer switches language.
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
  // Line heights are the same in Telugu and English (see teluguLineHeight), so layouts don't jump on a
  // language switch. Headings (display font, Baloo Tammudu 2) draw Telugu vowel signs above the font's
  // declared ascent, and Android clips anything outside a fixed line box no matter how tall we make it.
  // So headings set no lineHeight at all: Android sizes the line from the font's real bounds (font padding
  // on), and Baloo covers both scripts with one set of metrics, so both languages get the same height.
  const lineHeight =
    variant === 'hero'
      ? variantConfig.lineHeight
      : variantConfig.display
        ? undefined
        : teluguLineHeight(variantConfig.fontSize, variantConfig.lineHeight);

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
