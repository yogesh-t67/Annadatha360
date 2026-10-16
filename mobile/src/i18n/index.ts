import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import te from './locales/te.json';

export const LANGUAGE_STORAGE_KEY = 'annadata.language';

export type LanguageCode = 'te' | 'en';

export const supportedLanguages: LanguageCode[] = ['te', 'en'];

export async function getStoredLanguage(): Promise<LanguageCode | null> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return supportedLanguages.includes(stored as LanguageCode) ? (stored as LanguageCode) : null;
}

export async function setStoredLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

const deviceLanguageTag = Localization.getLocales()[0]?.languageCode ?? 'te';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
  },
  lng: deviceLanguageTag === 'en' ? 'en' : 'te',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
