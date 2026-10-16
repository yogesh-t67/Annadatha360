import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';

import { theme } from '../../theme';

export type CardTone = 'default' | 'brand' | 'soft';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  tone?: CardTone;
  padding?: keyof typeof theme.spacing;
  children: React.ReactNode;
}

const tones: Record<CardTone, object> = {
  default: {
    backgroundColor: theme.color.surface.raised,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    ...theme.elevation.level1,
  },
  brand: {
    backgroundColor: theme.color.surface.brand,
    borderWidth: 1,
    borderColor: theme.color.surface.brandDeep,
    ...theme.elevation.level2,
    shadowColor: theme.color.surface.brandDeep,
  },
  soft: {
    backgroundColor: theme.color.surface.brandSoft,
    borderWidth: 1,
    borderColor: theme.color.border.brand,
  },
};

export function Card({ onPress, tone = 'default', padding = 'md', style, children, ...rest }: CardProps) {
  const base = [
    { borderRadius: theme.radius.lg, padding: theme.spacing[padding], gap: theme.spacing.xs },
    tones[tone],
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}
