import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme } from '../theme';
import { Text } from './primitives';

/** Amber info strip. Defaults to the "demo only" notice shown under every feature that has no live data yet. */
export function Notice({ message, icon: Icon = Info }: { message?: string; icon?: LucideIcon }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.color.status.warningBorder,
        backgroundColor: theme.color.status.warningBg,
      }}
    >
      <Icon size={theme.iconSize.row} color={theme.color.status.warningText} strokeWidth={2.25} />
      <Text variant="body" color={theme.color.status.warningText} style={{ flex: 1 }}>
        {message ?? t('common.demoNotice')}
      </Text>
    </View>
  );
}
