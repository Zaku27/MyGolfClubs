import type { SimClub } from "../types/game";
import type { GolfClub } from "../types/golf";
import { getClubTypeDisplay } from "./clubUtils";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function formatBaseClubLabel(clubType: string, clubNumber?: string): string {
  return getClubTypeDisplay(clubType, clubNumber ?? "");
}

function composeDisplayName(base: string, name?: string): string {
  const normalizedName = name?.trim() ?? "";

  if (!normalizedName) return base;
  if (normalizeToken(base) === normalizeToken(normalizedName)) return base;
  return `${base} ${normalizedName}`;
}

/**
 * Returns a simulator label aligned with list/card display style.
 * Examples: Driver, 3Wood, 4Hybrid, 7Iron, PW, Putter
 */
export function formatSimClubLabel(club: Pick<SimClub, "number" | "type">): string {
  return formatBaseClubLabel(club.type, club.number);
}

/**
 * Top-page style full club name for GolfClub.
 * Example: 3Wood Callaway Rogue Max LS
 */
export function formatGolfClubDisplayName(club: Pick<GolfClub, "clubType" | "number" | "name">): string {
  return composeDisplayName(formatBaseClubLabel(club.clubType, club.number), club.name);
}

/**
 * Top-page style full club name.
 * Example: 3Wood Callaway Rogue Max LS
 */
export function formatSimClubDisplayName(club: Pick<SimClub, "number" | "type" | "name">): string {
  return composeDisplayName(formatSimClubLabel(club), club.name);
}
