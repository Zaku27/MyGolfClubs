export interface GolfClub {
  id?: number;
  name: string;
  length: number; // inches
  weight: number; // grams
  swingWeight: string; // e.g., D0, D2
  lieAngle: number; // degrees
  loftAngle: number; // degrees
  shaftType: string; // e.g., "Steel Regular", "Graphite Stiff"
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_CLUBS: Omit<GolfClub, 'id'>[] = [
  { name: 'Driver', length: 45.5, weight: 200, swingWeight: 'D2', lieAngle: 56, loftAngle: 10.5, shaftType: 'Graphite Regular', notes: '' },
  { name: '3-Wood', length: 43, weight: 190, swingWeight: 'D1', lieAngle: 57.5, loftAngle: 15, shaftType: 'Graphite Regular', notes: '' },
  { name: '5-Wood', length: 41.5, weight: 185, swingWeight: 'D0', lieAngle: 58.5, loftAngle: 18, shaftType: 'Graphite Regular', notes: '' },
  { name: 'Hybrid (4H)', length: 40.5, weight: 180, swingWeight: 'D0', lieAngle: 59, loftAngle: 20, shaftType: 'Steel Regular', notes: '' },
  { name: '3-Iron', length: 39, weight: 175, swingWeight: 'C9', lieAngle: 60, loftAngle: 20, shaftType: 'Steel Regular', notes: '' },
  { name: '4-Iron', length: 38.5, weight: 175, swingWeight: 'C9', lieAngle: 60.5, loftAngle: 22, shaftType: 'Steel Regular', notes: '' },
  { name: '5-Iron', length: 38, weight: 175, swingWeight: 'C8', lieAngle: 61, loftAngle: 24, shaftType: 'Steel Regular', notes: '' },
  { name: '6-Iron', length: 37.5, weight: 175, swingWeight: 'C8', lieAngle: 61.5, loftAngle: 27, shaftType: 'Steel Regular', notes: '' },
  { name: '7-Iron', length: 37, weight: 175, swingWeight: 'C7', lieAngle: 62, loftAngle: 31, shaftType: 'Steel Regular', notes: '' },
  { name: '8-Iron', length: 36.5, weight: 175, swingWeight: 'C7', lieAngle: 62.5, loftAngle: 35, shaftType: 'Steel Regular', notes: '' },
  { name: '9-Iron', length: 36, weight: 175, swingWeight: 'C6', lieAngle: 63, loftAngle: 39, shaftType: 'Steel Regular', notes: '' },
  { name: 'PW', length: 35.5, weight: 175, swingWeight: 'C6', lieAngle: 63.5, loftAngle: 44, shaftType: 'Steel Regular', notes: '' },
  { name: 'GW', length: 35.25, weight: 175, swingWeight: 'C5', lieAngle: 64, loftAngle: 50, shaftType: 'Steel Regular', notes: '' },
  { name: 'SW', length: 35, weight: 175, swingWeight: 'C5', lieAngle: 64.5, loftAngle: 56, shaftType: 'Steel Regular', notes: '' },
  { name: 'Putter', length: 33, weight: 350, swingWeight: 'E5', lieAngle: 70, loftAngle: 3, shaftType: 'Steel', notes: '' },
];
