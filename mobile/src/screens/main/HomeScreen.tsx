import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { CloudSun, Droplet, Leaf, Thermometer, TrendingUp, Wrench } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { CropImage } from '../../components/CropImage';
import { CONDITION_ICON } from '../../data/weatherIcons';
import { activeFarm, farmName, useFarmStore } from '../../store/farmStore';
import { FarmSwitcher } from '../../components/FarmSwitcher';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getHome } from '../../api/endpoints';
import { hasSession } from '../../api/tokens';
import type { HomeOut } from '../../api/types';
import { speak, stopSpeaking, useVoicePhase } from '../../voice/speech';
import { FarmerAvatar } from '../../components/FarmerAvatar';
import { AdCarousel } from '../../components/AdCarousel';
import { ADS } from '../../data/ads';

/** The welcome is spoken once per app launch, not every time the farmer comes back to Home. */
let greetedThisLaunch = false;

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { open, tab, talk } = useAppNavigation();
  const { crop, stage, acres, farms, activeFarmId } = useFarmStore();
  const farm = activeFarm({ farms, activeFarmId });
  const farmCount = farms.length;
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
    }, [i18n.language]), // the advisory comes back in the new language

  );

  // Spoken welcome, once each time the app is opened, in the selected language.
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);
  const voicePhase = useVoicePhase();
  useFocusEffect(
    useCallback(() => {
      if (greetedThisLaunch || !voiceEnabled) return;
      greetedThisLaunch = true;
      // Short delay: lets the screen appear and the phone's voices load before speaking.
      const timer = setTimeout(() => speak(t('home.welcomeSpeech'), i18n.language), 700);
      return () => clearTimeout(timer);
    }, [voiceEnabled, t, i18n.language]),
  );

  const today = home?.weather?.today;
  const TodayIcon = today ? CONDITION_ICON[today.condition] : Thermometer;

  return (
    <ScreenContainer>
      <AdCarousel ads={ADS} onPress={(ad) => open(ad.target)} />

      {/* The farmer is the voice button: talks during the welcome; tap opens Ask already listening. */}
      <View style={{ gap: theme.spacing.xs }}>
        <FarmerAvatar
          state={voicePhase === 'playing' ? 'speaking' : voicePhase === 'preparing' ? 'thinking' : 'idle'}
          mood="happy"
          size={120}
          onPress={() => {
            stopSpeaking();
            talk();
          }}
          accessibilityLabel={t('nav.ask')}
        />
        <Text variant="h2" align="center">
          {t('home.askTitle')}
        </Text>
        <Text variant="body" align="center" color={theme.color.text.muted}>
          {t('home.tapMic')}
        </Text>
      </View>

      {today || home?.latest_advisory ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {today ? (
            <Card style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xxs }} onPress={() => open('Weather')}>
              <TodayIcon size={32} color={theme.color.status.infoText} strokeWidth={1.75} />
              <Text variant="h2">{today.temp_max_c != null ? `${Math.round(today.temp_max_c)}°C` : '—'}</Text>
              <Text variant="body" color={theme.color.text.muted} align="center">
                {t('home.todayWeather')}
              </Text>
            </Card>
          ) : null}
          {home?.latest_advisory ? (
            <Card style={{ flex: 2, gap: theme.spacing.xxs, justifyContent: 'center' }}>
              <Text variant="body" weight="semibold" color={theme.color.text.muted}>
                {t('home.latestAdvisory')}
              </Text>
              <Text variant="bodyStrong" numberOfLines={2}>
                {home.latest_advisory.title}
              </Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      {farmCount > 1 ? <FarmSwitcher /> : null}

      <Card tone="brand" style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" weight="bold" color={theme.color.text.inverseMuted} numberOfLines={1}>
          {farmCount > 1 ? farmName(farms, farm, t) : t('home.myCrop')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <CropImage code={crop} size={72} />
          <View style={{ flex: 1 }}>
            <Text variant="h1" color={theme.color.text.inverse}>
              {t(`crops.${crop}`)}
            </Text>
            <Text variant="body" color={theme.color.text.inverseMuted}>
              {`${t(`stages.${stage}`)} · ${t('home.acresValue', { acres })}`}
            </Text>
          </View>
        </View>
        <Button label={t('home.manageCrop')} variant="onBrand" onPress={() => tab('FarmTab')} />
      </Card>

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
