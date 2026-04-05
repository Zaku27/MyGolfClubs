import { db } from './database';
import type { GolfBag, GolfClub, ClubPersonalData } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';
import { sortClubsForDisplay } from '../utils/clubSort';

const MAX_BAG_CLUBS = 14;

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

const normalizeBounceAngle = (
  clubType: GolfClub['clubType'],
  bounceAngle: unknown,
): number | undefined => {
  if (clubType !== 'Wedge') {
    return undefined;
  }

  const numeric = typeof bounceAngle === 'number' ? bounceAngle : Number(bounceAngle);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return Math.max(0, Math.min(20, Math.round(numeric * 10) / 10));
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
  bounceAngle: normalizeBounceAngle(club.clubType, club.bounceAngle),
});

const createClubRecord = (club: Omit<GolfClub, 'id'>): GolfClub => {
  const timestamp = createTimestamp();
  return {
    ...club,
    bounceAngle: normalizeBounceAngle(club.clubType, club.bounceAngle),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createUpdatedClubRecord = (club: Partial<GolfClub>): Partial<GolfClub> => ({
  ...club,
  updatedAt: createTimestamp(),
});

const normalizeBagName = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'メインバッグ';
};

const normalizeBagClubIds = (clubIds: number[]): number[] => {
  return [...new Set(clubIds.filter((clubId) => Number.isInteger(clubId) && clubId > 0))];
};

const validateBagClubIds = (clubIds: number[]): number[] => {
  const normalized = normalizeBagClubIds(clubIds);
  if (normalized.length > MAX_BAG_CLUBS) {
    throw new Error(`ゴルフバッグに入れられるクラブは${MAX_BAG_CLUBS}本までです`);
  }
  return normalized;
};

const normalizeBagRecord = (bag: GolfBag): GolfBag => ({
  ...bag,
  name: normalizeBagName(bag.name),
  clubIds: normalizeBagClubIds(bag.clubIds ?? []),
});

const createBagRecord = (name: string, clubIds: number[]): GolfBag => {
  const timestamp = createTimestamp();
  return {
    name: normalizeBagName(name),
    clubIds: validateBagClubIds(clubIds),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createUpdatedBagRecord = (patch: Partial<Pick<GolfBag, 'name' | 'clubIds'>>): Partial<GolfBag> => ({
  ...(patch.name != null ? { name: normalizeBagName(patch.name) } : {}),
  ...(patch.clubIds != null ? { clubIds: validateBagClubIds(patch.clubIds) } : {}),
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
    const currentClub = await db.clubs.get(id);
    const effectiveClubType = club.clubType ?? currentClub?.clubType;
    const effectiveBounceAngle = club.bounceAngle ?? currentClub?.bounceAngle;
    const updatedClub = createUpdatedClubRecord({
      ...club,
      ...(effectiveClubType
        ? { bounceAngle: normalizeBounceAngle(effectiveClubType, effectiveBounceAngle) }
        : {}),
    });
    return await db.clubs.update(id, updatedClub);
  }

  static async deleteClub(id: number): Promise<void> {
    await db.clubs.delete(id);
    const bags = await db.golfBags.toArray();
    await Promise.all(
      bags
        .filter((bag) => (bag.clubIds ?? []).includes(id))
        .map((bag) => db.golfBags.update(bag.id!, createUpdatedBagRecord({
          clubIds: (bag.clubIds ?? []).filter((clubId) => clubId !== id),
        }))),
    );
  }

  static async deleteAllClubs(): Promise<void> {
    await db.clubs.clear();
    const bags = await db.golfBags.toArray();
    await Promise.all(
      bags.map((bag) => db.golfBags.update(bag.id!, createUpdatedBagRecord({ clubIds: [] }))),
    );
  }

  static async initializeDefaultClubs(): Promise<void> {
    const count = await db.clubs.count();
    if (count === 0) {
      await db.clubs.bulkAdd(DEFAULT_CLUBS.map(createClubRecord));
    }
    await this.ensureDefaultBag();
  }

  static async resetToDefaults(): Promise<void> {
    await this.deleteAllClubs();
    await db.clubs.bulkAdd(DEFAULT_CLUBS.map(createClubRecord));
    const clubs = await this.getAllClubs();
    const defaultClubIds = sortClubsForDisplay(clubs)
      .slice(0, MAX_BAG_CLUBS)
      .map((club) => club.id)
      .filter((clubId): clubId is number => typeof clubId === 'number');
    const bags = await db.golfBags.toArray();

    if (bags.length === 0) {
      const bagId = await db.golfBags.add(createBagRecord('メインバッグ', defaultClubIds));
      await this.setActiveBagId(bagId);
      return;
    }

    const [firstBag, ...restBags] = bags;
    await db.golfBags.update(firstBag.id!, createUpdatedBagRecord({
      name: firstBag.name || 'メインバッグ',
      clubIds: defaultClubIds,
    }));
    await Promise.all(
      restBags.map((bag) => db.golfBags.update(bag.id!, createUpdatedBagRecord({ clubIds: [] }))),
    );
    await this.setActiveBagId(firstBag.id!);
  }

  static async ensureDefaultBag(): Promise<void> {
    const bags = await db.golfBags.toArray();
    if (bags.length === 0) {
      const clubs = sortClubsForDisplay(await this.getAllClubs());
      const defaultClubIds = clubs
        .slice(0, MAX_BAG_CLUBS)
        .map((club) => club.id)
        .filter((clubId): clubId is number => typeof clubId === 'number');
      const bagId = await db.golfBags.add(createBagRecord('メインバッグ', defaultClubIds));
      await this.setActiveBagId(bagId);
      return;
    }

    const activeBagId = await this.getActiveBagId();
    if (activeBagId == null || !(await db.golfBags.get(activeBagId))) {
      const firstBagId = bags[0].id;
      if (typeof firstBagId === 'number') {
        await this.setActiveBagId(firstBagId);
      }
    }
  }

  static async getAllBags(): Promise<GolfBag[]> {
    const bags = await db.golfBags.toArray();
    return bags
      .map(normalizeBagRecord)
      .sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));
  }

  static async createBag(name: string, clubIds: number[] = []): Promise<number> {
    return db.golfBags.add(createBagRecord(name, clubIds));
  }

  static async updateBag(
    id: number,
    patch: Partial<Pick<GolfBag, 'name' | 'clubIds'>>,
  ): Promise<number> {
    return db.golfBags.update(id, createUpdatedBagRecord(patch));
  }

  static async deleteBag(id: number): Promise<void> {
    const bagCount = await db.golfBags.count();
    if (bagCount <= 1) {
      throw new Error('少なくとも1つのゴルフバッグが必要です');
    }

    await db.golfBags.delete(id);
    const activeBagId = await this.getActiveBagId();
    if (activeBagId === id) {
      const nextBag = await db.golfBags.orderBy('createdAt').first();
      await this.setActiveBagId(nextBag?.id ?? null);
    }
  }

  static async getActiveBagId(): Promise<number | null> {
    const settings = await db.appSettings.get('app');
    return typeof settings?.activeBagId === 'number' ? settings.activeBagId : null;
  }

  static async setActiveBagId(activeBagId: number | null): Promise<void> {
    const settings = await db.appSettings.get('app');
    await db.appSettings.put({
      id: 'app',
      playerSkillLevel: settings?.playerSkillLevel ?? 0.5,
      activeBagId: activeBagId ?? undefined,
    });
  }

  static async addClubToBag(bagId: number, clubId: number): Promise<void> {
    const bag = await db.golfBags.get(bagId);
    if (!bag) {
      throw new Error('対象のゴルフバッグが見つかりません');
    }

    const clubIds = normalizeBagClubIds(bag.clubIds ?? []);
    if (clubIds.includes(clubId)) {
      return;
    }
    if (clubIds.length >= MAX_BAG_CLUBS) {
      throw new Error(`ゴルフバッグに入れられるクラブは${MAX_BAG_CLUBS}本までです`);
    }

    await db.golfBags.update(bagId, createUpdatedBagRecord({ clubIds: [...clubIds, clubId] }));
  }

  static async removeClubFromBag(bagId: number, clubId: number): Promise<void> {
    const bag = await db.golfBags.get(bagId);
    if (!bag) {
      throw new Error('対象のゴルフバッグが見つかりません');
    }

    await db.golfBags.update(bagId, createUpdatedBagRecord({
      clubIds: (bag.clubIds ?? []).filter((entry) => entry !== clubId),
    }));
  }

  static async setBagClubIds(bagId: number, clubIds: number[]): Promise<void> {
    const bag = await db.golfBags.get(bagId);
    if (!bag) {
      throw new Error('対象のゴルフバッグが見つかりません');
    }

    await db.golfBags.update(bagId, createUpdatedBagRecord({ clubIds }));
  }

  // ─── Personal Data (Weakness Factor) ──────────────────────────────────────────

  static async getAllPersonalData(): Promise<Record<string, ClubPersonalData>> {
    const records = await db.personalData.toArray();
    const map: Record<string, ClubPersonalData> = {};
    for (const record of records) {
      map[record.clubId] = record;
    }
    return map;
  }

  static async setPersonalData(data: ClubPersonalData): Promise<void> {
    await db.personalData.put(data);
  }

  static async deletePersonalData(clubId: string): Promise<void> {
    await db.personalData.delete(clubId);
  }

  static async clearAllPersonalData(): Promise<void> {
    await db.personalData.clear();
  }

  // ─── App Settings ─────────────────────────────────────────────────────────────

  static async getPlayerSkillLevel(): Promise<number> {
    const settings = await db.appSettings.get('app');
    return settings?.playerSkillLevel ?? 0.5;
  }

  static async setPlayerSkillLevel(level: number): Promise<void> {
    const settings = await db.appSettings.get('app');
    await db.appSettings.put({
      id: 'app',
      playerSkillLevel: Math.max(0, Math.min(1, Math.round(level * 100) / 100)),
      activeBagId: settings?.activeBagId,
    });
  }
}
