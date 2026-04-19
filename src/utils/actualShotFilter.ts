import type { SimClub } from "../types/game";
import { formatSimClubLabel } from "./simClubLabel";

/**
 * CSVのクラブ名をシミュレーターのクラブラベルにマッピング
 * PersonalDataInput.tsx と同様のロジック
 */
export function mapCsvClubToSimClubLabel(clubValue: string): string {
  const value = clubValue.trim();
  const normalized = value.replace(/\s+/g, '').toLowerCase();

  if (/^driver$/i.test(value) || /^minidriver$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Driver', number: '' });
  }

  const woodMatch = normalized.match(/^(\d+)(wood|w)$/i);
  if (woodMatch) {
    return formatSimClubLabel({ type: 'Wood', number: woodMatch[1] });
  }

  const hybridMatch = normalized.match(/^(\d+)(hybrid|h)$/i);
  if (hybridMatch) {
    return formatSimClubLabel({ type: 'Hybrid', number: hybridMatch[1] });
  }

  const ironMatch = normalized.match(/^(\d+)(iron|i)$/i);
  if (ironMatch) {
    return formatSimClubLabel({ type: 'Iron', number: ironMatch[1] });
  }

  // Map numeric-only club names (e.g., 54, 58, 60) as wedge loft angles
  const numberMatch = normalized.match(/^(\d+)$/i);
  if (numberMatch) {
    return formatSimClubLabel({ type: 'Wedge', number: numberMatch[1] });
  }

  // Map "Pitching Wedge" to PW
  if (/^pitchingwedge$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Wedge', number: 'PW' });
  }

  // Map "Gap Wedge" to GW
  if (/^gapwedge$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Wedge', number: 'GW' });
  }

  // Map "Lob Wedge" to LW
  if (/^lobwedge$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Wedge', number: 'LW' });
  }

  // Map "Sand Wedge" to SW
  if (/^sandwedge$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Wedge', number: 'SW' });
  }

  if (/^(pw|gw|sw)$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Wedge', number: normalized.toUpperCase() });
  }

  if (/^(putter|p)$/i.test(normalized)) {
    return formatSimClubLabel({ type: 'Putter', number: '' });
  }

  // Already valid simulator label like Driver, 3Wood, 4Hybrid, 7Iron, PW, Putter
  if (/^(Driver|\d+Wood|\d+Hybrid|\d+Iron|PW|GW|SW|Putter)$/i.test(value)) {
    return formatSimClubLabel({ 
      type: /^Driver$/i.test(value) ? 'Driver' : /Putter/i.test(value) ? 'Putter' : /^(PW|GW|SW)$/i.test(value) ? 'Wedge' : (/Wood/i.test(value) ? 'Wood' : /Hybrid/i.test(value) ? 'Hybrid' : 'Iron'),
      number: (() => {
        if (/^Driver$/i.test(value) || /^Putter$/i.test(value)) return '';
        const numberMatch = value.match(/^(\d+)/);
        if (numberMatch) return numberMatch[1];
        return value.toUpperCase();
      })() 
    });
  }

  // If it's already a valid simulator label, return as-is
  return value;
}

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
    // 実測データのクラブ名は既に mapCsvClubToSimClubLabel で正規化されている
    // なので、そのまま比較する
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
