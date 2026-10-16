import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text as RNText, View } from 'react-native';

import { theme } from '../../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'onBrand';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** Leading emoji, sized to read as an icon. */
  emoji?: string;
  /** Trailing glyph such as → for "go forward" actions. */
  trailing?: string;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  emoji,
  trailing,
  compact = false,
  loading = false,
  disabled = false,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = variants[variant];
  const textColor = isDisabled ? theme.color.interactive.primaryTextDisabled : v.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { minHeight: compact ? theme.touchTarget.minimum : 56 },
        v.container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && [v.pressed, { transform: [{ translateY: 2 }] }],
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.content}>
          {emoji ? <RNText style={styles.emoji}>{emoji}</RNText> : null}
          <Text variant={compact ? 'bodyStrong' : 'label'} weight="bold" color={textColor} style={styles.label}>
            {label}
          </Text>
          {trailing ? <RNText style={[styles.trailing, { color: textColor }]}>{trailing}</RNText> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  label: { flexShrink: 1, textAlign: 'center' },
  emoji: { fontSize: 20 },
  trailing: { fontSize: 20, fontWeight: '700' },
  disabled: { backgroundColor: theme.color.interactive.primaryBgDisabled, borderBottomWidth: 0 },
});

const variants: Record<ButtonVariant, { container: object; pressed: object; text: string }> = {
  primary: {
    container: {
      backgroundColor: theme.color.interactive.primaryBg,
      borderBottomWidth: 3,
      borderBottomColor: theme.color.interactive.primaryLip,
    },
    pressed: { borderBottomWidth: 1 },
    text: theme.color.interactive.primaryText,
  },
  secondary: {
    container: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.interactive.secondaryBorder,
      borderBottomWidth: 3,
      borderBottomColor: theme.color.border.default,
    },
    pressed: { backgroundColor: theme.color.surface.sunken, borderBottomWidth: 1.5 },
    text: theme.color.interactive.secondaryText,
  },
  soft: {
    container: {
      backgroundColor: theme.color.interactive.softBg,
      borderBottomWidth: 3,
      borderBottomColor: theme.color.surface.brandMid,
    },
    pressed: { borderBottomWidth: 1 },
    text: theme.color.interactive.secondaryText,
  },
  onBrand: {
    container: {
      backgroundColor: theme.color.surface.onBrandGlass,
      borderWidth: 1,
      borderColor: theme.color.surface.onBrandLine,
    },
    pressed: { backgroundColor: theme.color.surface.onBrandLine },
    text: theme.color.text.inverse,
  },
};
