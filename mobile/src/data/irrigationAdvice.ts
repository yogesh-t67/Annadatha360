/**
 * Irrigation advice from the live forecast + what the farmer sees in the soil + crop and stage.
 * Simple, explainable rules (no AI): each result says what to do and why, as i18n keys with params.
 * Thresholds are general agronomy rules of thumb for AP/TS, not crop-model outputs.
 */
import type { DayForecast } from '../api/types';
import type { CropKey, StageKey } from './farm';

export type SoilState = 'dry' | 'moist' | 'wet' | 'unknown';
export type Verdict = 'water' | 'light' | 'wait' | 'skip' | 'check';

export interface Reason {
  key: string;
  params?: Record<string, string | number>;
}

export interface IrrigationAdvice {
  verdict: Verdict;
  reasons: Reason[];
  /** First forecast day with useful rain, if any in the next 2 days. */
  rainDay: DayForecast | null;
}

/** Rain that's worth waiting for: ≥ 5 mm with ≥ 60 % chance. */
const USEFUL_RAIN_MM = 5;
const USEFUL_RAIN_PROB = 60;
const HOT_C = 38;

export function usefulRain(d: DayForecast): boolean {
  return (d.precipitation_mm ?? 0) >= USEFUL_RAIN_MM && (d.precipitation_probability ?? 0) >= USEFUL_RAIN_PROB;
}

export function irrigationAdvice(
  soil: SoilState,
  crop: CropKey,
  stage: StageKey,
  days: DayForecast[] | null,
): IrrigationAdvice {
  const reasons: Reason[] = [];
  const next2 = (days ?? []).slice(0, 2);
  const rainDay = next2.find(usefulRain) ?? null;
  const hot = (days?.[0]?.temp_max_c ?? 0) >= HOT_C;
  const sensitive = stage === 'flowering'; // yield is lost fastest if water runs short at flowering
  const paddy = crop === 'paddy';

  // Soil decides first: a waterlogged field never needs more water.
  if (soil === 'wet') {
    reasons.push({ key: 'irrigation.why.wet' });
    if (rainDay) reasons.push({ key: 'irrigation.why.rainComing', params: { mm: Math.round(rainDay.precipitation_mm ?? 0) } });
    return { verdict: 'skip', reasons, rainDay };
  }

  if (stage === 'harvest') {
    reasons.push({ key: paddy ? 'irrigation.why.harvestPaddy' : 'irrigation.why.harvest' });
    return { verdict: soil === 'dry' && !paddy ? 'light' : 'skip', reasons, rainDay };
  }

  if (soil === 'unknown') {
    reasons.push({ key: 'irrigation.why.fingerTest' });
    if (rainDay) reasons.push({ key: 'irrigation.why.rainComing', params: { mm: Math.round(rainDay.precipitation_mm ?? 0) } });
    return { verdict: 'check', reasons, rainDay };
  }

  if (rainDay) {
    reasons.push({ key: 'irrigation.why.rainComing', params: { mm: Math.round(rainDay.precipitation_mm ?? 0) } });
    if (soil === 'dry' && (sensitive || hot)) {
      reasons.push({ key: sensitive ? 'irrigation.why.flowering' : 'irrigation.why.hot', params: { temp: Math.round(days?.[0]?.temp_max_c ?? 0) } });
      return { verdict: 'light', reasons, rainDay };
    }
    return { verdict: 'wait', reasons, rainDay };
  }

  if (soil === 'dry') {
    reasons.push({ key: paddy ? 'irrigation.why.dryPaddy' : 'irrigation.why.dry' });
    if (sensitive) reasons.push({ key: 'irrigation.why.flowering' });
    if (hot) reasons.push({ key: 'irrigation.why.hot', params: { temp: Math.round(days?.[0]?.temp_max_c ?? 0) } });
    if (days) reasons.push({ key: 'irrigation.why.noRain' });
    return { verdict: 'water', reasons, rainDay };
  }

  // moist
  if (paddy) {
    reasons.push({ key: 'irrigation.why.moistPaddy' });
    return { verdict: 'light', reasons, rainDay };
  }
  reasons.push({ key: hot ? 'irrigation.why.moistHot' : 'irrigation.why.moist', params: { temp: Math.round(days?.[0]?.temp_max_c ?? 0) } });
  return { verdict: 'skip', reasons, rainDay };
}
