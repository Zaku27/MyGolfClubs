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
  }
}

export const db = new GolfBagDatabase();
