import type { GolfClubData } from '../types/golf';
import type { LieAngleStatus } from '../types/lieStandards';

export type WeightTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    expectedWeight: number;
    deviation: number;
    weightTrendMessage: string;
    projectedDistanceGap: number | null;
    projectedGapTargetClubType: GolfClubData['clubType'] | null;
    projectedGapTargetNumber: string | null;
  };
};

export type LoftTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    estimatedDistance: number;
    actualDistance: number;
    projectedDistanceGap: number | null;
    projectedGapTargetClubType: GolfClubData['clubType'] | null;
    projectedGapTargetNumber: string | null;
  };
  pointType: 'estimated' | 'actual';
};

export type LieTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    standardLieAngle: number;
    deviationFromStandard: number;
    lieStatus: LieAngleStatus;
  };
};

export type LieLengthTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    expectedLieAngle: number;
    deviationFromTrend: number;
    lieTrendMessage: string;
  };
};

export type LoftLengthTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    expectedLoft: number;
    deviationFromStandard: number;
    recommendedLoftAdjustment: number;
    projectedDistanceGap: number | null;
    projectedGapTargetClubType: GolfClubData['clubType'] | null;
    projectedGapTargetNumber: string | null;
    projectedSwingWeightImpact: number;
  };
};

export type SwingTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    swingWeightNumeric: number;
    swingDeviation: number;
    swingStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
  };
};

export type SwingLengthTooltipState = {
  x: number;
  y: number;
  club: GolfClubData & {
    swingWeightNumeric: number;
    expectedSwingWeight: number;
    deviationFromTrend: number;
    trendStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
  };
};

export type TooltipBoxSize = {
  width: number;
  height: number;
};