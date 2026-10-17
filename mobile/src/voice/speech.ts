import { useSyncExternalStore } from 'react';
import * as Speech from 'expo-speech';

import { useFarmStore } from '../store/farmStore';

export function speechLocale(language: string): 'te-IN' | 'en-IN' {
  return language === 'te' ? 'te-IN' : 'en-IN';
}

/**
 * Android doesn't say which voices are male, but Google's on-device voice ids follow a pattern
 * ("te-in-x-tem-local" = Telugu male). These are the male ids we know; anything named "male" counts too.
 */
const MALE_ID = new RegExp(
  [
    '-x-(tem|ene|end|iom|iol|cxm|mal)\\b', // Google on-device / network ids (te-in-x-tem-local, en-in-x-end-network…)
    '(Standard|Wavenet|Neural2|Chirp)-[BCD]\\b', // Google cloud-style names: B/C/D are the male Indian voices
    '(^|[^e])male', // engines that put "male" in the name (but not "female")
  ].join('|'),
  'i',
);
/** No male voice on the phone: the default voice at this pitch sounds clearly deeper. */
const FALLBACK_MALE_PITCH = 0.78;

export interface AppVoice {
  identifier: string;
  label: string;
  male: boolean;
}

let cache: Speech.Voice[] | null = null;
async function allVoices(): Promise<Speech.Voice[]> {
  if (!cache) {
    try {
      cache = await Speech.getAvailableVoicesAsync();
    } catch {
      cache = [];
    }
  }
  return cache;
}
allVoices(); // warm up so the first answer already uses the chosen voice

/** Voices for the language, likely-male first, on-device before network. */
export async function voicesFor(language: string): Promise<AppVoice[]> {
  const locale = speechLocale(language).toLowerCase();
  const list = (await allVoices()).filter((v) => v.language.replace('_', '-').toLowerCase() === locale);
  const isMale = (v: Speech.Voice) => MALE_ID.test(v.identifier) || MALE_ID.test(v.name);
  const local = (v: Speech.Voice) => !/network/i.test(v.identifier);
  return list
    .sort((a, b) => Number(isMale(b)) - Number(isMale(a)) || Number(local(b)) - Number(local(a)))
    .map((v) => ({ identifier: v.identifier, label: v.name, male: isMale(v) }));
}

function chosenVoice(language: string): { voice?: string; pitch: number } {
  const lang = language === 'te' ? 'te' : 'en';
  const saved = useFarmStore.getState().voiceIds?.[lang];
  const locale = speechLocale(language).toLowerCase();
  const available = (cache ?? []).filter((v) => v.language.replace('_', '-').toLowerCase() === locale);
  if (saved && available.some((v) => v.identifier === saved)) {
    return { voice: saved, pitch: 1 };
  }
  // Default: a male voice if the phone has one; otherwise the default voice a little deeper.
  const male = available.find((v) => MALE_ID.test(v.identifier) || MALE_ID.test(v.name));
  return male ? { voice: male.identifier, pitch: 1 } : { pitch: FALLBACK_MALE_PITCH };
}

// ---- "Is the app speaking right now?" — one app-wide signal, so the farmer avatar can animate its mouth for
// any read-aloud (answers, welcome, diagnosis, schemes) without each screen wiring it up.
let speakingNow = false;
const speakingListeners = new Set<() => void>();

function setSpeakingNow(value: boolean) {
  if (speakingNow === value) return;
  speakingNow = value;
  speakingListeners.forEach((l) => l());
}

export function useIsSpeaking(): boolean {
  return useSyncExternalStore(
    (listener) => {
      speakingListeners.add(listener);
      return () => speakingListeners.delete(listener);
    },
    () => speakingNow,
  );
}

/** Read text aloud in the farmer's language. Uses the phone's own text-to-speech (works in Expo Go). */
export function speak(text: string, language: string, onDone?: () => void, voiceOverride?: string): void {
  Speech.stop();
  const { voice, pitch } = voiceOverride ? { voice: voiceOverride, pitch: 1 } : chosenVoice(language);
  const finished = () => {
    setSpeakingNow(false);
    onDone?.();
  };
  Speech.speak(text, {
    language: speechLocale(language),
    voice,
    pitch,
    rate: 0.95,
    onStart: () => setSpeakingNow(true),
    onDone: finished,
    onStopped: finished,
    onError: finished,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
  setSpeakingNow(false);
}
