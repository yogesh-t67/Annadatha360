import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { theme, Tint } from '../theme';
import { Text } from './primitives';
import { EmojiChip } from './EmojiChip';

export interface FeatureTileProps {
  emoji: string;
  label: string;
  tint: Tint;
  onPress: () => void;
  selected?: boolean;
  showArrow?: boolean;
}

/** Two-per-row card with a tinted emoji chip; one tint per feature across the app. */
export function FeatureTile({ emoji, label, tint, onPress, selected = false, showArrow = false }: FeatureTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexBasis: '46%',
          flexGrow: 1,
          minHeight: 122,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.color.surface.brand : theme.color.tint[tint].border,
          backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
          ...theme.elevation.level1,
        },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <EmojiChip emoji={emoji} tint={tint} />
      <Text variant="label" weight="bold">
        {label}
      </Text>
      {showArrow ? (
        <RNText style={{ position: 'absolute', top: 14, right: 16, fontSize: 18, color: theme.color.text.muted }}>↗</RNText>
      ) : null}
      {selected ? <SelectedBadge /> : null}
    </Pressable>
  );
}

export function SelectedBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.surface.brand,
      }}
    >
      <RNText style={{ color: theme.color.text.inverse, fontSize: 13, fontWeight: '800' }}>✓</RNText>
    </View>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{children}</View>;
}
