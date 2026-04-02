import type { GolfClub } from "../types/golf";
import type { SimClub } from "../types/game";

function parseClubNumber(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getDefaultSuccessRate(club: GolfClub): number {
  const number = parseClubNumber(club.number);

  switch (club.clubType) {
    case "Driver":
      return 62;
    case "Wood":
      if (number === 3) return 64;
      if (number === 5) return 68;
      if (number === 7) return 72;
      if (number === 9) return 74;
      return 67;
    case "Hybrid":
      if (number === 2) return 65;
      if (number === 3) return 68;
      if (number === 4) return 71;
      if (number === 5) return 74;
      if (number === 6) return 76;
      return 72;
    case "Iron":
      if (number === 1) return 58;
      if (number === 2) return 60;
      if (number === 3) return 62;
      if (number === 4) return 64;
      if (number === 5) return 69;
      if (number === 6) return 73;
      if (number === 7) return 77;
      if (number === 8) return 81;
      if (number === 9) return 84;
      return 76;
    case "Wedge":
      if (club.number === "LW") return 76;
      if (club.number === "SW") return 80;
      if (club.number === "GW" || club.number === "AW") return 83;
      if (club.number === "PW") return 86;
      return 82;
    case "Putter":
      return 91;
    default:
      return 75;
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
