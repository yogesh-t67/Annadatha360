/**
 * Every district of Andhra Pradesh (29) and Telangana (33).
 *
 * - Display names live in i18n under `districts.<key>` (en + te).
 * - `mandi` is the spelling Agmarknet / data.gov.in uses; the backend matches market prices on it
 *   (case-insensitive). Set only where it differs from the English name.
 * - `coords` is the district headquarters, used for weather until the app asks for GPS.
 */
export interface District {
  key: string;
  state: 'ap' | 'ts';
  coords: [number, number];
  mandi?: string;
}

export const districtList = [
  // ---- Andhra Pradesh ----
  { key: 'alluri_sitharama_raju', state: 'ap', coords: [18.08, 82.67] },
  { key: 'anakapalli', state: 'ap', coords: [17.69, 83.0], mandi: 'Anakapally' },
  { key: 'ananthapuramu', state: 'ap', coords: [14.68, 77.6] },
  { key: 'annamayya', state: 'ap', coords: [14.06, 78.75] },
  { key: 'bapatla', state: 'ap', coords: [15.9, 80.47] },
  { key: 'chittoor', state: 'ap', coords: [13.22, 79.1], mandi: 'Chittor' },
  { key: 'konaseema', state: 'ap', coords: [16.58, 82.01], mandi: 'Dr.B.R.A.Konaseema' },
  { key: 'east_godavari', state: 'ap', coords: [17.0, 81.8] },
  { key: 'eluru', state: 'ap', coords: [16.71, 81.1] },
  { key: 'guntur', state: 'ap', coords: [16.31, 80.44] },
  { key: 'kakinada', state: 'ap', coords: [16.99, 82.25] },
  { key: 'krishna', state: 'ap', coords: [16.19, 81.14] },
  { key: 'kurnool', state: 'ap', coords: [15.83, 78.04] },
  { key: 'madanapalle', state: 'ap', coords: [13.55, 78.5] },
  { key: 'markapuram', state: 'ap', coords: [15.74, 79.27] },
  { key: 'nandyal', state: 'ap', coords: [15.48, 78.48] },
  { key: 'ntr', state: 'ap', coords: [16.51, 80.65] },
  { key: 'palnadu', state: 'ap', coords: [16.24, 80.05] },
  { key: 'parvathipuram_manyam', state: 'ap', coords: [18.78, 83.43] },
  { key: 'polavaram', state: 'ap', coords: [17.44, 81.78] },
  { key: 'prakasam', state: 'ap', coords: [15.5, 80.05] },
  { key: 'nellore', state: 'ap', coords: [14.44, 79.99], mandi: 'SPSR Nellore' },
  { key: 'sri_sathya_sai', state: 'ap', coords: [14.17, 77.81] },
  { key: 'srikakulam', state: 'ap', coords: [18.3, 83.9] },
  { key: 'tirupati', state: 'ap', coords: [13.63, 79.42], mandi: 'Tirupathi' },
  { key: 'visakhapatnam', state: 'ap', coords: [17.69, 83.22] },
  { key: 'vizianagaram', state: 'ap', coords: [18.11, 83.4], mandi: 'Vijayanagaram' },
  { key: 'west_godavari', state: 'ap', coords: [16.54, 81.52] },
  { key: 'ysr_kadapa', state: 'ap', coords: [14.47, 78.82] },

  // ---- Telangana ----
  { key: 'adilabad', state: 'ts', coords: [19.67, 78.53] },
  { key: 'bhadradri_kothagudem', state: 'ts', coords: [17.55, 80.62] },
  { key: 'hanumakonda', state: 'ts', coords: [18.01, 79.56] },
  { key: 'hyderabad', state: 'ts', coords: [17.39, 78.49] },
  { key: 'jagtial', state: 'ts', coords: [18.79, 78.91] },
  { key: 'jangaon', state: 'ts', coords: [17.72, 79.15] },
  { key: 'jayashankar_bhupalpally', state: 'ts', coords: [18.43, 79.86] },
  { key: 'jogulamba_gadwal', state: 'ts', coords: [16.23, 77.8] },
  { key: 'kamareddy', state: 'ts', coords: [18.32, 78.34] },
  { key: 'karimnagar', state: 'ts', coords: [18.44, 79.13] },
  { key: 'khammam', state: 'ts', coords: [17.25, 80.15] },
  { key: 'kumuram_bheem_asifabad', state: 'ts', coords: [19.36, 79.28] },
  { key: 'mahabubabad', state: 'ts', coords: [17.6, 80.0] },
  { key: 'mahabubnagar', state: 'ts', coords: [16.74, 78.0], mandi: 'Mahbubnagar' },
  { key: 'mancherial', state: 'ts', coords: [18.87, 79.44] },
  { key: 'medak', state: 'ts', coords: [18.05, 78.26] },
  { key: 'medchal_malkajgiri', state: 'ts', coords: [17.63, 78.48], mandi: 'Medchal Malkajgiri' },
  { key: 'mulugu', state: 'ts', coords: [18.19, 79.94] },
  { key: 'nagarkurnool', state: 'ts', coords: [16.48, 78.31] },
  { key: 'nalgonda', state: 'ts', coords: [17.05, 79.27] },
  { key: 'narayanpet', state: 'ts', coords: [16.74, 77.5] },
  { key: 'nirmal', state: 'ts', coords: [19.1, 78.34] },
  { key: 'nizamabad', state: 'ts', coords: [18.67, 78.09] },
  { key: 'peddapalli', state: 'ts', coords: [18.61, 79.37] },
  { key: 'rajanna_sircilla', state: 'ts', coords: [18.39, 78.81], mandi: 'Rajanna Siricilla' },
  { key: 'ranga_reddy', state: 'ts', coords: [17.25, 78.4] },
  { key: 'sangareddy', state: 'ts', coords: [17.62, 78.08] },
  { key: 'siddipet', state: 'ts', coords: [18.1, 78.85] },
  { key: 'suryapet', state: 'ts', coords: [17.14, 79.62] },
  { key: 'vikarabad', state: 'ts', coords: [17.34, 77.9] },
  { key: 'wanaparthy', state: 'ts', coords: [16.36, 78.06] },
  { key: 'warangal', state: 'ts', coords: [17.97, 79.59] },
  { key: 'yadadri_bhuvanagiri', state: 'ts', coords: [17.51, 78.89] },
] as const satisfies readonly District[];

export type DistrictKey = (typeof districtList)[number]['key'];

const byKey = new Map<string, District>(districtList.map((d) => [d.key, d]));

export function getDistrict(key: string): District | undefined {
  return byKey.get(key);
}

export function districtsOf(state: 'ap' | 'ts'): District[] {
  return districtList.filter((d) => d.state === state);
}

/** Old keys from earlier app versions → current key (persisted profiles keep working). */
export const LEGACY_DISTRICT: Record<string, DistrictKey> = { vijayawada: 'ntr' };
