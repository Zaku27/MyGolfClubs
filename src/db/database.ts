import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { GolfClub } from '../types/golf';

export class GolfBagDatabase extends Dexie {
  clubs!: Table<GolfClub>;

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
  }
}

export const db = new GolfBagDatabase();
