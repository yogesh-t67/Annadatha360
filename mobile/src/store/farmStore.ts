import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getDistrict, LEGACY_DISTRICT } from '../data/districts';
import type { CropKey, DistrictKey, RegionKey, StageKey } from '../data/farm';

/** One piece of land the farmer grows on. Saved on the backend as a "field" (docs/api/fields.md). */
export interface Farm {
  /** Local id, stable on this phone. */
  id: string;
  /** Farmer's own name for it ("Near the canal"); empty → shown as "Farm 1", "Farm 2", … */
  name: string;
  crop: CropKey;
  acres: string;
  stage: StageKey;
  /** Backend field id once synced. */
  serverId?: number;
}

export type FarmDetails = Pick<Farm, 'name' | 'crop' | 'acres' | 'stage'>;

export interface FarmProfile {
  name: string;
  /** Name in Telugu script, typed or corrected by the farmer; empty → auto-transliterated from `name`. */
  nameTe: string;
  phone: string;
  region: RegionKey;
  district: DistrictKey;
  village: string;
  /**
   * The ACTIVE farm's crop, acres and stage. Kept in step with `farms` by the actions below, so every screen
   * that reads `crop`/`acres`/`stage` automatically follows the farm the farmer has selected.
   */
  crop: CropKey;
  acres: string;
  stage: StageKey;
  /** All the farmer's farms (at least one) and which one the screens are about. */
  farms: Farm[];
  activeFarmId: string;
}

interface FarmState extends FarmProfile {
  onboarded: boolean;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  /** Profile fields; a crop/acres/stage change goes to the active farm. */
  update: (patch: Partial<Omit<FarmProfile, 'farms' | 'activeFarmId'>>) => void;
  addFarm: (details: FarmDetails) => string;
  updateFarm: (id: string, patch: Partial<FarmDetails>) => void;
  /** No-op for the last farm: a farmer always has one. */
  removeFarm: (id: string) => void;
  selectFarm: (id: string) => void;
  setFarmServerId: (id: string, serverId: number | undefined) => void;
  completeOnboarding: () => void;
  setVoiceEnabled: (on: boolean) => void;
  setNotificationsEnabled: (on: boolean) => void;
  /** Text-to-speech voice picked in Settings, per language (phone voice identifier). */
  voiceIds: Partial<Record<'te' | 'en', string>>;
  setVoiceId: (language: 'te' | 'en', identifier: string) => void;
  /** Back to a fresh install (logout). */
  reset: () => void;
}

const FIRST_FARM_ID = 'farm-1';

const newFarmId = () => `farm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Top-level crop/acres/stage mirror of the given farm. */
const mirror = (farm: Farm) => ({ crop: farm.crop, acres: farm.acres, stage: farm.stage, activeFarmId: farm.id });

const INITIAL_FARM: Farm = { id: FIRST_FARM_ID, name: '', crop: 'paddy', acres: '2', stage: 'growing' };

const INITIAL: FarmProfile & Pick<FarmState, 'onboarded' | 'voiceEnabled' | 'notificationsEnabled'> = {
  name: '',
  nameTe: '',
  phone: '',
  region: 'ap',
  district: 'guntur',
  village: '',
  ...mirror(INITIAL_FARM),
  farms: [INITIAL_FARM],
  onboarded: false,
  voiceEnabled: true,
  notificationsEnabled: true,
};

/** The farmer's name for a farm, else "Farm 2" etc. by its position. */
export function farmName(farms: Farm[], farm: Farm, t: (key: string, options?: Record<string, unknown>) => string): string {
  return farm.name.trim() || t('farm.defaultName', { n: farms.findIndex((f) => f.id === farm.id) + 1 });
}

/** The farm the screens are about. */
export function activeFarm(s: Pick<FarmProfile, 'farms' | 'activeFarmId'>): Farm {
  return s.farms.find((f) => f.id === s.activeFarmId) ?? s.farms[0];
}

export const useFarmStore = create<FarmState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      voiceIds: {},
      setVoiceId: (language, identifier) => set((s) => ({ voiceIds: { ...s.voiceIds, [language]: identifier } })),
      reset: () => set({ ...INITIAL, voiceIds: {} }),
      update: (patch) =>
        set((s) => {
          const { crop, acres, stage } = patch;
          if (crop === undefined && acres === undefined && stage === undefined) return patch;
          const farmPatch = Object.fromEntries(
            Object.entries({ crop, acres, stage }).filter(([, v]) => v !== undefined),
          ) as Partial<FarmDetails>;
          return { ...patch, farms: s.farms.map((f) => (f.id === s.activeFarmId ? { ...f, ...farmPatch } : f)) };
        }),
      addFarm: (details) => {
        const farm: Farm = { id: newFarmId(), ...details };
        set((s) => ({ farms: [...s.farms, farm], ...mirror(farm) }));
        return farm.id;
      },
      updateFarm: (id, patch) =>
        set((s) => {
          const farms = s.farms.map((f) => (f.id === id ? { ...f, ...patch } : f));
          return id === s.activeFarmId ? { farms, ...mirror(activeFarm({ farms, activeFarmId: id })) } : { farms };
        }),
      removeFarm: (id) =>
        set((s) => {
          if (s.farms.length <= 1) return {};
          const farms = s.farms.filter((f) => f.id !== id);
          return id === s.activeFarmId ? { farms, ...mirror(farms[0]) } : { farms };
        }),
      selectFarm: (id) => {
        const farm = get().farms.find((f) => f.id === id);
        if (farm) set(mirror(farm));
      },
      setFarmServerId: (id, serverId) =>
        set((s) => ({ farms: s.farms.map((f) => (f.id === id ? { ...f, serverId } : f)) })),
      completeOnboarding: () => set({ onboarded: true }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'annadata.farm',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      // v0 → v1: district list expanded to all AP/TS districts; map retired keys and keep state consistent.
      // v1 → v2: male voice is the default in both languages; forget voices picked while testing.
      // v2 → v3: one farm → a list of farms; the existing crop/acres/stage become the first farm.
      migrate: (persisted, version) => {
        const s = persisted as Partial<FarmState>;
        if (version < 2) s.voiceIds = {};
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
        if (version < 3 || !s.farms?.length) {
          const first: Farm = {
            ...INITIAL_FARM,
            ...(s.crop ? { crop: s.crop } : {}),
            ...(s.acres !== undefined ? { acres: s.acres } : {}),
            ...(s.stage ? { stage: s.stage } : {}),
          };
          s.farms = [first];
          Object.assign(s, mirror(first));
        }
        return s as FarmState;
      },
    },
  ),
);
