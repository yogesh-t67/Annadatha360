import React from 'react';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  Bot,
  CloudSun,
  Droplets,
  Landmark,
  Leaf,
  ShoppingBag,
  Sprout,
  TrendingUp,
  Wrench,
} from 'lucide-react-native';
import { View } from 'react-native';

import { theme } from '../../theme';
import { Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { GridTile } from '../../components/GridTile';
import { HomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeDashboard'>;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  // Tiles that live in other bottom tabs navigate by tab name; React Navigation
  // resolves this across the tree without extra plumbing.
  const crossTabNavigate = navigation.navigate as unknown as (tab: string, params?: object) => void;

  const tiles: { icon: GridTileIcon; label: string; onPress: () => void }[] = [
    { icon: CloudSun, label: t('home.tiles.weather'), onPress: () => navigation.navigate('Weather') },
    { icon: TrendingUp, label: t('home.tiles.marketPrices'), onPress: () => navigation.navigate('MarketPrices') },
    { icon: ShoppingBag, label: t('home.tiles.agriMart'), onPress: () => crossTabNavigate('ShopTab') },
    { icon: Bot, label: t('home.tiles.aiAssistant'), onPress: () => navigation.navigate('AiAssistant') },
    { icon: Leaf, label: t('home.tiles.cropAdvisory'), onPress: () => crossTabNavigate('AdvisoriesTab') },
    { icon: Wrench, label: t('home.tiles.farmServices'), onPress: () => crossTabNavigate('ServicesTab') },
    {
      icon: Sprout,
      label: t('home.tiles.farmManagement'),
      onPress: () => crossTabNavigate('AdvisoriesTab', { screen: 'FarmManagement' }),
    },
    {
      icon: Landmark,
      label: t('home.tiles.governmentSchemes'),
      onPress: () => crossTabNavigate('ServicesTab', { screen: 'GovernmentSchemes' }),
    },
  ];

  return (
    <ScreenContainer scroll>
      <Stack gap="xxs">
        <Text variant="h1">{t('home.greeting')}</Text>
        <Text variant="body" color={theme.color.text.secondary}>
          {t('home.greetingSubtitle')}
        </Text>
      </Stack>

      <Card style={{ borderColor: 'transparent', backgroundColor: theme.color.status.warningBg }}>
        <Stack direction="row" gap="sm" align="flex-start">
          <AlertTriangle size={20} color={theme.color.status.warningText} strokeWidth={2} />
          <Stack gap="xxs" style={{ flex: 1 }}>
            <Text variant="bodyStrong" color={theme.color.status.warningText}>
              {t('home.weatherAlertTitle')}
            </Text>
            <Text variant="caption" color={theme.color.status.warningText}>
              {t('home.weatherAlertBody')}
            </Text>
          </Stack>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Text variant="h2">{t('home.exploreTitle')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: theme.spacing.md }}>
          {tiles.map((tile) => (
            <GridTile key={tile.label} icon={tile.icon} label={tile.label} onPress={tile.onPress} />
          ))}
        </View>
      </Stack>

      <Card>
        <Stack direction="row" gap="sm" align="flex-start">
          <Droplets size={20} color={theme.color.interactive.primaryBg} strokeWidth={2} />
          <Stack gap="xxs" style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t('home.latestAdvisoryTitle')}</Text>
            <Text variant="caption" color={theme.color.text.secondary}>
              {t('home.latestAdvisoryBody')}
            </Text>
          </Stack>
        </Stack>
      </Card>
    </ScreenContainer>
  );
}

type GridTileIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
