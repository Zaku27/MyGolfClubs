import type { SimClub } from '../types/game';
import type { ClubPersonalData, GolfClub } from '../types/golf';
import {
  buildLieAngleAnalysis,
  buildSwingWeightAnalysis,
  buildWeightLengthAnalysis,
} from './analysisBuilders';
import { classifyWeightDeviation } from './analysisRules';
import { toSimClub } from './clubSimAdapter';
import { calculateBaseClubSuccessRate } from './calculateSuccessRate';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { readStoredJson, readStoredNumber } from './storage';

const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.0;
const DEFAULT_SWING_ADJUST_THRESHOLD = 1.5;
const WEAK_CLUB_THRESHOLD = 65;

/** 分析ペナルティポイントに掛ける倍率。ここを変えると全箇所に反映される */
export const ANALYSIS_PENALTY_MULTIPLIER = 1.5;

function parseUserLieAngleStandards(value: unknown): UserLieAngleStandards {
  if (!value || typeof value !== 'object') {
    return DEFAULT_USER_LIE_ANGLE_STANDARDS;
  }

  const parsed = value as Partial<UserLieAngleStandards>;
  return {
    byClubType: parsed.byClubType ?? {},
    byClubName: parsed.byClubName ?? {},
  };
}

export function buildAnalysisPenaltyByClubId(clubs: GolfClub[]): Record<string, number> {
  const penaltyMap: Record<string, number> = {};

  const addPenalty = (clubId: string, points: number) => {
    penaltyMap[clubId] = Math.min(20, (penaltyMap[clubId] ?? 0) + points);
  };

  const swingWeightTarget = readStoredNumber(
    SWING_TARGET_STORAGE_KEY,
    DEFAULT_SWING_TARGET,
    { decimals: 1 },
  );
  const swingGoodTolerance = readStoredNumber(
    SWING_GOOD_TOLERANCE_STORAGE_KEY,
    DEFAULT_SWING_GOOD_TOLERANCE,
    { decimals: 1 },
  );
  const swingAdjustThreshold = readStoredNumber(
    SWING_ADJUST_THRESHOLD_STORAGE_KEY,
    DEFAULT_SWING_ADJUST_THRESHOLD,
    { decimals: 1 },
  );
  const userLieAngleStandards = readStoredJson(
    LIE_STANDARDS_STORAGE_KEY,
    DEFAULT_USER_LIE_ANGLE_STANDARDS,
    parseUserLieAngleStandards,
  );

  const alwaysVisible = () => true;

  const { tableClubs: swingTable } = buildSwingWeightAnalysis(
    clubs,
    swingWeightTarget,
    swingGoodTolerance,
    swingAdjustThreshold,
    alwaysVisible,
  );
  for (const club of swingTable) {
    const clubId = toSimClub(club).id;
    if (club.swingStatus === '調整推奨') {
      addPenalty(clubId, 8);
    } else if (club.swingStatus !== '良好') {
      addPenalty(clubId, 4);
    }
  }

  const { tableClubs: weightTable } = buildWeightLengthAnalysis(clubs, alwaysVisible);
  for (const club of weightTable) {
    const clubId = toSimClub(club).id;
    const weightClass = classifyWeightDeviation(club.deviation);
    if (weightClass === 'heavyOutlier' || weightClass === 'lightOutlier') {
      addPenalty(clubId, 6);
    } else if (weightClass === 'outOfBand') {
      addPenalty(clubId, 3);
    }
  }

  const { tableClubs: lieTable } = buildLieAngleAnalysis(
    clubs,
    userLieAngleStandards,
    alwaysVisible,
  );
  for (const club of lieTable) {
    const clubId = toSimClub(club).id;
    if (club.lieStatus === 'Adjust Recommended') {
      addPenalty(clubId, 6);
    } else if (club.lieStatus === 'Slightly Off') {
      addPenalty(clubId, 3);
    }
  }

  return penaltyMap;
}

export function calculateDisplayClubSuccessRate(
  simClub: SimClub,
  personalData: ClubPersonalData | undefined,
  playerSkillLevel: number,
  analysisPenaltyPoints: number,
): number {
  const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(
    simClub,
    analysisPenaltyPoints,
  );

  return calculateBaseClubSuccessRate({
    baseSuccessRate: adjustedBaseSuccessRate,
    personalData,
    isWeakClub: isWeakClubByAnalysisAdjustedRate(simClub, analysisPenaltyPoints),
    playerSkillLevel,
  });
}

export function getAnalysisAdjustedBaseSuccessRate(
  simClub: SimClub,
  analysisPenaltyPoints: number,
): number {
  return Math.max(5, simClub.successRate - analysisPenaltyPoints * ANALYSIS_PENALTY_MULTIPLIER);
}

export function isWeakClubByAnalysisAdjustedRate(
  simClub: SimClub,
  analysisPenaltyPoints: number,
): boolean {
  const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(
    simClub,
    analysisPenaltyPoints,
  );
  return simClub.isWeakClub === true || adjustedBaseSuccessRate < WEAK_CLUB_THRESHOLD;
}
