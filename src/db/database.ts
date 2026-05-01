import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { GolfBag, GolfClub, ClubPersonalData } from '../types/golf';
import type { ClubUsageStat, HoleScore } from '../types/game';
import type { KeyRoundStats } from '../utils/roundAnalysis';

interface AppSettings {
  id: 'app';
  playerSkillLevel: number;
  activeBagId?: number;
}

export interface RoundHistory {
  id?: number;
  completedAt: string;
  courseName: string;
  courseHoleCount: number;
  playMode: 'bag' | 'robot' | 'measured';
  bagId?: number;
  totalScore: number;
  totalPar: number;
  perHoleResults: HoleScore[];
  clubUsageStats: ClubUsageStat[];
  keyStats: Pick<KeyRoundStats, 'totalStrokes' | 'girPercent' | 'fairwayHitPercent' | 'puttsPerHole'>;
  isFavorite: boolean;
  roundSeedNonce: string;
}

export class GolfBagDatabase extends Dexie {
  clubs!: Table<GolfClub>;
  golfBags!: Table<GolfBag>;
  personalData!: Table<ClubPersonalData>;
  actualShotRows!: Table<{ bagId: number; rows: Array<Record<string, string>> }>;
  appSettings!: Table<AppSettings>;
  roundHistory!: Table<RoundHistory>;

  constructor() {
    super('golfbag-db');
    this.version(1).stores({
      clubs: '++id, name',
    });
    // v2: add torque, flex, distance columns with defaults for existing rows
    this.version(2).stores({
      clubs: '++id, name',
    }).upgrade(async (tx) => {
      await tx.table('clubs').toCollection().modify((club) => {
        if (club.torque == null)      club.torque      = 0;
        if (club.flex == null)        club.flex        = 'R';
        if (club.distance == null)    club.distance    = 0;
        if (club.swingWeight == null) club.swingWeight = '';
        if (club.shaftType == null)   club.shaftType   = '';
        if (club.lieAngle == null)    club.lieAngle    = 0;
        if (club.loftAngle == null)   club.loftAngle   = 0;
        if (club.length == null)      club.length      = 0;
        if (club.weight == null)      club.weight      = 0;
        if (club.notes == null)       club.notes       = '';
      });
    });
    // v3: add personalData table for storing player club personal factors
    this.version(3).stores({
      clubs: '++id, name',
      personalData: 'clubId',
    });
    // v4: add appSettings table for storing global app settings like playerSkillLevel
    this.version(4).stores({
      clubs: '++id, name',
      personalData: 'clubId',
      appSettings: 'id',
    });
    this.version(5).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      appSettings: 'id',
    });
    // v6: normalize bounceAngle to wedge-only field
    this.version(6).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
    }).upgrade(async (tx) => {
      await tx.table('clubs').toCollection().modify((club) => {
        if (club.clubType !== 'Wedge') {
          club.bounceAngle = undefined;
          return;
        }

        const numeric = typeof club.bounceAngle === 'number' ? club.bounceAngle : Number(club.bounceAngle);
        if (!Number.isFinite(numeric)) {
          club.bounceAngle = undefined;
          return;
        }

        club.bounceAngle = Math.max(0, Math.min(20, Math.round(numeric * 10) / 10));
      });
    });
    this.version(7).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
    });
    // v8: add condition field for shaft condition
    this.version(8).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
    }).upgrade(async (tx) => {
      await tx.table('clubs').toCollection().modify(() => {
        // condition field is optional, so no default value needed
        // existing clubs will have undefined condition
      });
    });
    // v9: migrate swing weight from D-base (D0=0) to A-base (A0=0) by adding 30
    this.version(9).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
    }).upgrade(async (tx) => {
      // Migrate club swingWeight strings
      const oldSwingWeightToNumeric = (swingWeightRaw: string): number => {
        const normalized = (swingWeightRaw ?? '').trim().toUpperCase().replace(/\s+/g, '');
        const fullMatch = normalized.match(/^([A-F])([0-9](?:\.[0-9])?)$/);
        const legacyMatch = normalized.match(/^([0-9](?:\.[0-9])?)$/);
        if (!fullMatch && !legacyMatch) return 0;
        const letter = fullMatch ? fullMatch[1] : 'D';
        const point = Number(fullMatch ? fullMatch[2] : legacyMatch?.[1]);
        if (!Number.isFinite(point) || point < 0 || point > 9.9) return 0;
        const letterIndex = letter.charCodeAt(0) - 'D'.charCodeAt(0);
        return letterIndex * 10 + point;
      };

      const newNumericToSwingWeightLabel = (value: number): string => {
        const rounded = Math.round(value * 10) / 10;
        const letterIndex = Math.floor(rounded / 10);
        const point = rounded - letterIndex * 10;
        const letterCode = 'A'.charCodeAt(0) + letterIndex;
        if (letterCode < 'A'.charCodeAt(0) || letterCode > 'Z'.charCodeAt(0)) {
          return rounded.toFixed(1);
        }
        const pointLabel = Number.isInteger(point) ? point.toFixed(0) : point.toFixed(1);
        return `${String.fromCharCode(letterCode)}${pointLabel}`;
      };

      await tx.table('clubs').toCollection().modify((club) => {
        if (club.swingWeight && club.swingWeight.trim()) {
          const oldNumeric = oldSwingWeightToNumeric(club.swingWeight);
          if (oldNumeric !== 0) {
            const newNumeric = oldNumeric + 30;
            club.swingWeight = newNumericToSwingWeightLabel(newNumeric);
          }
        }
      });

      // Migrate bag swingWeightTarget numbers
      await tx.table('golfBags').toCollection().modify((bag) => {
        if (bag.swingWeightTarget != null && typeof bag.swingWeightTarget === 'number') {
          bag.swingWeightTarget = bag.swingWeightTarget + 30;
        }
      });
    });
    // v10: add roundHistory table for storing round statistics
    this.version(10).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
      roundHistory: '++id, completedAt, playMode, isFavorite, bagId',
    });

    // v11: add per-bag playerSkillLevel
    this.version(11).stores({
      clubs: '++id, name',
      golfBags: '++id, name, createdAt',
      personalData: 'clubId',
      actualShotRows: 'bagId',
      appSettings: 'id',
      roundHistory: '++id, completedAt, playMode, isFavorite, bagId',
    }).upgrade(async (tx) => {
      // Migrate global playerSkillLevel to bags
      const settings = await tx.table('appSettings').get('app');
      const globalSkillLevel = settings?.playerSkillLevel ?? 0.5;

      await tx.table('golfBags').toCollection().modify((bag) => {
        if (bag.playerSkillLevel == null) {
          bag.playerSkillLevel = globalSkillLevel;
        }
      });
    });
  }
}

export const db = new GolfBagDatabase();
