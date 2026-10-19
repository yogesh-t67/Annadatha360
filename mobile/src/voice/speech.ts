import { useSyncExternalStore } from 'react';
import * as Speech from 'expo-speech';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

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

// ---- Voice phase, app-wide: 'preparing' (server voice being generated) → 'playing' → 'idle'.
// The farmer avatar uses it to think while a voice is prepared and move its mouth only while sound plays.
export type VoicePhase = 'idle' | 'preparing' | 'playing';
let phase: VoicePhase = 'idle';
const phaseListeners = new Set<() => void>();

function setPhase(value: VoicePhase) {
  if (phase === value) return;
  phase = value;
  phaseListeners.forEach((l) => l());
}

export function useVoicePhase(): VoicePhase {
  return useSyncExternalStore(
    (listener) => {
      phaseListeners.add(listener);
      return () => phaseListeners.delete(listener);
    },
    () => phase,
  );
}

export function useIsSpeaking(): boolean {
  return useVoicePhase() === 'playing';
}

// ---- Live loudness of the playing voice, for lip-sync. Server audio reports PCM samples while it plays (Android
// Visualizer; needs the mic permission). Phone TTS doesn't, so the avatar falls back to a speech-like rhythm.
let level = 0;
let peak = 0.05;
let levelAt = 0;

function onSamples(frames: number[] | undefined) {
  if (!frames || frames.length === 0) return;
  let sum = 0;
  for (let i = 0; i < frames.length; i += 4) sum += frames[i] * frames[i];
  const rms = Math.sqrt(sum / Math.ceil(frames.length / 4));
  peak = Math.max(rms, peak * 0.995, 0.02); // adapts to the voice's loudness
  level = Math.min(1, rms / peak);
  levelAt = Date.now();
}

/** 0 (silent) … 1 (loudest) for the voice playing right now, or null when no live samples are available. */
export function getMouthLevel(): number | null {
  return Date.now() - levelAt < 250 ? level : null;
}

// ---- Telugu: natural male voice from the server (phones rarely have a male Telugu voice), phone voice as backup.
let seq = 0; // each speak() call gets a number; anything older is stale and must not play
let player: AudioPlayer | null = null;
let pendingDone: (() => void) | undefined;

function releasePlayer() {
  if (player) {
    try {
      player.remove();
    } catch {
      // already released
    }
    player = null;
  }
}

function useServerVoice(language: string, voiceOverride?: string): boolean {
  if (language !== 'te' || voiceOverride) return false;
  // A phone voice picked in Settings wins; otherwise Telugu uses the server's male voice.
  return !useFarmStore.getState().voiceIds?.te;
}

function speakOnPhone(text: string, language: string, finished: () => void, voiceOverride?: string) {
  const { voice, pitch } = voiceOverride ? { voice: voiceOverride, pitch: 1 } : chosenVoice(language);
  Speech.speak(text, {
    language: speechLocale(language),
    voice,
    pitch,
    rate: 0.95,
    onStart: () => setPhase('playing'),
    onDone: finished,
    onStopped: finished,
    onError: finished,
  });
}

async function speakFromServer(text: string, mine: number, finished: () => void): Promise<boolean> {
  try {
    const { api } = await import('../api/client');
    const { API_BASE_URL } = await import('../api/config');
    const { audio_url } = await api<{ audio_url: string }>('/tts', {
      method: 'POST',
      body: { text, language: 'te' },
      timeoutMs: 45_000,
    });
    if (mine !== seq) return true; // stopped or replaced meanwhile: stay quiet
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    const origin = API_BASE_URL.replace(/\/api\/v1$/, '');
    const p = createAudioPlayer({ uri: origin + audio_url, headers: { 'ngrok-skip-browser-warning': '1' } });
    player = p;
    peak = 0.05;
    try {
      if (p.isAudioSamplingSupported) {
        p.setAudioSamplingEnabled(true);
        p.addListener('audioSampleUpdate', (sample) => {
          if (mine === seq) onSamples(sample.channels[0]?.frames);
        });
      }
    } catch {
      // no sampling (e.g. mic permission not granted yet): the avatar uses its speech rhythm instead
    }
    p.addListener('playbackStatusUpdate', (status) => {
      if (mine !== seq) return;
      if (status.playing) setPhase('playing');
      if (status.didJustFinish) {
        releasePlayer();
        finished();
      }
    });
    p.play();
    return true;
  } catch (e) {
    console.warn('Server voice unavailable, using the phone voice', e);
    return false;
  }
}

/**
 * Read text aloud in the farmer's language. English: the phone's voice. Telugu: the server's natural male voice
 * (cached, so repeats are instant), falling back to the phone voice if the server can't make it.
 */
export function speak(text: string, language: string, onDone?: () => void, voiceOverride?: string): void {
  stopSpeaking();
  const mine = ++seq;
  pendingDone = onDone;
  const finished = () => {
    if (mine !== seq) return;
    setPhase('idle');
    const done = pendingDone;
    pendingDone = undefined;
    done?.();
  };
  if (!useServerVoice(language, voiceOverride)) {
    speakOnPhone(text, language, finished, voiceOverride);
    return;
  }
  setPhase('preparing');
  speakFromServer(text, mine, finished).then((ok) => {
    if (!ok && mine === seq) speakOnPhone(text, language, finished);
  });
}

export function stopSpeaking(): void {
  seq++;
  Speech.stop();
  releasePlayer();
  setPhase('idle');
  const done = pendingDone;
  pendingDone = undefined;
  done?.();
}
