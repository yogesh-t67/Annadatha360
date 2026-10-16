import { useCallback, useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModule as SpeechModule } from 'expo-speech-recognition';

import { speechLocale } from './speech';

/**
 * Loaded optionally: the native module only exists in a development build. In Expo Go it is missing,
 * and importing 'expo-speech-recognition' directly would crash the app, so we look it up and fall back
 * to "voice input unavailable" instead.
 */
const SpeechRecognition = requireOptionalNativeModule<typeof SpeechModule>('ExpoSpeechRecognition');

export type SpeechInputError = 'unavailable' | 'not-allowed' | 'no-speech' | 'language-not-supported' | 'other';

export function useSpeechInput(language: string, onFinal: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<SpeechInputError | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (!SpeechRecognition) return;
    const subs = [
      SpeechRecognition.addListener('start', () => {
        setListening(true);
        setPartial('');
        setError(null);
      }),
      SpeechRecognition.addListener('end', () => setListening(false)),
      SpeechRecognition.addListener('result', (e) => {
        const transcript = e.results[0]?.transcript ?? '';
        setPartial(transcript);
        if (e.isFinal && transcript.trim()) onFinalRef.current(transcript.trim());
      }),
      SpeechRecognition.addListener('error', (e) => {
        setListening(false);
        if (e.error === 'aborted') return;
        setError(
          e.error === 'not-allowed'
            ? 'not-allowed'
            : e.error === 'no-speech' || e.error === 'speech-timeout'
              ? 'no-speech'
              : e.error === 'language-not-supported'
                ? 'language-not-supported'
                : 'other',
        );
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      SpeechRecognition.abort();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!SpeechRecognition || !SpeechRecognition.isRecognitionAvailable()) {
      setError('unavailable');
      return;
    }
    const permission = await SpeechRecognition.requestPermissionsAsync();
    if (!permission.granted) {
      setError('not-allowed');
      return;
    }
    SpeechRecognition.start({ lang: speechLocale(language), interimResults: true, continuous: false });
  }, [language]);

  const stop = useCallback(() => SpeechRecognition?.stop(), []);

  return { available: SpeechRecognition !== null, listening, partial, error, start, stop };
}
