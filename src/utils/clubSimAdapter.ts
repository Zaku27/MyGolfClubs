import type { GolfClub } from "../types/golf";
import type { SimClub } from "../types/game";

function getDefaultSuccessRate(club: GolfClub): number {
  switch (club.clubType) {
    case "Driver":
      return 80;
    case "Wood":
      return 84;
    case "Hybrid":
      return 88;
    case "Iron":
      return 92;
    case "Wedge":
      return 96;
    case "Putter":
      return 100;
    default:
      return 90;
  }
}

/**
 * Converts a bag-management GolfClub into the lightweight SimClub
 * used by the game simulator.
 */
export function toSimClub(club: GolfClub): SimClub {
  const successRate = getDefaultSuccessRate(club);

  // Keep loft angle for estimateShotDistance/getEstimatedDistance.
  // Missing loft was treated as 0, which caused large distance overestimation in simulator UI.
  const loftAngle =
    typeof club.loftAngle === "number" && club.loftAngle > 0
      ? club.loftAngle
      : club.clubType === "Driver"
        ? 10.5
        : club.clubType === "Wood"
          ? 15
          : club.clubType === "Hybrid"
            ? 22
            : club.clubType === "Iron"
              ? 30
              : club.clubType === "Wedge"
                ? 46
                : 3;

  return {
    id: String(club.id ?? `${club.clubType}-${club.number}`),
    name: club.name,
    type: club.clubType as SimClub["type"],
    number: club.number,
    loftAngle,
    avgDistance: club.distance,
    successRate,
    isWeakClub: successRate < 65,
  };
}
