import React from 'react';
import { View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme } from '../theme';
import { Text } from './primitives';

/** Soft green-to-amber panel that leads a screen with one large icon. */
export function Hero({ icon: Icon, style, children }: { icon?: LucideIcon; style?: ViewStyle; children?: React.ReactNode }) {
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
      {Icon ? (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.color.surface.base,
          }}
        >
          <Icon size={38} color={theme.color.surface.brandDeep} strokeWidth={1.75} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Pill({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.color.border.default,
        backgroundColor: theme.color.surface.base,
      }}
    >
      {Icon ? <Icon size={theme.iconSize.inline} color={theme.color.text.secondary} strokeWidth={2.25} /> : null}
      <Text variant="body" weight="medium" color={theme.color.text.secondary}>
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
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: theme.spacing.xs,
              borderRadius: theme.radius.full,
              backgroundColor: i < step ? theme.color.surface.brand : theme.color.border.default,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function ScreenTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      {Icon ? <Icon size={theme.iconSize.hero} color={theme.color.text.primary} strokeWidth={2.25} /> : null}
      <Text variant="h1" style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}
