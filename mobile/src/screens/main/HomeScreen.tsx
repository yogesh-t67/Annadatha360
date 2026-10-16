import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { CloudSun, Droplet, Leaf, MapPin, Thermometer, TrendingUp, Wrench } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Pill } from '../../components/Blocks';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { MicButton } from '../../components/MicButton';
import { CropImage } from '../../components/CropImage';
import { CONDITION_ICON } from '../../data/weatherIcons';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getHome } from '../../api/endpoints';
import { hasSession } from '../../api/tokens';
import type { HomeOut } from '../../api/types';

export function HomeScreen() {
  const { t } = useTranslation();
  const { open, tab } = useAppNavigation();
  const { name, village, district, region, crop, stage, acres } = useFarmStore();
  const [home, setHome] = useState<HomeOut | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      hasSession().then((signedIn) => {
        if (signedIn) getHome().then((h) => active && setHome(h)).catch(() => undefined);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const trimmedName = name.trim();
  const location = [village.trim(), t(`districts.${district}`)].filter(Boolean).join(', ');
  const today = home?.weather?.today;
  const TodayIcon = today ? CONDITION_ICON[today.condition] : Thermometer;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{trimmedName ? t('home.helloName', { name: trimmedName }) : t('home.hello')}</Text>
        <Pill icon={MapPin}>{`${location} · ${t(`states.${region}`)}`}</Pill>
      </View>

      {today || home?.latest_advisory ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {today ? (
            <Card style={{ flex: 1, alignItems: 'center', gap: 2 }} onPress={() => open('Weather')}>
              <TodayIcon size={28} color={theme.color.status.infoText} strokeWidth={1.75} />
              <Text variant="h2">{today.temp_max_c != null ? `${Math.round(today.temp_max_c)}°C` : '—'}</Text>
              <Text variant="caption" color={theme.color.text.muted}>
                {t('home.todayWeather')}
              </Text>
            </Card>
          ) : null}
          {home?.latest_advisory ? (
            <Card style={{ flex: 2, gap: 2, justifyContent: 'center' }}>
              <Text variant="caption" weight="semibold" color={theme.color.text.muted}>
                {t('home.latestAdvisory')}
              </Text>
              <Text variant="bodyStrong" numberOfLines={2}>
                {home.latest_advisory.title}
              </Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      <Card tone="brand" style={{ gap: theme.spacing.sm }}>
        <Text variant="micro" weight="bold" color={theme.color.text.inverseMuted} style={{ letterSpacing: 1.2 }}>
          {t('home.myCrop')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <CropImage code={crop} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="h1" color={theme.color.text.inverse}>
              {t(`crops.${crop}`)}
            </Text>
            <Text variant="body" color={theme.color.text.inverseMuted}>
              {`${t(`stages.${stage}`)} · ${t('home.acresValue', { acres })}`}
            </Text>
          </View>
        </View>
        <Button label={t('home.manageCrop')} variant="onBrand" compact onPress={() => tab('FarmTab')} />
      </Card>

      <MicButton accessibilityLabel={t('nav.ask')} onPress={() => tab('AskTab')} />
      <View style={{ gap: theme.spacing.xxs, marginTop: -theme.spacing.xs }}>
        <Text variant="h2" align="center">
          {t('home.askTitle')}
        </Text>
        <Text variant="body" align="center" color={theme.color.text.muted}>
          {t('home.tapMic')}
        </Text>
      </View>

      <TileGrid>
        <FeatureTile icon={Leaf} tint="clay" label={t('home.tiles.cropProblem')} showArrow onPress={() => open('Diagnosis')} />
        <FeatureTile icon={CloudSun} tint="sky" label={t('home.tiles.weather')} showArrow onPress={() => open('Weather')} />
        <FeatureTile icon={Droplet} tint="water" label={t('home.tiles.irrigation')} showArrow onPress={() => open('Irrigation')} />
        <FeatureTile icon={TrendingUp} tint="sun" label={t('home.tiles.marketPrices')} showArrow onPress={() => open('Market')} />
      </TileGrid>

      <Button label={t('home.exploreServices')} variant="soft" icon={Wrench} onPress={() => tab('ServicesTab')} />
    </ScreenContainer>
  );
}
