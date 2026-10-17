import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getDistrict, LEGACY_DISTRICT } from '../data/districts';
import type { CropKey, DistrictKey, RegionKey, StageKey } from '../data/farm';

export interface FarmProfile {
  name: string;
  /** Name in Telugu script, typed or corrected by the farmer; empty → auto-transliterated from `name`. */
  nameTe: string;
  phone: string;
  region: RegionKey;
  district: DistrictKey;
  village: string;
  crop: CropKey;
  acres: string;
  stage: StageKey;
}

interface FarmState extends FarmProfile {
  onboarded: boolean;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  update: (patch: Partial<FarmProfile>) => void;
  completeOnboarding: () => void;
  setVoiceEnabled: (on: boolean) => void;
  setNotificationsEnabled: (on: boolean) => void;
}

export const useFarmStore = create<FarmState>()(
  persist(
    (set) => ({
      name: '',
      nameTe: '',
      phone: '',
      region: 'ap',
      district: 'guntur',
      village: '',
      crop: 'paddy',
      acres: '2',
      stage: 'growing',
      onboarded: false,
      voiceEnabled: true,
      notificationsEnabled: true,
      update: (patch) => set(patch),
      completeOnboarding: () => set({ onboarded: true }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'annadata.farm',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // v0 → v1: district list expanded to all AP/TS districts; map retired keys and keep state consistent.
      migrate: (persisted, version) => {
        const s = persisted as Partial<FarmProfile>;
        if (version < 1 && s.district) {
          const key = (LEGACY_DISTRICT[s.district] ?? s.district) as DistrictKey;
          const d = getDistrict(key);
          if (d) {
            s.district = key;
            s.region = d.state;
          } else {
            s.district = 'guntur';
            s.region = 'ap';
          }
        }
        return s as FarmState;
      },
    },
  ),
);
