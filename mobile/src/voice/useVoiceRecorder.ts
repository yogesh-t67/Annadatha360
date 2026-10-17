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

export type RecorderError = 'not-allowed' | 'too-short' | 'failed';

export function useVoiceRecorder(onRecorded: (uri: string) => void, { autoStopOnSilence = false } = {}) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<RecorderError | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;
  const heardSpeech = useRef(false);
  const quietSince = useRef<number | null>(null);
  const stopping = useRef(false);

  const stop = useCallback(async () => {
    if (stopping.current) return;
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
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('not-allowed');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      heardSpeech.current = false;
      quietSince.current = null;
      recorder.record();
      setRecording(true);
    } catch {
      setError('failed');
    }
  }, [recorder]);

  // The farmer taps again to send (they decide when they're done — pauses to think don't cut them off).
  // With autoStopOnSilence, it also stops ~1.5 s after they stop talking. Hard cap at MAX_MS either way.
  const db = state.metering;
  useEffect(() => {
    if (!recording) return;
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
  }, [db, state.durationMillis, recording, stop, autoStopOnSilence]);

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
