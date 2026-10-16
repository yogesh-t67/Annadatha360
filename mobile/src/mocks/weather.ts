import { Cloud, CloudRain, CloudSun, Sun } from 'lucide-react-native';

export type WeatherIcon = typeof Sun;

export interface DayForecast {
  date: Date;
  high: number;
  low: number;
  icon: WeatherIcon;
}

/** Placeholder data until the weather API lands (see docs/api). Not live. */
export const mockCurrentConditions = {
  tempC: 28,
  conditionIcon: CloudSun as WeatherIcon,
  humidityPercent: 70,
  windKph: 12,
};

const iconRotation: WeatherIcon[] = [Sun, CloudSun, Cloud, Sun, Sun, CloudRain, CloudSun];

export function getMockForecast(days = 7): DayForecast[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      date,
      high: 28 + ((index * 3) % 5),
      low: 21 + (index % 3),
      icon: iconRotation[index % iconRotation.length],
    };
  });
}
