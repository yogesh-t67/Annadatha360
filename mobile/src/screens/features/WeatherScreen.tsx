import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero, Pill } from '../../components/Blocks';
import { Notice } from '../../components/Notice';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getWeatherForecast } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { ForecastOut, WeatherCondition } from '../../api/types';

const CONDITION_EMOJI: Record<WeatherCondition, string> = {
  clear: '☀️',
  partly_cloudy: '🌤️',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  heavy_rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  unknown: '🌡️',
};

export function WeatherScreen() {
  const { t } = useTranslation();
  const { navigation, open } = useAppNavigation();
  const district = useFarmStore((s) => s.district);

  const [forecast, setForecast] = useState<ForecastOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
    }, []),
  );

  useEffect(() => {
    if (signedIn !== true) {
      if (signedIn === false) setLoading(false);
      return;
    }
    setLoading(true);
    setErrorKey(null);
    getWeatherForecast()
      .then(setForecast)
      .catch((e) => setErrorKey(errorMessageKey(e)))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const today = forecast?.days[0];

  return (
    <ScreenContainer showBack>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{t('weather.title')}</Text>
        <Pill>{`📍 ${t(`districts.${district}`)}`}</Pill>
      </View>

      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('voice.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            emoji="📱"
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
          <ActivityIndicator color={theme.color.surface.brand} />
        </Card>
      ) : errorKey ? (
        <Notice emoji="⚠️" message={t(errorKey)} />
      ) : !today ? (
        <Notice emoji="📍" message={t('weather.locationNeeded')} />
      ) : (
        <>
          <Hero
            emoji={CONDITION_EMOJI[today.condition]}
            style={{ backgroundColor: theme.color.tint.sky.bg, borderColor: theme.color.tint.sky.border }}
          >
            <Text variant="hero">{today.temp_max_c != null ? `${Math.round(today.temp_max_c)}°C` : '—'}</Text>
            <Text variant="body" align="center" color={theme.color.text.muted}>
              {t(`weather.condition.${today.condition}`)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.xs }}>
              {[
                today.humidity_mean != null ? `💧 ${today.humidity_mean}%` : null,
                today.precipitation_probability != null ? `🌧️ ${today.precipitation_probability}%` : null,
                today.wind_max_kmh != null ? `💨 ${Math.round(today.wind_max_kmh)} km/h` : null,
              ]
                .filter(Boolean)
                .map((s) => (
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

          {forecast?.alerts.length ? (
            <View style={{ gap: theme.spacing.xs }}>
              {forecast.alerts.map((a, i) => (
                <Notice
                  key={i}
                  emoji="⚠️"
                  message={t(`weather.alertType.${a.type}`) + ' — ' + t('weather.alertDate', { date: a.date })}
                />
              ))}
            </View>
          ) : null}

          <Text variant="h2">{t('weather.sevenDay')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {forecast?.days.map((d, i) => (
              <View
                key={d.date}
                style={{
                  width: '30%',
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
                <RNText style={{ fontSize: 30 }}>{CONDITION_EMOJI[d.condition]}</RNText>
                <Text variant="caption" color={theme.color.text.muted}>
                  {i === 0 ? t('weather.today') : t('weather.day', { n: i + 1 })}
                </Text>
                <Text variant="h2">{d.temp_max_c != null ? `${Math.round(d.temp_max_c)}°` : '—'}</Text>
                {d.temp_min_c != null ? (
                  <Text variant="caption" color={theme.color.text.muted}>{`${Math.round(d.temp_min_c)}°`}</Text>
                ) : null}
              </View>
            ))}
          </View>

          <Button label={t('weather.irrigationAdvice')} emoji="💧" trailing="→" onPress={() => open('Irrigation')} />
        </>
      )}
    </ScreenContainer>
  );
}
