import type { Hazard, LieType, ShotResult } from "../types/game";

export const DEFAULT_GREEN_RADIUS = 12;

const HAZARD_TYPE_LABEL: Record<Hazard["type"], string> = {
  bunker: "バンカー",
  water: "ウォーター",
  ob: "OB",
  rough: "ラフ",
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
 * polygon 形状は現状データが最小限なため、矩形境界で代用する。
 */
export function checkLandingInHazard(
  x: number,
  y: number,
  hazards: Hazard[],
): Hazard | null {
  for (const hazard of hazards) {
    if (hazard.type === "ob") {
      if (isPointInObArea(x, y, hazard.xCenter, hazard.width, hazard.yFront, hazard.yBack)) {
        return hazard;
      }
      continue;
    }

    if (hazard.shape === "rectangle") {
      if (isPointInRectangle(x, y, hazard.xCenter, hazard.width, hazard.yFront, hazard.yBack)) {
        return hazard;
      }
    } else if (hazard.shape === "polygon") {
      if (isPointInRectangle(x, y, hazard.xCenter, hazard.width, hazard.yFront, hazard.yBack)) {
        return hazard;
      }
    }
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
): { newRemaining: number; newLie: LieType } {
  if (hazardType === "ob") {
    return {
      newRemaining: Math.max(1, Math.round(remainingBeforeShot)),
      newLie: currentLie,
    };
  }

  const droppedRemaining = Math.max(
    Math.round(geometricRemainingAfterShot + 12),
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
  if (finalOutcome === "green") {
    return newRemainingDistance === 0
      ? `グリーンオン！カップインの可能性があります。`
      : `グリーンに近いです。残り${newRemainingDistance}y（${lie}）。`;
  }

  if (finalOutcome === "bunker") {
    return `バンカーに入った可能性があります。残り${newRemainingDistance}y（${lie}）。`;
  }

  if (finalOutcome === "rough") {
    return `ラフに入りました。残り${newRemainingDistance}y（${lie}）。`;
  }

  if (finalOutcome === "water") {
    return `ウォーターハザードに落ちました。ペナルティが発生します。`;
  }

  if (finalOutcome === "ob") {
    return `OB 判定です。ペナルティが発生します。`;
  }

  return `フェアウェイに着地しました。残り${newRemainingDistance}y（${lie}）。`;
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

export function assessLanding(
  landingX: number,
  landingY: number,
  targetDistance: number,
  hazards: Hazard[],
  greenRadius: number = DEFAULT_GREEN_RADIUS,
): {
  hazard: Hazard | null;
  geometricRemainingDistance: number;
  isOnGreen: boolean;
  finalOutcome: ShotResult["finalOutcome"];
} {
  const hazard = checkLandingInHazard(landingX, landingY, hazards);
  const geometricRemainingDistance = Math.max(
    0,
    Math.round(distanceToPinFromLanding(targetDistance, landingX, landingY)),
  );
  const isOnGreen = geometricRemainingDistance <= greenRadius;

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
    if (hazard.type === "rough") {
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
