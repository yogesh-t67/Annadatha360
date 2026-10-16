import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, Camera, CloudSun, Droplet, Landmark, Mic, Settings, TrendingUp, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../../theme';
import { Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ListItem } from '../../components/ListItem';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { FeatureScreen } from '../../navigation/types';

const services: { key: string; icon: LucideIcon; tint: Tint; target: FeatureScreen | 'ask' }[] = [
  { key: 'askAi', icon: Mic, tint: 'leaf', target: 'ask' },
  { key: 'diagnosis', icon: Camera, tint: 'clay', target: 'Diagnosis' },
  { key: 'weather', icon: CloudSun, tint: 'sky', target: 'Weather' },
  { key: 'irrigation', icon: Droplet, tint: 'water', target: 'Irrigation' },
  { key: 'market', icon: TrendingUp, tint: 'sun', target: 'Market' },
  { key: 'schemes', icon: Landmark, tint: 'leaf', target: 'Schemes' },
  { key: 'expert', icon: UserRound, tint: 'clay', target: 'Expert' },
  { key: 'alerts', icon: Bell, tint: 'sun', target: 'Alerts' },
  { key: 'settings', icon: Settings, tint: 'stone', target: 'Settings' },
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
            icon={s.icon}
            tint={s.tint}
            label={t(`services.${s.key}`)}
            onPress={() => (s.target === 'ask' ? tab('AskTab') : open(s.target))}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}
