import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CloudRain, Landmark, Sprout, TrendingUp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../../theme';
import { Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { IconChip } from '../../components/IconChip';
import { Notice } from '../../components/Notice';

const alertTypes: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'weather', icon: CloudRain, tint: 'sky' },
  { key: 'crop', icon: Sprout, tint: 'leaf' },
  { key: 'market', icon: TrendingUp, tint: 'sun' },
  { key: 'schemes', icon: Landmark, tint: 'clay' },
];

export function AlertsScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('alerts.title')}</Text>
      {alertTypes.map((a) => (
        <Card key={a.key}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconChip icon={a.icon} tint={a.tint} />
            <View style={{ flex: 1 }}>
              <Text variant="h2">{t(`alerts.${a.key}`)}</Text>
              <Text variant="body" color={theme.color.text.muted}>
                {t('alerts.available')}
              </Text>
            </View>
          </View>
        </Card>
      ))}
      <Notice />
    </ScreenContainer>
  );
}
