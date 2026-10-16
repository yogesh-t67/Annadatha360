import React from 'react';
import { Pressable, View } from 'react-native';

import { theme } from '../theme';
import { Stack, Text } from './primitives';

export interface GridTileProps {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
}

export function GridTile({ icon: Icon, label, onPress }: GridTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: '23%',
        minWidth: 72,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Stack align="center" gap="xxs">
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.status.successBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={26} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
        </View>
        <Text variant="micro" weight="medium" align="center" numberOfLines={2}>
          {label}
        </Text>
      </Stack>
    </Pressable>
  );
}
