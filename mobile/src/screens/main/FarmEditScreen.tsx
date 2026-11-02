import React, { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Check, Minus, Plus, Trash2 } from 'lucide-react-native';

import { resolveFontFamily, theme } from '../../theme';
import { Button, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SelectField } from '../../components/SelectField';
import { cropImages, crops, stages } from '../../data/farm';
import type { CropKey, StageKey } from '../../data/farm';
import { farmName, useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import type { FarmStackParamList } from '../../navigation/types';
import { hasSession } from '../../api/tokens';
import { deleteFarmOnServer, syncProfile } from '../../api/syncProfile';

const ACRES_STEP = 0.5;

interface Draft {
  name: string;
  crop: CropKey | null;
  acres: string;
  stage: StageKey | null;
}

/** Best effort: keep the backend (AI context, prices, weather) in step. Never blocks. */
function syncInBackground(language: string) {
  hasSession()
    .then((signedIn) => (signedIn ? syncProfile(useFarmStore.getState(), language) : undefined))
    .catch((e) => console.warn('Profile sync failed', e));
}

/** Add a farm (no farmId) or edit one. A new farm starts empty, so it can't be mistaken for an existing one. */
export function FarmEditScreen() {
  const { t, i18n } = useTranslation();
  const { navigation } = useAppNavigation();
  const { params } = useRoute<RouteProp<FarmStackParamList, 'FarmEdit'>>();
  const farms = useFarmStore((s) => s.farms);
  const { addFarm, updateFarm, removeFarm } = useFarmStore.getState();
  const farm = params?.farmId ? farms.find((f) => f.id === params.farmId) : undefined;

  const [draft, setDraft] = useState<Draft>(
    farm
      ? { name: farm.name, crop: farm.crop, acres: farm.acres, stage: farm.stage }
      : { name: '', crop: null, acres: '', stage: null },
  );
  const change = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const acres = Number.parseFloat(draft.acres);
  const ready = draft.crop !== null && draft.stage !== null && acres > 0;

  function save() {
    if (!ready || draft.crop === null || draft.stage === null) return;
    const details = { name: draft.name.trim(), crop: draft.crop, acres: draft.acres, stage: draft.stage };
    if (farm) updateFarm(farm.id, details);
    else addFarm(details); // the new farm becomes the selected one
    syncInBackground(i18n.language);
    navigation.goBack();
  }

  function confirmRemove() {
    if (!farm) return;
    Alert.alert(t('farm.removeTitle', { name: farmName(farms, farm, t) }), t('farm.removeBody'), [
      { text: t('farm.cancel'), style: 'cancel' },
      {
        text: t('farm.remove'),
        style: 'destructive',
        onPress: () => {
          removeFarm(farm.id);
          deleteFarmOnServer(farm.serverId).catch((e) => console.warn('Farm delete failed', e));
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{farm ? t('farm.editTitle') : t('farm.addTitle')}</Text>

      <TextField
        label={t('farm.name')}
        value={draft.name}
        onChangeText={(v) => change({ name: v })}
        placeholder={farm ? farmName(farms, farm, t) : t('farm.namePlaceholder')}
        maxLength={40}
      />

      <SelectField
        label={t('farm.crop')}
        value={draft.crop}
        placeholder={t('farm.chooseCrop')}
        options={crops.map((c) => ({ value: c.code, label: t(`crops.${c.code}`), image: cropImages[c.code] }))}
        onChange={(v) => change({ crop: v })}
        searchable
        searchPlaceholder={t('farm.searchCrop')}
      />

      <AcresStepper value={draft.acres} onChange={(v) => change({ acres: v })} />

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="bodyStrong" color={theme.color.text.secondary}>
          {t('farm.stage')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }} accessibilityRole="radiogroup">
          {stages.map((s) => {
            const selected = draft.stage === s;
            return (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => change({ stage: s })}
                style={({ pressed }) => ({
                  flexBasis: '46%',
                  flexGrow: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.xxs,
                  minHeight: theme.touchTarget.button,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                  backgroundColor: selected || pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
                })}
              >
                {selected ? <Check size={theme.iconSize.inline} color={theme.color.surface.brandDeep} strokeWidth={3} /> : null}
                <Text variant="bodyStrong" color={selected ? theme.color.surface.brandDeep : undefined}>
                  {t(`stages.${s}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
        <Button label={t('farm.save')} icon={Check} disabled={!ready} onPress={save} />
        {!ready ? (
          <Text variant="body" align="center" color={theme.color.text.muted}>
            {t('farm.fillToSave')}
          </Text>
        ) : null}
      </View>

      {farm && farms.length > 1 ? (
        <Button label={t('farm.remove')} variant="secondary" icon={Trash2} onPress={confirmRemove} />
      ) : null}
    </ScreenContainer>
  );
}

/** Acres with big − / + buttons (half-acre steps); the number can also be typed. */
function AcresStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, i18n } = useTranslation();
  const n = Number.parseFloat(value) || 0;
  const step = (dir: 1 | -1) => {
    const next = Math.max(0, Math.round((n + dir * ACRES_STEP) * 100) / 100);
    onChange(next === 0 ? '' : String(next));
  };

  const square = (dir: 1 | -1) => {
    const Icon = dir === 1 ? Plus : Minus;
    const disabled = dir === -1 && n <= 0;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === 1 ? t('farm.moreAcres') : t('farm.lessAcres')}
        disabled={disabled}
        onPress={() => step(dir)}
        style={({ pressed }) => ({
          width: theme.touchTarget.field,
          height: theme.touchTarget.field,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.md,
          backgroundColor: disabled
            ? theme.color.surface.sunken
            : pressed
              ? theme.color.surface.brandMid
              : theme.color.interactive.softBg,
        })}
      >
        <Icon
          size={theme.iconSize.row}
          color={disabled ? theme.color.text.tertiary : theme.color.surface.brandDeep}
          strokeWidth={3}
        />
      </Pressable>
    );
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="bodyStrong" color={theme.color.text.secondary}>
        {t('farm.area')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {square(-1)}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            height: theme.touchTarget.field,
            borderRadius: theme.radius.md,
            borderWidth: 1.5,
            borderColor: theme.color.border.default,
            backgroundColor: theme.color.surface.base,
          }}
        >
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.color.text.tertiary}
            accessibilityLabel={t('farm.area')}
            style={{
              minWidth: 48,
              paddingVertical: 0,
              textAlign: 'right',
              color: theme.color.text.primary,
              fontFamily: resolveFontFamily(i18n.language, 'bold'),
              fontSize: theme.typography.h2.fontSize,
            }}
          />
          <Text variant="label" color={theme.color.text.muted}>
            {t('farm.acresUnit')}
          </Text>
        </View>
        {square(1)}
      </View>
    </View>
  );
}
