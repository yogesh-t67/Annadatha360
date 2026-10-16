import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Droplets, Wind } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { theme } from '../../theme';
import { Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { getMockForecast, mockCurrentConditions } from '../../mocks/weather';

const localeTagByLanguage: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
};

export function WeatherScreen() {
  const { t, i18n } = useTranslation();
  const forecast = getMockForecast(7);
  const localeTag = localeTagByLanguage[i18n.language] ?? 'en-IN';
  const ConditionIcon = mockCurrentConditions.conditionIcon;

  return (
    <ScreenContainer scroll>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="h1">{t('weather.title')}</Text>
        <Text variant="micro" color={theme.color.text.tertiary}>
          {t('weather.demoDataNote')}
        </Text>
      </Stack>

      <Card>
        <Stack direction="row" justify="space-between" align="center">
          <Stack gap="xxs">
            <Text variant="display" weight="bold">{`${mockCurrentConditions.tempC}°C`}</Text>
            <Text variant="caption" color={theme.color.text.secondary}>
              {t('weather.conditionLabel')}
            </Text>
          </Stack>
          <ConditionIcon size={56} color={theme.color.interactive.primaryBg} strokeWidth={1.5} />
        </Stack>
        <Stack direction="row" gap="lg" style={{ marginTop: theme.spacing.md }}>
          <Stack direction="row" gap="xxs" align="center">
            <Droplets size={16} color={theme.color.text.tertiary} strokeWidth={2} />
            <Text variant="caption" color={theme.color.text.secondary}>
              {t('weather.humidity')} {mockCurrentConditions.humidityPercent}%
            </Text>
          </Stack>
          <Stack direction="row" gap="xxs" align="center">
            <Wind size={16} color={theme.color.text.tertiary} strokeWidth={2} />
            <Text variant="caption" color={theme.color.text.secondary}>
              {t('weather.wind')} {mockCurrentConditions.windKph} km/h
            </Text>
          </Stack>
        </Stack>
      </Card>

      <Card style={{ borderColor: 'transparent', backgroundColor: theme.color.status.warningBg }}>
        <Stack direction="row" gap="sm" align="flex-start">
          <AlertTriangle size={20} color={theme.color.status.warningText} strokeWidth={2} />
          <Stack gap="xxs" style={{ flex: 1 }}>
            <Text variant="bodyStrong" color={theme.color.status.warningText}>
              {t('weather.alertTitle')}
            </Text>
            <Text variant="caption" color={theme.color.status.warningText}>
              {t('weather.alertBody')}
            </Text>
          </Stack>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Text variant="h2">{t('weather.forecastTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Stack direction="row" gap="sm">
            {forecast.map((day, index) => {
              const DayIcon = day.icon;
              const label =
                index === 0
                  ? t('weather.today')
                  : new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(day.date);
              return (
                <Card key={day.date.toISOString()} padding="sm" style={{ width: 76, alignItems: 'center' }}>
                  <Stack align="center" gap="xs">
                    <Text variant="caption" weight="medium">
                      {label}
                    </Text>
                    <DayIcon size={24} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
                    <Stack direction="row" gap="xxs">
                      <Text variant="caption" weight="semibold">{`${day.high}°`}</Text>
                      <Text variant="caption" color={theme.color.text.tertiary}>{`${day.low}°`}</Text>
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </ScrollView>
      </Stack>
    </ScreenContainer>
  );
}
