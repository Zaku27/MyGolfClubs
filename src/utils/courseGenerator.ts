import type { Hole } from "../types/game";

const PAR_DISTANCE_RANGE: Record<3 | 4 | 5, { min: number; max: number }> = {
  3: { min: 140, max: 220 },
  4: { min: 320, max: 460 },
  5: { min: 470, max: 590 },
};

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

function cloneHole(hole: Hole): Hole {
  return {
    ...hole,
    hazards: (hole.hazards ?? []).map((hazard) => ({
      ...hazard,
      points: Array.isArray(hazard.points)
        ? hazard.points.map((point) => ({ ...point }))
        : undefined,
      groundCondition: hazard.groundCondition ? { ...hazard.groundCondition } : undefined,
    })),
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

    holes.push(hole);
  }

  return holes;
}
