import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import {
  CircleCheck,
  CloudRain,
  Droplet,
  Droplets,
  Hand,
  Hourglass,
  MessageCircle,
  Smartphone,
  Square,
  Sunrise,
  Volume2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { CropImage } from '../../components/CropImage';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { Notice } from '../../components/Notice';
import { soilStates } from '../../data/farm';
import { getDistrict } from '../../data/districts';
import { CONDITION_ICON } from '../../data/weatherIcons';
import { irrigationAdvice, SoilState, usefulRain, Verdict } from '../../data/irrigationAdvice';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getWeatherForecast } from '../../api/endpoints';
import { hasSession } from '../../api/tokens';
import type { DayForecast } from '../../api/types';
import { speak, stopSpeaking } from '../../voice/speech';

const VERDICT_STYLE: Record<Verdict, { icon: LucideIcon; fg: string; bg: string; border: string }> = {
  water: { icon: Droplets, fg: theme.color.status.infoText, bg: theme.color.tint.water.bg, border: theme.color.tint.water.border },
  light: { icon: Droplet, fg: theme.color.status.infoText, bg: theme.color.tint.sky.bg, border: theme.color.tint.sky.border },
  wait: { icon: Hourglass, fg: theme.color.status.warningText, bg: theme.color.status.warningBg, border: theme.color.status.warningBorder },
  skip: { icon: CircleCheck, fg: theme.color.status.successText, bg: theme.color.status.successBg, border: theme.color.tint.leaf.border },
  check: { icon: Hand, fg: theme.color.text.primary, bg: theme.color.tint.stone.bg, border: theme.color.tint.stone.border },
};

export function IrrigationScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, ask } = useAppNavigation();
  const crop = useFarmStore((s) => s.crop);
  const stage = useFarmStore((s) => s.stage);
  const district = useFarmStore((s) => s.district);
  const [soil, setSoil] = useState<SoilState>('unknown');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [days, setDays] = useState<DayForecast[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
      return () => stopSpeaking();
    }, []),
  );

  useEffect(() => {
    if (!signedIn) return;
    const coords = getDistrict(district)?.coords;
    setLoading(true);
    getWeatherForecast(coords ? { lat: coords[0], lng: coords[1] } : {})
      .then((f) => setDays(f.days))
      .catch(() => setDays(null)) // advice still works from the soil alone
      .finally(() => setLoading(false));
  }, [signedIn, district]);

  const advice = irrigationAdvice(soil, crop, stage, days);
  const style = VERDICT_STYLE[advice.verdict];
  const VerdictIcon = style.icon;
  const showTiming = advice.verdict === 'water' || advice.verdict === 'light';

  const lines = [
    t(`irrigation.verdict.${advice.verdict}`),
    ...advice.reasons.map((r) => t(r.key, r.params)),
    showTiming ? t('irrigation.timing') : '',
  ].filter(Boolean);

  function listen() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(lines.join('. '), i18n.language, () => setSpeaking(false));
  }

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('irrigation.title')}</Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <CropImage code={crop} size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="h2">{t(`crops.${crop}`)}</Text>
            <Text variant="body" color={theme.color.text.muted}>
              {`${t(`stages.${stage}`)} · ${t(`districts.${district}`)}`}
            </Text>
          </View>
        </View>
      </Card>

      {/* Rain in the next 3 days */}
      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('irrigation.signInForRain')}</Text>
          <Button
            label={t('voice.verifyNow')}
            icon={Smartphone}
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
          <ActivityIndicator color={theme.color.surface.brand} />
        </Card>
      ) : days ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h2">{t('irrigation.rainNext')}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {days.slice(0, 3).map((d, i) => {
              const DayIcon = CONDITION_ICON[d.condition];
              const rain = usefulRain(d);
              return (
                <View
                  key={d.date}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 2,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.lg,
                    borderWidth: rain ? 2 : 1,
                    borderColor: rain ? theme.color.tint.water.border : theme.color.border.default,
                    backgroundColor: rain ? theme.color.tint.water.bg : theme.color.surface.base,
                  }}
                >
                  <Text variant="caption" weight="bold" color={theme.color.text.muted}>
                    {i === 0 ? t('weather.today') : i === 1 ? t('irrigation.tomorrow') : t('weather.day', { n: i + 1 })}
                  </Text>
                  <DayIcon size={26} color={theme.color.surface.brandDeep} strokeWidth={1.75} />
                  <Text variant="bodyStrong">{`${Math.round(d.precipitation_mm ?? 0)} mm`}</Text>
                  <Text variant="caption" color={theme.color.text.muted}>
                    {`${d.precipitation_probability ?? 0}%`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Soil */}
      <Text variant="h2">{t('irrigation.soilQuestion')}</Text>
      <TileGrid>
        {soilStates.map((s) => (
          <FeatureTile
            key={s.key}
            icon={s.icon}
            tint={s.tint}
            label={t(`irrigation.soil.${s.key}`)}
            selected={soil === s.key}
            onPress={() => setSoil(s.key)}
          />
        ))}
      </TileGrid>

      {/* Advice */}
      <View
        accessibilityLiveRegion="polite"
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 2,
          borderColor: style.border,
          backgroundColor: style.bg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <VerdictIcon size={32} color={style.fg} strokeWidth={2.25} />
          <Text variant="h2" color={style.fg} style={{ flex: 1 }}>
            {t(`irrigation.verdict.${advice.verdict}`)}
          </Text>
        </View>
        {advice.reasons.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
            <Text variant="body" color={style.fg}>
              •
            </Text>
            <Text variant="body" style={{ flex: 1 }}>
              {t(r.key, r.params)}
            </Text>
          </View>
        ))}
        {showTiming ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Sunrise size={18} color={theme.color.text.secondary} strokeWidth={2.25} />
            <Text variant="caption" color={theme.color.text.secondary} style={{ flex: 1 }}>
              {t('irrigation.timing')}
            </Text>
          </View>
        ) : null}
        {advice.rainDay ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <CloudRain size={18} color={theme.color.text.secondary} strokeWidth={2.25} />
            <Text variant="caption" color={theme.color.text.secondary} style={{ flex: 1 }}>
              {t('irrigation.noSpray')}
            </Text>
          </View>
        ) : null}
        <Button
          label={speaking ? t('voice.stopSpeaking') : t('voice.listen')}
          icon={speaking ? Square : Volume2}
          variant="secondary"
          compact
          onPress={listen}
        />
      </View>

      <Button
        label={t('irrigation.askAi')}
        icon={MessageCircle}
        variant="soft"
        onPress={() =>
          ask(
            t('irrigation.aiQuestion', {
              crop: t(`crops.${crop}`),
              stage: t(`stages.${stage}`),
              soil: t(`irrigation.soil.${soil}`),
            }),
          )
        }
      />

      <Notice message={t('irrigation.disclaimer')} />
    </ScreenContainer>
  );
}
