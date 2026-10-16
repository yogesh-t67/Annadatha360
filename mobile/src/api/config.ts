/**
 * Backend base URL, from EXPO_PUBLIC_API_BASE_URL (set it in mobile/.env, which is git-ignored).
 *   Android emulator → http://10.0.2.2:<port>/api/v1   (10.0.2.2 is the host computer)
 *   Real phone       → http://<computer's LAN IP>:<port>/api/v1
 */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1').replace(/\/+$/, '');

export const DEFAULT_TIMEOUT_MS = 20_000;
/** Chat and photo diagnosis can take 5–40 s (docs/api/assistant.md). */
export const AI_TIMEOUT_MS = 120_000;
