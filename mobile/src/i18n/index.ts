import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import te from './locales/te.json';

export const LANGUAGE_STORAGE_KEY = 'annadata.language';

export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'mr' | 'gu';

/**
 * hi/ta/kn/mr/gu are shown as options on the language-select screen to match
 * the agreed IA, but have no translated resources yet: selecting one falls
 * back to English strings via i18next's fallbackLng. Needs native-speaker
 * translation before any of these five ship as a real locale.
 */
export const supportedLanguages: { code: LanguageCode; translated: boolean }[] = [
  { code: 'en', translated: true },
  { code: 'te', translated: true },
  { code: 'hi', translated: false },
  { code: 'ta', translated: false },
  { code: 'kn', translated: false },
  { code: 'mr', translated: false },
  { code: 'gu', translated: false },
];

export async function getStoredLanguage(): Promise<LanguageCode | null> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored as LanguageCode | null;
}

export async function setStoredLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

const deviceLanguageTag = Localization.getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
  },
  lng: deviceLanguageTag === 'te' ? 'te' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
