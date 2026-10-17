import AsyncStorage from '@react-native-async-storage/async-storage';

import { LANGUAGE_STORAGE_KEY } from '../i18n';
import { useFarmStore } from '../store/farmStore';
import { stopSpeaking } from '../voice/speech';
import { logout } from './endpoints';
import { FIELD_ID_KEY } from './syncProfile';

/**
 * Log out and forget everything this phone saved, so the app starts again from the Welcome screen.
 * The server session is revoked (best effort — works offline too). A verified farmer's data stays on the
 * server under their phone number; a guest account is simply left behind.
 */
export async function signOut(): Promise<void> {
  stopSpeaking();
  await logout(); // revokes the refresh token on the server, then clears tokens on the phone
  await AsyncStorage.multiRemove([FIELD_ID_KEY, LANGUAGE_STORAGE_KEY]);
  useFarmStore.getState().reset();
}
