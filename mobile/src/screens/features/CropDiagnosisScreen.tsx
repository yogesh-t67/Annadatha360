import React, { useState } from 'react';
import { Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Bug, Camera, Flower2, Leaf, Lock } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero } from '../../components/Blocks';
import { FeatureTile, TileGrid } from '../../components/FeatureTile';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const symptoms: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'yellowLeaves', icon: Leaf, tint: 'sun' },
  { key: 'brownSpots', icon: Leaf, tint: 'clay' },
  { key: 'insects', icon: Bug, tint: 'leaf' },
  { key: 'wilting', icon: Flower2, tint: 'stone' },
];

export function CropDiagnosisScreen() {
  const { t } = useTranslation();
  const { ask } = useAppNavigation();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('diagnosis.title')}</Text>

      <Hero icon={photoUri ? undefined : Camera}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            accessibilityIgnoresInvertColors
            style={{ width: '100%', height: 220, borderRadius: theme.radius.md }}
            resizeMode="cover"
          />
        ) : null}
        <Text variant="bodyStrong" align="center" color={theme.color.text.secondary}>
          {t('diagnosis.photoPrompt')}
        </Text>
        <Button
          label={photoUri ? t('diagnosis.retake') : t('diagnosis.openCamera')}
          icon={Camera}
          compact
          onPress={takePhoto}
        />
        <Text variant="caption" align="center" color={theme.color.text.muted}>
          {t('diagnosis.photoNote')}
        </Text>
      </Hero>
      {denied ? <Notice icon={Lock} message={t('diagnosis.cameraDenied')} /> : null}

      <Text variant="h2">{t('diagnosis.chooseSymptom')}</Text>
      <TileGrid>
        {symptoms.map((s) => (
          <FeatureTile
            key={s.key}
            icon={s.icon}
            tint={s.tint}
            label={t(`diagnosis.symptoms.${s.key}`)}
            onPress={() => ask(t(`diagnosis.symptoms.${s.key}`))}
          />
        ))}
      </TileGrid>

      <Notice />
    </ScreenContainer>
  );
}
