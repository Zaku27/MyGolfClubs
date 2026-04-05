import type { GolfClub } from '../types/golf';
import {
  lieStatusFromDeviation,
  resolveStandardLieAngle,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { sortClubsForDisplay } from './clubSort';
import {
  getClubCategory,
  getExpectedLieAngle,
  getEstimatedDistance,
  getLieLengthChartBounds,
  getLieLengthRegression,
  getLieLengthTrendMessage,
  getExpectedWeight,
  getSwingStatus,
  getWeightChartBounds,
  getWeightRegression,
  getWeightTrendMessage,
  makeTickValues,
  swingWeightToNumeric,
  type ClubCategory,
  type WeightLengthPoint,
} from './analysisUtils';

type ClubVisibilityPredicate = (club: GolfClub) => boolean;

type VisibilitySplitResult<T> = {
  tableClubs: T[];
  chartClubs: T[];
  hasAnyData: boolean;
  hasVisibleData: boolean;
};

type WeightChartBounds = {
  minLength: number;
  maxLength: number;
  minWeight: number;
  maxWeight: number;
  xInterval: number;
  yInterval: number;
};

const withCategory = <T extends GolfClub>(club: T): T & { category: ClubCategory } => ({
  ...club,
  category: getClubCategory(club),
});

const splitByVisibility = <T>(
  tableClubs: T[],
  isVisible: (club: T) => boolean,
): VisibilitySplitResult<T> => {
  const chartClubs = tableClubs.filter(isVisible);
  return {
    tableClubs,
    chartClubs,
    hasAnyData: tableClubs.length > 0,
    hasVisibleData: chartClubs.length > 0,
  };
};

const DEFAULT_WEIGHT_BOUNDS: WeightChartBounds = {
  minLength: 30,
  maxLength: 48,
  minWeight: 250,
  maxWeight: 550,
  xInterval: 2,
  yInterval: 50,
};

const DEFAULT_LIE_LENGTH_BOUNDS = {
  minLength: 30,
  maxLength: 48,
  minLieAngle: 54,
  maxLieAngle: 66,
  xInterval: 2,
  yInterval: 1,
};

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

  const visibility = splitByVisibility(tableClubs, isVisible);

  return {
    ...visibility,
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
    .map(withCategory);

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

  const visibility = splitByVisibility(tableClubs, isVisible);
  const bounds = visibility.hasVisibleData
    ? getWeightChartBounds(visibility.chartClubs as WeightLengthPoint[], regression)
    : DEFAULT_WEIGHT_BOUNDS;

  return {
    ...visibility,
    regression,
    bounds,
    lengthTicks: makeTickValues(bounds.minLength, bounds.maxLength, bounds.xInterval),
    weightTicks: makeTickValues(bounds.minWeight, bounds.maxWeight, bounds.yInterval),
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
      const clubWithCategory = withCategory(club);
      const swingWeightNumeric = swingWeightToNumeric(club.swingWeight ?? '');
      const swingDeviation = swingWeightNumeric - swingWeightTarget;
      const swingStatus = getSwingStatus(
        swingDeviation,
        swingGoodTolerance,
        swingAdjustThreshold,
      );

      return {
        ...clubWithCategory,
        swingWeightNumeric,
        swingDeviation,
        swingStatus,
      };
    });

  const visibility = splitByVisibility(tableClubs, isVisible);
  const swingMinValue = visibility.hasVisibleData
    ? Math.min(...visibility.chartClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : -2;
  const swingMaxValue = visibility.hasVisibleData
    ? Math.max(...visibility.chartClubs.map((club) => club.swingWeightNumeric), swingWeightTarget)
    : 4;
  const chartMin = Math.floor(swingMinValue - 2);
  const chartMax = Math.ceil(swingMaxValue + 2);

  return {
    ...visibility,
    chartMin,
    chartMax,
    ticks: Array.from(
      { length: Math.max(2, chartMax - chartMin + 1) },
      (_, index) => chartMin + index,
    ).filter((tick) => tick % 2 === 0),
  };
};

export const buildLieAngleAnalysis = (
  clubs: GolfClub[],
  userLieAngleStandards: UserLieAngleStandards,
  isVisible: ClubVisibilityPredicate,
) => {
  const tableClubs = sortClubsForDisplay(clubs).map((club) => {
    const clubWithCategory = withCategory(club);
    const standardLieAngle = resolveStandardLieAngle(club, userLieAngleStandards);
    const deviationFromStandard = club.lieAngle - standardLieAngle;
    const lieStatus = lieStatusFromDeviation(deviationFromStandard);

    return {
      ...clubWithCategory,
      standardLieAngle,
      deviationFromStandard,
      lieStatus,
    };
  });

  const visibility = splitByVisibility(tableClubs, isVisible);

  return {
    ...visibility,
  };
};

export const buildLieLengthAnalysis = (
  clubs: GolfClub[],
  trendBandTolerance: number,
  isVisible: ClubVisibilityPredicate,
) => {
  const baseClubs = sortClubsForDisplay(
    clubs.filter(
      (club) =>
        Number.isFinite(club.length) &&
        Number.isFinite(club.lieAngle) &&
        club.length > 0 &&
        club.lieAngle > 0 &&
        getClubCategory(club) !== 'putter',
    ),
  ).map(withCategory);

  const visibleBaseClubs = baseClubs.filter(isVisible);
  const regression = getLieLengthRegression(
    visibleBaseClubs.length > 0 ? visibleBaseClubs : baseClubs,
  );

  const tableClubs = baseClubs.map((club) => {
    const expectedLieAngle = getExpectedLieAngle(club.length, regression);
    const deviationFromTrend = club.lieAngle - expectedLieAngle;
    return {
      ...club,
      expectedLieAngle,
      deviationFromTrend,
      lieTrendMessage: getLieLengthTrendMessage(deviationFromTrend),
    };
  });

  const visibility = splitByVisibility(tableClubs, isVisible);
  const bounds = visibility.hasVisibleData
    ? getLieLengthChartBounds(visibility.chartClubs, regression, trendBandTolerance)
    : DEFAULT_LIE_LENGTH_BOUNDS;

  return {
    ...visibility,
    regression,
    bounds,
    lengthTicks: makeTickValues(bounds.minLength, bounds.maxLength, bounds.xInterval),
    lieAngleTicks: makeTickValues(bounds.minLieAngle, bounds.maxLieAngle, bounds.yInterval),
  };
};
