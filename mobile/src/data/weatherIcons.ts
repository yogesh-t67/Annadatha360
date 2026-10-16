import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Thermometer,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { WeatherCondition } from '../api/types';

export const CONDITION_ICON: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  partly_cloudy: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  heavy_rain: CloudRain,
  snow: CloudSnow,
  thunderstorm: CloudLightning,
  unknown: Thermometer,
};
