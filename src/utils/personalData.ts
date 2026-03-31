import type { ClubPersonalData } from "../types/golf";
import type { SimClub } from "../types/game";

export function getLegacyClubKey(clubType: string, clubNumber: string): string {
  return `${clubType}-${clubNumber}`;
}

export function resolvePersonalDataForSimClub(
  club: SimClub,
  personalDataMap: Record<string, ClubPersonalData>,
): ClubPersonalData | undefined {
  return personalDataMap[club.id] ?? personalDataMap[getLegacyClubKey(club.type, club.number)];
}
