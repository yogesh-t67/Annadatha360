import React from 'react';
import { Pressable, Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { SelectedBadge, TileGrid } from '../../components/FeatureTile';
import { SelectField } from '../../components/SelectField';
import { crops, stages } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function CropSelectionScreen() {
  const { t } = useTranslation();
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
          const selected = crop === c.key;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`crops.${c.key}`)}
              onPress={() => update({ crop: c.key })}
              style={({ pressed }) => ({
                flexBasis: '46%',
                flexGrow: 1,
                minHeight: 112,
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.xxs,
                borderRadius: theme.radius.lg,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.elevation.level1,
              })}
            >
              <RNText style={{ fontSize: 38, lineHeight: 46 }}>{c.emoji}</RNText>
              <Text variant="label" weight="bold">
                {t(`crops.${c.key}`)}
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
        trailing="→"
        onPress={() => {
          completeOnboarding();
          enterApp();
        }}
      />
    </ScreenContainer>
  );
}
