import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronRight,
  FileClock,
  HelpCircle,
  LogOut,
  MapPin,
  Package,
  Settings,
  Star,
  User,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { theme } from '../../theme';
import { Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';

const menuItems = [
  { key: 'myFields', icon: MapPin },
  { key: 'myOrders', icon: Package },
  { key: 'savedProducts', icon: Star },
  { key: 'notifications', icon: Bell },
  { key: 'advisoryHistory', icon: FileClock },
  { key: 'settings', icon: Settings },
  { key: 'helpSupport', icon: HelpCircle },
] as const;

export function ProfileDashboardScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer scroll>
      <Text variant="h1">{t('profile.title')}</Text>

      <Card>
        <Stack direction="row" gap="sm" align="center">
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.full,
              backgroundColor: theme.color.status.successBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={26} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
          </View>
          <Stack gap="xxs">
            <Text variant="h2">{t('profile.mockName')}</Text>
            <Text variant="caption" color={theme.color.text.secondary}>
              {t('profile.mockLocation')}
            </Text>
          </Stack>
        </Stack>
      </Card>

      <Card padding="xxs">
        <Stack>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.sm,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.color.border.default,
                  minHeight: theme.touchTarget.minimum,
                }}
              >
                <Icon size={20} color={theme.color.text.secondary} strokeWidth={1.75} />
                <Text variant="body" style={{ flex: 1 }}>
                  {t(`profile.menu.${item.key}`)}
                </Text>
                <ChevronRight size={18} color={theme.color.text.tertiary} strokeWidth={2} />
              </Pressable>
            );
          })}
        </Stack>
      </Card>

      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          minHeight: theme.touchTarget.minimum,
        }}
      >
        <LogOut size={18} color={theme.color.status.dangerText} strokeWidth={2} />
        <Text variant="bodyStrong" color={theme.color.status.dangerText}>
          {t('profile.menu.logout')}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}
