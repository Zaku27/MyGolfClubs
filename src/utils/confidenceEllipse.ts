export type ConfidenceEllipseStats = {
  meanX: number;
  meanY: number;
  stdDevX: number;
  stdDevY: number;
  correlation?: number;
};

export type ConfidenceEllipse = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export const CHI_SQUARE_SCALE_BY_CONFIDENCE: Record<number, number> = {
  0.68: Math.sqrt(2.279),
  0.95: Math.sqrt(5.991),
  0.99: Math.sqrt(9.21),
};

/**
 * Monte Carlo の平均点と標準偏差から、2次元正規分布を仮定した簡易信頼楕円を返す。
 *
 * correlation があれば covariance を復元し、固有値から回転楕円を求める。
 * correlation が無い場合は従来どおり軸平行な楕円として扱う。
 * 将来的に covariance を直接渡す形へ拡張することも可能。
 */
export function calculateConfidenceEllipse(
  stats: ConfidenceEllipseStats,
  confidenceLevel: number = 0.95,
): ConfidenceEllipse {
  const scale = CHI_SQUARE_SCALE_BY_CONFIDENCE[confidenceLevel] ?? Math.sqrt(5.991);
  const safeCorrelation = Math.max(-0.999999, Math.min(0.999999, stats.correlation ?? 0));
  const varianceX = Math.max(0, stats.stdDevX ** 2);
  const varianceY = Math.max(0, stats.stdDevY ** 2);
  const covariance = safeCorrelation * stats.stdDevX * stats.stdDevY;

  // 2x2 共分散行列の固有値を使うと、主軸方向の分散を直接取り出せる。
  const trace = varianceX + varianceY;
  const determinantTerm = Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2));
  const majorEigenvalue = Math.max(0, (trace + determinantTerm) / 2);
  const minorEigenvalue = Math.max(0, (trace - determinantTerm) / 2);

  // 回転角は主軸の向き。annotation は degree 指定なのでラジアンから変換する。
  const rotationRadians = determinantTerm > 0 ? 0.5 * Math.atan2(2 * covariance, varianceX - varianceY) : 0;
  const rotation = (rotationRadians * 180) / Math.PI;

  return {
    x: stats.meanX,
    y: stats.meanY,
    width: Math.max(0, Math.sqrt(majorEigenvalue) * scale * 2),
    height: Math.max(0, Math.sqrt(minorEigenvalue) * scale * 2),
    rotation,
  };
}