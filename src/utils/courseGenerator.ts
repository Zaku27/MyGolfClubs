import type { Hazard, HazardType, Hole } from "../types/game";

const PAR_DISTANCE_RANGE: Record<3 | 4 | 5, { min: number; max: number }> = {
  3: { min: 140, max: 220 },
  4: { min: 320, max: 460 },
  5: { min: 470, max: 590 },
};

const HAZARD_TYPES: HazardType[] = ["bunker", "water", "ob", "rough", "semirough", "bareground"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickPar(holeNumber: number): 3 | 4 | 5 {
  const roll = Math.random();

  if (holeNumber % 9 === 0 && roll > 0.7) {
    return 5;
  }

  if (roll < 0.22) return 3;
  if (roll < 0.78) return 4;
  return 5;
}

function buildHazardId(holeNumber: number, hazardIndex: number): string {
  return `rh-${holeNumber}-${hazardIndex}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateHazard(hole: Hole, hazardIndex: number): Hazard {
  const type = HAZARD_TYPES[randomInt(0, HAZARD_TYPES.length - 1)];
  const holeLength = hole.distanceFromTee;
  const minFront = Math.max(20, Math.round(holeLength * 0.12));
  const maxBack = Math.round(holeLength * 0.95);
  const yFront = randomInt(minFront, Math.max(minFront + 8, maxBack - 25));
  const depth = randomInt(10, 36);
  const yBack = Math.min(maxBack, yFront + depth);

  let width = randomInt(16, 70);
  if (type === "ob") {
    width = randomInt(14, 22);
  }

  const lateralLimit = type === "ob" ? 80 : 55;
  const xCenter = type === "ob"
    ? (Math.random() < 0.5 ? -1 : 1) * randomInt(62, lateralLimit)
    : randomInt(-lateralLimit, lateralLimit);

  const penaltyStrokes = type === "ob" ? 2 : type === "water" ? 1 : 0;

  return {
    id: buildHazardId(hole.number, hazardIndex),
    type,
    shape: "rectangle",
    yFront,
    yBack,
    xCenter,
    width,
    penaltyStrokes,
    groundCondition: {
      hardness: "medium",
      slopeAngle: 0,
      slopeDirection: 0,
    },
    name: `${type.toUpperCase()} ${hazardIndex + 1}`,
  };
}

function cloneHole(hole: Hole): Hole {
  return {
    ...hole,
    hazards: (hole.hazards ?? []).map((hazard) => ({ ...hazard })),
    groundCondition: hole.groundCondition ? { ...hole.groundCondition } : undefined,
  };
}

export function cloneCourse(holes: Hole[]): Hole[] {
  return holes.map(cloneHole);
}

export function generateRandomCourse(holeCount: number): Hole[] {
  const normalizedHoleCount = Math.max(1, Math.min(18, Math.round(holeCount)));
  const holes: Hole[] = [];

  for (let i = 0; i < normalizedHoleCount; i += 1) {
    const number = i + 1;
    const par = pickPar(number);
    const distanceRange = PAR_DISTANCE_RANGE[par];
    const distanceFromTee = randomInt(distanceRange.min, distanceRange.max);
    const hazardCount = randomInt(1, 4);

    const hole: Hole = {
      number,
      par,
      distanceFromTee,
      targetDistance: distanceFromTee,
      greenRadius: randomInt(10, 16),
      hazards: [],
      groundCondition: {
        hardness: "medium",
        slopeAngle: 0,
        slopeDirection: 0,
      },
    };

    hole.hazards = Array.from({ length: hazardCount }, (_, hazardIndex) => generateHazard(hole, hazardIndex));
    holes.push(hole);
  }

  return holes;
}
