import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Camera, Check, CircleCheck, MapPin, Trash2, X } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SelectField } from '../../components/SelectField';
import { CropImage } from '../../components/CropImage';
import { FarmSwitcher } from '../../components/FarmSwitcher';
import { cropImages, crops, stages } from '../../data/farm';
import { activeFarm, FarmDetails, farmName, useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { hasSession } from '../../api/tokens';
import { deleteFarmOnServer, syncProfile } from '../../api/syncProfile';

const NEW_FARM: FarmDetails = { name: '', crop: 'paddy', acres: '', stage: 'sowing' };

/** Best effort: keep the backend profile (AI context, prices, weather) in step. Never blocks. */
function syncInBackground(language: string) {
  hasSession()
    .then((signedIn) => (signedIn ? syncProfile(useFarmStore.getState(), language) : undefined))
    .catch((e) => console.warn('Profile sync failed', e));
}

export function MyFarmScreen() {
  const { t, i18n } = useTranslation();
  const { open } = useAppNavigation();
  const store = useFarmStore();
  const current = activeFarm(store);
  const detailsOf = (f: FarmDetails): FarmDetails => ({ name: f.name, crop: f.crop, acres: f.acres, stage: f.stage });

  /** `adding`: the form is for a new farm, saved only when the farmer taps Save. */
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<FarmDetails>(detailsOf(current));
  const [justSaved, setJustSaved] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setAdding(false);
      setDraft(detailsOf(activeFarm(useFarmStore.getState())));
      setJustSaved(false);
    }, []),
  );

  function change(patch: Partial<FarmDetails>) {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
  }

  function showFarm(id: string) {
    const farm = useFarmStore.getState().farms.find((f) => f.id === id);
    if (!farm) return;
    setAdding(false);
    setDraft(detailsOf(farm));
    setJustSaved(false);
  }

  function save() {
    if (adding) {
      store.addFarm(draft);
      setAdding(false);
    } else {
      store.updateFarm(current.id, draft);
    }
    setJustSaved(true);
    syncInBackground(i18n.language);
  }

  function confirmRemove() {
    const name = farmName(store.farms, current, t);
    Alert.alert(t('farm.removeTitle', { name }), t('farm.removeBody'), [
      { text: t('farm.cancel'), style: 'cancel' },
      {
        text: t('farm.remove'),
        style: 'destructive',
        onPress: () => {
          const { serverId } = current;
          store.removeFarm(current.id);
          showFarm(useFarmStore.getState().activeFarmId);
          deleteFarmOnServer(serverId).catch((e) => console.warn('Farm delete failed', e));
        },
      },
    ]);
  }

  const shown = adding ? draft : current;
  const title = adding ? t('farm.newFarm') : farmName(store.farms, current, t);
  const canSave = Number.parseFloat(draft.acres) > 0;

  return (
    <ScreenContainer>
      <Text variant="h1">{t('farm.title')}</Text>

      <FarmSwitcher
        onSelect={showFarm}
        onAdd={() => {
          setAdding(true);
          setDraft(NEW_FARM);
          setJustSaved(false);
        }}
      />

      <Card tone="brand">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <CropImage code={shown.crop} size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" weight="bold" color={theme.color.text.inverseMuted} numberOfLines={1}>
              {title}
            </Text>
            <Text variant="h1" color={theme.color.text.inverse} numberOfLines={1}>
              {t(`crops.${shown.crop}`)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
              <MapPin size={20} color={theme.color.text.inverseMuted} strokeWidth={2.25} />
              <Text variant="body" color={theme.color.text.inverseMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {`${t(`districts.${store.district}`)} · ${t('home.acresValue', { acres: shown.acres || '0' })}`}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <TextField
        label={t('farm.name')}
        value={draft.name}
        onChangeText={(v) => change({ name: v })}
        placeholder={t('farm.namePlaceholder')}
        maxLength={40}
      />
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

      <Button label={adding ? t('farm.addThisFarm') : t('farm.save')} icon={Check} disabled={!canSave} onPress={save} />
      {justSaved ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs }}
        >
          <CircleCheck size={22} color={theme.color.status.successText} strokeWidth={2.25} />
          <Text variant="bodyStrong" color={theme.color.status.successText}>
            {t('farm.saved')}
          </Text>
        </View>
      ) : null}
      {adding ? (
        <Button label={t('farm.cancel')} variant="secondary" icon={X} onPress={() => showFarm(current.id)} />
      ) : (
        <>
          <Button label={t('farm.diagnosis')} variant="secondary" icon={Camera} onPress={() => open('Diagnosis')} />
          {store.farms.length > 1 ? (
            <Button label={t('farm.remove')} variant="soft" icon={Trash2} onPress={confirmRemove} />
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}
