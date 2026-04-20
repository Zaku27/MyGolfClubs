import type { GolfClub, GolfClubData } from '../types/golf';
import type { Adjustment } from '../types/summary';
import {
  lieStatusFromDeviation,
} from '../types/lieStandards';
import { getAnalysisClubKey, getClubTypeDisplay } from './clubUtils';
import {
  CATEGORY_VISUAL_CONFIG,
  CLUB_TYPE_CATEGORY_MAP,
  DISTANCE_GAP_COEFFICIENT_AT_30,
  DISTANCE_GAP_COEFFICIENT_AT_45,
  DISTANCE_GAP_NARROW_THRESHOLD,
  DISTANCE_GAP_WIDE_THRESHOLD,
  DISTANCE_MODELS,
  SWING_STATUS_COLOR_MAP,
  WEIGHT_NORMAL_BAND_TOLERANCE,
  DEFAULT_HEAD_SPEED,
  DRIVER_TO_WOOD_IDEAL_MIN,
  DRIVER_TO_WOOD_IDEAL_MAX,
  DRIVER_TO_WOOD_MAX_ACCEPTABLE,
  WOOD_TO_HYBRID_IDEAL_MIN,
  WOOD_TO_HYBRID_IDEAL_MAX,
  WOOD_TO_HYBRID_TOLERANCE,
  IRON_GAP_IDEAL_MIN,
  IRON_GAP_IDEAL_MAX,
  IRON_GAP_TOLERANCE,
  WEDGE_GAP_IDEAL_MIN,
  WEDGE_GAP_IDEAL_MAX,
  WEDGE_GAP_TOLERANCE,
  type ClubCategory,
  type SwingStatus,
} from './analysisConstants';
import {
  classifySwingDeviation,
  classifyWeightDeviation,
} from './analysisRules';
import {
  normalizeSwingWeightText,
  numericToSwingWeightLabel,
  parseSwingWeightInput,
  swingWeightToNumeric,
} from './swingWeight';
import {
  clamp,
  createLieChartMappers,
  createLoftChartMappers,
  createSwingChartMappers,
  createWeightChartMappers,
  getTooltipPosition,
} from './analysisGeometry';

export type { ClubCategory, SwingStatus };

export type WeightRegression = {
  slope: number;
  intercept: number;
};

export type LoftDistancePoint = GolfClub & {
  category: GolfClubData['category'];
  estimatedDistance: number;
  actualDistance: number;
};

export type WeightLengthPoint = GolfClubData & {
  expectedWeight: number;
  deviation: number;
  weightTrendMessage: string;
};

type WeightChartBounds = {
  minLength: number;
  maxLength: number;
  minWeight: number;
  maxWeight: number;
  xInterval: number;
  yInterval: number;
};

export type SwingWeightPoint = GolfClubData & {
  swingWeightNumeric: number;
  swingDeviation: number;
  swingStatus: SwingStatus;
};

export type LieAnglePoint = GolfClubData & {
  standardLieAngle: number;
  deviationFromStandard: number;
  lieStatus: ReturnType<typeof lieStatusFromDeviation>;
};

export type LieLengthPoint = GolfClubData & {
  expectedLieAngle: number;
  deviationFromTrend: number;
  lieTrendMessage: string;
};

export type LoftLengthPoint = GolfClubData & {
  expectedLoft: number;
  deviationFromStandard: number;
  recommendedLoftAdjustment: number;
  projectedDistanceGap: number | null;
  projectedGapTargetClubType: GolfClub['clubType'] | null;
  projectedGapTargetNumber: string | null;
  projectedSwingWeightImpact: number;
};

export type SwingLengthPoint = GolfClubData & {
  swingWeightNumeric: number;
  expectedSwingWeight: number;
  deviationFromTrend: number;
  trendStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
};

type LieLengthChartBounds = {
  minLength: number;
  maxLength: number;
  minLieAngle: number;
  maxLieAngle: number;
  xInterval: number;
  yInterval: number;
};

export {
  clamp,
  createLieChartMappers,
  createLoftChartMappers,
  createSwingChartMappers,
  createWeightChartMappers,
  getTooltipPosition,
  normalizeSwingWeightText,
  numericToSwingWeightLabel,
  parseSwingWeightInput,
  swingWeightToNumeric,
};

const inferCategoryFromClubTypeCode = (normalizedClubType: string): ClubCategory => {
  if (normalizedClubType.endsWith('W')) return 'wood';
  if (normalizedClubType.endsWith('H')) return 'hybrid';
  if (normalizedClubType.endsWith('I')) return 'iron';
  return 'wedge';
};

export const getLieBarColor = (category: ClubCategory): string => {
  return CATEGORY_VISUAL_CONFIG[category].lieBarColor;
};

export const getClubCategoryByType = (clubType: string): ClubCategory => {
  const normalizedClubType = (clubType ?? '').trim().toUpperCase();
  const mappedCategory = CLUB_TYPE_CATEGORY_MAP[normalizedClubType];
  if (mappedCategory) return mappedCategory;
  return inferCategoryFromClubTypeCode(normalizedClubType);
};

export const getClubCategory = (club: GolfClub): ClubCategory =>
  getClubCategoryByType(club.clubType ?? '');

// ═══════════════════════════════════════════════════════════════════════════════
// 定数・設定値
// ═══════════════════════════════════════════════════════════════════════════════

/** 低ロフトペナルティ関連定数 */
const LOW_LOFT_PENALTY_LIMIT = 18;
const LOW_LOFT_PENALTY_REFERENCE = 10.5;
const LOW_LOFT_MAX_PENALTY = 20;
const LOW_LOFT_SPEED_RELIEF = 0.14;
const LOW_LOFT_SPEED_RELIEF_THRESHOLD = 30;

/** ドライバーブースト関連定数 */
const DRIVER_BOOST_RAMP_START = 43;
const DRIVER_BOOST_RAMP_END = 45;
const DRIVER_BOOST_AT_45 = 10.5;
const DRIVER_BOOST_ABOVE_45_PER_SPEED = 4;

/** 重さ回帰分析定数 */
const WEIGHT_REGRESSION_FALLBACK_SLOPE = -8;
const WEIGHT_REGRESSION_FALLBACK_INTERCEPT = 620;
const WEIGHT_REGRESSION_MIN_SLOPE = -1;
const WEIGHT_DOT_RADIUS_DRIVER_PUTTER = 6.5;
const WEIGHT_DOT_RADIUS_DEFAULT = 5.8;

/** ロフト回帰分析定数 */
const LOFT_REGRESSION_FALLBACK_SLOPE = -7.2;
const LOFT_REGRESSION_FALLBACK_INTERCEPT = 86;
const LOFT_REGRESSION_MIN_SLOPE = -4;
const LOFT_REGRESSION_MAX_SLOPE = -10;

/** ライ角回帰分析定数 */
const LIE_REGRESSION_FALLBACK_SLOPE = -1.4;
const LIE_REGRESSION_FALLBACK_INTERCEPT = 72;
const LIE_REGRESSION_MIN_SLOPE = -0.5;
const LIE_REGRESSION_MAX_SLOPE = -2.5;

/** 推定計算定数 */
const ESTIMATION_REFERENCE_HEAD_SPEED = 44.5;
const ESTIMATION_CLAMP_MIN = 0;
const ESTIMATION_CLAMP_MAX = 1;

export const getEstimatedDistance = (club: GolfClub, headSpeed: number) => {
  // 44.5m/sで調整した値を基準に、他ヘッドスピードでも自然に追従させる
  const loftAngle = club.loftAngle ?? 0;
  const category = getClubCategoryByType(club.clubType ?? '');

  const model = DISTANCE_MODELS[category];

  // 標準式: base + (headSpeed - reference) * speedCoeff + (loftAngle - 標準値) * loftCoeff
  let estimated =
    model.base +
    (headSpeed - ESTIMATION_REFERENCE_HEAD_SPEED) * model.speedCoeff +
    (loftAngle - model.standardLoft) * model.loftCoeff;

  // ドライバー限定ではなく、低ロフト帯全体へ緩やかに効く補正
  const effectiveLoft = loftAngle > 0 ? loftAngle : model.standardLoft;
  if (category !== 'putter' && effectiveLoft < LOW_LOFT_PENALTY_LIMIT) {
    const loftRatio = clamp(
      (LOW_LOFT_PENALTY_LIMIT - effectiveLoft) /
        (LOW_LOFT_PENALTY_LIMIT - LOW_LOFT_PENALTY_REFERENCE),
      0,
      1,
    );
    const loftPenalty = LOW_LOFT_MAX_PENALTY * loftRatio * loftRatio;
    const speedRelief = Math.max(0, headSpeed - LOW_LOFT_SPEED_RELIEF_THRESHOLD) * LOW_LOFT_SPEED_RELIEF * loftRatio * loftRatio;
    estimated -= loftPenalty;
    estimated += speedRelief;
  }

  if (category === 'driver' && headSpeed > DRIVER_BOOST_RAMP_START) {
    const rampRange = DRIVER_BOOST_RAMP_END - DRIVER_BOOST_RAMP_START;
    const rampRatio = clamp((headSpeed - DRIVER_BOOST_RAMP_START) / rampRange, ESTIMATION_CLAMP_MIN, ESTIMATION_CLAMP_MAX);
    const rampBoost = DRIVER_BOOST_AT_45 * rampRatio * rampRatio;
    const highSpeedBoost =
      headSpeed > DRIVER_BOOST_RAMP_END
        ? (headSpeed - DRIVER_BOOST_RAMP_END) * DRIVER_BOOST_ABOVE_45_PER_SPEED
        : 0;
    estimated += rampBoost + highSpeedBoost;
  }

  estimated = Math.max(model.min, Math.min(model.max, estimated));
  return Math.round(estimated * 10) / 10;
};

export const getCategoryColor = (category: ClubCategory): string => {
  return CATEGORY_VISUAL_CONFIG[category].color;
};

export const getCategoryLabel = (category: ClubCategory): string => {
  return CATEGORY_VISUAL_CONFIG[category].label;
};

export const isDistanceGapWide = (gap: number | null): boolean => {
  return gap !== null && gap > DISTANCE_GAP_WIDE_THRESHOLD;
};

export const isDistanceGapNarrow = (gap: number | null): boolean => {
  return gap !== null && gap < DISTANCE_GAP_NARROW_THRESHOLD;
};

export const isDistanceGapNormal = (gap: number | null): boolean => {
  return gap !== null && gap >= DISTANCE_GAP_NARROW_THRESHOLD && gap <= DISTANCE_GAP_WIDE_THRESHOLD;
};

export const estimateHeadSpeedFromClubs = (clubs: GolfClub[]): number | null => {
  const clubsWithDistance = clubs.filter(
    (club) => club.distance != null && club.distance > 0 && club.loftAngle != null && club.loftAngle > 0
  );

  if (clubsWithDistance.length === 0) {
    return null;
  }

  const headSpeeds: number[] = [];

  for (const club of clubsWithDistance) {
    const category = getClubCategoryByType(club.clubType ?? '');
    const model = DISTANCE_MODELS[category];

    // 基本式を逆算: headSpeed = (distance - base - (loft - standardLoft) * loftCoeff) / speedCoeff + 44.5
    const loftAngle = club.loftAngle ?? 0;
    const distance = club.distance ?? 0;

    const headSpeed =
      (distance - model.base - (loftAngle - model.standardLoft) * model.loftCoeff) / model.speedCoeff + ESTIMATION_REFERENCE_HEAD_SPEED;

    if (Number.isFinite(headSpeed) && headSpeed > 20 && headSpeed < 70) {
      headSpeeds.push(headSpeed);
    }
  }

  if (headSpeeds.length === 0) {
    return null;
  }

  // 平均を返す
  return headSpeeds.reduce((sum, hs) => sum + hs, 0) / headSpeeds.length;
};

export const calculateDistanceGapCoefficient = (headSpeed: number): number => {
  // ヘッドスピード45で係数3.5、ヘッドスピード30で係数2.5になるように線形補完
  // coefficient = a * headSpeed + b
  // 3.5 = a * 45 + b
  // 2.5 = a * 30 + b
  // 差分: 1.0 = a * 15 → a = 0.0667
  // b = 3.5 - 0.0667 * 45 = 0.5
  const a = (DISTANCE_GAP_COEFFICIENT_AT_45 - DISTANCE_GAP_COEFFICIENT_AT_30) / (45 - 30);
  const b = DISTANCE_GAP_COEFFICIENT_AT_45 - a * 45;

  return a * headSpeed + b;
};

export const getWeightLengthDotRadius = (club: Pick<GolfClub, 'clubType'>) => {
  const normalizedType = (club.clubType ?? '').toUpperCase();
  if (
    normalizedType === 'D' ||
    normalizedType === 'P' ||
    normalizedType === 'DRIVER' ||
    normalizedType === 'PUTTER'
  ) {
    return WEIGHT_DOT_RADIUS_DRIVER_PUTTER;
  }

  return WEIGHT_DOT_RADIUS_DEFAULT;
};

const getWeightFallbackRegression = (
  anchorLength: number,
  anchorWeight: number,
): WeightRegression => {
  return {
    slope: WEIGHT_REGRESSION_FALLBACK_SLOPE,
    intercept: anchorWeight - WEIGHT_REGRESSION_FALLBACK_SLOPE * anchorLength,
  };
};

export const getWeightRegression = (
  clubs: Pick<GolfClub, 'length' | 'weight'>[],
): WeightRegression => {
  if (clubs.length === 0) {
    return { slope: WEIGHT_REGRESSION_FALLBACK_SLOPE, intercept: WEIGHT_REGRESSION_FALLBACK_INTERCEPT };
  }

  const meanLength = clubs.reduce((sum, club) => sum + club.length, 0) / clubs.length;
  const meanWeight = clubs.reduce((sum, club) => sum + club.weight, 0) / clubs.length;

  let numerator = 0;
  let denominator = 0;

  for (const club of clubs) {
    const dx = club.length - meanLength;
    numerator += dx * (club.weight - meanWeight);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < 0.0001) {
    return getWeightFallbackRegression(meanLength, meanWeight);
  }

  const slope = numerator / denominator;
  if (slope >= WEIGHT_REGRESSION_MIN_SLOPE) {
    return getWeightFallbackRegression(meanLength, meanWeight);
  }

  return {
    slope,
    intercept: meanWeight - slope * meanLength,
  };
};

export const getExpectedWeight = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

const getLoftLengthFallbackRegression = (
  anchorLength: number,
  anchorLoft: number,
): WeightRegression => {
  return {
    slope: LOFT_REGRESSION_FALLBACK_SLOPE,
    intercept: anchorLoft - LOFT_REGRESSION_FALLBACK_SLOPE * anchorLength,
  };
};

export const getLoftLengthRegression = (
  clubs: Pick<GolfClub, 'length' | 'loftAngle'>[],
): WeightRegression => {
  if (clubs.length === 0) {
    return { slope: LOFT_REGRESSION_FALLBACK_SLOPE, intercept: LOFT_REGRESSION_FALLBACK_INTERCEPT };
  }

  const meanLength = clubs.reduce((sum, club) => sum + club.length, 0) / clubs.length;
  const meanLoft = clubs.reduce((sum, club) => sum + club.loftAngle, 0) / clubs.length;

  let numerator = 0;
  let denominator = 0;
  for (const club of clubs) {
    const dx = club.length - meanLength;
    numerator += dx * (club.loftAngle - meanLoft);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < 0.0001) {
    return getLoftLengthFallbackRegression(meanLength, meanLoft);
  }

  const slope = numerator / denominator;
  if (!Number.isFinite(slope) || slope > LOFT_REGRESSION_MIN_SLOPE || slope < LOFT_REGRESSION_MAX_SLOPE) {
    return getLoftLengthFallbackRegression(meanLength, meanLoft);
  }

  return {
    slope,
    intercept: meanLoft - slope * meanLength,
  };
};

export const getExpectedLoftAngle = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

/**
 * スロープ制約なしのカテゴリ専用回帰。フルバッグ用の ±4〜10°/inch 制約を外し
 * ウェッジや短尺ウッドなど極端な傾きにも対応する。
 */
export const getCategoryLoftLengthRegression = (
  clubs: Pick<GolfClub, 'length' | 'loftAngle'>[],
): WeightRegression | null => {
  if (clubs.length < 2) return null;

  const meanLength = clubs.reduce((sum, c) => sum + c.length, 0) / clubs.length;
  const meanLoft = clubs.reduce((sum, c) => sum + c.loftAngle, 0) / clubs.length;

  let numerator = 0;
  let denominator = 0;
  for (const club of clubs) {
    const dx = club.length - meanLength;
    numerator += dx * (club.loftAngle - meanLoft);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < 0.0001) {
    // x 値がすべて同じ → 平均ロフトで水平線
    return { slope: 0, intercept: meanLoft };
  }

  const slope = numerator / denominator;
  if (!Number.isFinite(slope)) return null;

  return { slope, intercept: meanLoft - slope * meanLength };
};

const getLieLengthFallbackRegression = (
  anchorLength: number,
  anchorLieAngle: number,
): WeightRegression => {
  return {
    slope: LIE_REGRESSION_FALLBACK_SLOPE,
    intercept: anchorLieAngle - LIE_REGRESSION_FALLBACK_SLOPE * anchorLength,
  };
};

export const getLieLengthRegression = (
  clubs: Pick<GolfClub, 'length' | 'lieAngle'>[],
): WeightRegression => {
  if (clubs.length === 0) {
    return { slope: LIE_REGRESSION_FALLBACK_SLOPE, intercept: LIE_REGRESSION_FALLBACK_INTERCEPT };
  }

  const meanLength = clubs.reduce((sum, club) => sum + club.length, 0) / clubs.length;
  const meanLieAngle = clubs.reduce((sum, club) => sum + club.lieAngle, 0) / clubs.length;

  let numerator = 0;
  let denominator = 0;

  for (const club of clubs) {
    const dx = club.length - meanLength;
    numerator += dx * (club.lieAngle - meanLieAngle);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < 0.0001) {
    return getLieLengthFallbackRegression(meanLength, meanLieAngle);
  }

  const slope = numerator / denominator;
  if (!Number.isFinite(slope) || slope > LIE_REGRESSION_MIN_SLOPE || slope < LIE_REGRESSION_MAX_SLOPE) {
    return getLieLengthFallbackRegression(meanLength, meanLieAngle);
  }

  return {
    slope,
    intercept: meanLieAngle - slope * meanLength,
  };
};

export const getExpectedLieAngle = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

export const formatSignedDegrees = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;

export const getLieLengthTrendMessage = (deviation: number) => {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= 0.5) return 'トレンド内';
  if (absDeviation <= 1.0) return deviation > 0 ? 'ややアップライト寄り' : 'ややフラット寄り';
  return deviation > 0 ? 'アップライト側の調整候補' : 'フラット側の調整候補';
};

export const getLieLengthDeviationLabel = (deviation: number) => {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= 0.5) {
    return `${formatSignedDegrees(deviation)} / トレンド内`;
  }

  return deviation > 0
    ? `${formatSignedDegrees(deviation)} トレンドよりアップライト`
    : `${formatSignedDegrees(deviation)} トレンドよりフラット`;
};

export const getLieLengthPointStyle = (
  club: Pick<GolfClub, 'clubType'> & { category: ClubCategory },
  deviation: number,
) => {
  if (deviation >= 1.2) {
    return {
      fill: '#c62828',
      stroke: '#7f0000',
      strokeWidth: 2.5,
      radius: 7,
    };
  }

  if (deviation <= -1.2) {
    return {
      fill: '#1565c0',
      stroke: '#0d47a1',
      strokeWidth: 2.5,
      radius: 7,
    };
  }

  return {
    fill: getCategoryColor(club.category),
    stroke: '#ffffff',
    strokeWidth: 2,
    radius: getWeightLengthDotRadius(club),
  };
};

export const getLieLengthChartBounds = (
  points: LieLengthPoint[],
  regression: WeightRegression,
  tolerance: number,
): LieLengthChartBounds => {
  const lengths = points.map((club) => club.length);
  const lieAngles = points.map((club) => club.lieAngle);
  const expectedLieAngles = points.map((club) => club.expectedLieAngle);

  const minLength = Math.max(28, Math.floor(Math.min(...lengths) - 1));
  const maxLength = Math.min(50, Math.ceil(Math.max(...lengths) + 1));

  const projectedMinLie = getExpectedLieAngle(maxLength, regression) - tolerance;
  const projectedMaxLie = getExpectedLieAngle(minLength, regression) + tolerance;

  const minLieAngle = Math.max(
    48,
    Math.floor((Math.min(...lieAngles, ...expectedLieAngles, projectedMinLie) - 0.8) * 2) / 2,
  );
  const maxLieAngle = Math.min(
    72,
    Math.ceil((Math.max(...lieAngles, ...expectedLieAngles, projectedMaxLie) + 0.8) * 2) / 2,
  );

  const yRange = maxLieAngle - minLieAngle;

  return {
    minLength,
    maxLength,
    minLieAngle,
    maxLieAngle,
    xInterval: maxLength - minLength <= 12 ? 1 : 2,
    yInterval: yRange <= 8 ? 1 : 2,
  };
};

export const getLoftLengthChartBounds = (
  points: LoftLengthPoint[],
  regression: WeightRegression,
) => {
  const lengths = points.map((club) => club.length);
  const loftAngles = points.map((club) => club.loftAngle);
  const expectedLofts = points.map((club) => club.expectedLoft);

  const minLength = Math.max(28, Math.floor(Math.min(...lengths) - 1));
  const maxLength = Math.min(50, Math.ceil(Math.max(...lengths) + 1));
  const projectedMinLoft = getExpectedLoftAngle(maxLength, regression) - 2;
  const projectedMaxLoft = getExpectedLoftAngle(minLength, regression) + 2;

  const minLoft = Math.max(
    7,
    Math.floor((Math.min(...loftAngles, ...expectedLofts, projectedMinLoft) - 1) * 2) / 2,
  );
  const maxLoft = Math.min(
    63,
    Math.ceil((Math.max(...loftAngles, ...expectedLofts, projectedMaxLoft) + 1) * 2) / 2,
  );

  const loftRange = maxLoft - minLoft;

  return {
    minLength,
    maxLength,
    minLoft,
    maxLoft,
    xInterval: maxLength - minLength <= 12 ? 1 : 2,
    yInterval: loftRange <= 20 ? 2 : 4,
  };
};

export const formatSignedGrams = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)} g`;

export const getWeightTrendMessage = (deviation: number) => {
  const deviationClass = classifyWeightDeviation(deviation);
  if (deviationClass === 'heavyOutlier') return 'バランス確認推奨';
  if (deviationClass === 'lightOutlier') return '軽量側の確認推奨';
  if (deviationClass === 'inBand') return 'トレンド内';
  return 'ややトレンド外';
};

export const getWeightDeviationLabel = (deviation: number) => {
  const deviationClass = classifyWeightDeviation(deviation);
  if (deviationClass === 'inBand') {
    return `${formatSignedGrams(deviation)} / トレンド内`;
  }

  return deviation > 0
    ? `${formatSignedGrams(deviation)} トレンドより重い`
    : `${formatSignedGrams(deviation)} トレンドより軽い`;
};

export const getWeightPointStyle = (
  club: Pick<GolfClub, 'clubType'> & { category: ClubCategory },
  deviation: number,
) => {
  const deviationClass = classifyWeightDeviation(deviation);

  if (deviationClass === 'heavyOutlier') {
    return {
      fill: '#e53935',
      stroke: '#000000',
      strokeWidth: 3,
      radius: 7,
    };
  }

  if (deviationClass === 'lightOutlier') {
    return {
      fill: '#ec407a',
      stroke: '#ad1457',
      strokeWidth: 3,
      radius: 7,
    };
  }

  return {
    fill: getCategoryColor(club.category),
    stroke: '#ffffff',
    strokeWidth: 2,
    radius: getWeightLengthDotRadius(club),
  };
};

export const getWeightChartBounds = (
  points: WeightLengthPoint[],
  regression: WeightRegression,
): WeightChartBounds => {
  const lengths = points.map((club) => club.length);
  const weights = points.map((club) => club.weight);
  const expectedWeights = points.map((club) => club.expectedWeight);

  const minLength = Math.max(28, Math.floor(Math.min(...lengths) - 1));
  const maxLength = Math.min(50, Math.ceil(Math.max(...lengths) + 1));
  const projectedMinWeight =
    getExpectedWeight(maxLength, regression) - WEIGHT_NORMAL_BAND_TOLERANCE;
  const projectedMaxWeight =
    getExpectedWeight(minLength, regression) + WEIGHT_NORMAL_BAND_TOLERANCE;
  const minWeight = Math.max(
    150,
    Math.floor(
      (Math.min(...weights, ...expectedWeights, projectedMinWeight) - 15) / 10,
    ) * 10,
  );
  const maxWeight = Math.min(
    520,
    Math.ceil(
      (Math.max(...weights, ...expectedWeights, projectedMaxWeight) + 15) / 10,
    ) * 10,
  );

  return {
    minLength,
    maxLength,
    minWeight,
    maxWeight,
    xInterval: maxLength - minLength <= 12 ? 1 : 2,
    yInterval: maxWeight - minWeight <= 160 ? 25 : 50,
  };
};

export const makeTickValues = (min: number, max: number, interval: number) => {
  const ticks: number[] = [];
  for (let value = min; value <= max; value += interval) {
    ticks.push(Number(value.toFixed(2)));
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }
  return ticks;
};

export const getSwingStatus = (
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): SwingStatus => {
  const deviationClass = classifySwingDeviation(
    deviation,
    goodTolerance,
    adjustThreshold,
  );

  if (deviationClass === 'adjust') return '調整推奨';
  if (deviationClass === 'good') return '良好';
  return deviationClass === 'heavy' ? 'やや重い' : 'やや軽い';
};

export const getSwingStatusColor = (status: SwingStatus) => SWING_STATUS_COLOR_MAP[status];

export const getSwingClubLabel = (
  club: Pick<GolfClub, 'clubType' | 'number' | 'name'>,
): string => {
  const typeLabel = getClubTypeDisplay(club.clubType, club.number).trim();
  if (typeLabel) return typeLabel;
  return (club.name ?? '').trim() || '-';
};

export const getSwingBarColor = (
  category: ClubCategory,
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): { fill: string; stroke: string; strokeWidth: number } => {
  const deviationClass = classifySwingDeviation(
    deviation,
    goodTolerance,
    adjustThreshold,
  );

  if (deviationClass === 'adjust') {
    return { fill: '#e53935', stroke: '#b71c1c', strokeWidth: 2 };
  }

  if (deviationClass === 'light') {
    return { fill: getCategoryColor(category), stroke: '#ef6c00', strokeWidth: 2 };
  }

  if (deviationClass === 'heavy') {
    return { fill: '#fb8c00', stroke: '#e65100', strokeWidth: 1.8 };
  }

  return { fill: getCategoryColor(category), stroke: 'none', strokeWidth: 0 };
};


export const buildActualDistanceLinePoints = (
  clubs: Array<Pick<LoftDistancePoint, 'loftAngle' | 'actualDistance'>>,
  mapX: (loftAngle: number) => number,
  mapY: (distance: number) => number,
) => {
  return clubs
    .filter((club) => club.actualDistance > 0)
    .map((club) => `${mapX(club.loftAngle)},${mapY(club.actualDistance)}`)
    .join(' ');
};


export const buildWeightTrendPoints = (
  hasData: boolean,
  bounds: {
    minLength: number;
    maxLength: number;
  },
  regression: WeightRegression,
  tolerance: number,
  mapX: (length: number) => number,
  mapY: (weight: number) => number,
) => {
  if (!hasData) {
    return { linePoints: '', bandPoints: '' };
  }

  const linePoints = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedWeight(length, regression))}`)
    .join(' ');

  const upper = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedWeight(length, regression) + tolerance)}`)
    .join(' ');
  const lower = [bounds.maxLength, bounds.minLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedWeight(length, regression) - tolerance)}`)
    .join(' ');

  return {
    linePoints,
    bandPoints: `${upper} ${lower}`,
  };
};

export const buildLieLengthTrendPoints = (
  hasData: boolean,
  bounds: {
    minLength: number;
    maxLength: number;
  },
  regression: WeightRegression,
  tolerance: number,
  mapX: (length: number) => number,
  mapY: (lieAngle: number) => number,
) => {
  if (!hasData) {
    return { linePoints: '', bandPoints: '' };
  }

  const linePoints = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedLieAngle(length, regression))}`)
    .join(' ');

  const upper = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedLieAngle(length, regression) + tolerance)}`)
    .join(' ');
  const lower = [bounds.maxLength, bounds.minLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedLieAngle(length, regression) - tolerance)}`)
    .join(' ');

  return {
    linePoints,
    bandPoints: `${upper} ${lower}`,
  };
};


export const buildLieReferencePoints = (
  clubs: Array<Pick<LieAnglePoint, 'standardLieAngle'>>,
  mapX: (index: number) => number,
  mapY: (deg: number) => number,
  minLie: number,
  maxLie: number,
  goodTolerance: number,
) => {
  const standardLinePoints = clubs
    .map((club, index) => `${mapX(index)},${mapY(club.standardLieAngle)}`)
    .join(' ');

  const upperGoodRangePoints = clubs
    .map(
      (club, index) =>
        `${mapX(index)},${mapY(Math.min(maxLie, club.standardLieAngle + goodTolerance))}`,
    )
    .join(' ');

  const goodRangePolygonPoints = clubs.length > 1
    ? `${upperGoodRangePoints} ${clubs
      .map(
        (club, index) =>
          `${mapX(clubs.length - 1 - index)},${mapY(Math.max(minLie, club.standardLieAngle - goodTolerance))}`,
      )
      .join(' ')}`
    : '';

  return {
    standardLinePoints,
    goodRangePolygonPoints,
  };
};

export const isAnalysisClubVisible = (
  club: GolfClub,
  hiddenClubKeys: Set<string>,
): boolean => !hiddenClubKeys.has(getAnalysisClubKey(club));

// Swing Length Analysis Constants
const SWING_LENGTH_IDEAL_SLOPE_MIN = -0.8;
const SWING_LENGTH_IDEAL_SLOPE_MAX = 0;

const getSwingLengthFallbackRegression = (
  anchorLength: number,
  anchorSwingWeight: number,
): WeightRegression => {
  const slope = -0.6;
  return {
    slope,
    intercept: anchorSwingWeight - slope * anchorLength,
  };
};

export const getSwingLengthRegression = (
  clubs: Pick<GolfClub, 'length' | 'swingWeight'>[],
): WeightRegression => {
  const validClubs = clubs.filter(
    (club) =>
      Number.isFinite(club.length) &&
      club.length > 0 &&
      club.swingWeight &&
      swingWeightToNumeric(club.swingWeight) !== 0,
  );

  if (validClubs.length === 0) {
    return { slope: -0.6, intercept: 30 };
  }

  const meanLength = validClubs.reduce((sum, club) => sum + club.length, 0) / validClubs.length;
  const meanSwingWeight =
    validClubs.reduce((sum, club) => sum + swingWeightToNumeric(club.swingWeight), 0) /
    validClubs.length;

  let numerator = 0;
  let denominator = 0;

  for (const club of validClubs) {
    const dx = club.length - meanLength;
    const swingWeightNum = swingWeightToNumeric(club.swingWeight);
    numerator += dx * (swingWeightNum - meanSwingWeight);
    denominator += dx * dx;
  }

  if (Math.abs(denominator) < 0.0001) {
    return getSwingLengthFallbackRegression(meanLength, meanSwingWeight);
  }

  const slope = numerator / denominator;
  if (!Number.isFinite(slope) || slope > 0.5 || slope < -2.5) {
    return getSwingLengthFallbackRegression(meanLength, meanSwingWeight);
  }

  return {
    slope,
    intercept: meanSwingWeight - slope * meanLength,
  };
};

export const getExpectedSwingWeight = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

export const getSwingLengthTrendStatus = (
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): SwingLengthPoint['trendStatus'] => {
  const absDeviation = Math.abs(deviation);
  if (absDeviation > adjustThreshold) return '調整推奨';
  if (absDeviation <= goodTolerance) return '良好';
  return deviation > 0 ? 'やや重い' : 'やや軽い';
};

export const getSwingLengthTrendMessage = (deviation: number, goodTolerance: number, adjustThreshold: number): string => {
  const status = getSwingLengthTrendStatus(deviation, goodTolerance, adjustThreshold);
  if (status === '良好') return 'トレンド内';
  if (status === 'やや重い') return 'やや重め';
  if (status === 'やや軽い') return 'やや軽め';
  return deviation > 0 ? '重すぎる傾向' : '軽すぎる傾向';
};

export const formatSignedSwingWeight = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

export const getSwingLengthDeviationLabel = (deviation: number, goodTolerance: number, adjustThreshold: number): string => {
  const status = getSwingLengthTrendStatus(deviation, goodTolerance, adjustThreshold);
  if (status === '良好') {
    return `${formatSignedSwingWeight(deviation)} / トレンド内`;
  }
  return deviation > 0
    ? `${formatSignedSwingWeight(deviation)} トレンドより重い`
    : `${formatSignedSwingWeight(deviation)} トレンドより軽い`;
};

export const getSwingLengthPointStyle = (
  club: Pick<GolfClub, 'clubType'> & { category: ClubCategory },
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
) => {
  const status = getSwingLengthTrendStatus(deviation, goodTolerance, adjustThreshold);

  if (status === '調整推奨') {
    const color = deviation > 0 ? '#c62828' : '#1565c0';
    const stroke = deviation > 0 ? '#7f0000' : '#0d47a1';
    return {
      fill: color,
      stroke,
      strokeWidth: 2.5,
      radius: 7,
    };
  }

  if (status === 'やや重い' || status === 'やや軽い') {
    return {
      fill: getCategoryColor(club.category),
      stroke: '#ef6c00',
      strokeWidth: 2,
      radius: 6.5,
    };
  }

  return {
    fill: getCategoryColor(club.category),
    stroke: '#ffffff',
    strokeWidth: 2,
    radius: getWeightLengthDotRadius(club),
  };
};

export const getSwingLengthChartBounds = (
  points: SwingLengthPoint[],
  regression: WeightRegression,
  adjustThreshold: number,
): {
  minLength: number;
  maxLength: number;
  minSwingWeight: number;
  maxSwingWeight: number;
  xInterval: number;
  yInterval: number;
} => {
  const lengths = points.map((club) => club.length);
  const swingWeights = points.map((club) => club.swingWeightNumeric);
  const expectedSwingWeights = points.map((club) => club.expectedSwingWeight);

  const minLength = Math.max(28, Math.floor(Math.min(...lengths) - 1));
  const maxLength = Math.min(50, Math.ceil(Math.max(...lengths) + 1));
  const projectedMinSwingWeight =
    getExpectedSwingWeight(maxLength, regression) - adjustThreshold;
  const projectedMaxSwingWeight =
    getExpectedSwingWeight(minLength, regression) + adjustThreshold;

  const minSwingWeight = Math.max(
    -5,
    Math.floor(
      (Math.min(...swingWeights, ...expectedSwingWeights, projectedMinSwingWeight) - 2) / 2,
    ) * 2,
  );
  const maxSwingWeight = Math.min(
    45,
    Math.ceil(
      (Math.max(...swingWeights, ...expectedSwingWeights, projectedMaxSwingWeight) + 2) / 2,
    ) * 2,
  );

  return {
    minLength,
    maxLength,
    minSwingWeight,
    maxSwingWeight,
    xInterval: maxLength - minLength <= 12 ? 1 : 2,
    yInterval: maxSwingWeight - minSwingWeight <= 16 ? 2 : 4,
  };
};

export const evaluateSwingLengthSlope = (slope: number): 'ideal' | 'tooSteep' | 'tooFlat' => {
  if (slope >= SWING_LENGTH_IDEAL_SLOPE_MIN && slope <= SWING_LENGTH_IDEAL_SLOPE_MAX) {
    return 'ideal';
  }
  if (slope < SWING_LENGTH_IDEAL_SLOPE_MIN) {
    return 'tooSteep';
  }
  return 'tooFlat';
};

export const getSwingLengthSlopeMessage = (slope: number): string => {
  const evaluation = evaluateSwingLengthSlope(slope);
  if (evaluation === 'ideal') return '傾斜良好';
  if (evaluation === 'tooSteep') return '傾斜が急すぎる';
  if (slope === 0) return '傾斜フラット（許容範囲）';
  return '傾斜がプラス（長いほど重くなる）';
};

export const buildSwingLengthTrendPoints = (
  hasData: boolean,
  bounds: {
    minLength: number;
    maxLength: number;
  },
  regression: WeightRegression,
  tolerance: number,
  mapX: (length: number) => number,
  mapY: (swingWeight: number) => number,
) => {
  if (!hasData) {
    return { linePoints: '', bandPoints: '' };
  }

  const linePoints = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedSwingWeight(length, regression))}`)
    .join(' ');

  const upper = [bounds.minLength, bounds.maxLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedSwingWeight(length, regression) + tolerance)}`)
    .join(' ');
  const lower = [bounds.maxLength, bounds.minLength]
    .map((length) => `${mapX(length)},${mapY(getExpectedSwingWeight(length, regression) - tolerance)}`)
    .join(' ');

  return {
    linePoints,
    bandPoints: `${upper} ${lower}`,
  };
};

type ClubWithDistance = GolfClub & {
  effectiveDistance: number;
};

export const computeGapsAndRecommendations = (clubs: GolfClub[]): Adjustment[] => {
  const adjustments: Adjustment[] = [];

  // Filter out putters and clubs without necessary data
  const validClubs = clubs.filter(
    (club) => club.clubType !== 'Putter' && (club.distance != null || club.loftAngle != null)
  );

  if (validClubs.length < 2) {
    return adjustments;
  }

  // Estimate head speed from clubs if available
  const estimatedHeadSpeed = estimateHeadSpeedFromClubs(clubs) ?? DEFAULT_HEAD_SPEED;

  // Calculate effective distance for each club (actual or estimated from loft)
  const clubsWithDistance: ClubWithDistance[] = validClubs.map((club) => ({
    ...club,
    effectiveDistance: club.distance != null && club.distance > 0
      ? club.distance
      : (club.loftAngle != null ? getEstimatedDistance(club, estimatedHeadSpeed) : 0),
  }));

  // Filter out clubs with zero effective distance
  const clubsWithValidDistance = clubsWithDistance.filter((c) => c.effectiveDistance > 0);

  if (clubsWithValidDistance.length < 2) {
    return adjustments;
  }

  // Sort by distance descending
  const sortedClubs = [...clubsWithValidDistance].sort((a, b) => b.effectiveDistance - a.effectiveDistance);

  // Calculate gaps between consecutive clubs
  for (let i = 0; i < sortedClubs.length - 1; i++) {
    const currentClub = sortedClubs[i];
    const nextClub = sortedClubs[i + 1];
    const gap = Math.round(currentClub.effectiveDistance - nextClub.effectiveDistance);

    if (gap <= 0) continue;

    const currentCategory = getClubCategory(currentClub);
    const nextCategory = getClubCategory(nextClub);

    // Determine gap category and thresholds
    let idealMin: number;
    let idealMax: number;
    let tolerance: number;
    let maxAcceptable: number | null = null;
    let priority: 'high' | 'medium' | 'low';

    // Driver → Wood (3W)
    if (currentCategory === 'driver' && nextCategory === 'wood') {
      idealMin = DRIVER_TO_WOOD_IDEAL_MIN;
      idealMax = DRIVER_TO_WOOD_IDEAL_MAX;
      maxAcceptable = DRIVER_TO_WOOD_MAX_ACCEPTABLE;
      tolerance = maxAcceptable - idealMax; // Wide gaps acceptable
      priority = 'low';
    }
    // Wood → Hybrid
    else if (currentCategory === 'wood' && nextCategory === 'hybrid') {
      idealMin = WOOD_TO_HYBRID_IDEAL_MIN;
      idealMax = WOOD_TO_HYBRID_IDEAL_MAX;
      tolerance = WOOD_TO_HYBRID_TOLERANCE;
      maxAcceptable = idealMax + tolerance;
      priority = 'high';
    }
    // Iron → Iron
    else if (currentCategory === 'iron' && nextCategory === 'iron') {
      idealMin = IRON_GAP_IDEAL_MIN;
      idealMax = IRON_GAP_IDEAL_MAX;
      tolerance = IRON_GAP_TOLERANCE;
      maxAcceptable = idealMax + tolerance;
      priority = 'high';
    }
    // Wedge → Wedge
    else if (currentCategory === 'wedge' && nextCategory === 'wedge') {
      idealMin = WEDGE_GAP_IDEAL_MIN;
      idealMax = WEDGE_GAP_IDEAL_MAX;
      tolerance = WEDGE_GAP_TOLERANCE;
      maxAcceptable = idealMax + tolerance;
      priority = 'high';
    }
    // Hybrid → Iron or other transitions
    else {
      // Use iron thresholds as default for other transitions
      idealMin = IRON_GAP_IDEAL_MIN;
      idealMax = IRON_GAP_IDEAL_MAX;
      tolerance = IRON_GAP_TOLERANCE;
      maxAcceptable = idealMax + tolerance;
      priority = 'medium';
    }

    const currentClubName = getClubTypeDisplay(currentClub.clubType, currentClub.number || '');
    const nextClubName = getClubTypeDisplay(nextClub.clubType, nextClub.number || '');

    // Check if gap exceeds max acceptable
    if (maxAcceptable && gap > maxAcceptable) {
      adjustments.push({
        priority,
        title: `距離ギャップ解消（${currentClubName}と${nextClubName}の間）`,
        description: `実際の飛距離ギャップが${gap}ydあります（理想：${idealMin}-${idealMax}yd）。中間的なクラブの追加を検討してください。`,
        estimatedEffect: 'アプローチ成功率 +25% 見込み',
      });
    }
    // Check if gap is below minimum
    else if (gap < idealMin - tolerance) {
      adjustments.push({
        priority: 'medium',
        title: `距離ギャップの確認（${currentClubName}と${nextClubName}の間）`,
        description: `実際の飛距離ギャップが${gap}ydと狭いです（理想：${idealMin}-${idealMax}yd）。距離差が出にくい場合はクラブの見直しを検討してください。`,
        estimatedEffect: '距離ギャップ適正化',
      });
    }
  }

  return adjustments;
};