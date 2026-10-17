import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Camera, Check, CircleCheck, MapPin } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SelectField } from '../../components/SelectField';
import { CropImage } from '../../components/CropImage';
import { cropImages, crops, stages } from '../../data/farm';
import { FarmProfile, useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { hasSession } from '../../api/tokens';
import { syncProfile } from '../../api/syncProfile';

type Draft = Pick<FarmProfile, 'crop' | 'acres' | 'stage'>;

export function MyFarmScreen() {
  const { t, i18n } = useTranslation();
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
          <CropImage code={saved.crop} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h1" color={theme.color.text.inverse}>
              {t(`crops.${saved.crop}`)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color={theme.color.text.inverseMuted} strokeWidth={2.25} />
              <Text variant="body" color={theme.color.text.inverseMuted}>
                {`${t(`districts.${saved.district}`)} · ${t('home.acresValue', { acres: saved.acres })}`}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <SelectField
        label={t('farm.crop')}
        value={draft.crop}
        options={crops.map((c) => ({ value: c.code, label: t(`crops.${c.code}`), image: cropImages[c.code] }))}
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
        icon={Check}
        onPress={() => {
          saved.update(draft);
          setJustSaved(true);
          // Best effort: keep the backend profile (AI context, prices, weather) in step. Never blocks.
          hasSession()
            .then((signedIn) => (signedIn ? syncProfile(useFarmStore.getState(), i18n.language) : undefined))
            .catch((e) => console.warn('Profile sync failed', e));
        }}
      />
      {justSaved ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <CircleCheck size={18} color={theme.color.status.successText} strokeWidth={2.25} />
          <Text variant="bodyStrong" color={theme.color.status.successText}>
            {t('farm.saved')}
          </Text>
        </View>
      ) : null}
      <Button label={t('farm.diagnosis')} variant="secondary" icon={Camera} onPress={() => open('Diagnosis')} />
    </ScreenContainer>
  );
}
