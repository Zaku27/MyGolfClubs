import { create } from 'zustand';
import type { GolfClub } from '../types/golf';
import { ClubService } from '../db/clubService';
import { sortClubsForDisplay } from '../utils/clubSort';

type ClubStoreState = {
  clubs: GolfClub[];
  loading: boolean;
  error: string | null;
};

type ClubStoreActions = {
  loadClubs: () => Promise<void>;
  addClub: (club: Omit<GolfClub, 'id'>) => Promise<void>;
  updateClub: (id: number, club: Partial<GolfClub>) => Promise<void>;
  deleteClub: (id: number) => Promise<void>;
  initializeDefaults: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearAllClubs: () => Promise<void>;
};

type ClubStore = ClubStoreState & ClubStoreActions;

const INITIAL_STATE: ClubStoreState = {
  clubs: [],
  loading: false,
  error: null,
};

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
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
      set((state) => ({ clubs: [newClub, ...state.clubs] }));
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
        clubs: state.clubs.map((c) => (c.id === id ? { ...c, ...club, updatedAt } : c)),
      }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  deleteClub: async (id) => {
    set({ error: null });
    try {
      await ClubService.deleteClub(id);
      set((state) => ({ clubs: state.clubs.filter((c) => c.id !== id) }));
    } catch (error) {
      setStoreError(set, error);
    }
  },

  clearAllClubs: async () => {
    set({ error: null });
    try {
      await ClubService.deleteAllClubs();
      set({ clubs: [] });
    } catch (error) {
      setStoreError(set, error);
    }
  },

  initializeDefaults: async () => {
    set({ loading: true, error: null });
    try {
      await ClubService.initializeDefaultClubs();
      await refreshClubs(set);
    } catch (error) {
      setStoreError(set, error);
    }
  },

  resetToDefaults: async () => {
    set({ loading: true, error: null });
    try {
      await ClubService.resetToDefaults();
      await refreshClubs(set);
    } catch (error) {
      setStoreError(set, error);
    }
  },
}));

let lastClubsRef: GolfClub[] | null = null;
let lastSortedClubs: GolfClub[] = [];

export const selectSortedClubsForDisplay = (state: ClubStoreState): GolfClub[] => {
  if (state.clubs === lastClubsRef) {
    return lastSortedClubs;
  }
  lastClubsRef = state.clubs;
  lastSortedClubs = sortClubsForDisplay(state.clubs);
  return lastSortedClubs;
};
