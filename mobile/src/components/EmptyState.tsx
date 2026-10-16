import React from 'react';
import { View } from 'react-native';

import { theme } from '../theme';
import { Stack, Text } from './primitives';

export interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}

/** Used for screens whose data pipeline isn't wired yet. Not a loading or error state. */
export function EmptyState({ icon: Icon, title, body }: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="md" style={{ flex: 1, paddingHorizontal: theme.spacing.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.full,
          backgroundColor: theme.color.status.successBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={28} color={theme.color.status.successText} strokeWidth={1.75} />
      </View>
      <Stack gap="xxs" align="center">
        <Text variant="h2" align="center">
          {title}
        </Text>
        <Text variant="body" color={theme.color.text.secondary} align="center">
          {body}
        </Text>
      </Stack>
    </Stack>
  );
}
