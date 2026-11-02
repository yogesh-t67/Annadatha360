import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Globe, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../theme';
import { LanguageCode, setStoredLanguage } from '../i18n';
import { useFarmStore } from '../store/farmStore';
import { Text } from './primitives';

const LOGO = require('../../assets/logo.jpg');

/**
 * Brand bar shown on every screen: optional back arrow, logo, FarmersAgriMart name with the farmer's place
 * under it (once onboarding is done), and a one-tap Telugu/English switch.
 */
export function AppHeader({ showBack = false }: { showBack?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const other: LanguageCode = i18n.language === 'te' ? 'en' : 'te';
  const { onboarded, district, region } = useFarmStore();
  // The place the farmer chose during onboarding: "District, State". Before that it's only a default, so hide it.
  const location = onboarded ? `${t(`districts.${district}`)}, ${t(`states.${region}`)}` : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.color.surface.canvas,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.border.default,
      }}
    >
      {showBack && navigation.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: theme.touchTarget.minimum,
            height: theme.touchTarget.minimum,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.color.surface.brandMid : theme.color.surface.base,
            borderWidth: 1,
            borderColor: theme.color.border.default,
          })}
        >
          <ChevronLeft size={28} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <Image
          source={LOGO}
          accessibilityIgnoresInvertColors
          style={{
            width: theme.touchTarget.minimum,
            height: theme.touchTarget.minimum,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.color.border.brand,
          }}
        />
      )}

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        {/* The brand name is always Latin letters, so keep its line tight even in the Telugu app. */}
        <Text
          variant="title"
          color={theme.color.surface.brandDeep}
          numberOfLines={1}
          style={{ lineHeight: theme.typography.title.lineHeight }}
        >
          {t('common.brandName')}
        </Text>
        {location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
            <MapPin size={16} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
            <Text variant="caption" color={theme.color.text.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {location}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`languageName.${other}`)}
        onPress={() => setStoredLanguage(other)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: theme.touchTarget.minimum,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.color.border.brand,
          backgroundColor: pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
        })}
      >
        <Globe size={theme.iconSize.inline} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
        <Text variant="bodyStrong" weight="bold" color={theme.color.surface.brandDeep}>
          {t(`languageName.${other}`)}
        </Text>
      </Pressable>
    </View>
  );
}
