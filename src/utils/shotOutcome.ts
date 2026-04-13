import type { Hazard, LieType, ShotResult } from "../types/game";

export const DEFAULT_GREEN_RADIUS = 12;

const HAZARD_TYPE_LABEL: Record<Hazard["type"], string> = {
  bunker: "バンカー",
  water: "ウォーター",
  ob: "OB",
  rough: "ラフ",
  semirough: "セミラフ",
  bareground: "ベアグラウンド",
};

function isCenterLineInsideHazard(xCenter: number, width: number): boolean {
  const halfWidth = Math.max(0, width / 2);
  return xCenter - halfWidth <= 0 && xCenter + halfWidth >= 0;
}

function isPlaceholderHazardName(name: string | undefined): boolean {
  const normalized = name?.trim();
  return !normalized || normalized === "新規ハザード";
}

function isLegacyAutoHazardName(name: string | undefined, type: Hazard["type"]): boolean {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return false;

  const compact = normalized.replace(/[\s_-]+/g, "");
  const japaneseNormalized = (name ?? "").trim();
  const japaneseTypeLabel = HAZARD_TYPE_LABEL[type];
  const japaneseAutoNamePattern = new RegExp(`^(左|右|中央)${japaneseTypeLabel}$`);

  if (japaneseAutoNamePattern.test(japaneseNormalized)) {
    return true;
  }

  if (type === "rough") {
    return /^rough\d*$/.test(compact) || /^rohgh\d*$/.test(compact) || compact.includes("rough") || compact.includes("rohgh");
  }

  if (type === "bunker") {
    return /^bunker\d*$/.test(compact) || compact.includes("bunker");
  }

  if (type === "water") {
    return /^water\d*$/.test(compact) || /^pond\d*$/.test(compact) || compact.includes("water") || compact.includes("pond");
  }

  if (type === "ob") {
    return /^ob\d*$/.test(compact) || compact.includes("ob");
  }

  return false;
}

export function buildHazardDisplayName(hazard: Hazard): string {
  if (!isPlaceholderHazardName(hazard.name) && !isLegacyAutoHazardName(hazard.name, hazard.type)) {
    return hazard.name as string;
  }

  return buildAutoHazardName(hazard.type, hazard.xCenter, hazard.width);
}

export function buildAutoHazardName(
  type: Hazard["type"],
  xCenter: number,
  width: number,
): string {
  const typeLabel = HAZARD_TYPE_LABEL[type];
  if (isCenterLineInsideHazard(xCenter, width)) return `中央${typeLabel}`;
  if (xCenter < 0) return `左${typeLabel}`;
  return `右${typeLabel}`;
}

function isPointInRectangle(
  x: number,
  y: number,
  xCenter: number,
  width: number,
  yFront: number,
  yBack: number,
): boolean {
  const halfWidth = width / 2;
  return (
    y >= Math.min(yFront, yBack) &&
    y <= Math.max(yFront, yBack) &&
    x >= xCenter - halfWidth &&
    x <= xCenter + halfWidth
  );
}

/**
 * OB はコース中心に最も近い境界線を越えたら判定する。
 */
function isPointInObArea(
  x: number,
  y: number,
  xCenter: number,
  width: number,
  yFront: number,
  yBack: number,
): boolean {
  const inYRange = y >= Math.min(yFront, yBack) && y <= Math.max(yFront, yBack);
  if (!inYRange) return false;

  const halfWidth = width / 2;
  const innerBoundary = xCenter < 0 ? xCenter + halfWidth : xCenter - halfWidth;
  return xCenter < 0 ? x <= innerBoundary : x >= innerBoundary;
}

/**
 * 着弾点が障害物内部にあるかを判定する。
 */
function isPointInHazard(
  x: number,
  y: number,
  hazard: Hazard,
): boolean {
  if (hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3) {
    return isPointInPolygon(x, y, hazard.points);
  }

  if (hazard.type === "ob") {
    return isPointInObArea(x, y, hazard.xCenter, hazard.width, hazard.yFront, hazard.yBack);
  }

  return isPointInRectangle(x, y, hazard.xCenter, hazard.width, hazard.yFront, hazard.yBack);
}

const HAZARD_TYPE_PRIORITY: Record<Hazard["type"], number> = {
  ob: 0,
  water: 1,
  bunker: 2,
  bareground: 3,
  rough: 4,
  semirough: 5,
};

export function checkLandingInHazard(
  x: number,
  y: number,
  hazards: Hazard[],
): Hazard | null {
  let selectedHazard: Hazard | null = null;
  let selectedPriority = Number.MAX_SAFE_INTEGER;

  for (const hazard of hazards) {
    if (!isPointInHazard(x, y, hazard)) {
      continue;
    }

    const priority = HAZARD_TYPE_PRIORITY[hazard.type] ?? Number.MAX_SAFE_INTEGER;
    if (selectedHazard === null || priority < selectedPriority) {
      selectedHazard = hazard;
      selectedPriority = priority;
    }
  }

  return selectedHazard;
}

export function findFirstHazardEntryPoint(
  trajectoryPoints: Array<{ x: number; y: number }>,
  hazard: Hazard,
): { x: number; y: number } | null {
  let wasInside = false;

  for (const point of trajectoryPoints) {
    const isInside = isPointInHazard(point.x, point.y, hazard);
    if (isInside && !wasInside) {
      return point;
    }
    wasInside = isInside;
  }

  return null;
}

export function distanceToPinFromLanding(
  targetDistance: number,
  finalX: number,
  finalY: number,
): number {
  const dx = finalX;
  const dy = targetDistance - finalY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function determinePenaltyStrokes(hazard: Hazard | null): number {
  if (!hazard) return 0;
  if (hazard.type === "bunker") return 0;
  if (hazard.type === "rough") return 0;
  if (hazard.type === "ob") return 1;
  return hazard.penaltyStrokes;
}

/**
 * ペナルティ系ハザード着弾時の次打位置を簡易的に決定する。
 */
export function resolvePenaltyRelief(
  hazardType: "water" | "ob",
  currentLie: LieType,
  remainingBeforeShot: number,
  geometricRemainingAfterShot: number,
  hazardDifficulty: number,
): { newRemaining: number; newLie: LieType } {
  const difficultyOffset = (hazardDifficulty - 3) * 4;

  if (hazardType === "ob") {
    return {
      newRemaining: Math.max(1, Math.round(remainingBeforeShot + difficultyOffset)),
      newLie: currentLie,
    };
  }

  const droppedRemaining = Math.max(
    Math.round(geometricRemainingAfterShot + 12 + difficultyOffset),
    Math.round(remainingBeforeShot * 0.35),
    1,
  );

  return {
    newRemaining: droppedRemaining,
    newLie: "rough",
  };
}

export function determineLieFromFinalOutcome(
  finalOutcome: ShotResult["finalOutcome"],
  hazard: Hazard | null,
): LieType {
  if (hazard?.type === "semirough") return "semirough";
  if (hazard?.type === "bareground") return "bareground";
  if (finalOutcome === "green") return "green";
  if (finalOutcome === "bunker") return "bunker";
  if (finalOutcome === "rough") return "rough";
  if (hazard?.type === "rough") return "rough";
  return "fairway";
}

export function buildOutcomeMessage(
  finalOutcome: ShotResult["finalOutcome"],
  newRemainingDistance: number,
  lie: LieType,
): string {
  const lieLabelMap: Record<LieType, string> = {
    tee: "ティー",
    fairway: "フェアウェイ",
    semirough: "セミラフ",
    rough: "ラフ",
    bareground: "ベアグラウンド",
    bunker: "バンカー",
    green: "グリーン",
  };
  const lieLabel = lieLabelMap[lie] ?? lie;

  if (finalOutcome === "green") {
    return newRemainingDistance === 0
      ? `グリーンオン！カップインの可能性があります。`
      : `グリーンに近いです。残り${newRemainingDistance}y（${lieLabel}）。`;
  }

  if (finalOutcome === "bunker") {
    return `バンカーに入った可能性があります。残り${newRemainingDistance}y（${lieLabel}）。`;
  }

  if (finalOutcome === "rough") {
    if (lie === "semirough") {
      return `セミラフに入りました。残り${newRemainingDistance}y（${lieLabel}）。`;
    }
    if (lie === "bareground") {
      return `ベアグラウンドに入りました。残り${newRemainingDistance}y（${lieLabel}）。`;
    }
    return `ラフに入りました。残り${newRemainingDistance}y（${lieLabel}）。`;
  }

  if (finalOutcome === "water") {
    return `ウォーターハザードに落ちました。ペナルティが発生します。`;
  }

  if (finalOutcome === "ob") {
    return `OB 判定です。ペナルティが発生します。`;
  }

  return `フェアウェイに着地しました。残り${newRemainingDistance}y（${lie}）。`;
}

export function buildNextShotAdvice(
  finalOutcome: ShotResult["finalOutcome"],
  lie: LieType,
): string {
  const lieLabelMap: Record<LieType, string> = {
    tee: "ティー",
    fairway: "フェアウェイ",
    semirough: "セミラフ",
    rough: "ラフ",
    bareground: "ベアグラウンド",
    bunker: "バンカー",
    green: "グリーン",
  };
  const lieLabel = lieLabelMap[lie] ?? lie;

  if (finalOutcome === "water") {
    return `ウォーター救済後は${lieLabel}ライです。まずはフェアウェイ復帰を優先し、方向の安定を意識してクラブを選びましょう。`;
  }

  if (finalOutcome === "bunker") {
    return `バンカーからの脱出を狙います。飛距離が大幅に落ちる事と難易度が大幅に上昇することに注意してください。`;
  }

  if (finalOutcome === "rough") {
    if (lie === "semirough") {
      return `セミラフからのショットです。飛距離は通常より少し落ち、方向の安定性もやや低下します。`;
    }
    if (lie === "bareground") {
      return `ベアグラウンドからのショットです。飛距離は大幅に落ち、方向も安定しません。`;
    }
    return `ラフからのショットです。飛距離が通常よりも落ちて、難易度も若干上がることを考慮してください。`;
  }

  if (finalOutcome === "ob") {
    return `OB 後は打ち直しです。次の1打は方向重視で刻むことをおすすめします。`;
  }

  if (finalOutcome === "green") {
    return `グリーン上です。残り距離による成功率とスキルレベルで、カップインが自動的に判定されます。`;
  }

  return `フェアウェイからのショットです。残り距離と風を見てクラブを選びましょう。`;
}

type DetailedShotMessageInput = {
  qualityLabel: string;
  clubLabel: string;
  actualDistance: number;
  finalOutcome: ShotResult["finalOutcome"];
  newRemainingDistance: number;
  lieLabel: string;
  hazard: Hazard | null;
  penaltyStrokes: number;
};

/**
 * 通常プレイ向けの詳細な結果メッセージを共通生成する。
 */
export function buildDetailedShotMessage({
  qualityLabel,
  clubLabel,
  actualDistance,
  finalOutcome,
  newRemainingDistance,
  lieLabel,
  hazard,
  penaltyStrokes,
}: DetailedShotMessageInput): string {
  if (hazard) {
    const hazardName = buildHazardDisplayName(hazard);
    if (hazard.type === "water" || hazard.type === "ob") {
      return `${qualityLabel} ${clubLabel} — ${actualDistance}y、${hazardName}に入り罰打+${penaltyStrokes}。救済後 残り${newRemainingDistance}y（${lieLabel}）`;
    }
    return `${qualityLabel} ${clubLabel} — ${actualDistance}y、${hazardName}着弾（残り${newRemainingDistance}y）`;
  }

  if (finalOutcome === "green" && newRemainingDistance === 0) {
    return `${qualityLabel} ${clubLabel} — ${actualDistance}yのショットがカップイン！🎉`;
  }

  return `${qualityLabel} ${clubLabel} — ${actualDistance}y、残り${newRemainingDistance}y（${lieLabel}）`;
}

function isPointInPolygon(
  x: number,
  y: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export function assessLanding(
  landingX: number,
  landingY: number,
  targetDistance: number,
  hazards: Hazard[],
  greenRadius: number = DEFAULT_GREEN_RADIUS,
  greenPolygon?: Array<{ x: number; y: number }>,
  trajectoryPoints?: Array<{ x: number; y: number }>,
): {
  hazard: Hazard | null;
  geometricRemainingDistance: number;
  isOnGreen: boolean;
  finalOutcome: ShotResult["finalOutcome"];
} {
  const hazard = checkLandingInHazard(landingX, landingY, hazards);
  let crossingX = landingX;
  let crossingY = landingY;

  if (hazard && trajectoryPoints?.length && (hazard.type === "water" || hazard.type === "ob")) {
    const entryPoint = findFirstHazardEntryPoint(trajectoryPoints, hazard);
    if (entryPoint) {
      crossingX = entryPoint.x;
      crossingY = entryPoint.y;
    }
  }

  const geometricRemainingDistance = Math.max(
    0,
    Math.round(distanceToPinFromLanding(targetDistance, crossingX, crossingY)),
  );
  const isOnGreen = greenPolygon && greenPolygon.length >= 3
    ? isPointInPolygon(landingX, landingY, greenPolygon)
    : geometricRemainingDistance <= greenRadius;

  if (hazard) {
    if (hazard.type === "water") {
      return { hazard, geometricRemainingDistance, isOnGreen: false, finalOutcome: "water" };
    }
    if (hazard.type === "ob") {
      return { hazard, geometricRemainingDistance, isOnGreen: false, finalOutcome: "ob" };
    }
    if (hazard.type === "bunker") {
      return { hazard, geometricRemainingDistance, isOnGreen: false, finalOutcome: "bunker" };
    }
    if (hazard.type === "rough" || hazard.type === "semirough" || hazard.type === "bareground") {
      return { hazard, geometricRemainingDistance, isOnGreen: false, finalOutcome: "rough" };
    }
    return { hazard, geometricRemainingDistance, isOnGreen: false, finalOutcome: "fairway" };
  }

  return {
    hazard: null,
    geometricRemainingDistance,
    isOnGreen,
    finalOutcome: isOnGreen ? "green" : "fairway",
  };
}
