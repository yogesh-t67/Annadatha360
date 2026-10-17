import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '../i18n';
import type { FarmProfile } from '../store/farmStore';
import { getDistrict, STATE_CODE } from '../data/farm';
import type { StageKey } from '../data/farm';
import { ApiError } from './client';
import { createField, updateField, updateMe } from './endpoints';
import type { GrowthStage, Language } from './types';

export const FIELD_ID_KEY = 'annadata.api.fieldId';

const STAGE: Record<StageKey, GrowthStage> = {
  sowing: 'sowing',
  growing: 'vegetative',
  flowering: 'flowering',
  harvest: 'maturity',
};

/**
 * Push the profile to the backend: farmer profile + one field.
 * Safe to call again; the field is created once and updated afterwards.
 * District HQ coordinates stand in for the farm location until the app asks for GPS (weather uses them).
 */
export async function syncProfile(profile: FarmProfile, language: string): Promise<void> {
  const d = getDistrict(profile.district);
  const [latitude, longitude] = d?.coords ?? [null, null];
  const district = i18n.getFixedT('en')(`districts.${profile.district}`);

  await updateMe({
    ...(profile.name.trim() ? { name: profile.name.trim() } : {}),
    preferred_language: (language === 'te' ? 'te' : 'en') as Language,
    primary_crop_code: profile.crop,
    location: {
      state: STATE_CODE[d?.state ?? profile.region],
      district,
      village: profile.village.trim() || null,
      latitude,
      longitude,
    },
  });

  const acreage = Number.parseFloat(profile.acres);
  if (!(acreage > 0)) return; // field needs a positive area; skip until the farmer enters one
  const field = {
    name: i18n.getFixedT('en')('farm.mainField', { defaultValue: 'Main field' }),
    crop_code: profile.crop,
    acreage: Math.round(acreage * 100) / 100,
    growth_stage: STAGE[profile.stage],
    latitude,
    longitude,
  };
  const existing = await AsyncStorage.getItem(FIELD_ID_KEY);
  if (existing) {
    try {
      await updateField(Number(existing), field);
      return;
    } catch (e) {
      // 404: saved id belongs to another account on this phone, or was deleted; create a fresh one.
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const created = await createField(field);
  await AsyncStorage.setItem(FIELD_ID_KEY, String(created.id));
}
