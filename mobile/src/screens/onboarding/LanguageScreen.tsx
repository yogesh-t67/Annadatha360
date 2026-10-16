import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LanguageCode, setStoredLanguage, supportedLanguages } from '../../i18n';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const glyphs: Record<LanguageCode, string> = { te: 'అ', en: 'A' };

export function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const { navigation } = useAppNavigation();

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('language.title')}</Text>

      {supportedLanguages.map((code) => {
        const selected = i18n.language === code;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`languageName.${code}`)}
            onPress={() => setStoredLanguage(code)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: 72,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: selected ? 2 : 1.5,
              borderColor: selected ? theme.color.surface.brandDeep : theme.color.border.brand,
              backgroundColor: selected ? theme.color.surface.brand : pressed ? theme.color.surface.sunken : theme.color.surface.base,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.color.surface.onBrandGlass : theme.color.surface.brandSoft,
              }}
            >
              <Text variant="h2" color={selected ? theme.color.text.inverse : theme.color.surface.brand}>
                {glyphs[code]}
              </Text>
            </View>
            <Text variant="h2" color={selected ? theme.color.text.inverse : theme.color.text.primary} style={{ flex: 1 }}>
              {t(`languageName.${code}`)}
            </Text>
            {selected ? <RNText style={{ fontSize: 22, color: theme.color.text.inverse, fontWeight: '800' }}>✓</RNText> : null}
          </Pressable>
        );
      })}

      <Button label={t('common.continue')} trailing="→" onPress={() => navigation.navigate('FarmerProfile')} />
    </ScreenContainer>
  );
}
