import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classifyShotQualityByTargetError } from '../utils/landingPosition';
import { GolfBagPanel } from '../components/GolfBagPanel';
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  selectSortedClubsForDisplay,
  useClubStore,
} from '../store/clubStore';
import { useBagIdUrlSync } from '../hooks/useBagIdUrlSync';
import { formatSimClubLabel } from '../utils/simClubLabel';
import {
  simulateShot,
  estimateBaseDistance,
} from '../utils/shotSimulation';
import { getSkillLabel } from '../utils/playerSkill';
import {
  calculateDisplayClubSuccessRate,
  getAnalysisAdjustedBaseSuccessRate,
  isWeakClubByAnalysisAdjustedRate,
} from '../utils/clubSuccessDisplay';
import {
  buildLieAngleAnalysis,
  buildSwingWeightAnalysis,
  buildWeightLengthAnalysis,
} from '../utils/analysisBuilders';
import { classifyWeightDeviation } from '../utils/analysisRules';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { readStoredJson, readStoredNumber } from '../utils/storage';
import { resolvePersonalDataForSimClub } from '../utils/personalData';
import { toSimClub } from '../utils/clubSimAdapter';
import {
  loadRangePlayerSettings,
  saveRangePlayerSettings,
  type RangeSeatType,
} from '../utils/rangePlayerSettings';
import { ShotControlPanel } from '../components/ShotControlPanel';
import { RangeClubSelectionPanel } from '../components/RangeClubSelectionPanel';
import { RangeSimulationResults } from '../components/RangeSimulationResults';
import { RangePlayerSettings } from '../components/range/RangePlayerSettings';
import { RangeCourseConditions } from '../components/range/RangeCourseConditions';
import { RangeSimulationControls } from '../components/range/RangeSimulationControls';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';
import type { LieType, ShotQuality, ShotResult } from '../types/game';
import { type SimClub } from '../types/game';
import type { GolfClub } from '../types/golf';

type SimulationOptions = {
  personalData?: any;
  playerSkillLevel?: number;
  headSpeed?: number;
  aimXOffset?: number;
  shotPowerPercent?: number;
  shotIndex?: number;
  seedNonce?: string;
  useStoredDistance?: boolean;
};
import {
  convertMpsToMph,
  normalizeWindDirection,
  normalizeWindSpeedMps,
} from '../utils/windDirection';
import {
  LIE_OPTIONS,
  clampAimXOffset,
  formatGroundHardnessLabel,
  type GroundHardness,
  type RangeConditionSettings,
  type AnalysisPenalty,
} from '../utils/rangeUtils';

const EMPTY_ACTUAL_SHOT_ROWS: Array<Record<string, string>> = [];

const RANGE_CONDITION_SETTINGS_KEY = 'rangeConditionSettings';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.0;
const DEFAULT_SWING_ADJUST_THRESHOLD = 1.5;

function toCanonicalSlopeSettings(slopeAngle: number, slopeDirection: number): { slopeAngle: number; slopeDirection: number } {
  const safeAngle = Number.isFinite(slopeAngle) ? slopeAngle : 0;
  const clampedAngle = Math.min(45, Math.abs(safeAngle));
  const normalizedDirection = Number.isFinite(slopeDirection)
    ? normalizeWindDirection(slopeDirection)
    : 0;

  if (safeAngle < 0) {
    return {
      slopeAngle: clampedAngle,
      slopeDirection: normalizeWindDirection(normalizedDirection + 180),
    };
  }

  return {
    slopeAngle: clampedAngle,
    slopeDirection: normalizedDirection,
  };
}

function loadRangeConditionSettings(): RangeConditionSettings {
  if (typeof window === 'undefined') {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }

  try {
    const raw = localStorage.getItem(RANGE_CONDITION_SETTINGS_KEY);
    if (!raw) {
      return {
        lie: 'ティー',
        windDirection: 180,
        windSpeed: 0,
        groundHardness: 'medium',
        slopeAngle: 0,
        slopeDirection: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RangeConditionSettings>;
    const safeLie = LIE_OPTIONS.includes(String(parsed.lie)) ? String(parsed.lie) : 'ティー';

    const safeGroundHardness = parsed.groundHardness === 'soft' || parsed.groundHardness === 'firm' || parsed.groundHardness === 'medium'
      ? parsed.groundHardness
      : 'medium';
    const canonicalSlope = toCanonicalSlopeSettings(
      Number(parsed.slopeAngle) || 0,
      Number(parsed.slopeDirection),
    );

    return {
      lie: safeLie,
      windDirection: normalizeWindDirection(Number(parsed.windDirection)),
      windSpeed: normalizeWindSpeedMps(Number(parsed.windSpeed)),
      groundHardness: safeGroundHardness,
      slopeAngle: canonicalSlope.slopeAngle,
      slopeDirection: canonicalSlope.slopeDirection,
    };
  } catch {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }
}

function saveRangeConditionSettings(settings: RangeConditionSettings) {
  if (typeof window === 'undefined') return;
  const canonicalSlope = toCanonicalSlopeSettings(settings.slopeAngle, settings.slopeDirection);
  localStorage.setItem(
    RANGE_CONDITION_SETTINGS_KEY,
    JSON.stringify({
      lie: settings.lie,
      windDirection: normalizeWindDirection(settings.windDirection),
      windSpeed: normalizeWindSpeedMps(settings.windSpeed),
      groundHardness: settings.groundHardness,
      slopeAngle: canonicalSlope.slopeAngle,
      slopeDirection: canonicalSlope.slopeDirection,
    }),
  );
}

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


type RangeSummary = {
  avg: number;
  std: number;
  success: number;
  estimatedDist: number;
  diff: number;
  avgToTargetDistance: number;
  meanRoll: number;
  meanLateral: number;
  groundRollContribution: string;
  groundLateralContribution: string;
  appliedGroundHardness: GroundHardness;
};

function normalizeSlopeForDisplay(slopeAngle: number, slopeDirection: number): { slopeAngle: number; slopeDirection: number } {
  return toCanonicalSlopeSettings(slopeAngle, slopeDirection);
}

function formatSlopeDirectionLabel(direction: number): string {
  if (direction === 0) return 'ピン方向上り';
  if (direction === 90) return '右側上り';
  if (direction === 180) return 'ピン反対方向上り';
  if (direction === 270) return '左側上り';
  if (direction > 0 && direction < 90) return '右前上り';
  if (direction > 90 && direction < 180) return '右後上り';
  if (direction > 180 && direction < 270) return '左後上り';
  return '左前上り';
}


function mapLieUiToGameLie(lie: string): LieType {
  switch (lie) {
    case 'ティー': return 'tee';
    case 'フェアウェイ': return 'fairway';
    case 'セミラフ': return 'semirough';
    case 'ラフ': return 'rough';
    case 'ベアグラウンド': return 'bareground';
    case 'バンカー': return 'bunker';
    case 'グリーン': return 'green';
    default: return 'tee';
  }
}

function toLandingResult(raw: ShotResult): LandingResult | null {
  const landing = raw?.landing;
  if (!landing) return null;

  const finalX = Number(landing.finalX);
  const finalY = Number(landing.finalY);
  if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) return null;

  const carry = Number(landing.carry);
  const roll = Number(landing.roll);
  const totalDistance = Number(landing.totalDistance);
  const lateralDeviation = Number(landing.lateralDeviation);

  return {
    carry: Number.isFinite(carry) ? carry : finalY,
    roll: Number.isFinite(roll) ? roll : 0,
    totalDistance: Number.isFinite(totalDistance) ? totalDistance : finalY,
    lateralDeviation: Number.isFinite(lateralDeviation) ? lateralDeviation : finalX,
    finalX,
    finalY,
    shotQuality: raw.shotQuality,
    qualityMetrics: landing.qualityMetrics,
    apexHeight: landing.apexHeight,
    trajectoryPoints: landing.trajectoryPoints,
  };
}

function buildMonteCarloResult(rawResults: ShotResult[]): MonteCarloResult {
  const shots = rawResults
    .map((r) => toLandingResult(r))
    .filter((shot): shot is LandingResult => shot !== null);

  if (shots.length === 0) {
    return {
      shots: [],
      stats: {
        meanX: 0,
        meanY: 0,
        stdDevX: 0,
        stdDevY: 0,
        correlation: 0,
      },
    };
  }

  const meanX = shots.reduce((sum, shot) => sum + shot.finalX, 0) / shots.length;
  const meanY = shots.reduce((sum, shot) => sum + shot.finalY, 0) / shots.length;
  const varianceX = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) ** 2, 0) / shots.length;
  const varianceY = shots.reduce((sum, shot) => sum + (shot.finalY - meanY) ** 2, 0) / shots.length;
  const covariance = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) * (shot.finalY - meanY), 0) / shots.length;
  const stdDevX = Math.sqrt(varianceX);
  const stdDevY = Math.sqrt(varianceY);

  // X/Y のばらつきの連動を相関係数として保持しておくと、
  // 可視化側で軸平行ではない回転楕円を描ける。
  const correlation = stdDevX > 0 && stdDevY > 0 ? covariance / (stdDevX * stdDevY) : 0;

  return {
    shots,
    stats: {
      meanX,
      meanY,
      stdDevX,
      stdDevY,
      correlation,
    },
  };
}

function getSelectableRangeClubs(
  clubs: GolfClub[],
  seatType: RangeSeatType,
): GolfClub[] {
  const filtered = clubs.filter((club) => seatType !== 'personal' || club.clubType !== 'Putter');

  return [...filtered].sort((a, b) => {
    if (seatType !== 'personal') {
      const aIsPutter = a.clubType === 'Putter';
      const bIsPutter = b.clubType === 'Putter';
      if (aIsPutter && !bIsPutter) return 1;
      if (!aIsPutter && bIsPutter) return -1;
    }

    return (a.loftAngle ?? 999) - (b.loftAngle ?? 999);
  });
}


export default function RangeScreen() {
  const allClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const personalData = useClubStore((state) => state.personalData);
  const actualShotRows = useClubStore((state) => {
    const bagId = state.activeBagId;
    return bagId != null ? state.actualShotRows[String(bagId)] ?? EMPTY_ACTUAL_SHOT_ROWS : EMPTY_ACTUAL_SHOT_ROWS;
  });
  const loadClubs = useClubStore((state) => state.loadClubs);
  const loadBags = useClubStore((state) => state.loadBags);
  const loadPersonalData = useClubStore((state) => state.loadPersonalData);
  const loadPlayerSkillLevel = useClubStore((state) => state.loadPlayerSkillLevel);
  const loadActualShotRows = useClubStore((state) => state.loadActualShotRows);
  const storedPlayerSkillLevel = useClubStore((state) => state.playerSkillLevel);
  const setActiveBag = useClubStore((state) => state.setActiveBag);
  const initialRangePlayerSettings = loadRangePlayerSettings();
  const initialRangeConditionSettings = loadRangeConditionSettings();
  // const { playerSkillLevel } = useGameStore();
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  // プレイヤー: "robot" or "personal"
  const [seatType, setSeatType] = useState<RangeSeatType>(initialRangePlayerSettings.seatType);
  // ロボット用: ヘッドスピードとスキルレベル
  const [robotHeadSpeed, setRobotHeadSpeed] = useState<number>(initialRangePlayerSettings.robotHeadSpeed);
  const [robotSkillLevel, setRobotSkillLevel] = useState<number>(initialRangePlayerSettings.robotSkillLevel);
  const [lie, setLie] = useState<string>(initialRangeConditionSettings.lie);
  // 風向は 0〜359 度（0°=北、時計回り）で保持する。
  const [windDirection, setWindDirection] = useState<number>(initialRangeConditionSettings.windDirection);
  // 風速は UI 仕様どおり m/s で保持する。
  const [windSpeed, setWindSpeed] = useState<number>(initialRangeConditionSettings.windSpeed);
  const [groundHardness, setGroundHardness] = useState<GroundHardness>(initialRangeConditionSettings.groundHardness);
  const [slopeAngle, setSlopeAngle] = useState<number>(initialRangeConditionSettings.slopeAngle);
  const [slopeDirection, setSlopeDirection] = useState<number>(initialRangeConditionSettings.slopeDirection);
  // 風ダイアルは通常閉じ、必要な時だけ開いて調整できるようにする。
  const [isWindControlOpen, setIsWindControlOpen] = useState<boolean>(false);
  const [isCourseConditionOpen, setIsCourseConditionOpen] = useState<boolean>(false);
  const [numShots, setNumShots] = useState<number>(10);
  const [aimXOffset, setAimXOffset] = useState<number>(0);
  const [shotPowerPercent, setShotPowerPercent] = useState<number>(100);
  const [results, setResults] = useState<ShotResult[]>([]);
  const [flatBaselineResults, setFlatBaselineResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [reuseLastSeed, setReuseLastSeed] = useState(initialRangePlayerSettings.reuseLastSeed);
  const [lastSimulationSeedNonce, setLastSimulationSeedNonce] = useState<string | null>(null);
  const monteCarloResult = useMemo(() => buildMonteCarloResult(results), [results]);
  const personalSkillLevel = storedPlayerSkillLevel;
  const displayedSkillLevel = useMemo(() => seatType === 'robot' ? robotSkillLevel : personalSkillLevel, [seatType, robotSkillLevel, personalSkillLevel]);
  const displayedSkillLabel = useMemo(() => getSkillLabel(displayedSkillLevel), [displayedSkillLevel]);
  const skillLevelName = useMemo(() => `適用スキルレベル ${(displayedSkillLevel * 100).toFixed(0)}% (${displayedSkillLabel})`, [displayedSkillLevel, displayedSkillLabel]);
  const displayedSkillLevelName = useMemo(() => seatType === 'actual' ? '' : skillLevelName, [seatType, skillLevelName]);
  const clubs = useMemo(() => seatType === 'robot' ? allClubs : activeBagClubs, [seatType, allClubs, activeBagClubs]);
  const selectableClubs = useMemo(() => getSelectableRangeClubs(clubs, seatType), [clubs, seatType]);

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

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });
  const gameLie = useMemo(() => mapLieUiToGameLie(lie), [lie]);
  // Range  UI input is m/s, but internal calculations use mph for compatibility.
  const windSpeedMph = useMemo(() => convertMpsToMph(windSpeed), [windSpeed]);

  // Reset wind direction and speed to initial state.
  const handleResetWind = useCallback(() => {
    setWindDirection(0);
    setWindSpeed(0);
  }, []);

  useEffect(() => {
    const initializeScreen = async () => {
      await Promise.all([
        loadClubs(),
        loadBags(),
        loadPersonalData(),
        loadPlayerSkillLevel(),
        loadActualShotRows(),
      ]);
    };

    void initializeScreen();
  }, [loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel, loadActualShotRows]);

  useEffect(() => {
    if (clubs.length === 0) {
      if (selectedClubId !== '') {
        setSelectedClubId('');
      }
      return;
    }

    const hasSelectedClub = selectableClubs.some((club) => String(club.id) === String(selectedClubId));
    if (hasSelectedClub) {
      return;
    }

    const firstPlayableClub = selectableClubs[0] ?? null;
    setSelectedClubId(firstPlayableClub?.id != null ? String(firstPlayableClub.id) : '');
  }, [selectableClubs, selectedClubId]);

  useEffect(() => {
    saveRangePlayerSettings({
      seatType,
      robotHeadSpeed,
      robotSkillLevel,
      reuseLastSeed,
    });
  }, [seatType, robotHeadSpeed, robotSkillLevel, reuseLastSeed]);

  useEffect(() => {
    saveRangeConditionSettings({
      lie,
      windDirection,
      windSpeed,
      groundHardness,
      slopeAngle,
      slopeDirection,
    });
  }, [lie, windDirection, windSpeed, groundHardness, slopeAngle, slopeDirection]);


  // avgDistanceが無い場合はdistanceをavgDistanceとして使う
  const selectedClub = useMemo(() => 
    clubs.find((c) => String(c.id) === String(selectedClubId)),
    [clubs, selectedClubId]
  );
  const simClub = useMemo(() => 
    selectedClub ? toSimClub(selectedClub) : undefined,
    [selectedClub]
  );
  const estimatedClubDistance = useMemo(() => simClub
    ? estimateBaseDistance(
        simClub,
        seatType === 'robot' ? robotHeadSpeed : undefined,
        undefined,
        true,
      )
    : 0,
    [simClub, seatType, robotHeadSpeed]
  );
  const actualModeResults = useMemo(() => {
    if (seatType !== 'actual' || !selectedClub) {
      return [] as ShotResult[];
    }

    const clubLabel = formatSimClubLabel(toSimClub(selectedClub));
    const parseNumber = (value?: string): number | null => {
      if (!value) return null;
      const raw = value.replace(/,/g, '').replace(/ /g, ' ').trim();
      const normalized = raw.replace(/左/g, 'L').replace(/右/g, 'R');
      const directionMatch = normalized.match(/^\s*([LR])\s*([+-]?\d+(?:\.\d+)?)\s*$/i)
        || normalized.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*([LR])\s*$/i);
      if (directionMatch) {
        const magnitude = Number(directionMatch[1] ?? directionMatch[2]);
        const direction = directionMatch[1] && /[LR]/i.test(directionMatch[1])
          ? directionMatch[1]
          : directionMatch[2];
        return Number.isFinite(magnitude)
          ? direction.toUpperCase() === 'L'
            ? -Math.abs(magnitude)
            : Math.abs(magnitude)
          : null;
      }
      const numeric = Number(raw.replace(/[^0-9+\-.]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    };

    const classifyQuality = (
      observedDistance: number,
      expectedDistance: number,
      lateralDeviation: number,
      _clubType: GolfClub['clubType'],
      wasMishit: boolean,
    ): ShotQuality => {
      if (wasMishit) {
        return 'poor';
      }
      return classifyShotQualityByTargetError(expectedDistance, observedDistance, lateralDeviation).quality;
    };

    return actualShotRows
      .filter((row) => row.club === clubLabel)
      .map((row) => {
        const carry = parseNumber(row['Carry (yds)']);
        const totalDistance = parseNumber(row['Total (yds)']);
        const roll = parseNumber(row['Roll (yds)']);
        const lateral = parseNumber(row['Lateral (yds)']);
        const shotType = row['Shot Type']?.toLowerCase() ?? '';
        const wasMishit = shotType.includes('mishit') || row.Shot?.toLowerCase().includes('mishit');

        const carryValue = Number.isFinite(carry) ? carry : null;
        const rollValue = Number.isFinite(roll) ? roll : null;
        const totalDistanceFromComponents =
          carryValue !== null && rollValue !== null
            ? carryValue + rollValue
            : null;
        const actualTotalDistance = totalDistanceFromComponents ?? totalDistance ?? 0;
        const actualCarry = carryValue !== null
          ? carryValue
          : rollValue !== null
            ? actualTotalDistance - rollValue
            : actualTotalDistance;

const expectedDistance = estimatedClubDistance ?? actualTotalDistance;
        const shotQuality = classifyQuality(actualTotalDistance, expectedDistance, lateral ?? 0, selectedClub.clubType, wasMishit);

        return {
          newRemainingDistance: 0,
          outcomeMessage: '',
          strokesAdded: 1,
          lie: 'fairway' as LieType,
          penalty: false,
          distanceHit: actualTotalDistance,
          shotQuality,
          wasSuccessful: shotQuality !== 'poor',
          effectiveSuccessRate: 100,
          landing: {
            carry: actualCarry,
            roll: roll ?? 0,
            totalDistance: actualTotalDistance,
            lateralDeviation: lateral ?? 0,
            finalX: lateral ?? 0,
            finalY: actualTotalDistance,
          },
          finalOutcome: 'fairway' as const,
          penaltyStrokes: 0,
        };
      });
  }, [actualShotRows, seatType, selectedClub]);

  const actualModeSummary = useMemo<RangeSummary | null>(() => {
    if (seatType !== 'actual' || actualModeResults.length === 0) {
      return null;
    }

    const distances = actualModeResults.map((result) => result.landing?.totalDistance ?? result.distanceHit);
    const avg = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const std = Math.sqrt(distances.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / distances.length);
    const success = actualModeResults.filter((result) => result.wasSuccessful).length / Math.max(1, actualModeResults.length);
    const meanRoll = actualModeResults.reduce((sum, result) => sum + (result.landing?.roll ?? 0), 0) / Math.max(1, actualModeResults.length);
    const meanLateral = actualModeResults.reduce((sum, result) => sum + Math.abs(result.landing?.lateralDeviation ?? 0), 0) / Math.max(1, actualModeResults.length);
    const hardnessFactor = groundHardness === 'firm' ? 1.35 : groundHardness === 'soft' ? 0.65 : 1;
    const rollBaseline = meanRoll / hardnessFactor;
    const rollContribution = meanRoll - rollBaseline;
    const rollContributionLabel = groundHardness === 'medium'
      ? '地面硬さは標準です。'
      : `${rollContribution >= 0 ? '+' : ''}${rollContribution.toFixed(1)}yd（${formatGroundHardnessLabel(groundHardness)}の影響）`;
    const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
    const meanSlopeXShift = actualModeResults.reduce((sum, result) => {
      const slopeX = result.landing?.finalX ?? 0;
      return sum + slopeX;
    }, 0) / Math.max(1, actualModeResults.length);
    const slopeEffectLabel = normalizedSlope.slopeAngle === 0
      ? 'フラットなので横ブレ影響は標準です。'
      : `傾斜 ${normalizedSlope.slopeAngle}° (${formatSlopeDirectionLabel(normalizedSlope.slopeDirection)}) により、横方向シフトは ${meanSlopeXShift >= 0 ? '+' : ''}${meanSlopeXShift.toFixed(1)}y です。`;
    const estimatedDist = estimatedClubDistance;
    const diff = Math.round(avg - estimatedDist);
    const avgToTargetDistance = actualModeResults.reduce((sum, result) => {
      const finalX = result.landing?.finalX ?? 0;
      const finalY = result.landing?.finalY ?? 0;
      const dx = finalX;
      const dy = finalY - estimatedDist;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / Math.max(1, actualModeResults.length);

    return {
      avg,
      std,
      success,
      estimatedDist,
      diff,
      avgToTargetDistance,
      meanRoll,
      meanLateral,
      groundRollContribution: rollContributionLabel,
      groundLateralContribution: slopeEffectLabel,
      appliedGroundHardness: groundHardness,
    };
  }, [actualModeResults, selectedClub, groundHardness, slopeAngle, slopeDirection]);

  const selectedResults = seatType === 'actual' ? actualModeResults : results;
  const selectedSummary = seatType === 'actual' ? actualModeSummary : summary;
  const selectedMonteCarlo = seatType === 'actual'
    ? buildMonteCarloResult(actualModeResults)
    : monteCarloResult;

  const targetDistance = selectedSummary?.estimatedDist ?? (seatType === 'robot'
    ? estimatedClubDistance
    : selectedClub?.distance ?? 0);
  const chartTarget = { x: 0, y: targetDistance };
  const chartAim = seatType === 'actual'
    ? undefined
    : { x: aimXOffset, y: Math.round(targetDistance * shotPowerPercent / 100) };
  const showRangeAimControls = !selectedClub?.clubType || selectedClub.clubType !== 'Putter';
  const analysisPenaltyByClubId = useMemo(() => {
    const penaltyMap: Record<string, AnalysisPenalty> = {};

    const addPenalty = (clubId: string, points: number, reason: string) => {
      const existing = penaltyMap[clubId] ?? { points: 0, reasons: [] };
      const nextReasons = existing.reasons.includes(reason)
        ? existing.reasons
        : [...existing.reasons, reason];
      penaltyMap[clubId] = {
        points: Math.min(20, existing.points + points),
        reasons: nextReasons,
      };
    };

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
        addPenalty(clubId, 8, 'スイングウェイト: 調整推奨');
      } else if (club.swingStatus !== '良好') {
        addPenalty(clubId, 4, `スイングウェイト: ${club.swingStatus}`);
      }
    }

    const { tableClubs: weightTable } = buildWeightLengthAnalysis(clubs, alwaysVisible);
    for (const club of weightTable) {
      const clubId = toSimClub(club).id;
      const weightClass = classifyWeightDeviation(club.deviation);
      if (weightClass === 'heavyOutlier' || weightClass === 'lightOutlier') {
        addPenalty(clubId, 6, '重量偏差: 外れ値');
      } else if (weightClass === 'outOfBand') {
        addPenalty(clubId, 3, '重量偏差: トレンド外');
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
        addPenalty(clubId, 6, 'ライ角: 調整推奨');
      } else if (club.lieStatus === 'Slightly Off') {
        addPenalty(clubId, 3, 'ライ角: ややズレ');
      }
    }

    return penaltyMap;
  }, [clubs, swingWeightTarget, swingGoodTolerance, swingAdjustThreshold, userLieAngleStandards]);

  const clubPersonal = useMemo(() => 
    simClub ? resolvePersonalDataForSimClub(simClub, personalData) : undefined,
    [simClub, personalData]
  );
  const effectiveSuccess = useMemo(() => 
    simClub && seatType === 'personal'
      ? calculateDisplayClubSuccessRate(
          simClub,
          clubPersonal,
          personalSkillLevel,
          analysisPenaltyByClubId[simClub.id]?.points ?? 0,
        )
      : null,
    [simClub, seatType, clubPersonal, personalSkillLevel, analysisPenaltyByClubId]
  );

  const createSimulationContext = useMemo(() => (club: SimClub) => ({
    lie: gameLie,
    windDirectionDegrees: windDirection,
    // Range  UI input is m/s, but internal calculations use mph for compatibility.
    windStrength: windSpeedMph,
    remainingDistance: club.avgDistance,
    targetDistance: club.avgDistance,
    originX: 0,
    originY: 0,
    hazards: [],
    groundHardness: groundHardness === 'soft' ? 60 : groundHardness === 'firm' ? 90 : 75,
    groundSlopeAngle: slopeAngle,
    groundSlopeDirection: slopeDirection,
  }), [gameLie, windDirection, windSpeedMph, groundHardness, slopeAngle, slopeDirection]);

  const handleSimulate = async () => {
    if (!simClub) return;
    setIsSimulating(true);
    const shotResults: ShotResult[] = [];
    const baselineResults: ShotResult[] = [];
    const simulationSeedNonce = reuseLastSeed && lastSimulationSeedNonce
      ? lastSimulationSeedNonce
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setLastSimulationSeedNonce(simulationSeedNonce);
    for (let i = 0; i < numShots; i++) {
      const context = createSimulationContext(simClub);

      let clubForSim = simClub;
      let options: SimulationOptions;
      if (seatType === 'robot') {
        clubForSim = { ...simClub, successRate: 100 };
        options = {
          personalData: undefined, // 個人データは使わない
          playerSkillLevel: robotSkillLevel,
          headSpeed: robotHeadSpeed,
          aimXOffset,
          shotPowerPercent,
          shotIndex: i,
          seedNonce: simulationSeedNonce,
        };
      } else {
        const analysisPenaltyPoints = analysisPenaltyByClubId[simClub.id]?.points ?? 0;
        const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(
          simClub,
          analysisPenaltyPoints,
        );
        const treatedAsWeakClub = isWeakClubByAnalysisAdjustedRate(
          simClub,
          analysisPenaltyPoints,
        );
        clubForSim = {
          ...simClub,
          successRate: adjustedBaseSuccessRate,
          isWeakClub: treatedAsWeakClub,
        };
        options = {
          personalData: clubPersonal ?? undefined,
          playerSkillLevel: personalSkillLevel,
          useStoredDistance: true,
          aimXOffset,
          shotPowerPercent,
          shotIndex: i,
          seedNonce: simulationSeedNonce,
        };
      }
      const shotResult = simulateShot(clubForSim, context, options);
      const baselineResult = simulateShot(
        clubForSim,
        {
          ...context,
          groundSlopeAngle: 0,
          groundSlopeDirection: 0,
        },
        options,
      );
      shotResults.push(shotResult);
      baselineResults.push(baselineResult);
    }
    setResults(shotResults);
    setFlatBaselineResults(baselineResults);
    // 統計情報を集計する
    const distances = shotResults.map((r) => r.landing?.totalDistance ?? r.distanceHit);
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const std = Math.sqrt(
      distances.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / distances.length
    );
    const success = shotResults.filter((r) => r.wasSuccessful).length / numShots;

    const meanRoll = shotResults.reduce((sum, r) => sum + (r.landing?.roll ?? 0), 0) / Math.max(1, shotResults.length);
    const meanLateral = shotResults.reduce((sum, r) => sum + Math.abs(r.landing?.lateralDeviation ?? 0), 0) / Math.max(1, shotResults.length);
    const meanSlopeXShift = shotResults.reduce((sum, r, index) => {
      const slopeX = r.landing?.finalX ?? 0;
      const flatX = baselineResults[index]?.landing?.finalX ?? 0;
      return sum + (slopeX - flatX);
    }, 0) / Math.max(1, shotResults.length);

    const hardnessFactor = groundHardness === 'firm' ? 1.35 : groundHardness === 'soft' ? 0.65 : 1;
    const rollBaseline = meanRoll / hardnessFactor;
    const rollContribution = meanRoll - rollBaseline;
    const rollContributionLabel = groundHardness === 'medium'
      ? '地面硬さは標準です。'
      : `${rollContribution >= 0 ? '+' : ''}${rollContribution.toFixed(1)}yd（${formatGroundHardnessLabel(groundHardness)}の影響）`;

    const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
    const slopeDirectionLabel = formatSlopeDirectionLabel(normalizedSlope.slopeDirection);

    const slopeLabel = normalizedSlope.slopeAngle === 0
      ? 'フラット'
      : `${normalizedSlope.slopeAngle}° (${slopeDirectionLabel})`;
    const slopeEffectLabel = normalizedSlope.slopeAngle === 0
      ? 'フラットなので横ブレ影響は標準です。'
      : `傾斜 ${slopeLabel} により、フラット比の横方向シフトは ${meanSlopeXShift >= 0 ? '+' : ''}${meanSlopeXShift.toFixed(1)}y（${meanSlopeXShift >= 0 ? '右' : '左'}）です。`;

    // 目安値との差分を計算
    // すべてのモードで共通の推定飛距離を使う
    const estimatedDist = estimatedClubDistance;
    const diff = Math.round(avg - estimatedDist);
    const avgToTargetDistance =
      shotResults.reduce((sum, result) => {
        const finalX = result.landing?.finalX ?? 0;
        const finalY = result.landing?.finalY ?? (result.landing?.totalDistance ?? result.distanceHit ?? 0);
        const dx = finalX;
        const dy = finalY - estimatedDist;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / Math.max(1, shotResults.length);

    setSummary({
      avg,
      std,
      success,
      estimatedDist,
      diff,
      avgToTargetDistance,
      meanRoll,
      meanLateral,
      groundRollContribution: rollContributionLabel,
      groundLateralContribution: slopeEffectLabel,
      appliedGroundHardness: groundHardness,
    });
    setCalibrated(false);
    setIsSimulating(false);
  };


  // ...existing code...

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">シミュレーター設定</p>
              <h1 className="text-2xl font-bold text-slate-900">レンジシミュレーター</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                to="/personal-data"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                パーソナルデータへ
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ホームに戻る
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <main className="w-full lg:flex-[1_1_0] min-w-0 flex flex-col gap-4">
          <RangeClubSelectionPanel
            clubs={clubs}
            selectableClubs={selectableClubs}
            selectedClubId={selectedClubId}
            onSelectedClubIdChange={setSelectedClubId}
            selectedClub={selectedClub}
            simClub={simClub}
            estimatedClubDistance={estimatedClubDistance}
            seatType={seatType}
            clubPersonal={clubPersonal}
            effectiveSuccess={effectiveSuccess}
          />

          {seatType !== 'actual' && (
            <ShotControlPanel
              aimXOffset={aimXOffset}
              onAimXOffsetChange={(value) => setAimXOffset(clampAimXOffset(value))}
              shotPowerPercent={shotPowerPercent}
              onShotPowerPercentChange={setShotPowerPercent}
              onShot={handleSimulate}
              shotButtonLabel={isSimulating ? `シミュレーション中...` : `ショット実行（${numShots}回）`}
              buttonDisabled={!selectedClub || isSimulating}
              inputsDisabled={!selectedClub || isSimulating}
              showAim={showRangeAimControls}
              showPower={showRangeAimControls}
            />
          )}

          <RangeSimulationResults
            results={selectedResults}
            summary={selectedSummary}
            flatBaselineResults={flatBaselineResults}
            chartTarget={chartTarget}
            chartAim={chartAim}
            monteCarloResult={selectedMonteCarlo}
            clubName={selectedClub?.name ?? 'Club'}
            skillLevelName={displayedSkillLevelName}
            numShots={seatType === 'actual' ? selectedResults.length : numShots}
            groundHardness={groundHardness}
            slopeAngle={slopeAngle}
            slopeDirection={slopeDirection}
            seatType={seatType}
          />
        </main>

        <aside className="w-full lg:w-[340px] lg:flex-shrink-0 flex flex-col gap-4">
          <RangePlayerSettings
            seatType={seatType}
            robotHeadSpeed={robotHeadSpeed}
            robotSkillLevel={robotSkillLevel}
            personalSkillLevel={personalSkillLevel}
            onSeatTypeChange={setSeatType}
            onRobotHeadSpeedChange={setRobotHeadSpeed}
            onRobotSkillLevelChange={setRobotSkillLevel}
          />

          {seatType !== 'robot' && (
            <div className="w-full bg-white rounded shadow p-4 range-use-bag-panel">
              <GolfBagPanel
                bags={bags}
                activeBagId={activeBag?.id ?? null}
                activeBagClubCount={activeBag?.clubIds.length ?? 0}
                onSelectBag={(bagId) => void setActiveBag(bagId)}
                showManagement={false}
                showImage={false}
                compact
              />
            </div>
          )}

          {seatType !== 'actual' && (
            <RangeSimulationControls
              numShots={numShots}
              reuseLastSeed={reuseLastSeed}
              onNumShotsChange={setNumShots}
              onReuseLastSeedChange={setReuseLastSeed}
            />
          )}

          {seatType !== 'actual' && (
            <RangeCourseConditions
              lie={lie}
              windDirection={windDirection}
              windSpeed={windSpeed}
              groundHardness={groundHardness}
              slopeAngle={slopeAngle}
              slopeDirection={slopeDirection}
              isWindControlOpen={isWindControlOpen}
              isCourseConditionOpen={isCourseConditionOpen}
              onLieChange={setLie}
              onWindDirectionChange={setWindDirection}
              onWindSpeedChange={setWindSpeed}
              onGroundHardnessChange={setGroundHardness}
              onSlopeAngleChange={setSlopeAngle}
              onSlopeDirectionChange={setSlopeDirection}
              onWindControlToggle={() => setIsWindControlOpen((prev) => !prev)}
              onCourseConditionToggle={() => setIsCourseConditionOpen((prev) => !prev)}
              onWindReset={handleResetWind}
            />
          )}
        </aside>
      </div>
    </div>
    </div>
    </div>
  );
}
