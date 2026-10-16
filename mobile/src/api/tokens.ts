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

export async function hasSession(): Promise<boolean> {
  return (await getRefreshToken()) !== null;
}
