import React from 'react';
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mic, Sprout, UsersRound } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero } from '../../components/Blocks';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const highlights = [Mic, UsersRound, Sprout];

export function WelcomeScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();

  return (
    <ScreenContainer>
      <Hero>
        <Image
          source={require('../../../assets/logo.jpg')}
          accessibilityIgnoresInvertColors
          accessibilityLabel="Annadata 360"
          style={{ width: 168, height: 168, borderRadius: 36, marginBottom: theme.spacing.xs }}
        />
        <Text variant="display" align="center">
          {t('welcome.title')}
        </Text>
        <Text variant="body" align="center" color={theme.color.text.muted}>
          {t('welcome.subtitle')}
        </Text>
      </Hero>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }} accessibilityElementsHidden>
        {highlights.map((Icon, i) => (
          <View
            key={i}
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
            <Icon size={26} color={theme.color.surface.brandDeep} strokeWidth={2} />
          </View>
        ))}
      </View>

      <Text variant="h2" align="center">
        {t('welcome.motto')}
      </Text>
      <Text variant="body" align="center" color={theme.color.text.muted}>
        {t('welcome.mottoBody')}
      </Text>

      <Button label={t('common.getStarted')} trailingIcon={ArrowRight} onPress={() => navigation.navigate('Language')} />
    </ScreenContainer>
  );
}
