import React from 'react';
import { Text as RNText, View, ViewStyle } from 'react-native';

import { theme } from '../theme';
import { Text } from './primitives';

/** Soft green-to-amber panel that leads a screen with one large emoji. */
export function Hero({ emoji, style, children }: { emoji?: string; style?: ViewStyle; children?: React.ReactNode }) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: theme.color.border.brand,
          backgroundColor: theme.color.surface.brandSoft,
        },
        style,
      ]}
    >
      {emoji ? <RNText style={{ fontSize: 62, lineHeight: 76 }}>{emoji}</RNText> : null}
      {children}
    </View>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.color.border.default,
        backgroundColor: theme.color.surface.base,
      }}
    >
      <Text variant="caption" weight="medium" color={theme.color.text.secondary}>
        {children}
      </Text>
    </View>
  );
}

/** "1 / 3" plus a three-segment bar for the onboarding steps. */
export function StepProgress({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View style={{ gap: theme.spacing.xs }} accessibilityLabel={`${step} / ${total}`}>
      <Text variant="caption" color={theme.color.text.muted}>
        {step} / {total}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i < step ? theme.color.surface.brand : theme.color.border.default,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function ScreenTitle({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return <Text variant="h1">{emoji ? `${emoji} ${children}` : children}</Text>;
}
