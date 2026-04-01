import {
  WEIGHT_HEAVY_OUTLIER_THRESHOLD,
  WEIGHT_LIGHT_OUTLIER_THRESHOLD,
  WEIGHT_NORMAL_BAND_TOLERANCE,
} from './analysisConstants';

export type WeightDeviationClass = 'heavyOutlier' | 'lightOutlier' | 'inBand' | 'outOfBand';

export type SwingDeviationClass = 'adjust' | 'good' | 'heavy' | 'light';

export const classifyWeightDeviation = (deviation: number): WeightDeviationClass => {
  if (deviation > WEIGHT_HEAVY_OUTLIER_THRESHOLD) return 'heavyOutlier';
  if (deviation < -WEIGHT_LIGHT_OUTLIER_THRESHOLD) return 'lightOutlier';
  if (Math.abs(deviation) <= WEIGHT_NORMAL_BAND_TOLERANCE) return 'inBand';
  return 'outOfBand';
};

export const classifySwingDeviation = (
  deviation: number,
  goodTolerance: number,
  adjustThreshold: number,
): SwingDeviationClass => {
  const abs = Math.abs(deviation);
  if (abs > adjustThreshold) return 'adjust';
  if (abs <= goodTolerance) return 'good';
  return deviation > 0 ? 'heavy' : 'light';
};
