import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme, Tint } from '../../theme';
import { Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ListItem } from '../../components/ListItem';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { FeatureScreen } from '../../navigation/types';

const services: { key: string; emoji: string; tint: Tint; target: FeatureScreen | 'ask' }[] = [
  { key: 'askAi', emoji: '🎙️', tint: 'leaf', target: 'ask' },
  { key: 'diagnosis', emoji: '📷', tint: 'clay', target: 'Diagnosis' },
  { key: 'weather', emoji: '🌦️', tint: 'sky', target: 'Weather' },
  { key: 'irrigation', emoji: '💧', tint: 'water', target: 'Irrigation' },
  { key: 'market', emoji: '💰', tint: 'sun', target: 'Market' },
  { key: 'schemes', emoji: '🏛️', tint: 'leaf', target: 'Schemes' },
  { key: 'expert', emoji: '👨🏽‍🌾', tint: 'clay', target: 'Expert' },
  { key: 'alerts', emoji: '🔔', tint: 'sun', target: 'Alerts' },
  { key: 'settings', emoji: '⚙️', tint: 'stone', target: 'Settings' },
];

export function ServicesScreen() {
  const { t } = useTranslation();
  const { open, tab } = useAppNavigation();

  return (
    <ScreenContainer>
      <Text variant="h1">{t('services.title')}</Text>
      <View style={{ gap: theme.spacing.sm }}>
        {services.map((s) => (
          <ListItem
            key={s.key}
            emoji={s.emoji}
            tint={s.tint}
            label={t(`services.${s.key}`)}
            onPress={() => (s.target === 'ask' ? tab('AskTab') : open(s.target))}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}
