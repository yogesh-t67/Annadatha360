import React from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { SelectedBadge, TileGrid } from '../../components/FeatureTile';
import { IconChip } from '../../components/IconChip';
import { SelectField } from '../../components/SelectField';
import { cropIcon, crops, stages } from '../../data/farm';
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
                minHeight: 104,
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.xs,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.xs,
                borderRadius: theme.radius.lg,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.elevation.level1,
              })}
            >
              <IconChip icon={cropIcon(c.code)} tint={selected ? 'leaf' : 'stone'} size={44} />
              <Text variant="bodyStrong" weight="bold" align="center" numberOfLines={2}>
                {t(`crops.${c.code}`)}
              </Text>
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
