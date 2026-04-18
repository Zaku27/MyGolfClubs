import { create } from 'zustand';
import type { ClubPersonalData, GolfBag, GolfClub } from '../types/golf';
import { ClubService } from '../db/clubService';
import { sortClubsForDisplay } from '../utils/clubSort';

type ClubStoreState = {
  clubs: GolfClub[];
  bags: GolfBag[];
  activeBagId: number | null;
  loading: boolean;
  error: string | null;
  personalData: Record<string, ClubPersonalData>;
  actualShotRows: Record<string, Array<Record<string, string>>>;
  playerSkillLevel: number;
};

type ClubStoreActions = {
  loadClubs: () => Promise<void>;
  loadBags: () => Promise<void>;
  addClub: (club: Omit<GolfClub, 'id'>) => Promise<void>;
  updateClub: (id: number, club: Partial<GolfClub>) => Promise<void>;
  deleteClub: (id: number) => Promise<void>;
  initializeDefaults: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearAllClubs: () => Promise<void>;
  clearAllBags: () => Promise<void>;
  createBag: (name: string, imageData?: string[]) => Promise<void>;
  renameBag: (id: number, name: string, imageData?: string[]) => Promise<void>;
  updateBagImage: (id: number, imageData: string[]) => Promise<void>;
  updateBagSwingSettings: (id: number, settings: { swingWeightTarget?: number; swingGoodTolerance?: number; swingAdjustThreshold?: number }) => Promise<void>;
  updateBagClubIds: (id: number, clubIds: number[]) => Promise<void>;
  deleteBag: (id: number) => Promise<void>;
  setActiveBag: (id: number) => Promise<void>;
  moveBagLeft: (id: number) => Promise<void>;
  moveBagRight: (id: number) => Promise<void>;
  toggleClubInActiveBag: (clubId: number) => Promise<void>;
  replaceActiveBagClubIds: (clubIds: number[]) => Promise<void>;
  loadPersonalData: () => Promise<void>;
  setPersonalData: (data: ClubPersonalData) => Promise<void>;
  removePersonalData: (clubId: string) => Promise<void>;
  loadPlayerSkillLevel: () => Promise<void>;
  setPlayerSkillLevel: (level: number) => Promise<void>;
  loadActualShotRows: () => Promise<void>;
  setActualShotRows: (rows: Array<Record<string, string>>, bagId: number | null) => Promise<void>;
};

type ClubStore = ClubStoreState & ClubStoreActions;

const INITIAL_STATE: ClubStoreState = {
  clubs: [],
  bags: [],
  activeBagId: null,
  loading: false,
  error: null,
  personalData: {},
  actualShotRows: {},
  playerSkillLevel: 0.5,
};

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

const clampSkillLevel = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
};

const createTimestamp = (): string => new Date().toISOString();

const setStoreError = (
  set: (partial: Partial<ClubStore>) => void,
  error: unknown,
): void => {
  set({ error: toErrorMessage(error), loading: false });
};

const refreshClubs = async (
  set: (partial: Partial<ClubStore>) => void,
): Promise<void> => {
  const clubs = await ClubService.getAllClubs();
  set({ clubs, loading: false, error: null });
};

const refreshBags = async (
  set: (partial: Partial<ClubStore>) => void,
): Promise<void> => {
  await ClubService.ensureDefaultBag();
  const [bags, activeBagId] = await Promise.all([
    ClubService.getAllBags(),
    ClubService.getActiveBagId(),
  ]);
  set({
    bags,
    activeBagId: activeBagId ?? bags[0]?.id ?? null,
    loading: false,
    error: null,
  });
};

export const useClubStore = create<ClubStore>((set) => ({
  ...INITIAL_STATE,

  loadClubs: async () => {
    set({ loading: true, error: null });
    try {
      await refreshClubs(set);
    } catch (error) {
      setStoreError(set, error);
    }
  },

  loadBags: async () => {
    set({ loading: true, error: null });
    try {
      await refreshBags(set);
    } catch (error) {
      setStoreError(set, error);
    }
  },

  addClub: async (club) => {
    set({ error: null });
    try {
      const id = await ClubService.createClub(club);
      const timestamp = createTimestamp();
      const newClub: GolfClub = {
        ...club,
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      // Refresh bags to include the newly added club
      const bags = await ClubService.getAllBags();

      set((state) => ({
        clubs: [newClub, ...state.clubs],
        bags,
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  updateClub: async (id, club) => {
    set({ error: null });
    try {
      await ClubService.updateClub(id, club);
      const updatedAt = createTimestamp();
      set((state) => ({
        clubs: state.clubs.map((c) =>
          c.id === id ? { ...c, ...club, updatedAt } : c
        ),
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  deleteClub: async (id) => {
    set({ error: null });
    try {
      await ClubService.deleteClub(id);
      set((state) => ({
        clubs: state.clubs.filter((c) => c.id !== id),
        bags: state.bags.map((bag) => ({
          ...bag,
          clubIds: bag.clubIds.filter((clubId) => clubId !== id),
        })),
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  clearAllClubs: async () => {
    set({ error: null });
    try {
      await ClubService.deleteAllClubs();
      set((state) => ({
        clubs: [],
        bags: state.bags.map((bag) => ({ ...bag, clubIds: [] })),
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  clearAllBags: async () => {
    set({ error: null });
    try {
      await ClubService.deleteAllBags();
      set({ bags: [], activeBagId: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  initializeDefaults: async () => {
    set({ loading: true, error: null });
    try {
      await ClubService.initializeDefaultClubs();
      const [clubs, bags, activeBagId] = await Promise.all([
        ClubService.getAllClubs(),
        ClubService.getAllBags(),
        ClubService.getActiveBagId(),
      ]);
      set({
        clubs,
        bags,
        activeBagId: activeBagId ?? bags[0]?.id ?? null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  resetToDefaults: async () => {
    set({ loading: true, error: null });
    try {
      await ClubService.resetToDefaults();
      const [clubs, bags, activeBagId] = await Promise.all([
        ClubService.getAllClubs(),
        ClubService.getAllBags(),
        ClubService.getActiveBagId(),
      ]);
      set({
        clubs,
        bags,
        activeBagId: activeBagId ?? bags[0]?.id ?? null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  createBag: async (name, imageData) => {
    set({ error: null });
    try {
      const bagId = await ClubService.createBag(name);
      if (imageData) {
        await ClubService.updateBag(bagId, { imageData });
      }
      const bags = await ClubService.getAllBags();
      await ClubService.setActiveBagId(bagId);
      set({ bags, activeBagId: bagId, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  renameBag: async (id, name, imageData) => {
    set({ error: null });
    try {
      await ClubService.updateBag(id, { name });
      if (imageData) {
        await ClubService.updateBag(id, { imageData });
      }
      const bags = await ClubService.getAllBags();
      set({ bags, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  updateBagImage: async (id, imageData) => {
    set({ error: null });
    try {
      await ClubService.updateBag(id, { imageData });
      const bags = await ClubService.getAllBags();
      set({ bags, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  updateBagSwingSettings: async (id, settings) => {
    set({ error: null });
    try {
      await ClubService.updateBag(id, settings);
      const bags = await ClubService.getAllBags();
      const updatedBag = bags.find(bag => bag.id === id);
      if (updatedBag) {
        set(state => ({
          bags: state.bags.map(bag => bag.id === id ? updatedBag : bag),
          error: null
        }));
        // Invalidate cache to ensure activeBag is recalculated
        invalidateActiveGolfBagCache();
      }
    } catch (error) {
      setStoreError(set, error);
    }
  },

  updateBagClubIds: async (id, clubIds) => {
    set({ error: null });
    try {
      await ClubService.updateBag(id, { clubIds });
      const bags = await ClubService.getAllBags();
      const updatedBag = bags.find(bag => bag.id === id);
      if (updatedBag) {
        set(state => ({
          bags: state.bags.map(bag => bag.id === id ? updatedBag : bag),
          error: null
        }));
        // Invalidate cache to ensure activeBag is recalculated
        invalidateActiveGolfBagCache();
      }
    } catch (error) {
      setStoreError(set, error);
    }
  },

  deleteBag: async (id) => {
    set({ error: null });
    try {
      await ClubService.deleteBag(id);
      const [bags, activeBagId] = await Promise.all([
        ClubService.getAllBags(),
        ClubService.getActiveBagId(),
      ]);
      set({ bags, activeBagId: activeBagId ?? bags[0]?.id ?? null, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  setActiveBag: async (id) => {
    set({ error: null });
    try {
      await ClubService.setActiveBagId(id);
      set({ activeBagId: id, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  moveBagLeft: async (id) => {
    set({ error: null });
    try {
      await ClubService.moveBagPosition(id, 'left');
      set({ bags: await ClubService.getAllBags(), error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  moveBagRight: async (id) => {
    set({ error: null });
    try {
      await ClubService.moveBagPosition(id, 'right');
      set({ bags: await ClubService.getAllBags(), error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  toggleClubInActiveBag: async (clubId) => {
    set({ error: null });
    try {
      const activeBagId = await ClubService.getActiveBagId();
      if (activeBagId == null) {
        throw new Error('アクティブなゴルフバッグが見つかりません');
      }

      const bags = await ClubService.getAllBags();
      const activeBag = bags.find((bag) => bag.id === activeBagId);
      if (!activeBag) {
        throw new Error('アクティブなゴルフバッグが見つかりません');
      }

      if (activeBag.clubIds.includes(clubId)) {
        await ClubService.removeClubFromBag(activeBagId, clubId);
      } else {
        await ClubService.addClubToBag(activeBagId, clubId);
      }

      set({ bags: await ClubService.getAllBags(), activeBagId, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  replaceActiveBagClubIds: async (clubIds) => {
    set({ error: null });
    try {
      const activeBagId = await ClubService.getActiveBagId();
      if (activeBagId == null) {
        throw new Error('アクティブなゴルフバッグが見つかりません');
      }

      await ClubService.setBagClubIds(activeBagId, clubIds);
      set({ bags: await ClubService.getAllBags(), activeBagId, error: null });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  loadPersonalData: async () => {
    set({ error: null });
    try {
      const personalData = await ClubService.getAllPersonalData();
      set({ personalData });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  setPersonalData: async (data) => {
    set({ error: null });
    try {
      await ClubService.setPersonalData(data);
      set((state) => ({
        personalData: { ...state.personalData, [data.clubId]: data },
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  removePersonalData: async (clubId) => {
    set({ error: null });
    try {
      await ClubService.deletePersonalData(clubId);
      set((state) => {
        const next = { ...state.personalData };
        delete next[clubId];
        return { personalData: next };
      });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  loadPlayerSkillLevel: async () => {
    set({ error: null });
    try {
      const playerSkillLevel = await ClubService.getPlayerSkillLevel();
      set({ playerSkillLevel });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  loadActualShotRows: async () => {
    set({ error: null });
    try {
      const actualShotRows = await ClubService.getAllActualShotRows();
      set({ actualShotRows });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  setPlayerSkillLevel: async (level) => {
    set({ error: null });
    try {
      const clamped = clampSkillLevel(level);
      await ClubService.setPlayerSkillLevel(clamped);
      set({ playerSkillLevel: clamped });
    } catch (error) {
      setStoreError(set, error);
    }
  },
  setActualShotRows: async (rows, bagId) => {
    if (bagId == null) {
      return;
    }
    const bagKey = String(bagId);
    set((state) => ({
      actualShotRows: {
        ...state.actualShotRows,
        [bagKey]: rows,
      },
    }));
    try {
      await ClubService.setActualShotRows(bagId, rows);
    } catch (error) {
      setStoreError(set, error);
    }
  },
}));

let lastClubsRef: GolfClub[] | null = null;
let lastSortedClubs: GolfClub[] = [];
let lastBagsRef: GolfBag[] | null = null;
let lastActiveBagId: number | null = null;
let lastActiveBag: GolfBag | null = null;
let lastActiveBagClubsRef: GolfClub[] = [];
let lastActiveBagClubsClubsRef: GolfClub[] | null = null;
let lastActiveBagClubsBagsRef: GolfBag[] | null = null;
let lastActiveBagClubsBagId: number | null = null;

export const selectSortedClubsForDisplay = (state: ClubStoreState): GolfClub[] => {
  if (state.clubs === lastClubsRef) {
    return lastSortedClubs;
  }
  lastClubsRef = state.clubs;
  lastSortedClubs = sortClubsForDisplay(state.clubs);
  return lastSortedClubs;
};

export const selectActiveGolfBag = (state: ClubStoreState): GolfBag | null => {
  if (state.bags === lastBagsRef && state.activeBagId === lastActiveBagId) {
    return lastActiveBag;
  }

  lastBagsRef = state.bags;
  lastActiveBagId = state.activeBagId;

  if (state.bags.length === 0) {
    lastActiveBag = null;
    return null;
  }

  lastActiveBag = state.bags.find((bag) => bag.id === state.activeBagId) ?? state.bags[0] ?? null;
  return lastActiveBag;
};

export const invalidateActiveGolfBagCache = () => {
  lastBagsRef = null;
  lastActiveBagId = null;
  lastActiveBag = null;
};

export const selectSortedActiveBagClubs = (state: ClubStoreState): GolfClub[] => {
  if (
    state.clubs === lastActiveBagClubsClubsRef &&
    state.bags === lastActiveBagClubsBagsRef &&
    state.activeBagId === lastActiveBagClubsBagId
  ) {
    return lastActiveBagClubsRef;
  }

  lastActiveBagClubsClubsRef = state.clubs;
  lastActiveBagClubsBagsRef = state.bags;
  lastActiveBagClubsBagId = state.activeBagId;

  const activeBag = selectActiveGolfBag(state);
  if (!activeBag) {
    lastActiveBagClubsRef = [];
    return lastActiveBagClubsRef;
  }

  const clubIdSet = new Set(activeBag.clubIds);
  lastActiveBagClubsRef = sortClubsForDisplay(
    state.clubs.filter((club) => club.id != null && clubIdSet.has(club.id)),
  );
  return lastActiveBagClubsRef;
};
