import type { ClubCategory as AnalysisClubCategory } from '../utils/analysisConstants';

export type ClubCategory = 'Driver' | 'Wood' | 'Hybrid' | 'Iron' | 'Wedge' | 'Putter';

export interface GolfClub {
  id?: number;
  clubType: ClubCategory; // Fixed categories: Driver, Wood, Hybrid, Iron, Wedge, Putter
  name: string; // Manufacturer + Model only, e.g., "Ping G430", "Titleist T150"
  number: string; // Club number / loft designation, e.g., "7", "PW", "W", "3W", "4H", "SW"
  length: number; // inches (合計長さ)
  lengthStandard?: number; // 標準長さ（インチ）
  lengthAdjustment?: number; // 調整（インチ）
  weight: number; // grams
  swingWeight: string; // e.g., D0, D2
  lieAngle: number; // degrees
  lieStandard?: number; // 標準ライ角（度）
  lieAdjustment?: number; // 調整（度）
  loftAngle: number; // degrees
  bounceAngle?: number; // degrees (Wedge only)
  shaftType: string; // e.g., "Steel", "Graphite"
  torque: number; // トルク（小数1桁）
  condition?: '先調子' | '先中調子' | '中調子' | '中元調子' | '元調子'; // 調子（省略可）
  flex?: 'X' | 'S' | 'SR' | 'R' | 'A' | 'L' | 'R2'; // フレックス（パターは不要）
  distance: number; // 飛距離（小数1桁）
  notes: string;
  imageData?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type GolfClubData = GolfClub & {
  category: AnalysisClubCategory;
};

export interface GolfBag {
  id?: number;
  name: string;
  clubIds: number[];
  imageData?: string[];
  swingWeightTarget?: number;
  swingGoodTolerance?: number;
  swingAdjustThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attachment {
  type: 'file' | 'url';
  name: string;
  value: string;
  createdAt?: string;
}

export interface AccessoryItem {
  id: string;
  name: string;
  imageData?: string;
  note?: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface ClubPersonalData {
  clubId: string;
  weaknessFactor: number;  // 0.0-1.0 (0 = no weakness, 0.3 = moderate weakness)
}

export const DEFAULT_CLUBS: Omit<GolfClub, 'id'>[] = [
  { clubType: 'Driver', name: 'Driver', number: '1', length: 45.5, weight: 310, swingWeight: 'D1', lieAngle: 58, loftAngle: 10.5, shaftType: 'Graphite', torque: 4.5, flex: 'S', distance: 230, notes: '' },
  { clubType: 'Wood', name: 'Wood', number: '3', length: 43, weight: 315, swingWeight: 'D1', lieAngle: 56, loftAngle: 15, shaftType: 'Graphite', torque: 4.0, flex: 'S', distance: 210, notes: '' },
  { clubType: 'Wood', name: 'Wood', number: '5', length: 42.5, weight: 314, swingWeight: 'D1', lieAngle: 56.5, loftAngle: 18, shaftType: 'Graphite', torque: 4.0, flex: 'S', distance: 200, notes: '' },
  { clubType: 'Wood', name: 'Wood', number: '7', length: 42.0, weight: 316, swingWeight: 'D1', lieAngle: 57.0, loftAngle: 21, shaftType: 'Graphite', torque: 4.0, flex: 'S', distance: 190, notes: '' },
  { clubType: 'Hybrid', name: 'Hybrid', number: '3', length: 40.25, weight: 340, swingWeight: 'D1', lieAngle: 58.5, loftAngle: 19, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 200, notes: '' },
  { clubType: 'Hybrid', name: 'Hybrid', number: '4', length: 39.75, weight: 345, swingWeight: 'D1', lieAngle: 59, loftAngle: 22, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 190, notes: '' },
  { clubType: 'Hybrid', name: 'Hybrid', number: '5', length: 39.25, weight: 345, swingWeight: 'D1', lieAngle: 59.5, loftAngle: 25, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 180, notes: '' },
  { clubType: 'Hybrid', name: 'Hybrid', number: '6', length: 38.75, weight: 350, swingWeight: 'D1', lieAngle: 60.0, loftAngle: 28, shaftType: 'Steel', torque: 3.5, flex: 'S', distance: 170, notes: '' },
  { clubType: 'Iron', name: 'Iron', number: '5', length: 38, weight: 412, swingWeight: 'D1', lieAngle: 62, loftAngle: 24, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 180, notes: '' },
  { clubType: 'Iron', name: 'Iron', number: '6', length: 37.5, weight: 418, swingWeight: 'D1', lieAngle: 62.5, loftAngle: 27, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 170, notes: '' },
  { clubType: 'Iron', name: 'Iron', number: '7', length: 37, weight: 424, swingWeight: 'D1', lieAngle: 63, loftAngle: 31, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 160, notes: '' },
  { clubType: 'Iron', name: 'Iron', number: '8', length: 36.5, weight: 430, swingWeight: 'D1', lieAngle: 63.5, loftAngle: 35, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 150, notes: '' },
  { clubType: 'Iron', name: 'Iron', number: '9', length: 36, weight: 436, swingWeight: 'D1', lieAngle: 64, loftAngle: 39, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 140, notes: '' },
  { clubType: 'Wedge', name: 'Wedge', number: 'PW', length: 35.5, weight: 442, swingWeight: 'D1', lieAngle: 64, loftAngle: 44, bounceAngle: 10, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 120, notes: '' },
  { clubType: 'Wedge', name: 'Wedge', number: 'GW', length: 35.25, weight: 450, swingWeight: 'D1', lieAngle: 64, loftAngle: 50, bounceAngle: 12, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 110, notes: '' },
  { clubType: 'Wedge', name: 'Utility Wedge', number: 'UW', length: 35.25, weight: 450, swingWeight: 'D1', lieAngle: 64, loftAngle: 50, bounceAngle: 12, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 110, notes: '' },
  { clubType: 'Wedge', name: 'Approach Wedge', number: 'AW', length: 35.25, weight: 450, swingWeight: 'D1', lieAngle: 64, loftAngle: 50, bounceAngle: 12, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 110, notes: '' },
  { clubType: 'Wedge', name: 'Wedge', number: 'SW', length: 35, weight: 455, swingWeight: 'D1', lieAngle: 64, loftAngle: 54, bounceAngle: 14, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 100, notes: '' },
  { clubType: 'Wedge', name: 'Wedge', number: 'LW', length: 34.75, weight: 460, swingWeight: 'D1', lieAngle: 64, loftAngle: 58, bounceAngle: 8, shaftType: 'Steel', torque: 1.9, flex: 'S', distance: 90, notes: '' },
  { clubType: 'Putter', name: 'Putter', number: 'P', length: 33, weight: 500, swingWeight: 'D1', lieAngle: 70, loftAngle: 3, shaftType: 'Steel', torque: 1.0, distance: 10, notes: '' },
];
 
// ─── ユーザープロフィール情報 ──────────────────────────────
export interface UserProfile {
  // 今後、年齢・性別・身長・体重なども追加可能
}
