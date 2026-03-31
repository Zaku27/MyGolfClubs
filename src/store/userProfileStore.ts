import { create } from 'zustand';
import type { UserProfile } from '../types/golf';

interface UserProfileState {
  profile: UserProfile;
  setHeadSpeed: (headSpeed: number | null) => void;
  loadProfile: () => void;
}

const STORAGE_KEY = 'userProfile';

function loadProfileFromStorage(): UserProfile {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as UserProfile;
      } catch {}
    }
  }
  return { headSpeed: null };
}

function saveProfileToStorage(profile: UserProfile) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: loadProfileFromStorage(),
  setHeadSpeed: (headSpeed) => {
    set((state) => {
      const next = { ...state.profile, headSpeed };
      saveProfileToStorage(next);
      return { profile: next };
    });
  },
  loadProfile: () => {
    set({ profile: loadProfileFromStorage() });
  },
}));
