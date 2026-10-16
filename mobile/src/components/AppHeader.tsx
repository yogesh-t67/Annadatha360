import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../theme';
import { LanguageCode, setStoredLanguage } from '../i18n';
import { Text } from './primitives';

/** Brand bar shown on every screen: optional back arrow, logo, and a one-tap Telugu/English switch. */
export function AppHeader({ showBack = false }: { showBack?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const other: LanguageCode = i18n.language === 'te' ? 'en' : 'te';

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
            width: 44,
            height: 44,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.color.surface.brandMid : theme.color.surface.base,
            borderWidth: 1,
            borderColor: theme.color.border.default,
          })}
        >
          <ChevronLeft size={26} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.color.surface.brandSoft,
            borderWidth: 1,
            borderColor: theme.color.border.brand,
          }}
        >
          <RNText style={{ fontSize: 22 }}>🌱</RNText>
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="h2" color={theme.color.surface.brandDeep} numberOfLines={1}>
          అన్నదాత 360
        </Text>
        <Text variant="micro" color={theme.color.text.muted} style={{ letterSpacing: 1.6, fontSize: 10 }}>
          ANNADATA 360
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`languageName.${other}`)}
        onPress={() => setStoredLanguage(other)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 40,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.color.border.brand,
          backgroundColor: pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
        })}
      >
        <RNText style={{ fontSize: 15 }}>🌐</RNText>
        <Text variant="caption" weight="bold" color={theme.color.surface.brandDeep}>
          {t(`languageName.${other}`)}
        </Text>
      </Pressable>
    </View>
  );
}
