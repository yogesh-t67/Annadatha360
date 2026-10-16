import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';

import { theme } from '../../theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padding?: keyof typeof theme.spacing;
  children: React.ReactNode;
}

export function Card({ onPress, padding = 'md', style, children, ...rest }: CardProps) {
  const base = [
    {
      backgroundColor: theme.color.surface.raised,
      borderRadius: theme.radius.md,
      padding: theme.spacing[padding],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    theme.elevation.level1,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && { backgroundColor: theme.color.surface.sunken }]}
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
