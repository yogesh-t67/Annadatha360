export interface LabourWorker {
  key: 'ramesh' | 'lakshmi' | 'suresh' | 'anitha';
  rateRupees: number;
  rating: number;
  bookingsCount: number;
}

/** Placeholder until the labour-services API lands (see docs/api). Not live. */
export const mockWorkers: LabourWorker[] = [
  { key: 'ramesh', rateRupees: 550, rating: 4.8, bookingsCount: 130 },
  { key: 'lakshmi', rateRupees: 500, rating: 4.7, bookingsCount: 95 },
  { key: 'suresh', rateRupees: 600, rating: 4.9, bookingsCount: 110 },
  { key: 'anitha', rateRupees: 480, rating: 4.6, bookingsCount: 70 },
];
