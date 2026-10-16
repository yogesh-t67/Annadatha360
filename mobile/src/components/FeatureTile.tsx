import React from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUpRight, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../theme';
import { Text } from './primitives';
import { IconChip } from './IconChip';

export interface FeatureTileProps {
  icon: LucideIcon;
  label: string;
  tint: Tint;
  onPress: () => void;
  selected?: boolean;
  showArrow?: boolean;
}

/** Two-per-row card with a tinted icon chip; one tint per feature across the app. */
export function FeatureTile({ icon, label, tint, onPress, selected = false, showArrow = false }: FeatureTileProps) {
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
      <IconChip icon={icon} tint={tint} />
      <Text variant="label" weight="bold">
        {label}
      </Text>
      {showArrow ? (
        <View style={{ position: 'absolute', top: 14, right: 16 }}>
          <ArrowUpRight size={18} color={theme.color.text.muted} strokeWidth={2.25} />
        </View>
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
      <Check size={15} color={theme.color.text.inverse} strokeWidth={3} />
    </View>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{children}</View>;
}
