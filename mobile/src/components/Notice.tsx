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
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.status.warningBorder,
        backgroundColor: theme.color.status.warningBg,
      }}
    >
      <Icon size={16} color={theme.color.status.warningText} strokeWidth={2.25} style={{ marginTop: 2 }} />
      <Text variant="caption" color={theme.color.status.warningText} style={{ flex: 1 }}>
        {message ?? t('common.demoNotice')}
      </Text>
    </View>
  );
}
