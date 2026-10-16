import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { SelectedBadge, TileGrid } from '../../components/FeatureTile';
import { SelectField } from '../../components/SelectField';
import { cropImages, crops, stages } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { hasSession } from '../../api/tokens';
import { syncProfile } from '../../api/syncProfile';

export function CropSelectionScreen() {
  const { t, i18n } = useTranslation();
  const { enterApp } = useAppNavigation();
  const crop = useFarmStore((s) => s.crop);
  const acres = useFarmStore((s) => s.acres);
  const stage = useFarmStore((s) => s.stage);
  const update = useFarmStore((s) => s.update);
  const completeOnboarding = useFarmStore((s) => s.completeOnboarding);

  return (
    <ScreenContainer showBack>
      <StepProgress step={3} />
      <ScreenTitle>{t('cropSelection.title')}</ScreenTitle>

      <TileGrid>
        {crops.map((c) => {
          const selected = crop === c.code;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`crops.${c.code}`)}
              onPress={() => update({ crop: c.code })}
              style={({ pressed }) => ({
                flexBasis: '30%',
                flexGrow: 1,
                maxWidth: '32%',
                overflow: 'hidden',
                borderRadius: theme.radius.lg,
                borderWidth: selected ? 2.5 : 1,
                borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.elevation.level1,
              })}
            >
              <Image
                source={cropImages[c.code]}
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.color.surface.sunken }}
              />
              <View style={{ paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xs, minHeight: 44, justifyContent: 'center' }}>
                <Text variant="caption" weight="bold" align="center" numberOfLines={2}>
                  {t(`crops.${c.code}`)}
                </Text>
              </View>
              {selected ? <SelectedBadge /> : null}
            </Pressable>
          );
        })}
      </TileGrid>

      <TextField
        label={t('cropSelection.area')}
        value={acres}
        onChangeText={(v) => update({ acres: v.replace(/[^\d.]/g, '') })}
        keyboardType="decimal-pad"
      />
      <SelectField
        label={t('cropSelection.stage')}
        value={stage}
        options={stages.map((s) => ({ value: s, label: t(`stages.${s}`) }))}
        onChange={(v) => update({ stage: v })}
      />
      <Button
        label={t('common.finish')}
        trailingIcon={ArrowRight}
        onPress={() => {
          completeOnboarding();
          enterApp();
          // Best effort: send the profile to the backend if the phone was verified. Never blocks the app.
          hasSession()
            .then((signedIn) => (signedIn ? syncProfile(useFarmStore.getState(), i18n.language) : undefined))
            .catch((e) => console.warn('Profile sync failed', e));
        }}
      />
    </ScreenContainer>
  );
}
