import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmojiChip } from '../../components/EmojiChip';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { Notice } from '../../components/Notice';
import { cropEmoji, soilStates } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';

export function IrrigationScreen() {
  const { t } = useTranslation();
  const crop = useFarmStore((s) => s.crop);
  const stage = useFarmStore((s) => s.stage);
  const [soil, setSoil] = useState<(typeof soilStates)[number]['key']>('unknown');

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('irrigation.title')}</Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <EmojiChip emoji={cropEmoji(crop)} tint="leaf" size={54} />
          <View style={{ flex: 1 }}>
            <Text variant="h2">{t(`crops.${crop}`)}</Text>
            <Text variant="body" color={theme.color.text.muted}>
              {t(`stages.${stage}`)}
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="h2">{t('irrigation.soilQuestion')}</Text>
      <TileGrid>
        {soilStates.map((s) => (
          <FeatureTile
            key={s.key}
            emoji={s.emoji}
            tint={s.tint}
            label={t(`irrigation.soil.${s.key}`)}
            selected={soil === s.key}
            onPress={() => setSoil(s.key)}
          />
        ))}
      </TileGrid>

      <Card tone="soft">
        <Text variant="h2">{`👉 ${t('irrigation.nextStep')}`}</Text>
        <Text variant="body" color={theme.color.text.secondary}>
          {soil === 'wet' ? t('irrigation.wetAdvice') : t('irrigation.defaultAdvice')}
        </Text>
      </Card>

      <Notice />
    </ScreenContainer>
  );
}
