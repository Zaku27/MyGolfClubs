import { create } from 'zustand';
import type { UserProfile } from '../types/golf';

interface UserProfileState {
  profile: UserProfile;
  loadProfile: () => void;
}

const STORAGE_KEY = 'userProfile';

function loadProfileFromStorage(): UserProfile {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {};
        }
      } catch {}
    }
  }
  return {};
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: loadProfileFromStorage(),
  loadProfile: () => {
    set({ profile: loadProfileFromStorage() });
  },
}));
