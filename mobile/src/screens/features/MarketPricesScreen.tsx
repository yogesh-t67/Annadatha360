import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmojiChip } from '../../components/EmojiChip';
import { SelectField } from '../../components/SelectField';
import { Notice } from '../../components/Notice';
import { CropKey, cropEmoji, crops, marketDistricts } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';

type MarketKey = (typeof marketDistricts)[number];

export function MarketPricesScreen() {
  const { t } = useTranslation();
  const farmCrop = useFarmStore((s) => s.crop);
  const farmDistrict = useFarmStore((s) => s.district);
  const [crop, setCrop] = useState<CropKey>(farmCrop);
  const [market, setMarket] = useState<MarketKey>(
    (marketDistricts as readonly string[]).includes(farmDistrict) ? (farmDistrict as MarketKey) : 'guntur',
  );

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('market.title')}</Text>
      <SelectField
        label={t('market.crop')}
        value={crop}
        options={crops.map((c) => ({ value: c.key, label: t(`crops.${c.key}`), emoji: c.emoji }))}
        onChange={setCrop}
      />
      <SelectField
        label={t('market.market')}
        value={market}
        options={marketDistricts.map((d) => ({ value: d, label: t(`districts.${d}`) }))}
        onChange={setMarket}
      />

      <Card style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <EmojiChip emoji={cropEmoji(crop)} tint="sun" size={54} />
          <Text variant="h2" style={{ flex: 1 }}>
            {`${t(`crops.${crop}`)} · ${t(`districts.${market}`)}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.status.warningDot }} />
          <Text variant="h2" style={{ flex: 1 }}>
            {t('market.unavailable')}
          </Text>
        </View>
        <Text variant="body" color={theme.color.text.muted}>
          {t('market.apiNote')}
        </Text>
      </Card>

      <Notice />
    </ScreenContainer>
  );
}
