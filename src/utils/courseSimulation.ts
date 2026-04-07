import { calculateLandingOutcome, applyGroundCondition } from "./landingPosition";
import type { ClubData, SkillLevel } from "./landingPosition";
import type { GroundCondition, Hole, ShotResult } from "../types/game";
import {
  assessLanding,
  buildOutcomeMessage,
  DEFAULT_GREEN_RADIUS,
  determineLieFromFinalOutcome,
  determinePenaltyStrokes,
} from "./shotOutcome";

const DEFAULT_GROUND_HARDNESS = 75;

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

  const condition = hole.groundCondition ?? { hardness: "medium", slopeAngle: 0, slopeDirection: 0 };

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
    condition.hardness,
    condition.slopeAngle,
    condition.slopeDirection,
  ].join("|");
}

export function simulateShotWithCourse(
  club: ClubData,
  skill: SkillLevel,
  hole: Hole,
  aimXOffset: number = 0,
): ShotResult {
  const targetDistance = getHoleTargetDistance(hole);
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_RADIUS;
  const seed = buildCourseSimulationSeed(club, hole, aimXOffset);
  const groundCondition: GroundCondition = hole.groundCondition ?? {
    hardness: "medium",
    slopeAngle: 0,
    slopeDirection: 0,
  };

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

  const landing = applyGroundCondition(
    landingOutcome.landing,
    groundCondition,
    club,
    skill,
  );

  const assessment = assessLanding(
    landing.finalX,
    landing.finalY,
    targetDistance,
    hole.hazards ?? [],
    greenRadius,
    landing.trajectoryPoints,
  );
  const { hazard, finalOutcome, geometricRemainingDistance } = assessment;
  const penaltyStrokes = determinePenaltyStrokes(hazard);
  const newRemainingDistance = geometricRemainingDistance;
  const lie = determineLieFromFinalOutcome(finalOutcome, hazard);
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
