export interface GolfClub {
  id?: number;
  clubType: string; // e.g., D, 3W, 5W, 4H
  name: string;
  length: number; // inches
  weight: number; // grams
  swingWeight: string; // e.g., D0, D2
  lieAngle: number; // degrees
  loftAngle: number; // degrees
  shaftType: string; // e.g., "Steel", "Graphite"
  torque: number; // トルク（小数1桁）
  flex: 'S' | 'SR' | 'R' | 'A' | 'L'; // フレックス
  distance: number; // 飛距離（整数）
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_CLUBS: Omit<GolfClub, 'id'>[] = [
  { clubType: 'D', name: 'Driver', length: 45.5, weight: 310, swingWeight: 'D1', lieAngle: 58, loftAngle: 10.5, shaftType: 'Graphite', torque: 4.5, flex: 'S', distance: 230, notes: '' },
  { clubType: '3W', name: '3-Wood', length: 43, weight: 315, swingWeight: 'D1', lieAngle: 56, loftAngle: 15, shaftType: 'Graphite', torque: 4.0, flex: 'S', distance: 210, notes: '' },
  { clubType: '5W', name: '5-Wood', length: 42.5, weight: 314, swingWeight: 'D1', lieAngle: 56.5, loftAngle: 18, shaftType: 'Graphite', torque: 4.0, flex: 'S', distance: 200, notes: '' },
  { clubType: '4H', name: 'Hybrid (4H)', length: 39.75, weight: 345, swingWeight: 'D1', lieAngle: 59, loftAngle: 22, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 190, notes: '' },
  { clubType: '5H', name: 'Hybrid (5H)', length: 39.25, weight: 345, swingWeight: 'D1', lieAngle: 59.5, loftAngle: 25, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 180, notes: '' },
  { clubType: '6I', name: '6-Iron', length: 37.5, weight: 418, swingWeight: 'D1', lieAngle: 62.5, loftAngle: 27, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 170, notes: '' },
  { clubType: '7I', name: '7-Iron', length: 37, weight: 424, swingWeight: 'D1', lieAngle: 63, loftAngle: 31, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 160, notes: '' },
  { clubType: '8I', name: '8-Iron', length: 36.5, weight: 430, swingWeight: 'D1', lieAngle: 63.5, loftAngle: 35, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 150, notes: '' },
  { clubType: '9I', name: '9-Iron', length: 36, weight: 436, swingWeight: 'D1', lieAngle: 64, loftAngle: 39, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 140, notes: '' },
  { clubType: 'PW', name: 'PW', length: 35.5, weight: 442, swingWeight: 'D1', lieAngle: 64, loftAngle: 44, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 120, notes: '' },
  { clubType: '50', name: '50 Wedge', length: 35.25, weight: 424, swingWeight: 'D1', lieAngle: 64, loftAngle: 50, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 110, notes: '' },
  { clubType: '54', name: '54 Wedge', length: 35, weight: 424, swingWeight: 'D1', lieAngle: 64, loftAngle: 54, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 100, notes: '' },
  { clubType: '58', name: '58 Wedge', length: 34.75, weight: 424, swingWeight: 'D1', lieAngle: 64, loftAngle: 58, shaftType: 'Steel', torque: 2.5, flex: 'S', distance: 90, notes: '' },
  { clubType: 'P', name: 'Putter', length: 33, weight: 350, swingWeight: 'D1', lieAngle: 70, loftAngle: 3, shaftType: 'Steel', torque: 2.0, flex: 'S', distance: 10, notes: '' },
];
