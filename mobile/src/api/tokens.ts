import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'annadata.accessToken';
const REFRESH_KEY = 'annadata.refreshToken';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

let cachedAccess: string | null | undefined;

export async function getAccessToken(): Promise<string | null> {
  if (cachedAccess === undefined) cachedAccess = await SecureStore.getItemAsync(ACCESS_KEY);
  return cachedAccess;
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveTokens({ access_token, refresh_token }: TokenPair): Promise<void> {
  cachedAccess = access_token;
  await SecureStore.setItemAsync(ACCESS_KEY, access_token);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
}

export async function clearTokens(): Promise<void> {
  cachedAccess = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

let guestAttempt: Promise<boolean> | null = null;
let guestUnavailableUntil = 0;

/**
 * Closed-beta servers (GUEST_LOGIN_ENABLED) hand out guest accounts, so testers use every feature without
 * phone verification. Concurrent callers share one request; if the server says no (or is unreachable),
 * we don't ask again for a minute and the screens show "Verify phone" as before.
 */
function tryGuestLogin(): Promise<boolean> {
  if (Date.now() < guestUnavailableUntil) return Promise.resolve(false);
  guestAttempt ??= (async () => {
    try {
      const [{ guestLogin }, { default: i18n }] = await Promise.all([import('./endpoints'), import('i18next')]);
      await guestLogin(i18n.language === 'en' ? 'en' : 'te');
      // Tell the new account the farm details already entered on this phone (crop, district, language).
      const [{ useFarmStore }, { syncProfile }] = await Promise.all([import('../store/farmStore'), import('./syncProfile')]);
      const farm = useFarmStore.getState();
      if (farm.onboarded) syncProfile(farm, i18n.language).catch((e) => console.warn('Profile sync failed', e));
      return true;
    } catch {
      guestUnavailableUntil = Date.now() + 60_000;
      return false;
    }
  })().finally(() => {
    guestAttempt = null;
  });
  return guestAttempt;
}

/** True when the app can call signed-in endpoints, logging in as a guest first if the server allows it. */
export async function hasSession(): Promise<boolean> {
  if ((await getRefreshToken()) !== null) return true;
  return tryGuestLogin();
}
