import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View } from 'react-native';

import { theme } from '../../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon: Icon,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 56 : theme.touchTarget.minimum;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height },
        variantStyles[variant].container,
        isDisabled && variantStyles[variant].containerDisabled,
        pressed && !isDisabled && variantStyles[variant].containerPressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].text.color as string} />
      ) : (
        <View style={styles.content}>
          {Icon ? (
            <Icon
              size={20}
              strokeWidth={2}
              color={(isDisabled ? variantStyles[variant].textDisabled : variantStyles[variant].text).color as string}
            />
          ) : null}
          <Text
            variant="bodyStrong"
            color={(isDisabled ? variantStyles[variant].textDisabled : variantStyles[variant].text).color as string}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
});

const variantStyles: Record<
  ButtonVariant,
  {
    container: object;
    containerPressed: object;
    containerDisabled: object;
    text: { color: string };
    textDisabled: { color: string };
  }
> = {
  primary: {
    container: { backgroundColor: theme.color.interactive.primaryBg },
    containerPressed: { backgroundColor: theme.color.interactive.primaryBgPressed },
    containerDisabled: { backgroundColor: theme.color.interactive.primaryBgDisabled },
    text: { color: theme.color.interactive.primaryText },
    textDisabled: { color: theme.color.interactive.primaryTextDisabled },
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.color.interactive.secondaryBorder,
    },
    containerPressed: { backgroundColor: theme.color.surface.sunken },
    containerDisabled: { borderColor: theme.color.border.default },
    text: { color: theme.color.interactive.secondaryText },
    textDisabled: { color: theme.color.text.disabled },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    containerPressed: { backgroundColor: theme.color.surface.sunken },
    containerDisabled: {},
    text: { color: theme.color.interactive.ghostText },
    textDisabled: { color: theme.color.text.disabled },
  },
  inverse: {
    container: { backgroundColor: theme.color.surface.base },
    containerPressed: { backgroundColor: theme.color.surface.sunken },
    containerDisabled: { backgroundColor: 'rgba(255,255,255,0.4)' },
    text: { color: theme.color.interactive.primaryBg },
    textDisabled: { color: theme.color.text.disabled },
  },
};
