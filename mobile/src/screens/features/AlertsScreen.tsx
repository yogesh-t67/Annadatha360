import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme, Tint } from '../../theme';
import { Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmojiChip } from '../../components/EmojiChip';
import { Notice } from '../../components/Notice';

const alertTypes: { key: string; emoji: string; tint: Tint }[] = [
  { key: 'weather', emoji: '🌧️', tint: 'sky' },
  { key: 'crop', emoji: '🌱', tint: 'leaf' },
  { key: 'market', emoji: '💰', tint: 'sun' },
  { key: 'schemes', emoji: '🏛️', tint: 'clay' },
];

export function AlertsScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('alerts.title')}</Text>
      {alertTypes.map((a) => (
        <Card key={a.key}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <EmojiChip emoji={a.emoji} tint={a.tint} />
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
