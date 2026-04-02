import type { SimClub } from "../types/game";
import type { GolfClub } from "../types/golf";
import { getClubTypeDisplay } from "./clubUtils";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns a simulator label aligned with list/card display style.
 * Examples: Driver, 3Wood, 4Hybrid, 7Iron, PW, Putter
 */
export function formatSimClubLabel(club: Pick<SimClub, "number" | "type">): string {
  return getClubTypeDisplay(club.type, club.number);
}

/**
 * Top page (GolfClub) label formatter with the same rules as simulator labels.
 */
export function formatGolfClubLabel(club: Pick<GolfClub, "clubType" | "number">): string {
  return getClubTypeDisplay(club.clubType, club.number);
}

/**
 * Top-page style full club name.
 * Example: 3Wood Callaway Rogue Max LS
 */
export function formatSimClubDisplayName(club: Pick<SimClub, "number" | "type" | "name">): string {
  const base = formatSimClubLabel(club);
  const name = club.name?.trim() ?? "";

  if (!name) return base;
  if (normalizeToken(base) === normalizeToken(name)) return base;
  return `${base} ${name}`;
}
