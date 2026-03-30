import type { GolfClub } from '../types/golf';
import type { ClubCategory } from '../utils/analysisUtils';
import type { LieAngleStatus } from '../types/lieStandards';

export type WeightTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    expectedWeight: number;
    deviation: number;
    weightTrendMessage: string;
  };
};

export type LoftTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    estimatedDistance: number;
    actualDistance: number;
  };
  pointType: 'estimated' | 'actual';
};

export type LieTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    standardLieAngle: number;
    deviationFromStandard: number;
    lieStatus: LieAngleStatus;
  };
};

export type SwingTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    swingWeightNumeric: number;
    swingDeviation: number;
    swingStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
  };
};

export type TooltipBoxSize = {
  width: number;
  height: number;
};