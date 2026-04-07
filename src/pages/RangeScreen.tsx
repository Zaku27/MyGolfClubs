import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GolfBagPanel } from '../components/GolfBagPanel';

// ショット品質の英語ラベル関数
function qualityLabel(q: string) {
  switch (q) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "average": return "Average";
    case "poor": return "Poor";
    case "mishit": return "Mishit";
    default: return q;
  }
}
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  selectSortedClubsForDisplay,
  useClubStore,
} from '../store/clubStore';
import { useBagIdUrlSync } from '../hooks/useBagIdUrlSync';
import { formatGolfClubDisplayName } from '../utils/simClubLabel';
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
import ShotDispersionChart from '../components/ShotDispersionChart';
import WindDirectionDial from '../components/WindDirectionDial';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';
import type { LieType, ShotResult } from '../types/game';
import type { GolfClub } from '../types/golf';
import {
  convertMpsToMph,
  formatWindDirectionLabel,
  normalizeWindDirection,
  normalizeWindSpeedMps,
} from '../utils/windDirection';

const LIE_OPTIONS = [
  'ティー',
  'フェアウェイ',
  'セミラフ',
  'ラフ',
  'ベアグラウンド',
  'バンカー',
];

const SLOPE_DIRECTION_PRESETS = [
  { label: '前', value: 0 },
  { label: '右', value: 90 },
  { label: '後', value: 180 },
  { label: '左', value: 270 },
];

function getLiePenaltyInfo(lie: string, clubType: string): string {
  switch (lie) {
    case 'ティー':
      return '標準的なライです。飛距離の影響はほとんどありません。';
    case 'フェアウェイ':
      return 'ほぼ通常のライです。飛距離はほとんど落ちません。';
    case 'セミラフ':
      return '飛距離は約10%減少し、方向の安定性もやや低下します。';
    case 'ラフ':
      return '飛距離は約18%減少し、ショットが不安定になります。';
    case 'ベアグラウンド':
      return '飛距離は約40%減少し、非常に打ちにくいライです。';
    case 'バンカー':
      return clubType === 'Wedge'
        ? 'ウェッジでは飛距離約30%減、その他番手では約50%減。砂では方向も乱れやすいです。'
        : '飛距離は約50%減。砂地では方向も不安定になります。';
    case 'グリーン':
      return 'パター用のライです。飛距離補正はパット動作によります。';
    default:
      return '選択したライのペナルティ情報はありません。';
  }
}

const SHOT_COUNTS = [5, 10, 20, 40];

function clampAimXOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-50, Math.min(50, Math.round(value)));
}

const RANGE_CONDITION_SETTINGS_KEY = 'rangeConditionSettings';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;

type GroundHardness = "soft" | "medium" | "firm";

type RangeConditionSettings = {
  lie: string;
  windDirection: number;
  windSpeed: number;
  groundHardness: GroundHardness;
  slopeAngle: number;
  slopeDirection: number;
};

type AnalysisPenalty = {
  points: number;
  reasons: string[];
};

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
    const slopeDirection = Number(parsed.slopeDirection);

    return {
      lie: safeLie,
      windDirection: normalizeWindDirection(Number(parsed.windDirection)),
      windSpeed: normalizeWindSpeedMps(Number(parsed.windSpeed)),
      groundHardness: safeGroundHardness,
      slopeAngle: Number(parsed.slopeAngle) || 0,
      slopeDirection: Number.isFinite(slopeDirection) ? normalizeWindDirection(slopeDirection) : 0,
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
  localStorage.setItem(
    RANGE_CONDITION_SETTINGS_KEY,
    JSON.stringify({
      lie: settings.lie,
      windDirection: normalizeWindDirection(settings.windDirection),
      windSpeed: normalizeWindSpeedMps(settings.windSpeed),
      groundHardness: settings.groundHardness,
      slopeAngle: settings.slopeAngle,
      slopeDirection: normalizeWindDirection(settings.slopeDirection),
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

const qualityStatusColor = (shotQuality: string) => {
  if (shotQuality === 'excellent') return 'text-blue-700';
  if (shotQuality === 'good') return 'text-green-700';
  if (shotQuality === 'average') return 'text-amber-600';
  if (shotQuality === 'poor') return 'text-pink-600';
  if (shotQuality === 'mishit') return 'text-red-600';
  return 'text-gray-700';
};

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

function formatGroundHardnessImpact(groundHardness: GroundHardness, roll: number | undefined): string {
  if (roll == null || !Number.isFinite(roll)) return '-';

  const hardnessValue = groundHardness === 'firm' ? 90 : groundHardness === 'soft' ? 60 : 75;
  const currentFactor = 0.8 + (hardnessValue / 100) * 0.4;
  const mediumFactor = 0.8 + (75 / 100) * 0.4;
  const baseline = roll * (mediumFactor / currentFactor);
  const delta = roll - baseline;
  const deltaLabel = delta === 0 ? '0.0y' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}y`;

  return `ラン ${deltaLabel}`;
}

function normalizeSlopeForDisplay(slopeAngle: number, slopeDirection: number): { slopeAngle: number; slopeDirection: number } {
  const normalizedDirection = normalizeWindDirection(slopeDirection);
  if (slopeAngle < 0) {
    return {
      slopeAngle: Math.abs(slopeAngle),
      slopeDirection: normalizeWindDirection(normalizedDirection + 180),
    };
  }

  return {
    slopeAngle,
    slopeDirection: normalizedDirection,
  };
}

function toStoredSlopeDirection(slopeAngle: number, displayedDirection: number): number {
  return slopeAngle < 0
    ? normalizeWindDirection(displayedDirection - 180)
    : normalizeWindDirection(displayedDirection);
}

function formatSlopeDirectionLabel(direction: number): string {
  if (direction === 0) return 'ピン方向 uphill';
  if (direction === 90) return '右側 uphill';
  if (direction === 180) return 'ピン反対方向 uphill';
  if (direction === 270) return '左側 uphill';
  if (direction > 0 && direction < 90) return '右前 uphill';
  if (direction > 90 && direction < 180) return '右後 uphill';
  if (direction > 180 && direction < 270) return '左後 uphill';
  return '左前 uphill';
}

function formatSlopeEffectGuide(slopeAngle: number, slopeDirection: number): string {
  const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
  if (normalizedSlope.slopeAngle === 0) {
    return 'フラット: キャリー・ラン・横ブレの傾斜補正は入りません。';
  }

  const direction = normalizedSlope.slopeDirection;
  const directionLabel = formatSlopeDirectionLabel(direction);
  let effect = '前後と左右の補正が混在します。';

  if (direction === 0) effect = 'ピン方向が上りになり、キャリーとランは減りやすくなります。';
  else if (direction === 180) effect = 'ピン方向が下りになり、キャリーとランは伸びやすくなります。';
  else if (direction === 90) effect = '右側が上りになり、左へ流れやすくなります。';
  else if (direction === 270) effect = '左側が上りになり、右へ流れやすくなります。';
  else if (direction > 0 && direction < 90) effect = '右前上りで、キャリーとランが減りつつ左へ流れやすくなります。';
  else if (direction > 90 && direction < 180) effect = '右後上りで、キャリーとランが伸びつつ左へ流れやすくなります。';
  else if (direction > 180 && direction < 270) effect = '左後上りで、キャリーとランが伸びつつ右へ流れやすくなります。';
  else if (direction > 270 && direction < 360) effect = '左前上りで、キャリーとランが減りつつ右へ流れやすくなります。';

  return `${normalizedSlope.slopeAngle}° / ${directionLabel}: ${effect}`;
}

function formatSlopeImpact(
  landing: ShotResult['landing'] | undefined,
  baselineLanding: ShotResult['landing'] | undefined,
): string {
  if (!landing || !baselineLanding) return '-';

  const carryDiff = (landing.carry ?? 0) - (baselineLanding.carry ?? 0);
  const rollDiff = (landing.roll ?? 0) - (baselineLanding.roll ?? 0);
  const lateralDiff = (landing.lateralDeviation ?? 0) - (baselineLanding.lateralDeviation ?? 0);
  const fmt = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}y`;

  return `C ${fmt(carryDiff)} / R ${fmt(rollDiff)} / X ${fmt(lateralDiff)}`;
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
  seatType: 'robot' | 'personal',
): GolfClub[] {
  const filtered = clubs.filter((club) => seatType === 'robot' || club.clubType !== 'Putter');

  return [...filtered].sort((a, b) => {
    if (seatType === 'robot') {
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
  const initializeDefaults = useClubStore((state) => state.initializeDefaults);
  const loadClubs = useClubStore((state) => state.loadClubs);
  const loadBags = useClubStore((state) => state.loadBags);
  const loadPersonalData = useClubStore((state) => state.loadPersonalData);
  const loadPlayerSkillLevel = useClubStore((state) => state.loadPlayerSkillLevel);
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
  const [numShots, setNumShots] = useState<number>(10);
  const [aimXOffset, setAimXOffset] = useState<number>(0);
  const [results, setResults] = useState<ShotResult[]>([]);
  const [flatBaselineResults, setFlatBaselineResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [reuseLastSeed, setReuseLastSeed] = useState(false);
  const [lastSimulationSeedNonce, setLastSimulationSeedNonce] = useState<string | null>(null);
  const [showRobotHint, setShowRobotHint] = useState(false);
  const robotHintRef = useRef<HTMLDivElement | null>(null);
  const monteCarloResult = buildMonteCarloResult(results);
  const chartTarget = { x: 0, y: summary?.estimatedDist ?? 0 };
  const chartAim = { x: aimXOffset, y: summary?.estimatedDist ?? 0 };
  const personalSkillLevel = storedPlayerSkillLevel;
  const personalSkillLevelLabel = getSkillLabel(personalSkillLevel);
  const displayedSkillLevel = seatType === 'robot' ? robotSkillLevel : personalSkillLevel;
  const displayedSkillLabel = getSkillLabel(displayedSkillLevel);
  const skillLevelName = `適用スキルレベル ${(displayedSkillLevel * 100).toFixed(0)}% (${displayedSkillLabel})`;
  const clubs = seatType === 'personal' ? activeBagClubs : allClubs;
  const selectableClubs = getSelectableRangeClubs(clubs, seatType);
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
  const gameLie = mapLieUiToGameLie(lie);
  // 既存シミュレーションは mph 前提なので、UI(m/s)から変換して渡す。
  const windSpeedMph = convertMpsToMph(windSpeed);
  // 閉じた状態でも現在値が分かるよう、角度+方位ラベルを作って表示する。
  const windDirectionSummary = formatWindDirectionLabel(windDirection);

  // 風向・風速を初期状態へ戻す。
  const handleResetWind = () => {
    setWindDirection(0);
    setWindSpeed(0);
  };

  useEffect(() => {
    const initializeScreen = async () => {
      await initializeDefaults();
      await Promise.all([
        loadClubs(),
        loadBags(),
        loadPersonalData(),
        loadPlayerSkillLevel(),
      ]);
    };

    void initializeScreen();
  }, [initializeDefaults, loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel]);

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
    });
  }, [seatType, robotHeadSpeed, robotSkillLevel]);

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

  useEffect(() => {
    if (!showRobotHint) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (robotHintRef.current && !robotHintRef.current.contains(targetNode)) {
        setShowRobotHint(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showRobotHint]);

  // avgDistanceが無い場合はdistanceをavgDistanceとして使う
  let selectedClub = clubs.find((c) => String(c.id) === String(selectedClubId));
  const simClub = selectedClub ? toSimClub(selectedClub) : undefined;
  const estimatedClubDistance = simClub
    ? estimateBaseDistance(
        simClub,
        seatType === 'robot' ? robotHeadSpeed : undefined,
        undefined,
        true,
      )
    : 0;
  const analysisPenaltyByClubId = (() => {
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
  })();

  const clubPersonal: import('../types/golf').ClubPersonalData | undefined =
    simClub ? resolvePersonalDataForSimClub(simClub, personalData) : undefined;
  const effectiveSuccess =
    simClub && seatType === 'personal'
      ? calculateDisplayClubSuccessRate(
          simClub,
          clubPersonal,
          personalSkillLevel,
          analysisPenaltyByClubId[simClub.id]?.points ?? 0,
        )
      : null;

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
      const context = {
        lie: gameLie,
        windDirectionDegrees: windDirection,
        // Range 画面の入力は m/s だが、内部計算は互換のため mph を利用する。
        windStrength: windSpeedMph,
        remainingDistance: simClub.avgDistance,
        targetDistance: simClub.avgDistance,
        originX: 0,
        originY: 0,
        hazards: [],
        shotPowerPercent: 100,
        groundHardness: groundHardness === 'soft' ? 60 : groundHardness === 'firm' ? 90 : 75,
        groundSlopeAngle: slopeAngle,
        groundSlopeDirection: slopeDirection,
      };

      // ロボット打席の場合はクラブ成功率100%、スキル・ヘッドスピードをロボット値で渡す
      let clubForSim = simClub;
      let options;
      if (seatType === 'robot') {
        clubForSim = { ...simClub, successRate: 100 };
        options = {
          personalData: undefined, // 個人データは使わない
          playerSkillLevel: robotSkillLevel,
          headSpeed: robotHeadSpeed,
          aimXOffset,
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
    const meanFinalX = shotResults.reduce((sum, r) => sum + (r.landing?.finalX ?? 0), 0) / Math.max(1, shotResults.length);

    const hardnessFactor = groundHardness === 'firm' ? 1.35 : groundHardness === 'soft' ? 0.65 : 1;
    const rollBaseline = meanRoll / hardnessFactor;
    const rollContribution = meanRoll - rollBaseline;
    const rollContributionLabel = groundHardness === 'medium'
      ? '地面硬さは標準です。'
      : `${rollContribution >= 0 ? '+' : ''}${rollContribution.toFixed(1)}yd（${groundHardness}の影響）`;

    const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
    const slopeDirectionLabel = formatSlopeDirectionLabel(normalizedSlope.slopeDirection);

    const slopeLabel = normalizedSlope.slopeAngle === 0
      ? 'フラット'
      : `${normalizedSlope.slopeAngle}° (${slopeDirectionLabel})`;
    const slopeEffectLabel = normalizedSlope.slopeAngle === 0
      ? 'フラットなので横ブレ影響は標準です。'
      : `傾斜 ${slopeLabel} のため横ブレ平均は ${meanLateral.toFixed(1)}y、${meanFinalX >= 0 ? '右' : '左'}方向へやや影響しています。`;

    // 目安値との差分を計算
    // プレイヤーがpersonalの場合は実測飛距離を目安値とする
    const estimatedDist = seatType === 'personal'
      ? (selectedClub?.distance ?? 0)
      : estimatedClubDistance;
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
    <div className="min-h-screen bg-green-50 flex flex-col items-center py-4 px-2">
      {/* Header */}
      <div className="w-full max-w-7xl flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-green-900">レンジシミュレーター</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/personal-data"
            className="inline-flex items-center justify-center rounded bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-emerald-200"
          >
            パーソナルデータへ
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded bg-white px-3 py-2 text-sm font-semibold text-green-900 shadow border border-green-200 hover:bg-green-50"
          >
            クラブ管理に戻る
          </Link>
        </div>
      </div>

      <div className="w-full max-w-7xl flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="w-full lg:flex-1 flex flex-col gap-4">
          <div className="w-full bg-white rounded shadow p-4">
            <label className="block font-semibold mb-2">クラブ選択</label>
            {clubs.length === 0 ? (
              <div className="text-red-600 font-bold py-2">クラブが登録されていません。<br/>クラブ管理画面でクラブを追加してください。</div>
            ) : (
              <>
                <select
                  className="w-full border rounded p-2 mb-2"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                >
                  <option value="">-- クラブを選択 --</option>
                  {selectableClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {formatGolfClubDisplayName(club)}
                    </option>
                  ))}
                </select>
                {selectedClub && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-green-900 text-sm">
                    <span className="font-bold">{selectedClub.name}</span>
                    <span>
                      {seatType === 'personal'
                        ? `実測飛距離: ${selectedClub?.distance ?? '-'} y`
                        : `推定飛距離: ${simClub ? estimatedClubDistance : '-'} y`}
                    </span>
                    <div ref={robotHintRef} className="relative">
                      <span className="inline-flex items-center gap-2">
                        <span>
                          クラブ成功率: {
                            simClub ? (
                              seatType === 'robot'
                                ? '100% (ロボット固定)'
                                : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? effectiveSuccess.toFixed(1) : '--') + '%'
                            ) : '--'
                          }
                        </span>
                        {seatType === 'robot' && (
                          <button
                            type="button"
                            aria-label="ロボット打席のクラブ成功率ヒント"
                            aria-expanded={showRobotHint}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-xs font-bold text-blue-700"
                            onClick={() => setShowRobotHint((prev) => !prev)}
                          >
                            ?
                          </button>
                        )}
                      </span>
                      {seatType === 'robot' && showRobotHint && (
                        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-blue-300 bg-white p-2 text-xs leading-relaxed text-blue-900 shadow-lg">
                          ロボット打席はクラブの個体差や個人データの影響を受けないため、クラブ成功率は常に100%で固定されます。
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
            <button
              className={`w-full md:flex-1 py-3 rounded text-lg font-bold shadow transition ${selectedClub ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-green-100 text-green-400 cursor-not-allowed'}`}
              disabled={!selectedClub || isSimulating}
              onClick={handleSimulate}
            >
              {isSimulating ? 'シミュレーション中...' : `ショット実行（${numShots}回）`}
            </button>

            <div className="w-full md:w-1/2 rounded border border-green-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-semibold">狙い（左右）</span>
                <span className="text-xs text-gray-600">目標は中央(0y)、左右 X 軸で -50〜50y を指定できます。</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="aim-x-offset"
                  type="range"
                  min={-50}
                  max={50}
                  step={1}
                  value={aimXOffset}
                  onChange={(e) => setAimXOffset(clampAimXOffset(Number(e.target.value)))}
                  className="w-full accent-green-700"
                />
                <input
                  type="number"
                  min={-50}
                  max={50}
                  step={1}
                  value={aimXOffset}
                  onChange={(e) => setAimXOffset(clampAimXOffset(Number(e.target.value)))}
                  className="w-20 border rounded p-1 text-right"
                />
                <span className="text-sm font-semibold text-green-900">y</span>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {results.length > 0 && summary && (
            <div className="w-full bg-white rounded shadow p-4 mb-4">
              <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-bold text-green-900">セッション結果：</span>
                <span>平均: {summary.avg.toFixed(1)} y</span>
                <span>成功率: {(summary.success * 100).toFixed(1)}%</span>
                <span>目標まで平均距離: {(summary.avgToTargetDistance ?? 0).toFixed(1)} y</span>
              </div>
              <div className="mb-4 rounded border border-green-200 bg-green-50/40 p-2">
                <ShotDispersionChart
                  monteCarloResult={monteCarloResult}
                  target={chartTarget}
                  aim={chartAim}
                  clubName={selectedClub?.name ?? 'Club'}
                  skillLevelName={skillLevelName}
                  numShots={numShots}
                  groundHardness={groundHardness}
                  slopeAngle={slopeAngle}
                />
              </div>
              {summary.estimatedDist && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <span className="font-semibold">目安との比較：</span>
                  <span>目安: {summary.estimatedDist} y / 実績平均: {summary.avg.toFixed(1)} y</span>
                  <span className={summary.diff > 0 ? 'text-red-600 font-bold' : summary.diff < 0 ? 'text-blue-600 font-bold' : ''}>
                    {summary.diff > 0 ? ` (+${summary.diff}y)` : summary.diff < 0 ? ` (${summary.diff}y)` : ' (一致)'}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="px-1 py-0.5">#</th>
                      <th className="px-1 py-0.5">飛距離</th>
                      <th className="px-1 py-0.5">キャリー</th>
                      <th className="px-1 py-0.5">ラン</th>
                      <th className="px-1 py-0.5">横ブレ</th>
                      <th className="px-1 py-0.5">地面影響</th>
                      <th className="px-1 py-0.5">傾斜影響</th>
                      {/* <th className="px-1 py-0.5">判定値</th>
                      <th className="px-1 py-0.5">判定内訳(C/L)</th> */}
                      <th className="px-1 py-0.5">着地X</th>
                      <th className="px-1 py-0.5">着地Y</th>
                      <th className="px-1 py-0.5">ショット品質</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-1 py-0.5 text-center">{i + 1}</td>
                        <td className="px-1 py-0.5 text-center">{(r.landing?.totalDistance ?? r.distanceHit).toFixed(1)}</td>
                        <td className="px-1 py-0.5 text-center">{r.landing?.carry?.toFixed(1) ?? '-'}</td>
                        <td className="px-1 py-0.5 text-center">{r.landing?.roll?.toFixed(1) ?? '-'}</td>
                        <td className="px-1 py-0.5 text-center">{r.landing?.lateralDeviation?.toFixed(1) ?? '-'}</td>
                        <td className="px-1 py-0.5 text-center">{formatGroundHardnessImpact(summary.appliedGroundHardness, r.landing?.roll)}</td>
                        <td className="px-1 py-0.5 text-center">
                          {formatSlopeImpact(r.landing, flatBaselineResults[i]?.landing)}
                        </td>
                        {/* <td className={`px-1 py-0.5 text-center ${r.landing?.qualityMetrics && r.landing.qualityMetrics.score >= r.landing.qualityMetrics.poorThreshold ? 'text-red-600 font-bold' : ''}`}>
                          {r.landing?.qualityMetrics ? `${r.landing.qualityMetrics.score.toFixed(2)} / ${r.landing.qualityMetrics.poorThreshold.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-1 py-0.5 text-center">
                          {r.landing?.qualityMetrics ? (
                            <>
                              <span className={r.landing.qualityMetrics.decisiveAxis === 'carry' ? 'text-red-600 font-bold' : ''}>
                                {r.landing.qualityMetrics.weightedCarry.toFixed(2)}
                              </span>
                              {' / '}
                              <span className={r.landing.qualityMetrics.decisiveAxis === 'lateral' ? 'text-red-600 font-bold' : ''}>
                                {r.landing.qualityMetrics.weightedLateral.toFixed(2)}
                              </span>
                            </>
                          ) : '-'}
                        </td> */}
                        <td className="px-1 py-0.5 text-center">{r.landing?.finalX?.toFixed(1) ?? '-'}</td>
                        <td className="px-1 py-0.5 text-center">{r.landing?.finalY?.toFixed(1) ?? '-'}</td>
                        <td className={`px-1 py-0.5 text-center font-bold ${qualityStatusColor(r.shotQuality)}`}>{qualityLabel(r.shotQuality)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        <aside className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-4">
          <div className="w-full bg-white rounded shadow p-4">
            <label className="block font-semibold mb-2">プレイヤー選択</label>
            <select
              className="w-full border rounded p-2 mb-2"
              value={seatType}
              onChange={e => setSeatType(e.target.value as RangeSeatType)}
            >
              <option value="personal">ユーザー</option>
              <option value="robot">ロボット</option>
            </select>

            {seatType === 'robot' && (
              <div className="flex flex-col gap-2 mt-2 bg-blue-50 rounded p-3 border border-blue-300">
                <div>
                  <label className="block font-semibold mb-1">ヘッドスピード (m/s)</label>
                  <input
                    type="number"
                    min={20}
                    max={60}
                    step={0.1}
                    value={robotHeadSpeed}
                    onChange={e => setRobotHeadSpeed(Number(e.target.value))}
                    className="w-32 border rounded p-1 mr-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">スキルレベル</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={robotSkillLevel}
                    onChange={e => setRobotSkillLevel(Number(e.target.value))}
                    className="w-40 accent-green-700"
                  />
                  <span className="ml-2">{(robotSkillLevel * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {seatType === 'personal' && (
              <div className="flex flex-col gap-2 mt-2 bg-green-50 rounded p-3 border border-green-200 text-sm text-green-900">
                <span className="text-xs text-green-700">
                  レンジではパーソナルデータ画面で保存したスキルレベルが適用されます。
                </span>
                <div className="rounded border border-green-200 bg-white/80 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      <span className="font-semibold">適用スキルレベル:</span>{' '}
                      {(personalSkillLevel * 100).toFixed(0)}% ({personalSkillLevelLabel})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

            {seatType === 'personal' && (
            <div className="w-full bg-white rounded shadow p-4">
              <GolfBagPanel
                bags={bags}
                activeBagId={activeBag?.id ?? null}
                activeBagClubCount={activeBag?.clubIds.length ?? 0}
                onSelectBag={(bagId) => void setActiveBag(bagId)}
                showManagement={false}
                compact
                title="練習するバッグ"
                description="個人データではバッグ内クラブを使用します。ロボットでは全クラブを使用します。"
              />
            </div>
          )}

          <div className="w-full bg-white rounded shadow p-4">
              <label className="block font-semibold mb-2">試行設定</label>
              <div className="space-y-4">
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <label className="block font-semibold mb-1">試行回数</label>
                  <div className="flex gap-2 flex-wrap">
                    {SHOT_COUNTS.map((n) => (
                      <button
                        key={n}
                        className={`px-3 py-1 rounded border ${numShots === n ? 'bg-green-200 border-green-600' : 'bg-white border-green-200'} font-semibold`}
                        onClick={() => setNumShots(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label htmlFor="reuse-last-seed" className="block font-semibold text-green-900">
                        再実行時の乱数
                      </label>
                      <p className="text-xs text-gray-600">
                        {reuseLastSeed
                          ? '前回と同じ乱数で再実行します。条件が同じなら結果も再現されます。'
                          : '毎回新しい乱数で再実行します。'}
                      </p>
                    </div>
                    <label htmlFor="reuse-last-seed" className="inline-flex cursor-pointer items-center gap-2">
                      <span className={`text-sm font-medium ${reuseLastSeed ? 'text-green-900' : 'text-gray-500'}`}>
                        同じ乱数
                      </span>
                      <span className="relative inline-flex items-center">
                        <input
                          id="reuse-last-seed"
                          type="checkbox"
                          className="peer sr-only"
                          checked={reuseLastSeed}
                          onChange={(e) => setReuseLastSeed(e.target.checked)}
                        />
                        <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-green-600" />
                        <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                      </span>
                      <span className={`text-sm font-medium ${reuseLastSeed ? 'text-gray-500' : 'text-green-900'}`}>
                        新しい乱数
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

          <div className="w-full bg-white rounded shadow p-4 flex flex-col gap-3">
            <div>
              <label className="block text-lg font-semibold mb-2">コースコンディション</label>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <label className="block font-semibold mb-1 text-green-900">ライ</label>
              <select
                className="w-full border rounded p-2"
                value={lie}
                onChange={(e) => setLie(e.target.value)}
              >
                {LIE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-green-900">
                ライペナルティ: {getLiePenaltyInfo(lie, simClub?.type ?? 'Iron')}
              </p>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="font-semibold">風向・風速</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    onClick={handleResetWind}
                  >
                    風をリセット
                  </button>
                  <button
                    type="button"
                    className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
                    onClick={() => setIsWindControlOpen((prev) => !prev)}
                    aria-expanded={isWindControlOpen}
                    aria-controls="wind-direction-dial-panel"
                  >
                    {isWindControlOpen ? '設定を閉じる' : '設定を開く'}
                  </button>
                </div>
              </div>
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                <span className="mr-3 font-semibold">風向: {windDirectionSummary}</span>
                <span className="font-semibold">風速: {windSpeed.toFixed(1)} m/s</span>
              </div>
              {isWindControlOpen && (
                <div id="wind-direction-dial-panel" className="mt-2">
                  <WindDirectionDial
                    windDirection={windDirection}
                    windSpeed={windSpeed}
                    onDirectionChange={(newDirection) => setWindDirection(normalizeWindDirection(newDirection))}
                    onSpeedChange={(newSpeed) => setWindSpeed(normalizeWindSpeedMps(newSpeed))}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 rounded border border-green-200 bg-green-50 p-3">
              <div className="mb-2">
                <label className="font-semibold">地面条件</label>
              </div>
              <div className="grid gap-3">
                <label className="space-y-1 text-xs font-semibold text-emerald-800">
                  地面硬さ
                  <select
                    value={groundHardness}
                    onChange={(event) => setGroundHardness(event.target.value as GroundHardness)}
                    className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                  >
                    <option value="soft">Soft</option>
                    <option value="medium">Medium</option>
                    <option value="firm">Firm</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-emerald-800">
                    傾斜角度
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      step={1}
                      value={slopeAngle}
                      onChange={(event) => setSlopeAngle(Number(event.target.value))}
                      className="w-full cursor-pointer"
                    />
                    <div className="text-right text-[11px] text-emerald-700">
                      {slopeAngle === 0 ? 'フラット' : `傾斜量 ${Math.abs(slopeAngle)}°`}
                    </div>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-emerald-800">
                    uphill方向
                    <input
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={slopeDirection}
                      onChange={(event) => setSlopeDirection(normalizeWindDirection(Number(event.target.value)))}
                      className="w-full cursor-pointer"
                    />
                    <div className="text-right text-[11px] text-emerald-700">
                      {normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection}°
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {SLOPE_DIRECTION_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setSlopeDirection(toStoredSlopeDirection(slopeAngle, preset.value))}
                          className={[
                            'min-w-10 rounded border px-2 py-1 text-[11px] font-bold transition',
                            normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection === preset.value
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-emerald-800">
                {formatSlopeEffectGuide(slopeAngle, slopeDirection)}
              </p>
            </div>
          </div>
        </aside>
      </div>
      {/* オートキャリブレーション（個人データ更新）削除済み */}
    </div>
  );
}

// --- Route Integration ---
// Add to your router:
// import RangeScreen from './pages/RangeScreen';
// <Route path="/range" element={<RangeScreen />} />
