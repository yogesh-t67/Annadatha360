import React, { useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SelectField } from '../../components/SelectField';
import { cropEmoji, crops, stages } from '../../data/farm';
import { FarmProfile, useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

type Draft = Pick<FarmProfile, 'crop' | 'acres' | 'stage'>;

export function MyFarmScreen() {
  const { t } = useTranslation();
  const { open } = useAppNavigation();
  const saved = useFarmStore();
  const [draft, setDraft] = useState<Draft>({ crop: saved.crop, acres: saved.acres, stage: saved.stage });
  const [justSaved, setJustSaved] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const s = useFarmStore.getState();
      setDraft({ crop: s.crop, acres: s.acres, stage: s.stage });
      setJustSaved(false);
    }, []),
  );

  function change(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
  }

  return (
    <ScreenContainer>
      <Text variant="h1">{t('farm.title')}</Text>

      <Card tone="brand">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.surface.base,
            }}
          >
            <RNText style={{ fontSize: 32 }}>{cropEmoji(saved.crop)}</RNText>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h1" color={theme.color.text.inverse}>
              {t(`crops.${saved.crop}`)}
            </Text>
            <Text variant="body" color={theme.color.text.inverseMuted}>
              {`📍 ${t(`districts.${saved.district}`)} · ${t('home.acresValue', { acres: saved.acres })}`}
            </Text>
          </View>
        </View>
      </Card>

      <SelectField
        label={t('farm.crop')}
        value={draft.crop}
        options={crops.map((c) => ({ value: c.key, label: t(`crops.${c.key}`), emoji: c.emoji }))}
        onChange={(v) => change({ crop: v })}
      />
      <TextField
        label={t('farm.area')}
        value={draft.acres}
        onChangeText={(v) => change({ acres: v.replace(/[^\d.]/g, '') })}
        keyboardType="decimal-pad"
      />
      <SelectField
        label={t('farm.stage')}
        value={draft.stage}
        options={stages.map((s) => ({ value: s, label: t(`stages.${s}`) }))}
        onChange={(v) => change({ stage: v })}
      />

      <Button
        label={t('farm.save')}
        emoji="✅"
        onPress={() => {
          saved.update(draft);
          setJustSaved(true);
        }}
      />
      {justSaved ? (
        <Text variant="bodyStrong" color={theme.color.status.successText} align="center" accessibilityLiveRegion="polite">
          {`✓ ${t('farm.saved')}`}
        </Text>
      ) : null}
      <Button label={t('farm.diagnosis')} variant="secondary" emoji="📷" onPress={() => open('Diagnosis')} />
    </ScreenContainer>
  );
}
