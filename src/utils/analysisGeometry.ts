export type ChartSize = {
  width: number;
  height: number;
};

export type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
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

const getPlotDimensions = (chartSize: ChartSize, padding: ChartPadding) => ({
  plotWidth: chartSize.width - padding.left - padding.right,
  plotHeight: chartSize.height - padding.top - padding.bottom,
});

const normalizePosition = (
  value: number,
  min: number,
  max: number,
  safeDenominator: boolean,
) => {
  const denominator = max - min;
  const divisor = safeDenominator ? denominator || 1 : denominator;
  return (value - min) / divisor;
};

const createCartesianMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  axis: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    safeXDenominator: boolean;
    safeYDenominator: boolean;
  },
) => {
  const { plotWidth, plotHeight } = getPlotDimensions(chartSize, padding);

  const mapX = (value: number) =>
    padding.left +
    normalizePosition(value, axis.minX, axis.maxX, axis.safeXDenominator) * plotWidth;

  const mapY = (value: number) =>
    chartSize.height -
    padding.bottom -
    normalizePosition(value, axis.minY, axis.maxY, axis.safeYDenominator) * plotHeight;

  return { mapX, mapY };
};

const createIndexedXMapper = (
  chartSize: ChartSize,
  padding: ChartPadding,
  clubCount: number,
) => {
  const { plotWidth } = getPlotDimensions(chartSize, padding);
  const slotWidth = plotWidth / Math.max(1, clubCount);
  const mapX = (index: number) => padding.left + slotWidth * (index + 0.5);
  return { mapX, slotWidth };
};

const getAdaptiveBarWidth = (
  slotWidth: number,
  ratio: number,
  minWidth: number,
  maxWidth: number,
) => Math.min(maxWidth, Math.max(minWidth, slotWidth * ratio));

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
  return createCartesianMappers(chartSize, padding, {
    minX: axis.minLoft,
    maxX: axis.maxLoft,
    minY: axis.minDistance,
    maxY: axis.maxDistance,
    safeXDenominator: false,
    safeYDenominator: false,
  });
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
  return createCartesianMappers(chartSize, padding, {
    minX: bounds.minLength,
    maxX: bounds.maxLength,
    minY: bounds.minWeight,
    maxY: bounds.maxWeight,
    safeXDenominator: true,
    safeYDenominator: true,
  });
};

export const createSwingChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  chartMin: number,
  chartMax: number,
  clubCount: number,
) => {
  const { mapY } = createCartesianMappers(chartSize, padding, {
    minX: 0,
    maxX: 1,
    minY: chartMin,
    maxY: chartMax,
    safeXDenominator: true,
    safeYDenominator: true,
  });
  const { mapX, slotWidth } = createIndexedXMapper(chartSize, padding, clubCount);
  const barWidth = getAdaptiveBarWidth(slotWidth, 0.52, 12, 30);

  return { mapX, mapY, barWidth };
};

export const createLieChartMappers = (
  chartSize: ChartSize,
  padding: ChartPadding,
  minLie: number,
  maxLie: number,
  clubCount: number,
) => {
  const { mapY } = createCartesianMappers(chartSize, padding, {
    minX: 0,
    maxX: 1,
    minY: minLie,
    maxY: maxLie,
    safeXDenominator: true,
    safeYDenominator: false,
  });
  const { mapX, slotWidth } = createIndexedXMapper(chartSize, padding, clubCount);
  const barWidth = getAdaptiveBarWidth(slotWidth, 0.55, 12, 32);

  return { mapX, mapY, barWidth };
};
