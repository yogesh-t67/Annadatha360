import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero, Pill } from '../../components/Blocks';
import { Notice } from '../../components/Notice';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const sampleDays = [
  { emoji: '☀️', temp: 30 },
  { emoji: '🌤️', temp: 29 },
  { emoji: '🌧️', temp: 28 },
];

const sampleStats = ['💧 65%', '🌧️ 20%', '💨 8 km/h'];

export function WeatherScreen() {
  const { t } = useTranslation();
  const { open } = useAppNavigation();
  const district = useFarmStore((s) => s.district);

  return (
    <ScreenContainer showBack>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{t('weather.title')}</Text>
        <Pill>{`📍 ${t(`districts.${district}`)}`}</Pill>
      </View>

      <Hero
        emoji="🌤️"
        style={{ backgroundColor: theme.color.tint.sky.bg, borderColor: theme.color.tint.sky.border }}
      >
        <Text variant="hero">30°C</Text>
        <Text variant="body" align="center" color={theme.color.text.muted}>
          {t('weather.illustrative')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.xs }}>
          {sampleStats.map((s) => (
            <View
              key={s}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xxs,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: theme.color.border.default,
                backgroundColor: theme.color.surface.base,
              }}
            >
              <Text variant="caption" weight="semibold" color={theme.color.text.secondary}>
                {s}
              </Text>
            </View>
          ))}
        </View>
      </Hero>

      <Text variant="h2">{t('weather.threeDay')}</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {sampleDays.map((d, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 2,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.color.border.default,
              backgroundColor: theme.color.surface.base,
              ...theme.elevation.level1,
            }}
          >
            <RNText style={{ fontSize: 30 }}>{d.emoji}</RNText>
            <Text variant="caption" color={theme.color.text.muted}>
              {t('weather.day', { n: i + 1 })}
            </Text>
            <Text variant="h2">{`${d.temp}°`}</Text>
          </View>
        ))}
      </View>

      <Button label={t('weather.irrigationAdvice')} emoji="💧" trailing="→" onPress={() => open('Irrigation')} />
      <Notice />
    </ScreenContainer>
  );
}
