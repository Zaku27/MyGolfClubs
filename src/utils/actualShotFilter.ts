import type { SimClub } from "../types/game";
import { formatSimClubLabel } from "./simClubLabel";

/**
 * 実測データからクラブ名のセットを抽出
 */
export function extractClubNamesFromActualShots(
  actualShotRows: Array<Record<string, string>>
): Set<string> {
  const clubNames = new Set<string>();
  for (const row of actualShotRows) {
    const clubName = row.club;
    if (clubName) {
      clubNames.add(clubName);
    }
  }
  return clubNames;
}

/**
 * バッグのクラブのうち、実測データがあるクラブのみをフィルタリング
 * ※パター（Putter）は実測データがなくても含める
 */
export function filterClubsWithActualShots(
  clubs: SimClub[],
  actualShotRows: Array<Record<string, string>>
): SimClub[] {
  const availableClubNames = extractClubNamesFromActualShots(actualShotRows);

  return clubs.filter((club) => {
    // パターは実測データがなくても含める
    if (club.type === "Putter") {
      return true;
    }
    const clubLabel = formatSimClubLabel(club);
    return availableClubNames.has(clubLabel);
  });
}

/**
 * 実測データがあるクラブの数をカウント
 */
export function countClubsWithActualShots(
  clubs: SimClub[],
  actualShotRows: Array<Record<string, string>>
): number {
  return filterClubsWithActualShots(clubs, actualShotRows).length;
}

/**
 * クラブの実測データのみを抽出
 */
export function extractShotsForClub(
  actualShotRows: Array<Record<string, string>>,
  clubLabel: string
): Array<Record<string, string>> {
  return actualShotRows.filter((row) => row.club === clubLabel);
}
