import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Pill } from '../../components/Blocks';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { MicButton } from '../../components/MicButton';
import { cropEmoji } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function HomeScreen() {
  const { t } = useTranslation();
  const { open, tab } = useAppNavigation();
  const { name, village, district, region, crop, stage, acres } = useFarmStore();

  const trimmedName = name.trim();
  const location = [village.trim(), t(`districts.${district}`)].filter(Boolean).join(', ');

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="h1">{`${trimmedName ? t('home.helloName', { name: trimmedName }) : t('home.hello')}! 🙏`}</Text>
        <Pill>{`📍 ${location} · ${t(`states.${region}`)}`}</Pill>
      </View>

      <Card tone="brand" style={{ gap: theme.spacing.sm }}>
        <Text variant="micro" weight="bold" color={theme.color.text.inverseMuted} style={{ letterSpacing: 1.2 }}>
          {t('home.myCrop')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.surface.base,
            }}
          >
            <RNText style={{ fontSize: 32 }}>{cropEmoji(crop)}</RNText>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h1" color={theme.color.text.inverse}>
              {t(`crops.${crop}`)}
            </Text>
            <Text variant="body" color={theme.color.text.inverseMuted}>
              {`🌱 ${t(`stages.${stage}`)} · ${t('home.acresValue', { acres })}`}
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
        <FeatureTile emoji="🌿" tint="clay" label={t('home.tiles.cropProblem')} showArrow onPress={() => open('Diagnosis')} />
        <FeatureTile emoji="🌦️" tint="sky" label={t('home.tiles.weather')} showArrow onPress={() => open('Weather')} />
        <FeatureTile emoji="💧" tint="water" label={t('home.tiles.irrigation')} showArrow onPress={() => open('Irrigation')} />
        <FeatureTile emoji="💰" tint="sun" label={t('home.tiles.marketPrices')} showArrow onPress={() => open('Market')} />
      </TileGrid>

      <Button label={t('home.exploreServices')} variant="soft" emoji="🧰" onPress={() => tab('ServicesTab')} />
    </ScreenContainer>
  );
}
