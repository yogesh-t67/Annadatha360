import {
  Droplets,
  FlaskConical,
  Sprout,
  Tractor,
  Truck,
  Users,
  Wrench,
  Plane,
} from 'lucide-react-native';

export type FarmServiceIcon = typeof Tractor;

export interface FarmService {
  key:
    | 'tractorRental'
    | 'harvesting'
    | 'droneSpraying'
    | 'soilTesting'
    | 'customHiring'
    | 'transport'
    | 'labourSupport'
    | 'irrigationServices';
  icon: FarmServiceIcon;
  rateRupees: number;
}

/** Placeholder until the farm-services API lands (see docs/api). Not live. */
export const mockFarmServices: FarmService[] = [
  { key: 'tractorRental', icon: Tractor, rateRupees: 1200 },
  { key: 'harvesting', icon: Sprout, rateRupees: 1500 },
  { key: 'droneSpraying', icon: Plane, rateRupees: 800 },
  { key: 'soilTesting', icon: FlaskConical, rateRupees: 300 },
  { key: 'customHiring', icon: Wrench, rateRupees: 900 },
  { key: 'transport', icon: Truck, rateRupees: 700 },
  { key: 'labourSupport', icon: Users, rateRupees: 550 },
  { key: 'irrigationServices', icon: Droplets, rateRupees: 400 },
];
