import type { GolfClub } from './golf';

export type LieAngleStatus = 'Good' | 'Slightly Off' | 'Adjust Recommended';

export type UserLieAngleStandards = {
  byClubType: Record<string, number>;
  byClubName: Record<string, number>;
};

export const DEFAULT_USER_LIE_ANGLE_STANDARDS: UserLieAngleStandards = {
  byClubType: {},
  byClubName: {},
};

export const DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE: Record<string, number> = {
  D: 57.0,
  '3W': 56.0,
  '5W': 56.5,
  '4H': 59.0,
  '5H': 59.5,
  '6I': 61.5,
  '7I': 62.0,
  '8I': 62.5,
  '9I': 63.0,
  PW: 64.0,
  '50': 64.0,
  '54': 64.0,
  '58': 64.0,
  P: 70.0,
};

export const normalizeLieStandardKey = (value: string): string =>
  value.trim().toUpperCase();

export const makePerClubLieStandardKey = (
  clubName: string,
  clubType: string,
  clubNumber = '',
): string => {
  const normalizedName = normalizeLieStandardKey(clubName);
  const normalizedType = normalizeLieStandardKey(clubType);
  const normalizedNumber = normalizeLieStandardKey(clubNumber);

  if (!normalizedNumber) {
    return `${normalizedName}|${normalizedType}`;
  }

  return `${normalizedName}|${normalizedType}|${normalizedNumber}`;
};

export const getLieStandardTypeKeyForClub = (club: GolfClub): string => {
  const normalizedName = normalizeLieStandardKey(club.name ?? '');
  const normalizedNumber = normalizeLieStandardKey(club.number ?? '');
  const legacyType = normalizeLieStandardKey(club.clubType ?? '');

  switch (club.clubType) {
    case 'Driver':
      return 'D';
    case 'Wood': {
      const woodNumber = extractLeadingNumber(normalizedNumber);
      if (Number.isFinite(woodNumber)) {
        return woodNumber === 1 ? 'D' : `${woodNumber}W`;
      }
      break;
    }
    case 'Hybrid': {
      const hybridNumber = extractLeadingNumber(normalizedNumber);
      if (Number.isFinite(hybridNumber)) {
        return `${hybridNumber}H`;
      }
      break;
    }
    case 'Iron': {
      if (normalizedNumber === 'PW') return 'PW';
      const ironNumber = extractLeadingNumber(normalizedNumber);
      if (Number.isFinite(ironNumber)) {
        return `${ironNumber}I`;
      }
      break;
    }
    case 'Wedge': {
      if (normalizedNumber === 'PW') return 'PW';
      const wedgeKey = getWedgeLieTypeKey(Number(club.loftAngle ?? 0), normalizedNumber);
      if (wedgeKey) {
        return wedgeKey;
      }
      break;
    }
    case 'Putter':
      return 'P';
  }

  const inferredType = inferClubTypeFromNameOrLoft(club, normalizedName);
  if (inferredType) {
    return inferredType;
  }

  if (Number.isFinite(DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[legacyType])) {
    return legacyType;
  }

  switch (legacyType) {
    case 'D':
    case 'DRIVER':
      return 'D';
    case 'WOOD':
      return '3W';
    case 'H':
    case 'HYBRID':
      return '5H';
    case 'I':
    case 'IRON':
      return '7I';
    case 'WEDGE':
      return '54';
    case 'P':
    case 'PUTTER':
      return 'P';
    default:
      return '54';
  }
};

export const displayLieStandardTypeLabel = (clubTypeKey: string): string => {
  const normalized = normalizeLieStandardKey(clubTypeKey);
  if (normalized === 'D') return 'Driver';
  if (normalized === 'P') return 'Putter';
  return normalized;
};

export const fallbackLieStandardForType = (clubTypeKey: string): number => {
  const normalized = normalizeLieStandardKey(clubTypeKey);
  const defaultByType = DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[normalized];
  if (Number.isFinite(defaultByType)) {
    return defaultByType;
  }
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return 64.0;
  }
  if (normalized === 'D' || normalized === 'DRIVER') {
    return 57.0;
  }
  if (normalized === 'P' || normalized === 'PUTTER') {
    return 70.0;
  }
  if (normalized === 'WOOD' || normalized.endsWith('W')) {
    return 57.0;
  }
  if (normalized === 'HYBRID' || normalized.endsWith('H')) {
    return 59.5;
  }
  if (normalized === 'IRON' || normalized.endsWith('I') || normalized === 'PW') {
    return 62.0;
  }
  return 64.0;
};

export const compareLieStandardTypeOrder = (a: string, b: string): number => {
  const [ag, av, as] = getLieStandardTypeSortKey(a);
  const [bg, bv, bs] = getLieStandardTypeSortKey(b);
  if (ag !== bg) return ag - bg;
  if (av !== bv) return av - bv;
  return as.localeCompare(bs);
};

export const resolveStandardLieAngle = (
  club: GolfClub,
  standards: UserLieAngleStandards,
): number => {
  const perClubKey = makePerClubLieStandardKey(
    club.name ?? '',
    club.clubType ?? '',
    club.number ?? '',
  );
  const legacyPerClubKey = makePerClubLieStandardKey(club.name ?? '', club.clubType ?? '');
  const normalizedName = normalizeLieStandardKey(club.name ?? '');
  const normalizedType = getLieStandardTypeKeyForClub(club);
  const legacyType = normalizeLieStandardKey(club.clubType ?? '');

  const byName = standards.byClubName[perClubKey] ?? standards.byClubName[legacyPerClubKey];
  if (Number.isFinite(byName)) {
    return byName;
  }

  const byType = standards.byClubType[normalizedType] ?? standards.byClubType[legacyType];
  if (Number.isFinite(byType)) {
    return byType;
  }

  const defaultByType = DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[normalizedType]
    ?? DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[legacyType];
  if (Number.isFinite(defaultByType)) {
    return defaultByType;
  }

  const inferredType = inferClubTypeFromNameOrLoft(club, normalizedName);
  if (inferredType) {
    const inferred = DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[inferredType];
    if (Number.isFinite(inferred)) {
      return inferred;
    }
  }

  return fallbackLieStandardForType(normalizedType);
};

const extractLeadingNumber = (value: string): number => {
  const match = value.match(/^(\d+)/);
  if (!match) return Number.NaN;
  return Number(match[1]);
};

const getWedgeLieTypeKey = (loftAngle: number, normalizedNumber: string): string | null => {
  const numericLoft = Number(normalizedNumber) || loftAngle;
  if (!Number.isFinite(numericLoft) || numericLoft <= 0) {
    return null;
  }
  if (numericLoft <= 52) return '50';
  if (numericLoft <= 56) return '54';
  return '58';
};

const getLieStandardTypeSortKey = (clubTypeRaw: string): [number, number, string] => {
  const clubType = normalizeLieStandardKey(clubTypeRaw);
  if (clubType === 'D' || clubType === 'DRIVER') return [0, 0, clubType];
  if (clubType === 'WOOD') return [1, 999, clubType];
  if (clubType === 'HYBRID') return [2, 999, clubType];
  if (clubType === 'PW') return [3, 10, clubType];
  if (clubType === 'IRON') return [3, 999, clubType];
  if (clubType.endsWith('W')) {
    const n = Number(clubType.replace('W', ''));
    return [1, Number.isFinite(n) ? n : 999, clubType];
  }
  if (clubType.endsWith('H')) {
    const n = Number(clubType.replace('H', ''));
    return [2, Number.isFinite(n) ? n : 999, clubType];
  }
  if (clubType.endsWith('I')) {
    const n = Number(clubType.replace('I', ''));
    return [3, Number.isFinite(n) ? n : 999, clubType];
  }
  if (clubType === 'WEDGE') return [5, 999, clubType];
  if (/^\d+(\.\d+)?$/.test(clubType)) {
    return [5, Number(clubType), clubType];
  }
  if (clubType === 'P' || clubType === 'PUTTER') return [6, 0, clubType];
  return [7, 999, clubType];
};

const inferClubTypeFromNameOrLoft = (
  club: GolfClub,
  normalizedName: string,
): string | null => {
  if (normalizedName.includes('DRIVER')) return 'D';
  if (normalizedName.includes('PUTTER')) return 'P';
  if (normalizedName.includes('PW') || normalizedName.includes('PITCHING')) {
    return 'PW';
  }

  const woodMatch = normalizedName.match(/\b(\d+)\s*-?\s*W(?:OOD)?\b/);
  if (woodMatch?.[1]) return `${woodMatch[1]}W`;

  const hybridMatch = normalizedName.match(/\b(\d+)\s*-?\s*H(?:YBRID)?\b/);
  if (hybridMatch?.[1]) return `${hybridMatch[1]}H`;

  const ironMatch = normalizedName.match(/\b([3-9])\s*-?\s*I(?:RON)?\b/);
  if (ironMatch?.[1]) return `${ironMatch[1]}I`;

  const categoryType = normalizeLieStandardKey(club.clubType ?? '');
  const loft = Number(club.loftAngle ?? 0);

  if (categoryType === 'D' || categoryType.endsWith('W')) {
    if (loft <= 13) return 'D';
    if (loft <= 16.5) return '3W';
    return '5W';
  }
  if (categoryType.endsWith('H')) {
    if (loft <= 23) return '4H';
    return '5H';
  }
  if (categoryType.endsWith('I') || categoryType === 'PW') {
    if (loft <= 29) return '6I';
    if (loft <= 33) return '7I';
    if (loft <= 37) return '8I';
    if (loft <= 41) return '9I';
    return 'PW';
  }
  if (/^\d+(\.\d+)?$/.test(categoryType)) {
    if (loft <= 52) return '50';
    if (loft <= 56) return '54';
    return '58';
  }
  if (categoryType === 'P') return 'P';

  if (loft <= 29) return '6I';
  if (loft <= 33) return '7I';
  if (loft <= 37) return '8I';
  if (loft <= 41) return '9I';
  if (loft <= 47) return 'PW';
  if (loft <= 52) return '50';
  if (loft <= 56) return '54';
  if (loft > 65) return 'P';
  return '58';
};

export const lieStatusFromDeviation = (deviation: number): LieAngleStatus => {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= 1.5) return 'Good';
  if (absDeviation <= 3.0) return 'Slightly Off';
  return 'Adjust Recommended';
};

export const lieStatusColor = (status: LieAngleStatus): string => {
  switch (status) {
    case 'Good':
      return '#2e7d32';
    case 'Slightly Off':
      return '#ef6c00';
    case 'Adjust Recommended':
      return '#c62828';
  }
};

export const lieStatusLabelJa = (status: LieAngleStatus): string => {
  switch (status) {
    case 'Good':
      return '良好';
    case 'Slightly Off':
      return 'ややズレ';
    case 'Adjust Recommended':
      return '調整推奨';
  }
};
