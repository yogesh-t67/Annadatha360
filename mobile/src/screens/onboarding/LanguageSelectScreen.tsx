import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';

import { theme } from '../../theme';
import { Button, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LanguageCode, setStoredLanguage, supportedLanguages } from '../../i18n';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelect'>;

export function LanguageSelectScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<LanguageCode>(i18n.language as LanguageCode);

  async function handleContinue() {
    await setStoredLanguage(selected);
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }

  return (
    <ScreenContainer scroll>
      <Stack gap="xxs" style={{ marginTop: theme.spacing.md }}>
        <Text variant="h1">{t('languageSelect.title')}</Text>
        <Text variant="body" color={theme.color.text.secondary}>
          {t('languageSelect.subtitle')}
        </Text>
      </Stack>

      <Stack gap="sm">
        {supportedLanguages.map(({ code, translated }) => {
          const isSelected = selected === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(code)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: theme.touchTarget.minimum,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.md,
                borderWidth: 1.5,
                borderColor: isSelected ? theme.color.interactive.primaryBg : theme.color.border.default,
                backgroundColor: theme.color.surface.raised,
              }}
            >
              <Stack direction="row" gap="xs" align="center">
                <Text variant="bodyStrong">{t(`languages.${code}`)}</Text>
                {!translated ? (
                  <Text variant="micro" color={theme.color.text.tertiary}>
                    (English fallback)
                  </Text>
                ) : null}
              </Stack>
              {isSelected ? (
                <Check size={20} color={theme.color.interactive.primaryBg} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          );
        })}
      </Stack>

      <Button label={t('common.continue')} onPress={handleContinue} />
    </ScreenContainer>
  );
}
