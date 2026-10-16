import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';

import { theme } from '../../theme';
import { Card, Stack, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { CropCategory, mockCropPrices } from '../../mocks/marketPrices';

const categories: ('all' | CropCategory)[] = ['all', 'cereals', 'pulses', 'oilseeds'];

export function MarketPricesScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | CropCategory>('all');

  const filteredCrops = useMemo(() => {
    return mockCropPrices.filter((crop) => {
      const matchesCategory = activeCategory === 'all' || crop.category === activeCategory;
      const label = t(`marketPrices.crops.${crop.key}`);
      const matchesQuery = label.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query, t]);

  return (
    <ScreenContainer scroll>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="h1">{t('marketPrices.title')}</Text>
        <Text variant="micro" color={theme.color.text.tertiary}>
          {t('marketPrices.demoDataNote')}
        </Text>
      </Stack>

      <TextField
        placeholder={t('marketPrices.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        icon={Search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Stack direction="row" gap="xs">
          {categories.map((category) => {
            const active = activeCategory === category;
            return (
              <Pressable
                key={category}
                onPress={() => setActiveCategory(category)}
                style={{
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  backgroundColor: active ? theme.color.interactive.primaryBg : theme.color.surface.raised,
                  borderWidth: 1,
                  borderColor: active ? theme.color.interactive.primaryBg : theme.color.border.default,
                }}
              >
                <Text
                  variant="caption"
                  weight="medium"
                  color={active ? theme.color.text.inverse : theme.color.text.secondary}
                >
                  {t(`marketPrices.categories.${category}`)}
                </Text>
              </Pressable>
            );
          })}
        </Stack>
      </ScrollView>

      <Stack gap="sm">
        {filteredCrops.map((crop) => {
          const isUp = crop.trendPercent >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const trendColor = isUp ? theme.color.priceUp : theme.color.priceDown;
          return (
            <Card key={crop.key}>
              <Stack direction="row" justify="space-between" align="center">
                <Stack gap="xxs">
                  <Text variant="bodyStrong">{t(`marketPrices.crops.${crop.key}`)}</Text>
                  <Text variant="caption" color={theme.color.text.secondary}>
                    {`₹${crop.pricePerQuintal.toLocaleString('en-IN')} `}
                    {t('marketPrices.perQuintal')}
                  </Text>
                </Stack>
                <Stack direction="row" gap="xxs" align="center">
                  <TrendIcon size={16} color={trendColor} strokeWidth={2.5} />
                  <Text variant="bodyStrong" color={trendColor}>{`${isUp ? '+' : ''}${crop.trendPercent}%`}</Text>
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </ScreenContainer>
  );
}
