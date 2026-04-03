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
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const headSpeedRaw = parsed?.headSpeed;
        const headSpeed =
          typeof headSpeedRaw === 'number' && Number.isFinite(headSpeedRaw)
            ? headSpeedRaw
            : null;
        const sanitized: UserProfile = { headSpeed };

        // Migrate legacy profile payloads by stripping removed keys (e.g. skillWeights).
        if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
          saveProfileToStorage(sanitized);
        }

        return sanitized;
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
