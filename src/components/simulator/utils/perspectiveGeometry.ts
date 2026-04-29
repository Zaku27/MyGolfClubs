import type { Hole, LieType, HazardType } from "../../../types/game";

// パースペクティブ投影パラメータ
export interface PerspectiveParams {
  horizonY: number;
  vanishingPointY: number;
  maxVisibleDistance: number;
  distanceToY: (distance: number) => number;
  distanceToScale: (distance: number) => number;
  xToScreenX: (x: number, distance: number) => number;
}

// 位置情報
export interface Position3D {
  x: number;
  y: number;
  scale: number;
}

// ハザード位置の型定義
export interface PolygonHazardPosition {
  type: HazardType;
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  scale: number;
  shape: "polygon";
}

export type HazardPosition = PolygonHazardPosition;

/**
 * パースペクティブ投影パラメータを計算
 */
export function calculatePerspectiveParams(targetDistance: number): PerspectiveParams {
  const vanishingPointY = 20; // 消失点のY位置（%）- 視点を下げるために値を増加
  const scaleFactor = 0.6; // 遠景の縮小率
  const maxVisibleDistance = targetDistance * 1.2;

  // 距離をY座標に変換（近いほど下、遠いほど上）
  const distanceToY = (distance: number): number => {
    const normalized = Math.max(0, Math.min(1, 1 - distance / maxVisibleDistance));
    // 非線形変換でパースペクティブ感を出す
    const perspectiveNormalized = Math.pow(normalized, 0.7);
    return vanishingPointY + (100 - vanishingPointY) * perspectiveNormalized;
  };

  // 地平線をグリーンを少し超えた位置に設定
  const horizonY = distanceToY(targetDistance * 1.05);

  // 距離に応じたスケール
  const distanceToScale = (distance: number): number => {
    const normalized = Math.max(0, Math.min(1, 1 - distance / maxVisibleDistance));
    return scaleFactor + (1 - scaleFactor) * Math.pow(normalized, 0.5);
  };

  // 横位置の変換（パースペクティブ効果込み）
  const xToScreenX = (x: number, distance: number): number => {
    const scale = distanceToScale(distance);
    // 中心からのオフセットをスケールに適用
    return 50 + (x * scale * 0.8);
  };

  return {
    horizonY,
    vanishingPointY,
    maxVisibleDistance,
    distanceToY,
    distanceToScale,
    xToScreenX,
  };
}

/**
 * ボール位置を計算
 */
export function calculateBallPosition(
  originX: number,
  originY: number,
  perspective: PerspectiveParams
): Position3D {
  const y = perspective.distanceToY(originY);
  // 地平線より上にならないようにY座標を制限
  const clampedY = Math.max(y, perspective.horizonY);
  const x = perspective.xToScreenX(originX, originY);
  const scale = perspective.distanceToScale(originY);
  return { x, y: clampedY, scale };
}

/**
 * ピン位置を計算
 */
export function calculatePinPosition(
  targetDistance: number,
  perspective: PerspectiveParams
): Position3D {
  const y = perspective.distanceToY(targetDistance);
  const x = 50; // ピンは常に中央
  const scale = perspective.distanceToScale(targetDistance);
  return { x, y, scale };
}

/**
 * 狙い点を計算（選択クラブの飛距離に基づく）
 * aimXOffsetはピン方向に対する左右のオフセット
 */
export function calculateAimPosition(
  aimXOffset: number,
  remainingDistance: number,
  targetDistance: number,
  perspective: PerspectiveParams,
  selectedClubAvgDistance?: number,
  originX: number = 0,
  originY: number = 0
): Position3D {
  // 選択したクラブの飛距離に基づいてターゲット位置を決定
  const clubDistance = selectedClubAvgDistance ?? 0;
  // 残り距離とクラブ飛距離の小さい方を使用（ピンを超えないように）
  const aimDistance = Math.min(clubDistance, remainingDistance, targetDistance);
  
  // ピン位置（常に中央）
  const pinX = 0;
  const pinY = targetDistance;
  
  // ボールからピンへの方向ベクトル
  const toPinX = pinX - originX;
  const toPinY = pinY - originY;
  const toPinDistance = Math.hypot(toPinX, toPinY);
  
  // ピン方向の単位ベクトル
  const forward = toPinDistance > 1e-6
    ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
    : { x: 0, y: 1 };
  
  // 右方向の単位ベクトル（forwardを90度回転）
  const right = { x: forward.y, y: -forward.x };
  
  // ピン方向にaimDistance進み、右方向にaimXOffset進んだ位置
  const aimX = originX + forward.x * aimDistance + right.x * aimXOffset;
  const aimY = originY + forward.y * aimDistance + right.y * aimXOffset;
  
  // 地平線より上にならないようにY座標を制限
  const clampedAimY = Math.min(aimY, targetDistance * 1.05); // 地平線位置に基づいて制限
  
  const y = perspective.distanceToY(clampedAimY);
  const scale = perspective.distanceToScale(clampedAimY);
  const x = perspective.xToScreenX(aimX, clampedAimY);
  
  return { x, y, scale };
}

/**
 * 前回ショットの着地点を計算
 */
export function calculateLastLandingPosition(
  finalX: number,
  finalY: number,
  finalOutcome?: "fairway" | "rough" | "bunker" | "water" | "ob" | "green",
  perspective?: PerspectiveParams
): (Position3D & { outcome?: string }) | null {
  if (!perspective) return null;
  const y = perspective.distanceToY(finalY);
  // 地平線より上にならないようにY座標を制限
  const clampedY = Math.max(y, perspective.horizonY);
  const x = perspective.xToScreenX(finalX, finalY);
  const scale = perspective.distanceToScale(finalY);
  return { x, y: clampedY, scale, outcome: finalOutcome };
}

/**
 * フェアウェイの描画パスを生成
 */
export function calculateFairwayPath(
  targetDistance: number,
  perspective: PerspectiveParams,
  maxPolygonY?: number
): string {
  const startY = perspective.distanceToY(0);
  const endY = perspective.distanceToY(targetDistance);
  const horizonY = perspective.horizonY;

  // ポリゴンの最大Y値があればそれを使用、なければターゲット距離を使用
  const polygonMaxY = maxPolygonY !== undefined ? perspective.distanceToY(maxPolygonY) : endY;
  const clippedEndY = Math.max(polygonMaxY, horizonY);

  // 横幅いっぱいのフェアウェイ（viewBox: -100 0 300 100）
  const leftX = -100;
  const rightX = 200;

  // 台形のフェアウェイ
  return `
    M ${leftX} ${startY}
    L ${rightX} ${startY}
    L ${rightX} ${clippedEndY}
    L ${leftX} ${clippedEndY}
    Z
  `;
}

/**
 * グリーンの描画情報を計算（長方形版）
 */
export interface GreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateGreenRect(
  targetDistance: number,
  perspective: PerspectiveParams
): GreenRect {
  const greenY = perspective.distanceToY(targetDistance);
  const greenScale = perspective.distanceToScale(targetDistance);
  const greenWidth = 15 * greenScale;
  const greenHeight = 8 * greenScale;
  return {
    x: 50 - greenWidth / 2,
    y: greenY - greenHeight / 2,
    width: greenWidth,
    height: greenHeight,
  };
}

/**
 * グリーンのポリゴンを計算
 */
export interface GreenPolygonPosition {
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  scale: number;
}

export function calculateGreenPolygon(
  greenPolygon: Array<{ x: number; y: number }>,
  perspective: PerspectiveParams
): GreenPolygonPosition | null {
  if (!greenPolygon || greenPolygon.length < 3) return null;

  const horizonY = perspective.horizonY;

  // 各ポイントをパースペクティブ変換（地平線でクリップ）
  const rawPoints = greenPolygon.map((point) => ({
    x: perspective.xToScreenX(point.x, point.y),
    y: perspective.distanceToY(point.y),
  }));

  // 全ての点が地平線より上なら描画しない
  const allAboveHorizon = rawPoints.every((p) => p.y < horizonY);
  if (allAboveHorizon) return null;

  // 地平線でポリゴンをクリップ
  const clippedPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < rawPoints.length; i++) {
    const curr = rawPoints[i];
    const prev = rawPoints[(i - 1 + rawPoints.length) % rawPoints.length];

    const currAbove = curr.y < horizonY;
    const prevAbove = prev.y < horizonY;

    if (currAbove !== prevAbove) {
      // 地平線との交差点を計算
      const t = (horizonY - prev.y) / (curr.y - prev.y);
      const intersectX = prev.x + t * (curr.x - prev.x);
      clippedPoints.push({ x: intersectX, y: horizonY });
    }

    if (!currAbove) {
      // 地平線以下の点を追加
      clippedPoints.push(curr);
    }
  }

  // クリップ後のポイントが不足していれば描画しない
  if (clippedPoints.length < 3) return null;

  // SVG path 文字列を生成
  const pathData = clippedPoints
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
    .join(" ") + " Z";

  // バウンディングボックスを計算
  const xs = clippedPoints.map((p) => p.x);
  const ys = clippedPoints.map((p) => p.y);

  const bbox = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };

  // 平均距離からスケールを計算
  const avgY = greenPolygon.reduce((sum, p) => sum + p.y, 0) / greenPolygon.length;
  const scale = perspective.distanceToScale(avgY);

  return {
    pathData,
    bbox,
    scale,
  };
}

/**
 * ハザードの位置計算（ポリゴンのみ）
 */
export function calculateHazardPositions(
  hole: Hole,
  perspective: PerspectiveParams
): HazardPosition[] {
  if (!hole.hazards) return [];

  return hole.hazards.map<HazardPosition | null>((hazard) => {
    if (hazard.shape !== "polygon" || !hazard.points || hazard.points.length < 3) {
      return null;
    }

    // ポリゴンのパースペクティブ変換（地平線でクリップ）
    const horizonY = perspective.horizonY;

    // 各ポイントを変換
    const rawPoints = hazard.points.map((point) => ({
      x: perspective.xToScreenX(point.x, point.y),
      y: perspective.distanceToY(point.y),
    }));

    // 全ての点が地平線より上なら描画しない
    const allAboveHorizon = rawPoints.every((p) => p.y < horizonY);
    if (allAboveHorizon) return null;

    // 地平線でポリゴンをクリップ
    const clippedPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < rawPoints.length; i++) {
      const curr = rawPoints[i];
      const prev = rawPoints[(i - 1 + rawPoints.length) % rawPoints.length];

      const currAbove = curr.y < horizonY;
      const prevAbove = prev.y < horizonY;

      if (currAbove !== prevAbove) {
        // 地平線との交差点を計算
        const t = (horizonY - prev.y) / (curr.y - prev.y);
        const intersectX = prev.x + t * (curr.x - prev.x);
        clippedPoints.push({ x: intersectX, y: horizonY });
      }

      if (!currAbove) {
        // 地平線以下の点を追加
        clippedPoints.push(curr);
      }
    }

    // クリップ後のポイントが不足していれば描画しない
    if (clippedPoints.length < 3) return null;

    // SVG path 文字列を生成
    const pathData = clippedPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
      .join(" ") + " Z";

    // バウンディングボックスを計算
    const xs = clippedPoints.map((p) => p.x);
    const ys = clippedPoints.map((p) => p.y);

    const bbox = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };

    // 平均距離からスケールを計算
    const avgY = hazard.points.reduce((sum, p) => sum + p.y, 0) / hazard.points.length;
    const scale = perspective.distanceToScale(avgY);

    return {
      type: hazard.type,
      pathData,
      bbox,
      scale,
      shape: "polygon" as const,
    };
  }).filter((h): h is HazardPosition => h !== null);
}

/**
 * ハザードの色を取得
 */
export function getHazardColor(type: string): string {
  switch (type) {
    case "water":
      return "#3b82f6";
    case "bunker":
      return "#fbbf24";
    case "rough":
    case "semirough":
      return "#22c55e";
    case "ob":
      return "#16a34a";
    default:
      return "#9ca3af";
  }
}

/**
 * ライの色を取得
 */
export const LIE_COLORS: Record<LieType, string> = {
  tee: "#34d399",      // emerald-400 (same as green)
  fairway: "#22c55e",  // green-500
  semirough: "#84cc16", // lime-500
  rough: "#22c55e",    // green-500 (swapped with OB)
  bareground: "#a8a29e", // stone-400
  bunker: "#fbbf24",   // amber-400
  green: "#34d399",    // emerald-400
};

/**
 * アウトカムの色を取得
 */
export const OUTCOME_COLORS: Record<string, string> = {
  fairway: "#22c55e",
  rough: "#22c55e",
  bunker: "#fbbf24",
  water: "#3b82f6",
  ob: "#16a34a",
  green: "#34d399",
};
