import { calculateLandingOutcome } from "./landingPosition";
import type { ClubData, SkillLevel } from "./landingPosition";
import type { Hazard, Hole, ShotResult, LieType } from "../types/game";

const DEFAULT_GROUND_HARDNESS = 70;
const DEFAULT_GREEN_CAPTURE_RADIUS = 12;

function getHoleTargetDistance(hole: Hole): number {
  return hole.targetDistance ?? hole.distanceFromTee;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildCourseSimulationSeed(
  club: ClubData,
  hole: Hole,
  aimXOffset: number,
): string {
  const hazardSeed = (hole.hazards ?? [])
    .map((hazard) => `${hazard.id}:${hazard.type}:${hazard.shape}:${hazard.yFront}:${hazard.yBack}:${hazard.xCenter}:${hazard.width}:${hazard.penaltyStrokes}`)
    .join("|");

  return [
    club.clubType,
    club.name,
    club.number,
    club.loftAngle,
    club.distance,
    aimXOffset,
    hole.number,
    getHoleTargetDistance(hole),
    hazardSeed,
  ].join("|");
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
 * OB は「矩形の幅全体」ではなく、コース中心に最も近い境界線を越えたかで判定する。
 * 例:
 * - 左OB: 着弾X が innerBoundary 以下なら OB
 * - 右OB: 着弾X が innerBoundary 以上なら OB
 *
 * Y方向は従来どおり、そのOB区間内だけを有効範囲とする。
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

  if (xCenter < 0) {
    return x <= innerBoundary;
  }

  return x >= innerBoundary;
}

/**
 * 着弾点が障害物内部にあるかを判定する。
 * polygon 形状は現状データが最小限なため、矩形境界で代用します。
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

function distanceToPinFromLanding(
  targetDistance: number,
  finalX: number,
  finalY: number,
): number {
  const dx = finalX;
  const dy = targetDistance - finalY;
  return Math.sqrt(dx * dx + dy * dy);
}

function determineFinalOutcome(
  landingX: number,
  landingY: number,
  targetDistance: number,
  greenRadius: number,
  hazards: Hazard[],
): ShotResult["finalOutcome"] {
  const hazard = checkLandingInHazard(landingX, landingY, hazards);
  if (hazard) {
    if (hazard.type === "water") return "water";
    if (hazard.type === "ob") return "ob";
    if (hazard.type === "bunker") return "bunker";
    // rough は最終的な finalOutcome では fairway 扱い。
    return "fairway";
  }

  const distanceToPin = distanceToPinFromLanding(targetDistance, landingX, landingY);
  if (distanceToPin <= greenRadius) {
    return "green";
  }

  return "fairway";
}

function determineLie(
  finalOutcome: ShotResult["finalOutcome"],
  hazard: Hazard | null,
): LieType {
  if (finalOutcome === "green") return "green";
  if (finalOutcome === "bunker") return "bunker";
  if (hazard?.type === "rough") return "rough";
  return "fairway";
}

function determinePenaltyStrokes(hazard: Hazard | null): number {
  if (!hazard) return 0;
  if (hazard.type === "bunker") return 0;
  return hazard.penaltyStrokes;
}

function buildOutcomeMessage(
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

  if (finalOutcome === "water") {
    return `ウォーターハザードに落ちました。ペナルティが発生します。`;
  }

  if (finalOutcome === "ob") {
    return `OB 判定です。ペナルティが発生します。`;
  }

  return `フェアウェイに着地しました。残り${newRemainingDistance}y（${lie}）。`;
}

export function simulateShotWithCourse(
  club: ClubData,
  skill: SkillLevel,
  hole: Hole,
  aimXOffset: number = 0,
): ShotResult {
  const targetDistance = getHoleTargetDistance(hole);
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_CAPTURE_RADIUS;
  const seed = buildCourseSimulationSeed(club, hole, aimXOffset);
  const landingOutcome = calculateLandingOutcome({
    club,
    skillLevel: skill,
    aimXOffset,
    conditions: {
      wind: 0,
      groundHardness: DEFAULT_GROUND_HARDNESS,
      seed,
      baseDistanceOverride: targetDistance,
    },
  });

  const landing = landingOutcome.landing;
  const hazard = checkLandingInHazard(landing.finalX, landing.finalY, hole.hazards ?? []);
  const finalOutcome = determineFinalOutcome(landing.finalX, landing.finalY, targetDistance, greenRadius, hole.hazards ?? []);
  const penaltyStrokes = determinePenaltyStrokes(hazard);
  const newRemainingDistance = Math.max(0, Math.round(distanceToPinFromLanding(targetDistance, landing.finalX, landing.finalY)));
  const lie = determineLie(finalOutcome, hazard);
  const wasSuccessful = finalOutcome === "fairway" || finalOutcome === "green";
  const effectiveSuccessRate = Math.round(clampNumber((1 - skill.mishitRate) * 100, 0, 100));

  return {
    newRemainingDistance,
    outcomeMessage: buildOutcomeMessage(finalOutcome, newRemainingDistance, lie),
    strokesAdded: 1,
    lie,
    penalty: penaltyStrokes > 0,
    distanceHit: Math.round(landing.totalDistance),
    shotQuality: landingOutcome.shotQuality,
    wasSuccessful,
    effectiveSuccessRate,
    confidenceBoostApplied: false,
    landing,
    finalOutcome,
    penaltyStrokes,
  };
}
