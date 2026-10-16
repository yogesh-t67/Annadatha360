import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Info, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { theme } from '../../theme';
import { Button, Card, Stack, Text } from '../../components/primitives';
import { EmptyState } from '../../components/EmptyState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { mockProducts } from '../../mocks/agriMart';
import { useCartStore } from '../../store/cartStore';

const paymentMethods = ['UPI', 'Cards', 'Netbanking'];

export function CartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const linesWithProduct = lines
    .map((line) => ({ line, product: mockProducts.find((p) => p.id === line.productId) }))
    .filter((entry): entry is { line: typeof entry.line; product: NonNullable<typeof entry.product> } =>
      Boolean(entry.product)
    );
  const total = linesWithProduct.reduce((sum, { line, product }) => sum + line.quantity * product.price, 0);

  if (linesWithProduct.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState icon={ShoppingCart} title={t('cart.emptyTitle')} body={t('cart.emptyBody')} />
        <Button label={t('cart.browseShop')} onPress={() => navigation.goBack()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Stack gap="sm">
        {linesWithProduct.map(({ line, product }) => (
          <Card key={product.id}>
            <Stack direction="row" justify="space-between" align="center">
              <Stack gap="xxs" style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t(`agriMart.products.${product.nameKey}`)}</Text>
                <Text variant="caption" color={theme.color.text.secondary}>
                  {`₹${product.price}`}
                </Text>
              </Stack>
              <Stack direction="row" gap="sm" align="center">
                <Stack direction="row" align="center" gap="xs">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setQuantity(product.id, line.quantity - 1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: theme.color.border.default,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Minus size={16} color={theme.color.text.primary} strokeWidth={2} />
                  </Pressable>
                  <Text variant="bodyStrong">{line.quantity}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setQuantity(product.id, line.quantity + 1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: theme.color.border.default,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} color={theme.color.text.primary} strokeWidth={2} />
                  </Pressable>
                </Stack>
                <Pressable accessibilityRole="button" onPress={() => removeItem(product.id)}>
                  <Trash2 size={18} color={theme.color.status.dangerText} strokeWidth={2} />
                </Pressable>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Card>
        <Stack direction="row" justify="space-between" align="center">
          <Text variant="h2">{t('cart.totalLabel')}</Text>
          <Text variant="h1" color={theme.color.interactive.primaryBg}>
            {`₹${total.toLocaleString('en-IN')}`}
          </Text>
        </Stack>
      </Card>

      <Stack gap="xs">
        <Text variant="bodyStrong">{t('cart.paymentMethods')}</Text>
        <Stack direction="row" gap="xs" wrap>
          {paymentMethods.map((method) => (
            <View
              key={method}
              style={{
                paddingVertical: theme.spacing.xs,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.sm,
                borderWidth: 1,
                borderColor: theme.color.border.default,
              }}
            >
              <Text variant="caption" weight="medium">
                {method}
              </Text>
            </View>
          ))}
        </Stack>
      </Stack>

      <Stack direction="row" gap="sm" align="flex-start" style={{ backgroundColor: theme.color.status.infoBg, borderRadius: theme.radius.sm, padding: theme.spacing.sm }}>
        <Info size={18} color={theme.color.status.infoText} strokeWidth={2} />
        <Text variant="micro" color={theme.color.status.infoText} style={{ flex: 1 }}>
          {t('cart.checkoutPendingNote')}
        </Text>
      </Stack>

      <Button label={t('cart.checkout')} disabled />
    </ScreenContainer>
  );
}
