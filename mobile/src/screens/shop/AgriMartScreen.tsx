import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  Bug,
  Droplets,
  FlaskConical,
  Search,
  ShoppingCart,
  Sprout,
  Tractor,
  Wrench,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { theme } from '../../theme';
import { Button, Card, Stack, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { dealProductIds, mockProducts } from '../../mocks/agriMart';
import { useCartStore } from '../../store/cartStore';

const categoryIcons = {
  seeds: Sprout,
  fertilizers: FlaskConical,
  pesticides: Bug,
  equipment: Tractor,
  irrigation: Droplets,
  tools: Wrench,
} as const;

export function AgriMartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const addItem = useCartStore((state) => state.addItem);
  const itemCount = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
  const deals = mockProducts.filter((product) => dealProductIds.includes(product.id));

  return (
    <ScreenContainer scroll>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="h1">{t('agriMart.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cart.title')}
          onPress={() => navigation.navigate('Cart' as never)}
          style={{
            width: theme.touchTarget.minimum,
            height: theme.touchTarget.minimum,
            borderRadius: theme.radius.full,
            backgroundColor: theme.color.surface.raised,
            borderWidth: 1,
            borderColor: theme.color.border.default,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShoppingCart size={20} color={theme.color.text.primary} strokeWidth={2} />
          {itemCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                borderRadius: theme.radius.full,
                backgroundColor: theme.color.status.dangerText,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text variant="micro" weight="bold" color={theme.color.text.inverse}>
                {itemCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Stack>

      <TextField placeholder={t('agriMart.searchPlaceholder')} icon={Search} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: theme.spacing.md }}>
        {(Object.keys(categoryIcons) as (keyof typeof categoryIcons)[]).map((category) => {
          const Icon = categoryIcons[category];
          return (
            <View key={category} style={{ width: '31%', alignItems: 'center' }}>
              <Stack align="center" gap="xxs">
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.color.status.successBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={26} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
                </View>
                <Text variant="micro" weight="medium" align="center">
                  {t(`agriMart.categories.${category}`)}
                </Text>
              </Stack>
            </View>
          );
        })}
      </View>

      <Text variant="caption" color={theme.color.text.tertiary}>
        {t('agriMart.catalogPendingNote')}
      </Text>

      <Stack gap="sm">
        <Text variant="h2">{t('agriMart.dealsTitle')}</Text>
        {deals.map((product) => (
          <Card key={product.id}>
            <Stack direction="row" justify="space-between" align="center">
              <Stack gap="xxs" style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t(`agriMart.products.${product.nameKey}`)}</Text>
                <Stack direction="row" gap="xs" align="center">
                  <Text variant="bodyStrong" color={theme.color.interactive.primaryBg}>
                    {`₹${product.price}`}
                  </Text>
                  {product.originalPrice ? (
                    <Text
                      variant="caption"
                      color={theme.color.text.tertiary}
                      style={{ textDecorationLine: 'line-through' }}
                    >
                      {`₹${product.originalPrice}`}
                    </Text>
                  ) : null}
                </Stack>
              </Stack>
              <Button label={t('agriMart.addToCart')} size="md" onPress={() => addItem(product.id)} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </ScreenContainer>
  );
}
