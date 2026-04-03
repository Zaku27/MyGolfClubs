import type { GolfClub } from '../types/golf';
import {
  lieStatusFromDeviation,
} from '../types/lieStandards';
import { getAnalysisClubKey, getClubTypeDisplay } from './clubUtils';
import {
  CATEGORY_VISUAL_CONFIG,
  CLUB_TYPE_CATEGORY_MAP,
  DISTANCE_MODELS,
  SWING_STATUS_COLOR_MAP,
  WEIGHT_NORMAL_BAND_TOLERANCE,
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
  estimatedDistance: number;
  actualDistance: number;
  category: ClubCategory;
};

export type WeightLengthPoint = GolfClub & {
  category: ClubCategory;
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

export type SwingWeightPoint = GolfClub & {
  category: ClubCategory;
  swingWeightNumeric: number;
  swingDeviation: number;
  swingStatus: SwingStatus;
};

export type LieAnglePoint = GolfClub & {
  category: ClubCategory;
  standardLieAngle: number;
  deviationFromStandard: number;
  lieStatus: ReturnType<typeof lieStatusFromDeviation>;
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

const LOW_LOFT_PENALTY_LIMIT = 18;
const LOW_LOFT_PENALTY_REFERENCE = 10.5;
const LOW_LOFT_MAX_PENALTY = 20;
const LOW_LOFT_SPEED_RELIEF = 0.14;
const DRIVER_BOOST_RAMP_START = 43;
const DRIVER_BOOST_RAMP_END = 45;
const DRIVER_BOOST_AT_45 = 10.5;
const DRIVER_BOOST_ABOVE_45_PER_SPEED = 4.9;

export const getEstimatedDistance = (club: GolfClub, headSpeed: number) => {
  // 44.5m/sで調整した値を基準に、他ヘッドスピードでも自然に追従させる
  const loftAngle = club.loftAngle ?? 0;
  const category = getClubCategoryByType(club.clubType ?? '');

  const model = DISTANCE_MODELS[category];

  // 標準式: base + (headSpeed - 44.5) * speedCoeff + (loftAngle - 標準値) * loftCoeff
  let estimated =
    model.base +
    (headSpeed - 44.5) * model.speedCoeff +
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
    const speedRelief = Math.max(0, headSpeed - 30) * LOW_LOFT_SPEED_RELIEF * loftRatio * loftRatio;
    estimated -= loftPenalty;
    estimated += speedRelief;
  }

  if (category === 'driver' && headSpeed > DRIVER_BOOST_RAMP_START) {
    const rampRange = DRIVER_BOOST_RAMP_END - DRIVER_BOOST_RAMP_START;
    const rampRatio = clamp((headSpeed - DRIVER_BOOST_RAMP_START) / rampRange, 0, 1);
    const rampBoost = DRIVER_BOOST_AT_45 * rampRatio * rampRatio;
    const highSpeedBoost =
      headSpeed > DRIVER_BOOST_RAMP_END
        ? (headSpeed - DRIVER_BOOST_RAMP_END) * DRIVER_BOOST_ABOVE_45_PER_SPEED
        : 0;
    estimated += rampBoost + highSpeedBoost;
  }

  estimated = Math.max(model.min, Math.min(model.max, estimated));
  return Math.round(estimated);
};

export const getCategoryColor = (category: ClubCategory) => {
  return CATEGORY_VISUAL_CONFIG[category].color;
};

export const getCategoryLabel = (category: ClubCategory) => {
  return CATEGORY_VISUAL_CONFIG[category].label;
};

export const getWeightLengthDotRadius = (club: Pick<GolfClub, 'clubType'>) => {
  const normalizedType = (club.clubType ?? '').toUpperCase();
  if (
    normalizedType === 'D' ||
    normalizedType === 'P' ||
    normalizedType === 'DRIVER' ||
    normalizedType === 'PUTTER'
  ) {
    return 7;
  }

  return 5.8;
};

const getWeightFallbackRegression = (
  anchorLength: number,
  anchorWeight: number,
): WeightRegression => {
  const slope = -8;
  return {
    slope,
    intercept: anchorWeight - slope * anchorLength,
  };
};

export const getWeightRegression = (
  clubs: Pick<GolfClub, 'length' | 'weight'>[],
): WeightRegression => {
  if (clubs.length === 0) {
    return { slope: -8, intercept: 620 };
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
  if (slope >= -1) {
    return getWeightFallbackRegression(meanLength, meanWeight);
  }

  return {
    slope,
    intercept: meanWeight - slope * meanLength,
  };
};

export const getExpectedWeight = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

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