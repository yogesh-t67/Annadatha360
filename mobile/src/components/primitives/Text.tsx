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
 * The only component allowed to set fontFamily/fontSize/lineHeight directly.
 * Every other component renders copy through this one so the Telugu/Latin
 * font switch and the type scale stay centralized.
 */
export function Text({ variant = 'body', weight, color, align, style, children, ...rest }: TextProps) {
  const { i18n } = useTranslation();
  const variantConfig = theme.typography[variant];
  const resolvedWeight = weight ?? variantConfig.weight;
  const fontFamily = resolveFontFamily(i18n.language, resolvedWeight);

  return (
    <RNText
      style={[
        {
          fontFamily,
          fontSize: variantConfig.fontSize,
          lineHeight: variantConfig.lineHeight,
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
