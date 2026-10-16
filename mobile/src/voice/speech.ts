import * as Speech from 'expo-speech';

export function speechLocale(language: string): 'te-IN' | 'en-IN' {
  return language === 'te' ? 'te-IN' : 'en-IN';
}

/** Read text aloud in the farmer's language. Uses the phone's own text-to-speech (works in Expo Go). */
export function speak(text: string, language: string, onDone?: () => void): void {
  Speech.stop();
  Speech.speak(text, { language: speechLocale(language), rate: 0.95, onDone, onStopped: onDone, onError: onDone });
}

export function stopSpeaking(): void {
  Speech.stop();
}
