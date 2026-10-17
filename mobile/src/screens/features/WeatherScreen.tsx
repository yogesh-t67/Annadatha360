import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowRight,
  Droplet,
  Droplets,
  MapPin,
  Smartphone,
  Thermometer,
  TriangleAlert,
  Umbrella,
  Wind,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

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
import { CONDITION_ICON } from '../../data/weatherIcons';
import { getDistrict } from '../../data/districts';
import type { ForecastOut } from '../../api/types';

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
    // Always ask for the farmer's current district, even if the backend profile hasn't synced yet.
    const coords = getDistrict(district)?.coords;
    getWeatherForecast(coords ? { lat: coords[0], lng: coords[1] } : {})
      .then(setForecast)
      .catch((e) => setErrorKey(errorMessageKey(e)))
      .finally(() => setLoading(false));
  }, [signedIn, district]);

  const today = forecast?.days[0];
  const TodayIcon = today ? CONDITION_ICON[today.condition] : Thermometer;

  return (
    <ScreenContainer showBack>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{t('weather.title')}</Text>
        <Pill icon={MapPin}>{t(`districts.${district}`)}</Pill>
      </View>

      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('voice.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            icon={Smartphone}
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
          <ActivityIndicator color={theme.color.surface.brand} />
        </Card>
      ) : errorKey ? (
        <Notice icon={TriangleAlert} message={t(errorKey)} />
      ) : !today ? (
        <Notice icon={MapPin} message={t('weather.locationNeeded')} />
      ) : (
        <>
          <Hero icon={TodayIcon} style={{ backgroundColor: theme.color.tint.sky.bg, borderColor: theme.color.tint.sky.border }}>
            <Text variant="hero">{today.temp_max_c != null ? `${Math.round(today.temp_max_c)}°C` : '—'}</Text>
            <Text variant="body" align="center" color={theme.color.text.muted}>
              {t(`weather.condition.${today.condition}`)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.xs }}>
              {(
                [
                  today.humidity_mean != null ? { icon: Droplets, text: `${today.humidity_mean}%` } : null,
                  today.precipitation_probability != null
                    ? { icon: Umbrella, text: `${today.precipitation_probability}%` }
                    : null,
                  today.wind_max_kmh != null ? { icon: Wind, text: `${Math.round(today.wind_max_kmh)} km/h` } : null,
                ] as const
              )
                .filter((s): s is { icon: LucideIcon; text: string } => s !== null)
                .map((s, idx) => {
                  const StatIcon = s.icon;
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xxs,
                        borderRadius: theme.radius.full,
                        borderWidth: 1,
                        borderColor: theme.color.border.default,
                        backgroundColor: theme.color.surface.base,
                      }}
                    >
                      <StatIcon size={14} color={theme.color.text.secondary} strokeWidth={2.25} />
                      <Text variant="caption" weight="semibold" color={theme.color.text.secondary}>
                        {s.text}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </Hero>

          {forecast?.alerts.length ? (
            <View style={{ gap: theme.spacing.xs }}>
              {forecast.alerts.map((a, i) => (
                <Notice
                  key={i}
                  icon={TriangleAlert}
                  message={t(`weather.alertType.${a.type}`) + ' — ' + t('weather.alertDate', { date: a.date })}
                />
              ))}
            </View>
          ) : null}

          <Text variant="h2">{t('weather.sevenDay')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {forecast?.days.map((d, i) => {
              const DayIcon = CONDITION_ICON[d.condition];
              return (
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
                  <DayIcon size={28} color={theme.color.surface.brandDeep} strokeWidth={1.75} />
                  <Text variant="caption" color={theme.color.text.muted}>
                    {i === 0 ? t('weather.today') : t('weather.day', { n: i + 1 })}
                  </Text>
                  <Text variant="h2">{d.temp_max_c != null ? `${Math.round(d.temp_max_c)}°` : '—'}</Text>
                  {d.temp_min_c != null ? (
                    <Text variant="caption" color={theme.color.text.muted}>{`${Math.round(d.temp_min_c)}°`}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Button label={t('weather.irrigationAdvice')} icon={Droplet} trailingIcon={ArrowRight} onPress={() => open('Irrigation')} />
        </>
      )}
    </ScreenContainer>
  );
}
