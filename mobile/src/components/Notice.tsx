import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../theme';
import { Text } from './primitives';

/** Amber info strip. Defaults to the "demo only" notice shown under every feature that has no live data yet. */
export function Notice({ message, emoji = 'ℹ️' }: { message?: string; emoji?: string }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.status.warningBorder,
        backgroundColor: theme.color.status.warningBg,
      }}
    >
      <RNText style={{ fontSize: 16, lineHeight: 20 }}>{emoji}</RNText>
      <Text variant="caption" color={theme.color.status.warningText} style={{ flex: 1 }}>
        {message ?? t('common.demoNotice')}
      </Text>
    </View>
  );
}
