import React from 'react';
import { Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../theme';
import { Text } from './primitives';
import { IconChip } from './IconChip';

export function ListItem({
  icon,
  tint,
  label,
  onPress,
}: {
  icon: LucideIcon;
  tint: Tint;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.touchTarget.row,
        paddingVertical: theme.spacing.xs,
        paddingLeft: theme.spacing.sm,
        paddingRight: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.color.border.default,
        backgroundColor: pressed ? theme.color.surface.sunken : theme.color.surface.base,
        ...theme.elevation.level1,
      })}
    >
      <IconChip icon={icon} tint={tint} />
      <Text variant="label" weight="bold" style={{ flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={theme.iconSize.row} color={theme.color.text.muted} strokeWidth={2.25} />
    </Pressable>
  );
}
