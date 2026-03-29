import { create } from 'zustand';
import type { GolfClub } from '../types/golf';
import { ClubService } from '../db/clubService';
import { sortClubsForDisplay } from '../utils/clubSort';

interface ClubStore {
  clubs: GolfClub[];
  loading: boolean;
  error: string | null;
  loadClubs: () => Promise<void>;
  addClub: (club: Omit<GolfClub, 'id'>) => Promise<void>;
  updateClub: (id: number, club: Partial<GolfClub>) => Promise<void>;
  deleteClub: (id: number) => Promise<void>;
  initializeDefaults: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearAllClubs: () => Promise<void>;
}

export const useClubStore = create<ClubStore>((set) => ({
    clearAllClubs: async () => {
      try {
        await ClubService.deleteAllClubs();
        set({ clubs: [] });
      } catch (error) {
        set({ error: (error as Error).message });
      }
    },
  clubs: [],
  loading: false,
  error: null,

  loadClubs: async () => {
    set({ loading: true, error: null });
    try {
      const clubs = await ClubService.getAllClubs();
      set({ clubs, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addClub: async (club) => {
    try {
      const id = await ClubService.createClub(club);
      const newClub: GolfClub = {
        ...club,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({ clubs: [newClub, ...state.clubs] }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateClub: async (id, club) => {
    try {
      await ClubService.updateClub(id, club);
      set((state) => ({
        clubs: state.clubs.map((c) => (c.id === id ? { ...c, ...club } : c)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteClub: async (id) => {
    try {
      await ClubService.deleteClub(id);
      set((state) => ({ clubs: state.clubs.filter((c) => c.id !== id) }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  initializeDefaults: async () => {
    try {
      await ClubService.initializeDefaultClubs();
      const clubs = await ClubService.getAllClubs();
      set({ clubs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  resetToDefaults: async () => {
    try {
      await ClubService.resetToDefaults();
      const clubs = await ClubService.getAllClubs();
      set({ clubs });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));

let lastClubsRef: GolfClub[] | null = null;
let lastSortedClubs: GolfClub[] = [];

export const selectSortedClubsForDisplay = (state: ClubStore): GolfClub[] => {
  if (state.clubs === lastClubsRef) {
    return lastSortedClubs;
  }
  lastClubsRef = state.clubs;
  lastSortedClubs = sortClubsForDisplay(state.clubs);
  return lastSortedClubs;
};
