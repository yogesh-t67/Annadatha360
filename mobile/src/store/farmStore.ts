import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CropKey, DistrictKey, RegionKey, StageKey } from '../data/farm';

export interface FarmProfile {
  name: string;
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
    },
  ),
);
