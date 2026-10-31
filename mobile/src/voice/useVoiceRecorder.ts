import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

/**
 * Records the farmer's spoken question for the AI to hear directly (no on-device speech-to-text).
 *
 * - Mono AAC in M4A at speech quality: small uploads on rural networks, and Gemini understands it as-is.
 * - Live input level (0–1) so the UI can show the app is hearing them.
 * - Stops when the farmer taps again (optionally also on silence), and after 60 s at most.
 */
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

const SPEECH_DB = -38; // louder than this = talking
const SILENCE_DB = -45; // quieter than this = pause
const SILENCE_MS = 1500;
const MAX_MS = 60_000;
const MIN_MS = 700; // shorter taps are mistakes, not questions

/**
 * Speaking makes the level jump well above the room's background; silence stays flat. Android boosts quiet
 * input, so a silent room can read as loud as soft speech: compare against the background, not a fixed level.
 */
const SPEECH_JUMP_DB = 12;

export function soundsSilent(levels: number[]): boolean {
  const heard = levels.slice(3); // skip the mic warming up
  if (heard.length < 5) return false; // too few levels to judge: let the AI listen
  const sorted = [...heard].sort((a, b) => a - b);
  const background = sorted[Math.floor(sorted.length * 0.2)];
  const loudest = sorted[sorted.length - 1];
  return loudest < SILENCE_DB || loudest - background < SPEECH_JUMP_DB;
}

export type RecorderError = 'not-allowed' | 'too-short' | 'no-speech' | 'failed';

export function useVoiceRecorder(onRecorded: (uri: string) => void, { autoStopOnSilence = false } = {}) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<RecorderError | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;
  const heardSpeech = useRef(false);
  /** Mic levels (dB) of this recording, about 10 a second; empty if the phone doesn't report levels. */
  const levels = useRef<number[]>([]);
  const quietSince = useRef<number | null>(null);
  const stopping = useRef(false);
  /** Between the tap and the mic actually running (permission, audio mode, prepare: up to ~2 s on slow phones). */
  const starting = useRef(false);

  const stop = useCallback(async () => {
    if (stopping.current || starting.current) return;
    stopping.current = true;
    try {
      const duration = recorder.currentTime * 1000;
      await recorder.stop();
      setRecording(false);
      // Back to playback mode so the spoken answer comes out of the loudspeaker, not the earpiece.
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      if (duration < MIN_MS) {
        setError('too-short');
        return;
      }
      // Nothing was said: don't upload it and wait ~10 s for the AI to say so.
      if (soundsSilent(levels.current)) {
        setError('no-speech');
        return;
      }
      if (recorder.uri) onRecordedRef.current(recorder.uri);
      else setError('failed');
    } catch {
      setRecording(false);
      setError('failed');
    } finally {
      stopping.current = false;
    }
  }, [recorder]);

  const start = useCallback(async () => {
    if (starting.current || stopping.current || recorder.isRecording) return; // a second tap while starting
    starting.current = true;
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('not-allowed');
        return;
      }
      // Show "listening" (red ring) straight away; the mic is ready a moment later.
      setRecording(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      heardSpeech.current = false;
      levels.current = [];
      quietSince.current = null;
      recorder.record();
    } catch {
      setRecording(false);
      setError('failed');
    } finally {
      starting.current = false;
    }
  }, [recorder]);

  // The farmer taps again to send (they decide when they're done — pauses to think don't cut them off).
  // With autoStopOnSilence, it also stops ~1.5 s after they stop talking. Hard cap at MAX_MS either way.
  const db = state.metering;
  useEffect(() => {
    if (!recording) return;
    if (db !== undefined && state.isRecording && !starting.current) {
      if (db > -100 && levels.current.length < 1000) levels.current.push(db);
    }
    if (state.durationMillis >= MAX_MS) {
      stop();
      return;
    }
    if (!autoStopOnSilence || db === undefined) return;
    if (db > SPEECH_DB) heardSpeech.current = true;
    if (!heardSpeech.current) return;
    if (db < SILENCE_DB) {
      quietSince.current ??= Date.now();
      if (Date.now() - quietSince.current >= SILENCE_MS) stop();
    } else {
      quietSince.current = null;
    }
  }, [db, state.durationMillis, state.isRecording, recording, stop, autoStopOnSilence]);

  // Leaving the screen mid-recording: discard it.
  useEffect(
    () => () => {
      if (recorder.isRecording) recorder.stop().catch(() => undefined);
    },
    [recorder],
  );

  // dB (≈ -60 quiet … 0 loud) → 0–1 for the level animation.
  const level = recording && db !== undefined ? Math.min(1, Math.max(0, (db + 60) / 50)) : 0;

  return { recording, level, seconds: Math.floor(state.durationMillis / 1000), error, start, stop };
}
