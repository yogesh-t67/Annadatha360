import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '../i18n';
import { farmName, useFarmStore } from '../store/farmStore';
import type { Farm, FarmProfile } from '../store/farmStore';
import { getDistrict, STATE_CODE } from '../data/farm';
import type { StageKey } from '../data/farm';
import { ApiError } from './client';
import { createField, deleteField, updateField, updateMe } from './endpoints';
import type { GrowthStage, Language } from './types';

/** Server field id saved by app versions with a single farm; adopted by the first farm, then cleared. */
export const FIELD_ID_KEY = 'annadata.api.fieldId';

const STAGE: Record<StageKey, GrowthStage> = {
  sowing: 'sowing',
  growing: 'vegetative',
  flowering: 'flowering',
  harvest: 'maturity',
};

/**
 * Push the profile to the backend: farmer profile + one field per farm.
 * Safe to call again; each field is created once and updated afterwards.
 * District HQ coordinates stand in for the farm location until the app asks for GPS (weather uses them).
 */
export async function syncProfile(profile: FarmProfile, language: string): Promise<void> {
  const d = getDistrict(profile.district);
  const [latitude, longitude] = d?.coords ?? [null, null];
  const en = i18n.getFixedT('en');

  await updateMe({
    ...(profile.name.trim() ? { name: profile.name.trim() } : {}),
    preferred_language: (language === 'te' ? 'te' : 'en') as Language,
    primary_crop_code: profile.crop,
    location: {
      state: STATE_CODE[d?.state ?? profile.region],
      district: en(`districts.${profile.district}`),
      village: profile.village.trim() || null,
      latitude,
      longitude,
    },
  });

  const legacyId = await AsyncStorage.getItem(FIELD_ID_KEY);
  for (const [i, farm] of profile.farms.entries()) {
    const serverId = farm.serverId ?? (i === 0 && legacyId ? Number(legacyId) : undefined);
    await syncFarm({ ...farm, serverId }, farmName(profile.farms, farm, en), latitude, longitude);
  }
  if (legacyId) await AsyncStorage.removeItem(FIELD_ID_KEY);
}

async function syncFarm(farm: Farm, name: string, latitude: number | null, longitude: number | null) {
  const acreage = Number.parseFloat(farm.acres);
  if (!(acreage > 0)) return; // field needs a positive area; skip until the farmer enters one
  const field = {
    name,
    crop_code: farm.crop,
    acreage: Math.round(acreage * 100) / 100,
    growth_stage: STAGE[farm.stage],
    latitude,
    longitude,
  };
  const { setFarmServerId } = useFarmStore.getState();
  if (farm.serverId !== undefined) {
    try {
      await updateField(farm.serverId, field);
      setFarmServerId(farm.id, farm.serverId);
      return;
    } catch (e) {
      // 404: saved id belongs to another account on this phone, or was deleted; create a fresh one.
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const created = await createField(field);
  setFarmServerId(farm.id, created.id);
}

/** Best effort: remove a deleted farm's field on the backend too. */
export async function deleteFarmOnServer(serverId: number | undefined): Promise<void> {
  if (serverId === undefined) return;
  try {
    await deleteField(serverId);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
}
