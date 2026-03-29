import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { sortClubsForDisplay } from '../utils/clubSort';
import {
  DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE,
  compareLieStandardTypeOrder,
  displayLieStandardTypeLabel,
  fallbackLieStandardForType,
  getLieStandardTypeKeyForClub,
  type LieAngleStatus,
  lieStatusColor,
  lieStatusLabelJa,
  lieStatusFromDeviation,
  makePerClubLieStandardKey,
  resolveStandardLieAngle,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import './AnalysisScreen.css';

type AnalysisScreenProps = {
  clubs: GolfClub[];
  onBack: () => void;
  onUpdateActualDistance: (clubId: number, distance: number) => void;
  headSpeed: number;
  onHeadSpeedChange: (value: number) => void;
  hiddenAnalysisClubKeys: string[];
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  swingWeightTarget: number;
  swingGoodTolerance: number;
  swingAdjustThreshold: number;
  onSetSwingWeightTarget: (value: number) => void;
  onSetSwingGoodTolerance: (value: number) => void;
  onSetSwingAdjustThreshold: (value: number) => void;
  onResetSwingWeightTarget: () => void;
  onResetSwingThresholds: () => void;
  userLieAngleStandards: UserLieAngleStandards;
  onSetLieTypeStandard: (clubType: string, value: number) => void;
  onSetLieClubStandard: (clubName: string, value: number) => void;
  onClearLieTypeStandard: (clubType: string) => void;
  onClearLieClubStandard: (clubName: string) => void;
  onResetLieStandards: () => void;
};

type ClubCategory = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

const CHART_WIDTH = 920;
const CHART_HEIGHT = 360;
const PADDING = { top: 24, right: 28, bottom: 52, left: 60 };
const MIN_LOFT = 5;
const MAX_LOFT = 60;
const MIN_DISTANCE = 0;
const MAX_DISTANCE = 340;
const MIN_LENGTH = 30;
const MAX_LENGTH = 48;
const MIN_WEIGHT = 250;
const MAX_WEIGHT = 550;
const WEIGHT_NORMAL_BAND_TOLERANCE = 12;
const WEIGHT_OUTLIER_THRESHOLD = 15;

const LIE_MIN = 50;
const LIE_MAX = 70;
const LIE_GOOD_TOLERANCE = 1.5;
const LIE_PADDING = { top: 30, right: 28, bottom: 80, left: 56 };
const LIE_STANDARD_LINE_COLOR = '#00897b';

const SWING_PADDING = { top: 30, right: 28, bottom: 80, left: 56 };

const getLieBarColor = (category: ClubCategory): string => {
  switch (category) {
    case 'driver':
      return '#1976d2';
    case 'wood':
      return '#1976d2';
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

type WeightTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    expectedWeight: number;
    deviation: number;
    weightTrendMessage: string;
  };
};

type LoftTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    estimatedDistance: number;
    actualDistance: number;
  };
  pointType: 'estimated' | 'actual';
};

type LieTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    standardLieAngle: number;
    deviationFromStandard: number;
    lieStatus: LieAngleStatus;
  };
};

type SwingTooltipState = {
  x: number;
  y: number;
  club: GolfClub & {
    category: ClubCategory;
    swingWeightNumeric: number;
    swingDeviation: number;
    swingStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
  };
};

type TooltipBoxSize = {
  width: number;
  height: number;
};

const getClubCategoryByType = (clubType: string): ClubCategory => {
  // New category format (post-2026 update)
  if (clubType === 'Driver' || clubType === 'Putter') return clubType.toLowerCase() as ClubCategory;
  if (clubType === 'Wood') return 'wood';
  if (clubType === 'Hybrid') return 'hybrid';
  if (clubType === 'Iron') return 'iron';
  if (clubType === 'Wedge') return 'wedge';
  
  // Legacy format support (pre-2026)
  if (clubType === 'P') return 'putter';
  if (clubType === 'PW') return 'iron';
  if (clubType.endsWith('W') || clubType === 'D') return 'wood';
  if (clubType.endsWith('H')) return 'hybrid';
  if (clubType.endsWith('I')) return 'iron';
  return 'wedge';
};

const getEstimatedDistance = (club: GolfClub, headSpeed: number) => {
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
      speedPower = 1.00;
      break;
  }

  const speedRatio = Math.max(0.7, Math.min(1.35, headSpeed / 42));
  const speedFactor = Math.pow(speedRatio, speedPower);
  const estimated = baseline * speedFactor;
  const categoryAdjustment = category === 'driver' ? 1.05 : category === 'wood' ? 1.02 : category === 'wedge' ? 0.90 : category === 'iron' ? 0.95 : category === 'hybrid' ? 0.96 : 1.0;
  return Math.max(0, Math.min(290, estimated * categoryAdjustment));
};

const getClubCategory = (club: GolfClub): ClubCategory => getClubCategoryByType(club.clubType ?? '');

const getCategoryColor = (category: ClubCategory) => {
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

const getCategoryLabel = (category: ClubCategory) => {
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

const getWeightLengthDotRadius = (club: Pick<GolfClub, 'clubType'>) => {
  const normalizedType = (club.clubType ?? '').toUpperCase();
  if (normalizedType === 'D' || normalizedType === 'P' || normalizedType === 'DRIVER' || normalizedType === 'PUTTER') return 7;
  return 5.8;
};

type WeightRegression = {
  slope: number;
  intercept: number;
};

type WeightLengthPoint = GolfClub & {
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

const getWeightRegression = (
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

const getExpectedWeight = (length: number, regression: WeightRegression) =>
  regression.slope * length + regression.intercept;

const formatSignedGrams = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)} g`;

const getWeightTrendMessage = (deviation: number) => {
  if (deviation > WEIGHT_OUTLIER_THRESHOLD) {
    return 'バランス確認推奨';
  }
  if (deviation < -WEIGHT_OUTLIER_THRESHOLD) {
    return '軽量側の確認推奨';
  }
  if (Math.abs(deviation) <= WEIGHT_NORMAL_BAND_TOLERANCE) {
    return 'トレンド内';
  }
  return 'ややトレンド外';
};

const getWeightDeviationLabel = (deviation: number) => {
  if (Math.abs(deviation) <= WEIGHT_NORMAL_BAND_TOLERANCE) {
    return `${formatSignedGrams(deviation)} / トレンド内`;
  }
  return deviation > 0
    ? `${formatSignedGrams(deviation)} トレンドより重い`
    : `${formatSignedGrams(deviation)} トレンドより軽い`;
};

const getWeightPointStyle = (
  club: Pick<GolfClub, 'clubType'> & { category: ClubCategory },
  deviation: number,
) => {
  if (deviation > WEIGHT_OUTLIER_THRESHOLD) {
    return {
      fill: '#e53935',
      stroke: '#000000',
      strokeWidth: 3,
      radius: 7,
    };
  }

  if (deviation < -WEIGHT_OUTLIER_THRESHOLD) {
    return {
      fill: '#ff9800',
      stroke: '#8d4e00',
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

const getWeightChartBounds = (
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

const makeTickValues = (min: number, max: number, interval: number) => {
  const ticks: number[] = [];
  for (let value = min; value <= max; value += interval) {
    ticks.push(Number(value.toFixed(2)));
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }
  return ticks;
};

const normalizeSwingWeightText = (value: string): string => {
  return (value ?? '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９．]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .toUpperCase()
    .replace(/\s+/g, '');
};

const swingWeightToNumeric = (swingWeightRaw: string): number => {
  const normalized = normalizeSwingWeightText(swingWeightRaw);
  const fullMatch = normalized.match(/^([A-F])([0-9](?:\.[0-9])?)$/);
  const legacyMatch = normalized.match(/^([0-9](?:\.[0-9])?)$/);
  if (!fullMatch && !legacyMatch) return 0;

  // D0 is the baseline (0), so C9 becomes -1 and E1 becomes +11.
  const letter = fullMatch ? fullMatch[1] : 'D';
  const letterIndex = letter.charCodeAt(0) - 'D'.charCodeAt(0);
  const point = Number(fullMatch ? fullMatch[2] : legacyMatch?.[1]);
  if (!Number.isFinite(point) || point < 0 || point > 9.9) return 0;

  return letterIndex * 10 + point;
};

const numericToSwingWeightLabel = (value: number): string => {
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

const parseSwingWeightInput = (value: string): number | null => {
  const normalized = normalizeSwingWeightText(value);
  if (!normalized) return null;

  const fullMatch = normalized.match(/^([A-F])([0-9](?:\.[0-9])?)$/);
  const legacyMatch = normalized.match(/^([0-9](?:\.[0-9])?)$/);
  if (!fullMatch && !legacyMatch) return null;

  return swingWeightToNumeric(normalized);
};

const getSwingStatus = (
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): '良好' | 'やや重い' | 'やや軽い' | '調整推奨' => {
  const abs = Math.abs(deviation);
  if (abs <= goodTolerance) return '良好';
  if (abs > adjustThreshold) return '調整推奨';
  return deviation > 0 ? 'やや重い' : 'やや軽い';
};

const getSwingStatusColor = (status: '良好' | 'やや重い' | 'やや軽い' | '調整推奨') => {
  if (status === '良好') return '#2e7d32';
  if (status === '調整推奨') return '#c62828';
  return '#ef6c00';
};

const getSwingClubLabel = (club: Pick<GolfClub, 'clubType' | 'number' | 'name'>): string => {
  const typeLabel = getClubTypeDisplay(club.clubType, club.number).trim();
  if (typeLabel) return typeLabel;
  return (club.name ?? '').trim() || '-';
};

const getSwingBarColor = (
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getTooltipPosition = (
  pointX: number,
  pointY: number,
  chartSize: { width: number; height: number },
  boxSize: TooltipBoxSize,
) => {
  const margin = 10;
  const gap = 12;
  const usableWidth = Math.max(boxSize.width, 1);
  const usableHeight = Math.max(boxSize.height, 1);

  const preferAbove = pointY - usableHeight - gap >= margin;
  const preferredTop = preferAbove
    ? pointY - usableHeight - gap
    : pointY + gap;

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

export const AnalysisScreen = ({
  clubs,
  onBack,
  onUpdateActualDistance,
  headSpeed,
  onHeadSpeedChange,
  hiddenAnalysisClubKeys,
  onSetAnalysisClubVisible,
  swingWeightTarget,
  swingGoodTolerance,
  swingAdjustThreshold,
  onSetSwingWeightTarget,
  onSetSwingGoodTolerance,
  onSetSwingAdjustThreshold,
  onResetSwingWeightTarget,
  onResetSwingThresholds,
  userLieAngleStandards,
  onSetLieTypeStandard,
  onSetLieClubStandard,
  onClearLieTypeStandard,
  onClearLieClubStandard,
  onResetLieStandards,
}: AnalysisScreenProps) => {
  const [activeTab, setActiveTab] = useState<'weightLength' | 'loftDistance' | 'lieAngle' | 'swingWeight'>('loftDistance');
  const [showLieSettings, setShowLieSettings] = useState(false);
  const [showSwingSettings, setShowSwingSettings] = useState(false);
  const [rawLoftTooltip, setLoftTooltip] = useState<LoftTooltipState | null>(null);
  const [rawWeightTooltip, setWeightTooltip] = useState<WeightTooltipState | null>(null);
  const [rawSwingTooltip, setSwingTooltip] = useState<SwingTooltipState | null>(null);
  const [loftTooltipBox, setLoftTooltipBox] = useState<TooltipBoxSize>({ width: 200, height: 120 });
  const [weightTooltipBox, setWeightTooltipBox] = useState<TooltipBoxSize>({ width: 200, height: 110 });
  const [swingTooltipBox, setSwingTooltipBox] = useState<TooltipBoxSize>({ width: 220, height: 130 });
  const [loftChartSize, setLoftChartSize] = useState({ width: CHART_WIDTH, height: CHART_HEIGHT });
  const [weightChartSize, setWeightChartSize] = useState({ width: CHART_WIDTH, height: CHART_HEIGHT });
  const [swingChartSize, setSwingChartSize] = useState({ width: CHART_WIDTH, height: CHART_HEIGHT });
  const [rawLieTooltip, setLieTooltip] = useState<LieTooltipState | null>(null);
  const [lieTooltipBox, setLieTooltipBox] = useState<TooltipBoxSize>({ width: 200, height: 110 });
  const [lieChartSize, setLieChartSize] = useState({ width: CHART_WIDTH, height: CHART_HEIGHT });
  const loftChartContainerRef = useRef<HTMLDivElement | null>(null);
  const weightChartContainerRef = useRef<HTMLDivElement | null>(null);
  const swingChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lieChartContainerRef = useRef<HTMLDivElement | null>(null);
  const loftTooltipRef = useRef<HTMLDivElement | null>(null);
  const weightTooltipRef = useRef<HTMLDivElement | null>(null);
  const swingTooltipRef = useRef<HTMLDivElement | null>(null);
  const lieTooltipRef = useRef<HTMLDivElement | null>(null);

  const hiddenClubKeySet = new Set(hiddenAnalysisClubKeys);
  const isClubVisible = (club: GolfClub) => !hiddenClubKeySet.has(getAnalysisClubKey(club));
  const loftTooltip = rawLoftTooltip && isClubVisible(rawLoftTooltip.club) ? rawLoftTooltip : null;
  const weightTooltip = rawWeightTooltip && isClubVisible(rawWeightTooltip.club)
    ? rawWeightTooltip
    : null;
  const swingTooltip = rawSwingTooltip && isClubVisible(rawSwingTooltip.club)
    ? rawSwingTooltip
    : null;
  const lieTooltip = rawLieTooltip && isClubVisible(rawLieTooltip.club) ? rawLieTooltip : null;

  const loftTableClubs = sortClubsForDisplay(
    clubs.filter((club) => club.loftAngle >= MIN_LOFT && club.loftAngle <= MAX_LOFT),
  ).map((club) => ({
    ...club,
    estimatedDistance: getEstimatedDistance(club, headSpeed),
    actualDistance: club.distance ?? 0,
    category: getClubCategory(club),
  }));

  const chartClubs = loftTableClubs.filter(isClubVisible);

  const hasAnyLoftData = loftTableClubs.length > 0;
  const hasLoftData = chartClubs.length > 0;

  const loftTicks = [10, 20, 30, 40, 50, 60];
  const distanceTicks = [0, 50, 100, 150, 200, 250, 300];

  const weightLengthBaseClubs = clubs
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

  const visibleWeightLengthBaseClubs = weightLengthBaseClubs.filter(isClubVisible);
  const weightRegression = getWeightRegression(
    visibleWeightLengthBaseClubs.length > 0 ? visibleWeightLengthBaseClubs : weightLengthBaseClubs,
  );
  const weightLengthTableClubs = weightLengthBaseClubs.map((club) => {
    const expectedWeight = getExpectedWeight(club.length, weightRegression);
    const deviation = club.weight - expectedWeight;
    return {
      ...club,
      expectedWeight,
      deviation,
      weightTrendMessage: getWeightTrendMessage(deviation),
    };
  });
  const weightLengthClubs = weightLengthTableClubs.filter(isClubVisible);

  const hasAnyWeightLengthData = weightLengthTableClubs.length > 0;
  const hasWeightLengthData = weightLengthClubs.length > 0;
  const weightBounds = hasWeightLengthData
    ? getWeightChartBounds(weightLengthClubs, weightRegression)
    : {
        minLength: MIN_LENGTH,
        maxLength: MAX_LENGTH,
        minWeight: MIN_WEIGHT,
        maxWeight: MAX_WEIGHT,
        xInterval: 2,
        yInterval: 50,
      };
  const lengthTicks = makeTickValues(
    weightBounds.minLength,
    weightBounds.maxLength,
    weightBounds.xInterval,
  );
  const weightTicks = makeTickValues(
    weightBounds.minWeight,
    weightBounds.maxWeight,
    weightBounds.yInterval,
  );

  const swingWeightTableClubs = sortClubsForDisplay(
    clubs.filter((club) => getClubCategory(club) !== 'putter'),
  )
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
  const swingWeightClubs = swingWeightTableClubs.filter(isClubVisible);

  const hasAnySwingWeightData = swingWeightTableClubs.length > 0;
  const hasSwingWeightData = swingWeightClubs.length > 0;

  const lieAngleTableClubs = sortClubsForDisplay(clubs)
    .map((club) => {
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
  const lieAngleClubs = lieAngleTableClubs.filter(isClubVisible);
  const hasAnyLieAngleData = lieAngleTableClubs.length > 0;

  useEffect(() => {
    if (activeTab !== 'loftDistance') return;
    const container = loftChartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateSize = (nextWidth: number) => {
      const width = clamp(Math.round(nextWidth), 320, 1120);
      const height = clamp(Math.round(width * 0.43), 260, 430);
      setLoftChartSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'weightLength') return;
    const container = weightChartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateSize = (nextWidth: number) => {
      const width = clamp(Math.round(nextWidth), 320, 1120);
      const height = clamp(Math.round(width * 0.43), 260, 430);
      setWeightChartSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!loftTooltip || !loftTooltipRef.current) return;
    const rect = loftTooltipRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width <= 0 || height <= 0) return;
    setLoftTooltipBox((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [loftTooltip]);

  useEffect(() => {
    if (!weightTooltip || !weightTooltipRef.current) return;
    const rect = weightTooltipRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width <= 0 || height <= 0) return;
    setWeightTooltipBox((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [weightTooltip]);

  useEffect(() => {
    if (activeTab !== 'swingWeight') return;
    const container = swingChartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateSize = (nextWidth: number) => {
      const width = clamp(Math.round(nextWidth), 320, 1120);
      const height = clamp(Math.round(width * 0.43), 260, 430);
      setSwingChartSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!swingTooltip || !swingTooltipRef.current) return;
    const rect = swingTooltipRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width <= 0 || height <= 0) return;
    setSwingTooltipBox((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [swingTooltip]);

  useEffect(() => {
    if (activeTab !== 'lieAngle') return;
    const container = lieChartContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const updateSize = (nextWidth: number) => {
      const width = clamp(Math.round(nextWidth), 320, 1120);
      const height = clamp(Math.round(width * 0.43), 260, 430);
      setLieChartSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };
    updateSize(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!lieTooltip || !lieTooltipRef.current) return;
    const rect = lieTooltipRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width <= 0 || height <= 0) return;
    setLieTooltipBox((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [lieTooltip]);

  const mapLoftX = (loftAngle: number) => {
    const plotWidth = loftChartSize.width - PADDING.left - PADDING.right;
    return PADDING.left + ((loftAngle - MIN_LOFT) / (MAX_LOFT - MIN_LOFT)) * plotWidth;
  };

  const mapLoftY = (distance: number) => {
    const plotHeight = loftChartSize.height - PADDING.top - PADDING.bottom;
    return (
      loftChartSize.height -
      PADDING.bottom -
      ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * plotHeight
    );
  };

  const actualLinePoints = chartClubs
    .filter((club) => club.actualDistance > 0)
    .map((club) => `${mapLoftX(club.loftAngle)},${mapLoftY(club.actualDistance)}`)
    .join(' ');

  const weightPadding = { top: 24, right: 28, bottom: 52, left: 60 };
  const mapWeightLengthX = (length: number) => {
    const plotWidth = weightChartSize.width - weightPadding.left - weightPadding.right;
    return weightPadding.left + ((length - weightBounds.minLength) / (weightBounds.maxLength - weightBounds.minLength || 1)) * plotWidth;
  };
  const mapWeightLengthY = (weight: number) => {
    const plotHeight = weightChartSize.height - weightPadding.top - weightPadding.bottom;
    return (
      weightChartSize.height -
      weightPadding.bottom -
      ((weight - weightBounds.minWeight) / (weightBounds.maxWeight - weightBounds.minWeight || 1)) * plotHeight
    );
  };

  const weightTrendLinePoints = hasWeightLengthData
    ? [weightBounds.minLength, weightBounds.maxLength]
        .map((length) => `${mapWeightLengthX(length)},${mapWeightLengthY(getExpectedWeight(length, weightRegression))}`)
        .join(' ')
    : '';

  const weightTrendBandPoints = hasWeightLengthData
    ? `${[weightBounds.minLength, weightBounds.maxLength]
        .map((length) => `${mapWeightLengthX(length)},${mapWeightLengthY(getExpectedWeight(length, weightRegression) + WEIGHT_NORMAL_BAND_TOLERANCE)}`)
        .join(' ')} ${[weightBounds.maxLength, weightBounds.minLength]
        .map((length) => `${mapWeightLengthX(length)},${mapWeightLengthY(getExpectedWeight(length, weightRegression) - WEIGHT_NORMAL_BAND_TOLERANCE)}`)
        .join(' ')}`
    : '';

  const weightTooltipPos = weightTooltip
    ? getTooltipPosition(weightTooltip.x, weightTooltip.y, weightChartSize, weightTooltipBox)
    : null;

  const swingTooltipPos = swingTooltip
    ? getTooltipPosition(swingTooltip.x, swingTooltip.y, swingChartSize, swingTooltipBox)
    : null;

  const loftTooltipPos = loftTooltip
    ? getTooltipPosition(loftTooltip.x, loftTooltip.y, loftChartSize, loftTooltipBox)
    : null;

  const lieTooltipPos = lieTooltip
    ? getTooltipPosition(lieTooltip.x, lieTooltip.y, lieChartSize, lieTooltipBox)
    : null;

  const swingMinValue = hasSwingWeightData
    ? Math.min(...swingWeightClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : -2;
  const swingMaxValue = hasSwingWeightData
    ? Math.max(...swingWeightClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : 4;
  const swingChartMin = Math.floor(swingMinValue - 2);
  const swingChartMax = Math.ceil(swingMaxValue + 2);
  const swingTicks = Array.from(
    { length: Math.max(2, swingChartMax - swingChartMin + 1) },
    (_, index) => swingChartMin + index,
  ).filter((tick) => tick % 2 === 0);

  const mapSwingY = (value: number) => {
    const plotHeight = swingChartSize.height - SWING_PADDING.top - SWING_PADDING.bottom;
    return (
      swingChartSize.height -
      SWING_PADDING.bottom -
      ((value - swingChartMin) / (swingChartMax - swingChartMin || 1)) * plotHeight
    );
  };

  const mapSwingX = (index: number) => {
    const plotWidth = swingChartSize.width - SWING_PADDING.left - SWING_PADDING.right;
    return SWING_PADDING.left + (plotWidth / Math.max(1, swingWeightClubs.length)) * (index + 0.5);
  };

  const swingBarWidth = Math.min(
    30,
    Math.max(
      12,
      ((swingChartSize.width - SWING_PADDING.left - SWING_PADDING.right) /
        Math.max(1, swingWeightClubs.length)) *
        0.52,
    ),
  );

  const mapLieY = (deg: number) => {
    const plotHeight = lieChartSize.height - LIE_PADDING.top - LIE_PADDING.bottom;
    return lieChartSize.height - LIE_PADDING.bottom - ((deg - LIE_MIN) / (LIE_MAX - LIE_MIN)) * plotHeight;
  };

  const mapLieX = (index: number) => {
    const plotWidth = lieChartSize.width - LIE_PADDING.left - LIE_PADDING.right;
    return LIE_PADDING.left + (plotWidth / Math.max(1, lieAngleClubs.length)) * (index + 0.5);
  };

  const lieBarWidth = Math.min(32, Math.max(12, ((lieChartSize.width - LIE_PADDING.left - LIE_PADDING.right) / Math.max(1, lieAngleClubs.length)) * 0.55));
  const lieTicks = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70];
  const standardLieLinePoints = lieAngleClubs
    .map((club, index) => `${mapLieX(index)},${mapLieY(club.standardLieAngle)}`)
    .join(' ');
  const upperGoodRangePoints = lieAngleClubs
    .map((club, index) => `${mapLieX(index)},${mapLieY(Math.min(LIE_MAX, club.standardLieAngle + LIE_GOOD_TOLERANCE))}`)
    .join(' ');
  const goodRangePolygonPoints = lieAngleClubs.length > 1
    ? `${upperGoodRangePoints} ${lieAngleClubs
      .map((club, index) => `${mapLieX(lieAngleClubs.length - 1 - index)},${mapLieY(Math.max(LIE_MIN, club.standardLieAngle - LIE_GOOD_TOLERANCE))}`)
      .join(' ')}`
    : '';

  const handleActualDistanceChange = (clubId: number | undefined, event: ChangeEvent<HTMLInputElement>) => {
    if (clubId == null) return;
    const nextValue = Number(event.target.value);
    onUpdateActualDistance(clubId, Number.isFinite(nextValue) ? nextValue : 0);
  };

  const handleHeadSpeedChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) {
      onHeadSpeedChange(42);
      return;
    }
    onHeadSpeedChange(Math.max(30, Math.min(60, nextValue)));
  };

  const renderSelectionHeader = () => <th className="analysis-select-column">表示</th>;

  const renderSelectionCell = (club: GolfClub) => {
    const clubKey = getAnalysisClubKey(club);
    const checked = !hiddenClubKeySet.has(clubKey);

    return (
      <td className="analysis-select-cell">
        <input
          type="checkbox"
          className="analysis-checkbox"
          checked={checked}
          onChange={(event) => onSetAnalysisClubVisible(clubKey, event.target.checked)}
          aria-label={`${getClubTypeDisplay(club.clubType, club.number)} ${club.name} をグラフに表示`}
        />
      </td>
    );
  };

  return (
    <div className="analysis-screen">
      <div className="analysis-header">
        <div>
          <p className="analysis-eyebrow">分析ビュー</p>
          <h1>
            {activeTab === 'weightLength'
              ? '重量 - 長さ'
              : activeTab === 'loftDistance'
                ? 'ロフト - 飛距離'
                : activeTab === 'swingWeight'
                  ? 'スイングウェイト分布'
                  : 'ライ角分布'}
          </h1>
          {activeTab === 'weightLength' ? (
            <p className="analysis-subtitle">
              <p>回帰トレンドからの偏差で、重すぎるクラブと軽すぎるクラブをすぐに判別できます。</p>
            </p>
          ) : activeTab === 'loftDistance' ? (
            <p className="analysis-subtitle">
              推定飛距離はクラブ種別ごとの個別カーブを使い、42 m/s 基準でヘッドスピード補正しています。
            </p>
          ) : activeTab === 'swingWeight' ? (
            <p className="analysis-subtitle">
              D2 を基準にスイングウェイトのばらつきを可視化し、調整が必要なクラブを特定できます。
            </p>
          ) : (
            <p className="analysis-subtitle">
              全クラブのライ角分布を確認し、アイアンセットの一貫性やフィッティング問題を把握できます。
            </p>
          )}
          <div className="analysis-tab-nav" role="tablist" aria-label="分析タブ">
            <button
              className={`analysis-tab-btn ${activeTab === 'loftDistance' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'loftDistance'}
              onClick={() => setActiveTab('loftDistance')}
            >
              ロフトと飛距離
            </button>
            <button
              className={`analysis-tab-btn ${activeTab === 'lieAngle' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'lieAngle'}
              onClick={() => setActiveTab('lieAngle')}
            >
              ライ角分布
            </button>
            <button
              className={`analysis-tab-btn ${activeTab === 'weightLength' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'weightLength'}
              onClick={() => setActiveTab('weightLength')}
            >
              重量と長さ
            </button>
            <button
              className={`analysis-tab-btn ${activeTab === 'swingWeight' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'swingWeight'}
              onClick={() => setActiveTab('swingWeight')}
            >
              SW分布
            </button>
          </div>
        </div>
        <div className="analysis-controls">
          {activeTab === 'loftDistance' && (
            <label className="headspeed-control">
              <span>ヘッドスピード</span>
              <div className="headspeed-input-wrap">
                <input
                  type="number"
                  min="30"
                  max="60"
                  step="0.1"
                  value={headSpeed}
                  onChange={handleHeadSpeedChange}
                  className="analysis-input headspeed-input"
                />
                <em>m/s</em>
              </div>
            </label>
          )}
          {activeTab === 'swingWeight' && (
            <button className="btn-secondary" onClick={() => setShowSwingSettings((prev) => !prev)}>
              {showSwingSettings ? 'SW目安設定を閉じる' : 'SW目安設定を開く'}
            </button>
          )}
          {activeTab === 'lieAngle' && (
            <button className="btn-secondary" onClick={() => setShowLieSettings((prev) => !prev)}>
              {showLieSettings ? '基準値設定を閉じる' : '基準値設定を開く'}
            </button>
          )}
          <button className="btn-secondary" onClick={onBack}>
            クラブ一覧へ戻る
          </button>
        </div>
      </div>

      {activeTab === 'loftDistance' ? (
        <>
          <div className="analysis-card chart-card">
            {hasAnyLoftData ? (
              <>
                <div className="analysis-legend">
                  <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
                  <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
                  <span><i style={{ backgroundColor: '#26c6da' }} />ハイブリッド</span>
                  <span><i style={{ backgroundColor: '#2e8b57' }} />アイアン</span>
                  <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
                  <span><i className="legend-estimated" />推定</span>
                  <span><i className="legend-actual" />実測</span>
                  <span><i className="legend-actual-line" />実測ライン</span>
                </div>

                {hasLoftData ? (
                  <div
                    className="chart-scroll interactive-chart-scroll"
                    ref={loftChartContainerRef}
                    onMouseLeave={() => setLoftTooltip(null)}
                  >
                    <svg
                      viewBox={`0 0 ${loftChartSize.width} ${loftChartSize.height}`}
                      className="analysis-chart loft-analysis-chart"
                      role="img"
                      aria-label="ロフトと飛距離の散布図"
                    >
                      <rect
                        x={PADDING.left}
                        y={PADDING.top}
                        width={loftChartSize.width - PADDING.left - PADDING.right}
                        height={loftChartSize.height - PADDING.top - PADDING.bottom}
                        fill="#ffffff"
                        rx="18"
                      />

                      {distanceTicks.map((tick) => (
                        <g key={`y-${tick}`}>
                          <line
                            x1={PADDING.left}
                            x2={CHART_WIDTH - PADDING.right}
                            y1={mapLoftY(tick)}
                            y2={mapLoftY(tick)}
                            className="chart-grid chart-grid-animated"
                          />
                          <text x={PADDING.left - 12} y={mapLoftY(tick) + 4} textAnchor="end" className="chart-axis-label">
                            {tick}
                          </text>
                        </g>
                      ))}

                      {loftTicks.map((tick) => (
                        <g key={`x-${tick}`}>
                          <line
                            x1={mapLoftX(tick)}
                            x2={mapLoftX(tick)}
                            y1={PADDING.top}
                            y2={loftChartSize.height - PADDING.bottom}
                            className="chart-grid chart-grid-animated"
                          />
                          <text x={mapLoftX(tick)} y={loftChartSize.height - 24} textAnchor="middle" className="chart-axis-label">
                            {tick}°
                          </text>
                        </g>
                      ))}

                      {actualLinePoints && (
                        <polyline
                          points={actualLinePoints}
                          fill="none"
                          stroke="#ff8f00"
                          strokeWidth="2.5"
                          className="chart-line-animated"
                        />
                      )}

                      {chartClubs.map((club, index) => (
                        <g
                          key={getAnalysisClubKey(club)}
                          style={{ '--point-delay': `${index * 50}ms` } as CSSProperties}
                        >
                          <circle
                            cx={mapLoftX(club.loftAngle)}
                            cy={mapLoftY(club.estimatedDistance)}
                            r="8.5"
                            fill="#ffffff"
                            stroke={getCategoryColor(club.category)}
                            strokeWidth="3"
                            className="chart-point-circle"
                            onMouseEnter={() =>
                              setLoftTooltip({
                                x: mapLoftX(club.loftAngle),
                                y: mapLoftY(club.estimatedDistance),
                                club,
                                pointType: 'estimated',
                              })
                            }
                            onClick={() =>
                              setLoftTooltip({
                                x: mapLoftX(club.loftAngle),
                                y: mapLoftY(club.estimatedDistance),
                                club,
                                pointType: 'estimated',
                              })
                            }
                          >
                            <title>{`${club.name} | ロフト ${club.loftAngle}° | 推定 ${club.estimatedDistance.toFixed(0)}y`}</title>
                          </circle>
                          {club.actualDistance > 0 && (
                            <circle
                              cx={mapLoftX(club.loftAngle)}
                              cy={mapLoftY(club.actualDistance)}
                              r="8.5"
                              fill={getCategoryColor(club.category)}
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="chart-point-circle"
                              onMouseEnter={() =>
                                setLoftTooltip({
                                  x: mapLoftX(club.loftAngle),
                                  y: mapLoftY(club.actualDistance),
                                  club,
                                  pointType: 'actual',
                                })
                              }
                              onClick={() =>
                                setLoftTooltip({
                                  x: mapLoftX(club.loftAngle),
                                  y: mapLoftY(club.actualDistance),
                                  club,
                                  pointType: 'actual',
                                })
                              }
                            >
                              <title>{`${club.name} | ロフト ${club.loftAngle}° | 実測 ${club.actualDistance.toFixed(0)}y`}</title>
                            </circle>
                          )}
                          <text
                            x={mapLoftX(club.loftAngle) + 10}
                            y={mapLoftY(club.estimatedDistance) - 10}
                            className="chart-point-label"
                          >
                            {club.name}
                          </text>
                        </g>
                      ))}

                      <text
                        x={loftChartSize.width / 2}
                        y={loftChartSize.height - 2}
                        textAnchor="middle"
                        className="chart-title-label"
                      >
                        ロフト角（度）
                      </text>
                      <text
                        x="10"
                        y={loftChartSize.height / 2}
                        textAnchor="middle"
                        transform={`rotate(-90 10 ${loftChartSize.height / 2})`}
                        className="chart-title-label"
                      >
                        飛距離（ヤード）
                      </text>
                    </svg>
                    {loftTooltip && (
                      <div
                        ref={loftTooltipRef}
                        className="chart-tooltip"
                        style={{
                          left: loftTooltipPos?.left,
                          top: loftTooltipPos?.top,
                        }}
                      >
                        <div className="chart-tooltip-title">{loftTooltip.club.name}</div>
                        <div className="chart-tooltip-list">
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">クラブ種別</span>
                            <span className="chart-tooltip-value">{getClubTypeDisplay(loftTooltip.club.clubType, loftTooltip.club.number)}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">ロフト</span>
                            <span className="chart-tooltip-value">{loftTooltip.club.loftAngle.toFixed(1)}°</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">推定</span>
                            <span className="chart-tooltip-value">{loftTooltip.club.estimatedDistance.toFixed(0)} y</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">実測</span>
                            <span className="chart-tooltip-value">
                              {loftTooltip.club.actualDistance > 0 ? `${loftTooltip.club.actualDistance.toFixed(0)} y` : '-'}
                            </span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">選択点</span>
                            <span className="chart-tooltip-value">{loftTooltip.pointType === 'estimated' ? '推定ポイント' : '実測ポイント'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="analysis-empty">表示するクラブを選択してください</div>
                )}
              </>
            ) : (
              <div className="analysis-empty">クラブがまだ追加されていません</div>
            )}
          </div>

          <div className="analysis-card table-card">
            <div className="analysis-table-header">
              <h2>クラブデータ</h2>
              <p>実測飛距離は一覧データに直接反映されます。</p>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    {renderSelectionHeader()}
                    <th>クラブ</th>
                    <th>ロフト</th>
                    <th>推定</th>
                    <th>実測</th>
                  </tr>
                </thead>
                <tbody>
                  {loftTableClubs.map((club) => (
                    <tr key={`row-${getAnalysisClubKey(club)}`}>
                      {renderSelectionCell(club)}
                      <td>
                        <div className="analysis-club-name">
                          <span className="analysis-club-type">{getClubTypeDisplay(club.clubType, club.number)}</span>
                          <span>{club.name}</span>
                        </div>
                      </td>
                      <td>{club.loftAngle.toFixed(1)}°</td>
                      <td>{club.estimatedDistance.toFixed(0)} y</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={club.actualDistance || ''}
                          onChange={(event) => handleActualDistanceChange(club.id, event)}
                          className="analysis-input"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'lieAngle' ? (
        <>
          {showLieSettings && (
            <div className="analysis-card lie-settings-card">
              <div className="analysis-table-header">
                <h2>ライ角基準値設定</h2>
                <p>まずはクラブタイプ別を設定し、必要なクラブだけ個別上書きを入れてください。</p>
              </div>
              <div className="lie-settings-guide" role="note" aria-label="ライ角基準値設定の使い方">
                <div className="lie-settings-guide-title">使い方（おすすめ手順）</div>
                <ul className="lie-settings-guide-list">
                  <li>1. 先に「クラブタイプ別（基本）」を設定する</li>
                  <li>2. ずれが気になるクラブだけ「クラブ別 override」を設定する</li>
                  <li>3. 入力後は Enter またはフォーカス移動で保存。解除で元に戻せます</li>
                </ul>
              </div>
              <div className="lie-settings-grid">
                <div className="lie-settings-section">
                  <div className="lie-settings-section-title">1) クラブタイプ別（基本）</div>
                  {[...new Set([...Object.keys(DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE), ...clubs.map(getLieStandardTypeKeyForClub)])]
                    .sort(compareLieStandardTypeOrder)
                    .map((clubType) => (
                      <LieStandardInputRow
                        key={`type-${clubType}`}
                        label={displayLieStandardTypeLabel(clubType)}
                        defaultValue={DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[clubType] ?? fallbackLieStandardForType(clubType)}
                        currentValue={userLieAngleStandards.byClubType[clubType]}
                        onCommit={(value) => onSetLieTypeStandard(clubType, value)}
                        onClear={() => onClearLieTypeStandard(clubType)}
                      />
                    ))}
                </div>
                <div className="lie-settings-section">
                  <div className="lie-settings-section-title">2) クラブ別 override（必要なものだけ）</div>
                  {lieAngleTableClubs.map((club) => (
                    <LieStandardInputRow
                      key={`club-${getAnalysisClubKey(club)}`}
                      label={`${club.name} ${club.number}`.trim()}
                      subLabel={club.clubType}
                      defaultValue={club.standardLieAngle}
                      currentValue={
                        userLieAngleStandards.byClubName[
                          makePerClubLieStandardKey(club.name, club.clubType, club.number)
                        ] ?? userLieAngleStandards.byClubName[
                          makePerClubLieStandardKey(club.name, club.clubType)
                        ]
                      }
                      onCommit={(value) =>
                        onSetLieClubStandard(
                          makePerClubLieStandardKey(club.name, club.clubType, club.number),
                          value,
                        )
                      }
                      onClear={() =>
                        onClearLieClubStandard(
                          makePerClubLieStandardKey(club.name, club.clubType, club.number),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="lie-settings-actions">
                <button className="btn-secondary" onClick={onResetLieStandards}>全てリセット</button>
              </div>
            </div>
          )}

          <div className="analysis-card chart-card lie-angle-frame">
            {hasAnyLieAngleData ? (
              <>
                <div className="analysis-legend">
                  <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
                  <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
                  <span><i style={{ backgroundColor: '#26c6da' }} />ハイブリッド</span>
                  <span><i style={{ backgroundColor: '#2e8b57' }} />アイアン</span>
                  <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
                  <span><i style={{ backgroundColor: '#424242' }} />パター</span>
                  <span><i className="legend-good-range" />良好範囲 ±1.5°</span>
                  <span><i className="legend-standard-line" />基準値ライン</span>
                  <span><i style={{ backgroundColor: '#fb8c00', border: '1.5px solid #e65100', boxSizing: 'border-box' }} />ややズレ</span>
                  <span><i style={{ backgroundColor: '#c62828' }} />調整推奨</span>
                </div>
                {lieAngleClubs.length > 0 ? (
                  <div
                    className="chart-scroll interactive-chart-scroll"
                    ref={lieChartContainerRef}
                    onMouseLeave={() => setLieTooltip(null)}
                  >
                    <svg
                      viewBox={`0 0 ${lieChartSize.width} ${lieChartSize.height}`}
                      className="analysis-chart lie-analysis-chart"
                      role="img"
                      aria-label="ライ角分布の棒グラフ"
                    >
                    <rect
                      x={LIE_PADDING.left}
                      y={LIE_PADDING.top}
                      width={lieChartSize.width - LIE_PADDING.left - LIE_PADDING.right}
                      height={lieChartSize.height - LIE_PADDING.top - LIE_PADDING.bottom}
                      fill="#ffffff"
                      rx="18"
                    />
                    {lieTicks.map((tick) => (
                      <g key={`lie-y-${tick}`}>
                        <line
                          x1={LIE_PADDING.left}
                          x2={lieChartSize.width - LIE_PADDING.right}
                          y1={mapLieY(tick)}
                          y2={mapLieY(tick)}
                          className="chart-grid chart-grid-animated"
                        />
                        <text
                          x={LIE_PADDING.left - 8}
                          y={mapLieY(tick) + 4}
                          textAnchor="end"
                          className="chart-axis-label"
                        >
                          {tick}°
                        </text>
                      </g>
                    ))}
                    {goodRangePolygonPoints && (
                      <polygon
                        points={goodRangePolygonPoints}
                        fill="#2e7d32"
                        fillOpacity="0.16"
                      />
                    )}
                    {standardLieLinePoints && (
                      <polyline
                        points={standardLieLinePoints}
                        fill="none"
                        stroke={LIE_STANDARD_LINE_COLOR}
                        strokeWidth="3"
                        className="chart-standard-line"
                      />
                    )}
                    {lieAngleClubs.map((club, index) => {
                      const cx = mapLieX(index);
                      const bw = lieBarWidth;
                      const barBottom = mapLieY(LIE_MIN);
                      const lieVal = club.lieAngle;
                      const barTop = mapLieY(Math.min(Math.max(lieVal, LIE_MIN), LIE_MAX));
                      const barHeight = Math.max(0, barBottom - barTop);
                      const standardY = mapLieY(club.standardLieAngle);
                      const status = club.lieStatus;
                      const outOfRange = status === 'Adjust Recommended';
                      const barColor = outOfRange ? '#c62828' : getLieBarColor(club.category);
                      const deviation = club.deviationFromStandard;
                      return (
                        <g key={`lie-bar-${getAnalysisClubKey(club)}`}>
                          <circle
                            cx={cx}
                            cy={standardY}
                            r="4"
                            fill={LIE_STANDARD_LINE_COLOR}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            className="chart-standard-point"
                          >
                            <title>{`${club.name} | 基準ライ角 ${club.standardLieAngle.toFixed(1)}°`}</title>
                          </circle>
                          <rect
                            x={cx - bw / 2}
                            y={mapLieY(LIE_MAX)}
                            width={bw}
                            height={mapLieY(LIE_MIN) - mapLieY(LIE_MAX)}
                            fill="#e6efe8"
                            rx="4"
                          />
                          <rect
                            x={cx - bw / 2}
                            y={barTop}
                            width={bw}
                            height={barHeight}
                            fill={barColor}
                            rx="4"
                            stroke={status === 'Slightly Off' ? '#ef6c00' : outOfRange ? '#8e0000' : 'none'}
                            strokeWidth={status === 'Slightly Off' || outOfRange ? 2 : 0}
                            className="lie-angle-bar"
                            style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                            onMouseEnter={() => setLieTooltip({ x: cx, y: barTop, club })}
                            onClick={() => setLieTooltip({ x: cx, y: barTop, club })}
                          >
                            <title>{`${club.name} | ライ角 ${lieVal.toFixed(1)}° | 基準 ${club.standardLieAngle.toFixed(1)}° | 偏差 ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}°`}</title>
                          </rect>
                          <g transform={`translate(${cx}, ${lieChartSize.height - LIE_PADDING.bottom + 20})`}>
                            <text
                              textAnchor="end"
                              transform="rotate(-40)"
                              className="chart-axis-label"
                            >
                              {club.name}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                    <text
                      x={lieChartSize.width / 2}
                      y={lieChartSize.height - 2}
                      textAnchor="middle"
                      className="chart-title-label"
                    >
                      クラブ
                    </text>
                    <text
                      x="20"
                      y={lieChartSize.height / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 20 ${lieChartSize.height / 2})`}
                      className="chart-title-label"
                    >
                      ライ角（度）
                    </text>
                    </svg>
                    {lieTooltip && (
                      <div
                        ref={lieTooltipRef}
                        className="chart-tooltip"
                        style={{
                          left: lieTooltipPos?.left,
                          top: lieTooltipPos?.top,
                        }}
                      >
                        <div className="chart-tooltip-title">{lieTooltip.club.name}</div>
                        <div className="chart-tooltip-list">
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">クラブ種別</span>
                            <span className="chart-tooltip-value">{getClubTypeDisplay(lieTooltip.club.clubType, lieTooltip.club.number)}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">ライ角</span>
                            <span className="chart-tooltip-value">{lieTooltip.club.lieAngle.toFixed(1)}°</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">基準値</span>
                            <span className="chart-tooltip-value">{lieTooltip.club.standardLieAngle.toFixed(1)}°</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">偏差</span>
                            <span className="chart-tooltip-value">
                              {lieTooltip.club.deviationFromStandard >= 0 ? '+' : ''}
                              {lieTooltip.club.deviationFromStandard.toFixed(1)}°
                            </span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">状態</span>
                            <span className="chart-tooltip-value">{lieStatusLabelJa(lieTooltip.club.lieStatus)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="analysis-empty">表示するクラブを選択してください</div>
                )}
              </>
            ) : (
              <div className="analysis-empty">クラブがまだ追加されていません</div>
            )}
          </div>

          <div className="analysis-card table-card">
            <div className="analysis-table-header">
              <h2>ライ角サマリー</h2>
              <p>クラブ別基準ライ角からの偏差とフィッティング推奨ステータス一覧です。</p>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    {renderSelectionHeader()}
                    <th>クラブ名</th>
                    <th>種類</th>
                    <th>計測値（°）</th>
                    <th>基準値（°）</th>
                    <th>偏差（°）</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {lieAngleTableClubs.map((club) => {
                    const deviation = club.deviationFromStandard;
                    const status = club.lieStatus;
                    return (
                      <tr key={`lie-row-${getAnalysisClubKey(club)}`}>
                        {renderSelectionCell(club)}
                        <td>
                          <div className="analysis-club-name">
                            <span className="analysis-club-type">{getClubTypeDisplay(club.clubType, club.number)}</span>
                            <span>{club.name}</span>
                          </div>
                        </td>
                        <td>{getCategoryLabel(club.category)}</td>
                        <td>{club.lieAngle.toFixed(1)}</td>
                        <td>{club.standardLieAngle.toFixed(1)}</td>
                        <td>{deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}°</td>
                        <td>
                          <span
                            className={
                              status === 'Good'
                                ? 'lie-status-good'
                                : status === 'Slightly Off'
                                  ? 'lie-status-slight'
                                  : 'lie-status-adjust'
                            }
                            style={{ color: lieStatusColor(status) }}
                          >
                            {lieStatusLabelJa(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'swingWeight' ? (
        <>
          {showSwingSettings && (
            <div className="analysis-card lie-settings-card">
              <div className="analysis-table-header">
                <h2>スイングウェイト目安設定</h2>
                <p>目安ターゲットを設定すると、偏差とステータス判定に即時反映されます。</p>
              </div>
              <div className="lie-settings-guide" role="note" aria-label="スイングウェイト目安設定の使い方">
                <div className="lie-settings-guide-title">使い方</div>
                <ul className="lie-settings-guide-list">
                  <li>1. 目安ターゲットを 0.1 刻みで入力する</li>
                  <li>2. 良好範囲と調整推奨の閾値を必要に応じて変更する</li>
                  <li>3. 棒グラフの目安ラインと偏差表示でバランスを確認する</li>
                </ul>
              </div>
              <div className="lie-settings-grid">
                <div className="lie-settings-section">
                  <div className="lie-settings-section-title">目安ターゲット</div>
                  <SwingTargetInputRow
                    value={swingWeightTarget}
                    onCommit={onSetSwingWeightTarget}
                    onReset={onResetSwingWeightTarget}
                  />
                </div>
                <div className="lie-settings-section">
                  <div className="lie-settings-section-title">ステータス判定閾値</div>
                  <SwingThresholdInputRow
                    label="良好範囲"
                    value={swingGoodTolerance}
                    description="偏差の絶対値がこの値以下なら良好"
                    onCommit={onSetSwingGoodTolerance}
                  />
                  <SwingThresholdInputRow
                    label="調整推奨"
                    value={swingAdjustThreshold}
                    description="偏差の絶対値がこの値を超えると調整推奨"
                    onCommit={onSetSwingAdjustThreshold}
                  />
                </div>
              </div>
              <div className="lie-settings-actions">
                <button className="btn-secondary" onClick={onResetSwingWeightTarget}>目安ターゲットを初期値に戻す</button>
                <button className="btn-secondary" onClick={onResetSwingThresholds}>閾値を初期値に戻す</button>
              </div>
            </div>
          )}

          <div className="analysis-card chart-card swing-weight-frame">
            {hasAnySwingWeightData ? (
              <>
                <div className="analysis-legend">
                  <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
                  <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
                  <span><i style={{ backgroundColor: '#26c6da' }} />ハイブリッド</span>
                  <span><i style={{ backgroundColor: '#2e8b57' }} />アイアン</span>
                  <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
                  <span><i style={{ backgroundColor: '#fb8c00' }} />軽微なズレ</span>
                  <span><i style={{ backgroundColor: '#e53935' }} />調整推奨</span>
                  <span><i className="legend-good-range" />良好範囲 ±{swingGoodTolerance.toFixed(1)}</span>
                </div>
                <div className="swing-chart-toolbar">
                  <span className="swing-target-badge">
                    <i className="legend-standard-line" />
                    {`目安ターゲット: ${numericToSwingWeightLabel(swingWeightTarget)}`}
                  </span>
                </div>
                {hasSwingWeightData ? (
                  <div
                    className="chart-scroll interactive-chart-scroll"
                    ref={swingChartContainerRef}
                    onMouseLeave={() => setSwingTooltip(null)}
                  >
                    <svg
                      viewBox={`0 0 ${swingChartSize.width} ${swingChartSize.height}`}
                      className="analysis-chart swing-analysis-chart"
                      role="img"
                      aria-label="スイングウェイト分布の棒グラフ"
                    >
                    <rect
                      x={SWING_PADDING.left}
                      y={SWING_PADDING.top}
                      width={swingChartSize.width - SWING_PADDING.left - SWING_PADDING.right}
                      height={swingChartSize.height - SWING_PADDING.top - SWING_PADDING.bottom}
                      fill="#ffffff"
                      rx="18"
                    />

                    {swingTicks.map((tick) => (
                      <g key={`sw-y-${tick}`}>
                        <line
                          x1={SWING_PADDING.left}
                          x2={swingChartSize.width - SWING_PADDING.right}
                          y1={mapSwingY(tick)}
                          y2={mapSwingY(tick)}
                          className="chart-grid chart-grid-animated"
                        />
                        <text
                          x={SWING_PADDING.left - 8}
                          y={mapSwingY(tick) + 4}
                          textAnchor="end"
                          className="chart-axis-label"
                        >
                          {numericToSwingWeightLabel(tick)}
                        </text>
                      </g>
                    ))}

                    <line
                      x1={SWING_PADDING.left}
                      x2={swingChartSize.width - SWING_PADDING.right}
                      y1={mapSwingY(swingWeightTarget)}
                      y2={mapSwingY(swingWeightTarget)}
                      stroke="#2e7d32"
                      strokeWidth="2"
                      strokeDasharray="8 4"
                      className="chart-standard-line"
                    />

                    {swingWeightClubs.map((club, index) => {
                      const cx = mapSwingX(index);
                      const bw = swingBarWidth;
                      const barBottom = mapSwingY(swingChartMin);
                      const barTop = mapSwingY(club.swingWeightNumeric);
                      const barHeight = Math.max(0, barBottom - barTop);
                      const color = getSwingBarColor(
                        club.category,
                        club.swingDeviation,
                        swingGoodTolerance,
                        swingAdjustThreshold,
                      );
                      const clubLabel = getSwingClubLabel(club);

                      return (
                        <g key={`swing-bar-${getAnalysisClubKey(club)}`}>
                          <rect
                            x={cx - bw / 2}
                            y={barTop}
                            width={bw}
                            height={barHeight}
                            fill={color.fill}
                            stroke={color.stroke}
                            strokeWidth={color.strokeWidth}
                            rx="5"
                            className="swing-weight-bar"
                            style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                            onMouseEnter={() => setSwingTooltip({ x: cx, y: barTop, club })}
                            onClick={() => setSwingTooltip({ x: cx, y: barTop, club })}
                          >
                            <title>{`${clubLabel} | ${club.swingWeight || '-'} | 目安偏差 ${(club.swingDeviation >= 0 ? '+' : '') + club.swingDeviation.toFixed(1)}`}</title>
                          </rect>
                          <g transform={`translate(${cx}, ${swingChartSize.height - SWING_PADDING.bottom + 20})`}>
                            <text textAnchor="end" transform="rotate(-40)" className="chart-axis-label">
                              {clubLabel}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    <text
                      x={swingChartSize.width / 2}
                      y={swingChartSize.height - 2}
                      textAnchor="middle"
                      className="chart-title-label"
                    >
                      クラブ
                    </text>
                    <text
                      x="20"
                      y={swingChartSize.height / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 20 ${swingChartSize.height / 2})`}
                      className="chart-title-label"
                    >
                      スイングウェイト数値
                    </text>
                    </svg>
                    {swingTooltip && (
                      <div
                        ref={swingTooltipRef}
                        className="chart-tooltip"
                        style={{
                          left: swingTooltipPos?.left,
                          top: swingTooltipPos?.top,
                        }}
                      >
                        <div className="chart-tooltip-title">{swingTooltip.club.name || getSwingClubLabel(swingTooltip.club)}</div>
                        <div className="chart-tooltip-list">
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">クラブ種別</span>
                            <span className="chart-tooltip-value">{getClubTypeDisplay(swingTooltip.club.clubType, swingTooltip.club.number)}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">スイングウェイト</span>
                            <span className="chart-tooltip-value">{swingTooltip.club.swingWeight || '-'}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">目安偏差</span>
                            <span className="chart-tooltip-value">
                              {(swingTooltip.club.swingDeviation >= 0 ? '+' : '') + swingTooltip.club.swingDeviation.toFixed(1)}
                            </span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">状態</span>
                            <span className="chart-tooltip-value">{swingTooltip.club.swingStatus}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="analysis-empty">表示するクラブを選択してください</div>
                )}
              </>
            ) : (
              <div className="analysis-empty">クラブがまだ追加されていません</div>
            )}
          </div>

          <div className="analysis-card table-card">
            <div className="analysis-table-header">
              <h2>スイングウェイト詳細</h2>
              <p>目安値 {numericToSwingWeightLabel(swingWeightTarget)} を基準に、クラブごとの偏差と調整優先度を表示します。</p>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    {renderSelectionHeader()}
                    <th>クラブ名</th>
                    <th>種類</th>
                    <th>スイングウェイト</th>
                    <th>目安偏差</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {hasAnySwingWeightData ? (
                    swingWeightTableClubs.map((club) => (
                      <tr key={`sw-row-${getAnalysisClubKey(club)}`}>
                        {renderSelectionCell(club)}
                        <td>
                          <div className="analysis-club-name">
                            <span className="analysis-club-type">{getClubTypeDisplay(club.clubType, club.number)}</span>
                            <span>{club.name}</span>
                          </div>
                        </td>
                        <td>{getCategoryLabel(club.category)}</td>
                        <td>{club.swingWeight || '-'}</td>
                        <td>{club.swingDeviation >= 0 ? '+' : ''}{club.swingDeviation.toFixed(1)}</td>
                        <td>
                          <span style={{ color: getSwingStatusColor(club.swingStatus), fontWeight: 700 }}>
                            {club.swingStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="analysis-empty-cell">クラブがまだ追加されていません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="analysis-card chart-card weight-length-frame">
            {hasAnyWeightLengthData ? (
              <>
                <div className="chart-section-heading">
                  </div>
                <div className="analysis-legend">
                  <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
                  <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
                  <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
                  <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
                  <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
                  <span><i className="legend-heavy-outlier" />重い外れ値</span>
                  <span><i className="legend-light-outlier" />軽い外れ値</span>
                  <span><i className="legend-trend-line" />トレンド線</span>
                  <span><i className="legend-expected-band" />期待帯 ±12g</span>
                </div>
                {hasWeightLengthData ? (
                  <div
                    className="chart-scroll interactive-chart-scroll"
                    ref={weightChartContainerRef}
                    onMouseLeave={() => setWeightTooltip(null)}
                  >
                    <svg
                      viewBox={`0 0 ${weightChartSize.width} ${weightChartSize.height}`}
                      className="analysis-chart weight-analysis-chart"
                      role="img"
                      aria-label="重量と長さの散布図"
                    >
                    <rect
                      x={weightPadding.left}
                      y={weightPadding.top}
                      width={weightChartSize.width - weightPadding.left - weightPadding.right}
                      height={weightChartSize.height - weightPadding.top - weightPadding.bottom}
                      fill="#ffffff"
                      rx="18"
                    />

                    {weightTrendBandPoints && (
                      <polygon
                        points={weightTrendBandPoints}
                        className="weight-trend-band"
                      />
                    )}

                    {weightTicks.map((tick) => (
                      <g key={`w-y-${tick}`}>
                        <line
                          x1={weightPadding.left}
                          x2={weightChartSize.width - weightPadding.right}
                          y1={mapWeightLengthY(tick)}
                          y2={mapWeightLengthY(tick)}
                          className="chart-grid chart-grid-animated"
                        />
                        <text x={weightPadding.left - 12} y={mapWeightLengthY(tick) + 4} textAnchor="end" className="chart-axis-label">
                          {tick}
                        </text>
                      </g>
                    ))}

                    {lengthTicks.map((tick) => (
                      <g key={`l-x-${tick}`}>
                        <line
                          x1={mapWeightLengthX(tick)}
                          x2={mapWeightLengthX(tick)}
                          y1={weightPadding.top}
                          y2={weightChartSize.height - weightPadding.bottom}
                          className="chart-grid chart-grid-animated"
                        />
                        <text
                          x={mapWeightLengthX(tick)}
                          y={weightChartSize.height - 24}
                          textAnchor="middle"
                          className="chart-axis-label"
                        >
                          {tick}
                        </text>
                      </g>
                    ))}

                    {weightTrendLinePoints && (
                      <polyline
                        points={weightTrendLinePoints}
                        fill="none"
                        stroke="#7a7a7a"
                        strokeWidth="2"
                        className="chart-standard-line"
                      />
                    )}

                    {weightLengthClubs.map((club, index) => {
                      const style = getWeightPointStyle(club, club.deviation);
                      return (
                        <g
                          key={`wl-${getAnalysisClubKey(club)}`}
                          className="weight-point-group"
                          style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                        >
                          <circle
                            cx={mapWeightLengthX(club.length)}
                            cy={mapWeightLengthY(club.weight)}
                            r={style.radius}
                            fill={style.fill}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            className="chart-point-circle"
                            onMouseEnter={() =>
                              setWeightTooltip({
                                x: mapWeightLengthX(club.length),
                                y: mapWeightLengthY(club.weight),
                                club,
                              })
                            }
                            onClick={() =>
                              setWeightTooltip({
                                x: mapWeightLengthX(club.length),
                                y: mapWeightLengthY(club.weight),
                                club,
                              })
                            }
                          >
                            <title>{`${club.name} | 種類 ${getCategoryLabel(club.category)} | 長さ ${club.length.toFixed(2)} in | 重量 ${club.weight.toFixed(1)} g | 期待 ${club.expectedWeight.toFixed(1)} g | 偏差 ${formatSignedGrams(club.deviation)}`}</title>
                          </circle>
                        </g>
                      );
                    })}

                    <text
                      x={weightChartSize.width / 2}
                      y={weightChartSize.height - 2}
                      textAnchor="middle"
                      className="chart-title-label"
                    >
                      クラブ長（インチ）
                    </text>
                    <text
                      x="10"
                      y={weightChartSize.height / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 10 ${weightChartSize.height / 2})`}
                      className="chart-title-label"
                    >
                      クラブ重量（グラム）
                    </text>
                    </svg>
                    {weightTooltip && (
                      <div
                        ref={weightTooltipRef}
                        className="chart-tooltip"
                        style={{
                          left: weightTooltipPos?.left,
                          top: weightTooltipPos?.top,
                        }}
                      >
                        <div className="chart-tooltip-title">{weightTooltip.club.name}</div>
                        <div className="chart-tooltip-list">
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">クラブ種別</span>
                            <span className="chart-tooltip-value">{getClubTypeDisplay(weightTooltip.club.clubType, weightTooltip.club.number)}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">長さ</span>
                            <span className="chart-tooltip-value">{weightTooltip.club.length.toFixed(2)} in</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">重量</span>
                            <span className="chart-tooltip-value">{weightTooltip.club.weight.toFixed(1)} g</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">期待値</span>
                            <span className="chart-tooltip-value">{weightTooltip.club.expectedWeight.toFixed(1)} g</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">偏差</span>
                            <span className="chart-tooltip-value">{getWeightDeviationLabel(weightTooltip.club.deviation)}</span>
                          </div>
                          <div className="chart-tooltip-row">
                            <span className="chart-tooltip-label">示唆</span>
                            <span className="chart-tooltip-value">{weightTooltip.club.weightTrendMessage}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="analysis-empty">表示するクラブを選択してください</div>
                )}
              </>
            ) : (
              <div className="analysis-empty">クラブがまだ追加されていません</div>
            )}
          </div>

          <div className="analysis-card table-card">
            <div className="analysis-table-header">
              <h2>クラブ仕様</h2>
              <p>クラブ長と重量の実データ一覧です。</p>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    {renderSelectionHeader()}
                    <th>クラブ名</th>
                    <th>種類</th>
                    <th>長さ（in）</th>
                    <th>重量（g）</th>
                    <th>期待値（g）</th>
                    <th>偏差（g）</th>
                  </tr>
                </thead>
                <tbody>
                  {hasAnyWeightLengthData ? (
                    weightLengthTableClubs.map((club) => (
                      <tr key={`wl-row-${getAnalysisClubKey(club)}`}>
                        {renderSelectionCell(club)}
                        <td>
                          <div className="analysis-club-name">
                            <span className="analysis-club-type">{getClubTypeDisplay(club.clubType, club.number)}</span>
                            <span>{club.name}</span>
                          </div>
                        </td>
                        <td>{getCategoryLabel(club.category)}</td>
                        <td>{club.length.toFixed(2)}</td>
                        <td>{club.weight.toFixed(1)}</td>
                        <td>{club.expectedWeight.toFixed(1)}</td>
                        <td style={{ color: getWeightPointStyle(club, club.deviation).fill, fontWeight: 700 }}>
                          {formatSignedGrams(club.deviation)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="analysis-empty-cell">クラブがまだ追加されていません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

type LieStandardInputRowProps = {
  label: string;
  defaultValue: number;
  currentValue?: number;
  onCommit: (value: number) => void;
  onClear: () => void;
  subLabel?: string;
};

type SwingTargetInputRowProps = {
  value: number;
  onCommit: (value: number) => void;
  onReset: () => void;
};

type SwingThresholdInputRowProps = {
  label: string;
  value: number;
  description: string;
  onCommit: (value: number) => void;
};

const LieStandardInputRow = ({
  label,
  defaultValue,
  currentValue,
  onCommit,
  onClear,
  subLabel,
}: LieStandardInputRowProps) => {
  const isOverridden = currentValue != null;

  const commit = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>{label}</strong>
        {subLabel ? <span>{subLabel}</span> : null}
        <em className={isOverridden ? 'lie-setting-state is-overridden' : 'lie-setting-state'}>
          {isOverridden
            ? `上書き中: ${currentValue!.toFixed(1)}°`
            : `未設定（標準値 ${defaultValue.toFixed(1)}° を使用）`}
        </em>
      </div>
      <input
        key={`${currentValue ?? 'default'}-${defaultValue}`}
        className="analysis-input lie-setting-input"
        type="number"
        step="0.1"
        defaultValue={(currentValue ?? defaultValue).toFixed(1)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit((event.currentTarget as HTMLInputElement).value);
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={(event) => commit(event.target.value)}
      />
      <button
        className="btn-secondary lie-setting-reset"
        type="button"
        title="この行の上書きを解除"
        onClick={onClear}
      >
        解除
      </button>
    </div>
  );
};

const SwingTargetInputRow = ({
  value,
  onCommit,
  onReset,
}: SwingTargetInputRowProps) => {
  const [draft, setDraft] = useState(numericToSwingWeightLabel(value));

  useEffect(() => {
    setDraft(numericToSwingWeightLabel(value));
  }, [value]);

  const commit = () => {
    const parsed = parseSwingWeightInput(draft);
    if (parsed == null) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>目安ターゲット</strong>
        <span>既定値: D2</span>
        <em className="lie-setting-state">D1 や D1.5 の形式で設定できます</em>
      </div>
      <input
        className="analysis-input lie-setting-input"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={commit}
        placeholder="D2"
      />
      <button
        className="btn-secondary lie-setting-reset"
        type="button"
        onClick={onReset}
      >
        リセット
      </button>
    </div>
  );
};

const SwingThresholdInputRow = ({
  label,
  value,
  description,
  onCommit,
}: SwingThresholdInputRowProps) => {
  const [draft, setDraft] = useState(value.toFixed(1));

  useEffect(() => {
    setDraft(value.toFixed(1));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>{label}</strong>
        <span>{description}</span>
        <em className="lie-setting-state">0.1 刻みで設定できます</em>
      </div>
      <input
        className="analysis-input lie-setting-input"
        type="number"
        step="0.1"
        min="0.1"
        max="30"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={commit}
      />
      <div />
    </div>
  );
};
