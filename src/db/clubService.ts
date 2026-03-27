import { db } from './database';
import type { GolfClub } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';

export class ClubService {
  static async getAllClubs(): Promise<GolfClub[]> {
     const clubs = await db.clubs.toArray();
     return clubs.map((c) => ({
      ...c,
      torque:      c.torque      ?? 0,
      flex:        c.flex        ?? 'R',
      distance:    c.distance    ?? 0,
      swingWeight: c.swingWeight ?? '',
      shaftType:   c.shaftType   ?? '',
      lieAngle:    c.lieAngle    ?? 0,
      loftAngle:   c.loftAngle   ?? 0,
      length:      c.length      ?? 0,
      weight:      c.weight      ?? 0,
      notes:       c.notes       ?? '',
     }));
  }

  static async getClubById(id: number): Promise<GolfClub | undefined> {
    return await db.clubs.get(id);
  }

  static async createClub(club: Omit<GolfClub, 'id'>): Promise<number> {
    const newClub: GolfClub = {
      ...club,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await db.clubs.add(newClub);
  }

  static async updateClub(id: number, club: Partial<GolfClub>): Promise<number> {
    const updatedClub: Partial<GolfClub> = {
      ...club,
      updatedAt: new Date().toISOString(),
    };
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
      for (const club of DEFAULT_CLUBS) {
        await this.createClub(club);
      }
    }
  }

  static async resetToDefaults(): Promise<void> {
    await this.deleteAllClubs();
    await this.initializeDefaultClubs();
  }
}
