import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme';
import { Button, Stack, Text } from '../../components/primitives';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface.brand }}>
      <Stack style={{ flex: 1, padding: theme.spacing.xl }} justify="space-between">
        <View />
        <Stack align="center" gap="lg">
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: theme.radius.full,
              backgroundColor: theme.color.surface.base,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sprout size={44} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
          </View>
          <Stack align="center" gap="xxs">
            <Text variant="display" weight="bold" color={theme.color.text.inverse} align="center">
              {t('onboarding.brand')}
            </Text>
            <Text variant="h2" color={theme.color.text.inverse} align="center">
              {t('onboarding.tagline')}
            </Text>
          </Stack>
          <Text
            variant="body"
            color={theme.color.text.inverse}
            align="center"
            style={{ opacity: 0.85, maxWidth: 280 }}
          >
            {t('onboarding.subtitle')}
          </Text>
        </Stack>
        <Button label={t('common.getStarted')} variant="inverse" onPress={() => navigation.navigate('LanguageSelect')} />
      </Stack>
    </SafeAreaView>
  );
}
