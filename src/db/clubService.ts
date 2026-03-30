import { db } from './database';
import type { GolfClub } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';

const CLUB_VALUE_DEFAULTS = {
  number: '',
  torque: 0,
  flex: 'R' as GolfClub['flex'],
  distance: 0,
  swingWeight: '',
  shaftType: '',
  lieAngle: 0,
  loftAngle: 0,
  length: 0,
  weight: 0,
  notes: '',
};

const createTimestamp = (): string => new Date().toISOString();

const normalizeClubRecord = (club: GolfClub): GolfClub => ({
  ...club,
  number: club.number ?? CLUB_VALUE_DEFAULTS.number,
  torque: club.torque ?? CLUB_VALUE_DEFAULTS.torque,
  flex: club.flex ?? CLUB_VALUE_DEFAULTS.flex,
  distance: club.distance ?? CLUB_VALUE_DEFAULTS.distance,
  swingWeight: club.swingWeight ?? CLUB_VALUE_DEFAULTS.swingWeight,
  shaftType: club.shaftType ?? CLUB_VALUE_DEFAULTS.shaftType,
  lieAngle: club.lieAngle ?? CLUB_VALUE_DEFAULTS.lieAngle,
  loftAngle: club.loftAngle ?? CLUB_VALUE_DEFAULTS.loftAngle,
  length: club.length ?? CLUB_VALUE_DEFAULTS.length,
  weight: club.weight ?? CLUB_VALUE_DEFAULTS.weight,
  notes: club.notes ?? CLUB_VALUE_DEFAULTS.notes,
});

const createClubRecord = (club: Omit<GolfClub, 'id'>): GolfClub => {
  const timestamp = createTimestamp();
  return {
    ...club,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createUpdatedClubRecord = (club: Partial<GolfClub>): Partial<GolfClub> => ({
  ...club,
  updatedAt: createTimestamp(),
});

export class ClubService {
  static async getAllClubs(): Promise<GolfClub[]> {
    const clubs = await db.clubs.toArray();
    return clubs.map(normalizeClubRecord);
  }

  static async getClubById(id: number): Promise<GolfClub | undefined> {
    const club = await db.clubs.get(id);
    return club ? normalizeClubRecord(club) : undefined;
  }

  static async createClub(club: Omit<GolfClub, 'id'>): Promise<number> {
    const newClub = createClubRecord(club);
    return await db.clubs.add(newClub);
  }

  static async updateClub(id: number, club: Partial<GolfClub>): Promise<number> {
    const updatedClub = createUpdatedClubRecord(club);
    return await db.clubs.update(id, updatedClub);
  }

  static async deleteClub(id: number): Promise<void> {
    await db.clubs.delete(id);
  }

  static async deleteAllClubs(): Promise<void> {
    await db.clubs.clear();
  }

  static async initializeDefaultClubs(): Promise<void> {
    const count = await db.clubs.count();
    if (count === 0) {
      await db.clubs.bulkAdd(DEFAULT_CLUBS.map(createClubRecord));
    }
  }

  static async resetToDefaults(): Promise<void> {
    await this.deleteAllClubs();
    await this.initializeDefaultClubs();
  }
}
