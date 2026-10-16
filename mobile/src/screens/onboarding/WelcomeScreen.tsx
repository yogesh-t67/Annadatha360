import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero } from '../../components/Blocks';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();

  return (
    <ScreenContainer>
      <Hero emoji="👩🏽‍🌾🌾">
        <Text variant="display" align="center">
          {t('welcome.title')}
        </Text>
        <Text variant="body" align="center" color={theme.color.text.muted}>
          {t('welcome.subtitle')}
        </Text>
      </Hero>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }} accessibilityElementsHidden>
        {['🗣️', '🙋🏽', '🌱'].map((emoji) => (
          <View
            key={emoji}
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.surface.base,
              borderWidth: 1,
              borderColor: theme.color.border.default,
              ...theme.elevation.level1,
            }}
          >
            <RNText style={{ fontSize: 28 }}>{emoji}</RNText>
          </View>
        ))}
      </View>

      <Text variant="h2" align="center">
        {t('welcome.motto')}
      </Text>
      <Text variant="body" align="center" color={theme.color.text.muted}>
        {t('welcome.mottoBody')}
      </Text>

      <Button label={t('common.getStarted')} trailing="→" onPress={() => navigation.navigate('Language')} />
    </ScreenContainer>
  );
}
