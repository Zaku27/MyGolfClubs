import { create } from 'zustand';
import type { UserProfile } from '../types/golf';

interface UserProfileState {
  profile: UserProfile;
  setHeadSpeed: (headSpeed: number | null) => void;
  setSkillWeights: (baseSkillWeight: number, effectiveRateWeight: number) => void;
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
  setSkillWeights: (baseSkillWeight, effectiveRateWeight) => {
    set((state) => {
      const next = {
        ...state.profile,
        skillWeights: {
          baseSkillWeight: Math.max(0, Math.min(1, baseSkillWeight)),
          effectiveRateWeight: Math.max(0, Math.min(1, effectiveRateWeight)),
        },
      };
      saveProfileToStorage(next);
      return { profile: next };
    });
  },
  loadProfile: () => {
    set({ profile: loadProfileFromStorage() });
  },
}));
