import type { GolfClub } from '../types/golf';
import {
  lieStatusFromDeviation,
  resolveStandardLieAngle,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { sortClubsForDisplay } from './clubSort';
import { getAnalysisClubKey, getClubTypeDisplay } from './clubUtils';

export type ClubCategory = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export type WeightRegression = {
  slope: number;
  intercept: number;
};

type ClubVisibilityPredicate = (club: GolfClub) => boolean;

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
  swingStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
};

export type LieAnglePoint = GolfClub & {
  category: ClubCategory;
  standardLieAngle: number;
  deviationFromStandard: number;
  lieStatus: ReturnType<typeof lieStatusFromDeviation>;
};

type ChartSize = {
  width: number;
  height: number;
};

type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const WEIGHT_NORMAL_BAND_TOLERANCE = 12;
const WEIGHT_HEAVY_OUTLIER_THRESHOLD = 15;
const WEIGHT_LIGHT_OUTLIER_THRESHOLD = 15;

export const getLieBarColor = (category: ClubCategory): string => {
  switch (category) {
    case 'driver':
      return '#1976d2';
    case 'wood':
      return '#0d47a1';
    case 'hybrid':
      return '#26c6da';
    case 'iron':
      return '#2e7d32';
    case 'wedge':
      return '#9acd32';
    case 'putter':
      return '#424242';
  }
};

export const getClubCategoryByType = (clubType: string): ClubCategory => {
  if (clubType === 'Driver' || clubType === 'Putter') {
    return clubType.toLowerCase() as ClubCategory;
  }
  if (clubType === 'Wood') return 'wood';
  if (clubType === 'Hybrid') return 'hybrid';
  if (clubType === 'Iron') return 'iron';
  if (clubType === 'Wedge') return 'wedge';

  if (clubType === 'P') return 'putter';
  if (clubType === 'PW') return 'iron';
  if (clubType.endsWith('W') || clubType === 'D') return 'wood';
  if (clubType.endsWith('H')) return 'hybrid';
  if (clubType.endsWith('I')) return 'iron';
  return 'wedge';
};

export const getClubCategory = (club: GolfClub): ClubCategory =>
  getClubCategoryByType(club.clubType ?? '');

export const getEstimatedDistance = (club: GolfClub, headSpeed: number) => {
  const loftAngle = club.loftAngle ?? 0;
  const category = getClubCategoryByType(club.clubType ?? '');

  let baseline = 0;
  let speedPower = 1.0;

  switch (category) {
    case 'driver':
      baseline = 270.0 - 5.0 * loftAngle;
      speedPower = 1.15;
      break;
    case 'wood':
      baseline = 300.0 - 8.2222 * loftAngle + 0.1481 * loftAngle * loftAngle;
      speedPower = 1.14;
      break;
    case 'iron':
      baseline = 177.88 + 1.2559 * loftAngle - 0.0581 * loftAngle * loftAngle;
      speedPower = 1.08;
      break;
    case 'hybrid':
      baseline = 263.3333 - 3.3333 * loftAngle;
      speedPower = 1.12;
      break;
    case 'wedge':
      baseline = 235.0 - 2.5 * loftAngle;
      speedPower = 1.03;
      break;
    case 'putter':
      baseline = 10.0;
      speedPower = 1.0;
      break;
  }

  const speedRatio = Math.max(0.7, Math.min(1.35, headSpeed / 42));
  const speedFactor = Math.pow(speedRatio, speedPower);
  const estimated = baseline * speedFactor;
  const categoryAdjustment =
    category === 'driver'
      ? 1.05
      : category === 'wood'
        ? 1.02
        : category === 'wedge'
          ? 0.9
          : category === 'iron'
            ? 0.95
            : category === 'hybrid'
              ? 0.96
              : 1.0;

  return Math.max(0, Math.min(290, estimated * categoryAdjustment));
};

export const getCategoryColor = (category: ClubCategory) => {
  switch (category) {
    case 'driver':
      return '#1976d2';
    case 'wood':
      return '#0d47a1';
    case 'hybrid':
      return '#00acc1';
    case 'iron':
      return '#0b8f5b';
    case 'wedge':
      return '#9acd32';
    case 'putter':
      return '#616161';
  }
};

export const getCategoryLabel = (category: ClubCategory) => {
  switch (category) {
    case 'driver':
      return 'ドライバー';
    case 'wood':
      return 'ウッド';
    case 'hybrid':
      return 'ハイブリッド';
    case 'iron':
      return 'アイアン';
    case 'wedge':
      return 'ウェッジ';
    case 'putter':
      return 'パター';
  }
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
  if (deviation > WEIGHT_HEAVY_OUTLIER_THRESHOLD) {
    return 'バランス確認推奨';
  }
  if (deviation < -WEIGHT_LIGHT_OUTLIER_THRESHOLD) {
    return '軽量側の確認推奨';
  }
  if (Math.abs(deviation) <= WEIGHT_NORMAL_BAND_TOLERANCE) {
    return 'トレンド内';
  }
  return 'ややトレンド外';
};

export const getWeightDeviationLabel = (deviation: number) => {
  if (Math.abs(deviation) <= WEIGHT_NORMAL_BAND_TOLERANCE) {
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
  if (deviation > WEIGHT_HEAVY_OUTLIER_THRESHOLD) {
    return {
      fill: '#e53935',
      stroke: '#000000',
      strokeWidth: 3,
      radius: 7,
    };
  }

  if (deviation < -WEIGHT_LIGHT_OUTLIER_THRESHOLD) {
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

export const normalizeSwingWeightText = (value: string): string => {
  return (value ?? '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９．]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .toUpperCase()
    .replace(/\s+/g, '');
};

export const swingWeightToNumeric = (swingWeightRaw: string): number => {
  const normalized = normalizeSwingWeightText(swingWeightRaw);
  const fullMatch = normalized.match(/^([A-F])([0-9](?:\.[0-9])?)$/);
  const legacyMatch = normalized.match(/^([0-9](?:\.[0-9])?)$/);
  if (!fullMatch && !legacyMatch) return 0;

  const letter = fullMatch ? fullMatch[1] : 'D';
  const letterIndex = letter.charCodeAt(0) - 'D'.charCodeAt(0);
  const point = Number(fullMatch ? fullMatch[2] : legacyMatch?.[1]);
  if (!Number.isFinite(point) || point < 0 || point > 9.9) return 0;

  return letterIndex * 10 + point;
};

export const numericToSwingWeightLabel = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const letterIndex = Math.floor(rounded / 10);
  const point = rounded - letterIndex * 10;
  const letterCode = 'D'.charCodeAt(0) + letterIndex;

  if (letterCode < 'A'.charCodeAt(0) || letterCode > 'Z'.charCodeAt(0)) {
    return rounded.toFixed(1);
  }

  const pointLabel = Number.isInteger(point) ? point.toFixed(0) : point.toFixed(1);
  return `${String.fromCharCode(letterCode)}${pointLabel}`;
};

export const parseSwingWeightInput = (value: string): number | null => {
  const normalized = normalizeSwingWeightText(value);
  if (!normalized) return null;

  const fullMatch = normalized.match(/^([A-F])([0-9](?:\.[0-9])?)$/);
  const legacyMatch = normalized.match(/^([0-9](?:\.[0-9])?)$/);
  if (!fullMatch && !legacyMatch) return null;

  return swingWeightToNumeric(normalized);
};

export const getSwingStatus = (
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): '良好' | 'やや重い' | 'やや軽い' | '調整推奨' => {
  const abs = Math.abs(deviation);
  if (abs <= goodTolerance) return '良好';
  if (abs > adjustThreshold) return '調整推奨';
  return deviation > 0 ? 'やや重い' : 'やや軽い';
};

export const getSwingStatusColor = (
  status: '良好' | 'やや重い' | 'やや軽い' | '調整推奨',
) => {
  if (status === '良好') return '#2e7d32';
  if (status === '調整推奨') return '#c62828';
  return '#ef6c00';
};

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
  const abs = Math.abs(deviation);
  if (abs > adjustThreshold) {
    return { fill: '#e53935', stroke: '#b71c1c', strokeWidth: 2 };
  }
  if (deviation < -goodTolerance && abs <= adjustThreshold) {
    return { fill: getCategoryColor(category), stroke: '#ef6c00', strokeWidth: 2 };
  }
  if (abs > goodTolerance) {
    return { fill: '#fb8c00', stroke: '#e65100', strokeWidth: 1.8 };
  }
  return { fill: getCategoryColor(category), stroke: 'none', strokeWidth: 0 };
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const getTooltipPosition = (
  pointX: number,
  pointY: number,
  chartSize: { width: number; height: number },
  boxSize: { width: number; height: number },
) => {
  const margin = 10;
  const gap = 12;
  const usableWidth = Math.max(boxSize.width, 1);
  const usableHeight = Math.max(boxSize.height, 1);

  const preferAbove = pointY - usableHeight - gap >= margin;
  const preferredTop = preferAbove ? pointY - usableHeight - gap : pointY + gap;

  const top = clamp(
    preferredTop,
    margin,
    Math.max(margin, chartSize.height - usableHeight - margin),
  );
  const left = clamp(
    pointX - usableWidth / 2,
    margin,
    Math.max(margin, chartSize.width - usableWidth - margin),
  );

  return { left, top };
};

export const createLoftChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  axis: {
    minLoft: number;
    maxLoft: number;
    minDistance: number;
    maxDistance: number;
  },
) => {
  const mapX = (loftAngle: number) => {
    const plotWidth = chartSize.width - padding.left - padding.right;
    return padding.left + ((loftAngle - axis.minLoft) / (axis.maxLoft - axis.minLoft)) * plotWidth;
  };

  const mapY = (distance: number) => {
    const plotHeight = chartSize.height - padding.top - padding.bottom;
    return (
      chartSize.height -
      padding.bottom -
      ((distance - axis.minDistance) / (axis.maxDistance - axis.minDistance)) * plotHeight
    );
  };

  return { mapX, mapY };
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

export const createWeightChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  bounds: {
    minLength: number;
    maxLength: number;
    minWeight: number;
    maxWeight: number;
  },
) => {
  const mapX = (length: number) => {
    const plotWidth = chartSize.width - padding.left - padding.right;
    return padding.left + ((length - bounds.minLength) / (bounds.maxLength - bounds.minLength || 1)) * plotWidth;
  };

  const mapY = (weight: number) => {
    const plotHeight = chartSize.height - padding.top - padding.bottom;
    return (
      chartSize.height -
      padding.bottom -
      ((weight - bounds.minWeight) / (bounds.maxWeight - bounds.minWeight || 1)) * plotHeight
    );
  };

  return { mapX, mapY };
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

export const createSwingChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  chartMin: number,
  chartMax: number,
  clubCount: number,
) => {
  const mapY = (value: number) => {
    const plotHeight = chartSize.height - padding.top - padding.bottom;
    return (
      chartSize.height -
      padding.bottom -
      ((value - chartMin) / (chartMax - chartMin || 1)) * plotHeight
    );
  };

  const mapX = (index: number) => {
    const plotWidth = chartSize.width - padding.left - padding.right;
    return padding.left + (plotWidth / Math.max(1, clubCount)) * (index + 0.5);
  };

  const barWidth = Math.min(
    30,
    Math.max(
      12,
      ((chartSize.width - padding.left - padding.right) / Math.max(1, clubCount)) * 0.52,
    ),
  );

  return { mapX, mapY, barWidth };
};

export const createLieChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  minLie: number,
  maxLie: number,
  clubCount: number,
) => {
  const mapY = (deg: number) => {
    const plotHeight = chartSize.height - padding.top - padding.bottom;
    return chartSize.height - padding.bottom - ((deg - minLie) / (maxLie - minLie)) * plotHeight;
  };

  const mapX = (index: number) => {
    const plotWidth = chartSize.width - padding.left - padding.right;
    return padding.left + (plotWidth / Math.max(1, clubCount)) * (index + 0.5);
  };

  const barWidth = Math.min(
    32,
    Math.max(
      12,
      ((chartSize.width - padding.left - padding.right) / Math.max(1, clubCount)) * 0.55,
    ),
  );

  return { mapX, mapY, barWidth };
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

export const buildLoftDistanceAnalysis = (
  clubs: GolfClub[],
  headSpeed: number,
  isVisible: ClubVisibilityPredicate,
) => {
  const tableClubs = sortClubsForDisplay(
    clubs.filter((club) => club.loftAngle >= 5 && club.loftAngle <= 60),
  ).map((club) => ({
    ...club,
    estimatedDistance: getEstimatedDistance(club, headSpeed),
    actualDistance: club.distance ?? 0,
    category: getClubCategory(club),
  }));

  const chartClubs = tableClubs.filter(isVisible);

  return {
    tableClubs,
    chartClubs,
    hasAnyData: tableClubs.length > 0,
    hasVisibleData: chartClubs.length > 0,
  };
};

export const buildWeightLengthAnalysis = (
  clubs: GolfClub[],
  isVisible: ClubVisibilityPredicate,
) => {
  const baseClubs = clubs
    .filter(
      (club) =>
        Number.isFinite(club.length) &&
        Number.isFinite(club.weight) &&
        club.length > 0 &&
        club.weight > 0 &&
        getClubCategory(club) !== 'putter',
    )
    .map((club) => ({
      ...club,
      category: getClubCategory(club),
    }));

  const visibleBaseClubs = baseClubs.filter(isVisible);
  const regression = getWeightRegression(
    visibleBaseClubs.length > 0 ? visibleBaseClubs : baseClubs,
  );

  const tableClubs = baseClubs.map((club) => {
    const expectedWeight = getExpectedWeight(club.length, regression);
    const deviation = club.weight - expectedWeight;
    return {
      ...club,
      expectedWeight,
      deviation,
      weightTrendMessage: getWeightTrendMessage(deviation),
    };
  });

  const chartClubs = tableClubs.filter(isVisible);
  const hasVisibleData = chartClubs.length > 0;
  const bounds = hasVisibleData
    ? getWeightChartBounds(chartClubs, regression)
    : {
        minLength: 30,
        maxLength: 48,
        minWeight: 250,
        maxWeight: 550,
        xInterval: 2,
        yInterval: 50,
      };

  return {
    tableClubs,
    chartClubs,
    regression,
    bounds,
    lengthTicks: makeTickValues(bounds.minLength, bounds.maxLength, bounds.xInterval),
    weightTicks: makeTickValues(bounds.minWeight, bounds.maxWeight, bounds.yInterval),
    hasAnyData: tableClubs.length > 0,
    hasVisibleData,
  };
};

export const buildSwingWeightAnalysis = (
  clubs: GolfClub[],
  swingWeightTarget: number,
  swingGoodTolerance: number,
  swingAdjustThreshold: number,
  isVisible: ClubVisibilityPredicate,
) => {
  const tableClubs = sortClubsForDisplay(clubs.filter((club) => getClubCategory(club) !== 'putter'))
    .map((club) => {
      const category = getClubCategory(club);
      const swingWeightNumeric = swingWeightToNumeric(club.swingWeight ?? '');
      const swingDeviation = swingWeightNumeric - swingWeightTarget;
      const swingStatus = getSwingStatus(
        swingDeviation,
        swingGoodTolerance,
        swingAdjustThreshold,
      );

      return {
        ...club,
        category,
        swingWeightNumeric,
        swingDeviation,
        swingStatus,
      };
    });

  const chartClubs = tableClubs.filter(isVisible);
  const hasVisibleData = chartClubs.length > 0;
  const swingMinValue = hasVisibleData
    ? Math.min(...chartClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : -2;
  const swingMaxValue = hasVisibleData
    ? Math.max(...chartClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : 4;
  const chartMin = Math.floor(swingMinValue - 2);
  const chartMax = Math.ceil(swingMaxValue + 2);

  return {
    tableClubs,
    chartClubs,
    chartMin,
    chartMax,
    ticks: Array.from(
      { length: Math.max(2, chartMax - chartMin + 1) },
      (_, index) => chartMin + index,
    ).filter((tick) => tick % 2 === 0),
    hasAnyData: tableClubs.length > 0,
    hasVisibleData,
  };
};

export const buildLieAngleAnalysis = (
  clubs: GolfClub[],
  userLieAngleStandards: UserLieAngleStandards,
  isVisible: ClubVisibilityPredicate,
) => {
  const tableClubs = sortClubsForDisplay(clubs).map((club) => {
    const category = getClubCategory(club);
    const standardLieAngle = resolveStandardLieAngle(club, userLieAngleStandards);
    const deviationFromStandard = club.lieAngle - standardLieAngle;
    const lieStatus = lieStatusFromDeviation(deviationFromStandard);

    return {
      ...club,
      category,
      standardLieAngle,
      deviationFromStandard,
      lieStatus,
    };
  });

  return {
    tableClubs,
    chartClubs: tableClubs.filter(isVisible),
    hasAnyData: tableClubs.length > 0,
  };
};