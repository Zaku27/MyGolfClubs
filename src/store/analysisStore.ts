import { create } from 'zustand';

type AnalysisStoreState = {
  selectedLoftLengthClubId: number | null;
  adjustedLoftLength: number;
  selectLoftLengthClub: (clubId: number | null, currentLength: number) => void;
  setAdjustedLoftLength: (length: number) => void;
};

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  selectedLoftLengthClubId: null,
  adjustedLoftLength: 0,
  selectLoftLengthClub: (clubId, currentLength) =>
    set({ selectedLoftLengthClubId: clubId, adjustedLoftLength: currentLength }),
  setAdjustedLoftLength: (length) => set({ adjustedLoftLength: length }),
}));
