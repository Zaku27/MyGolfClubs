import type { ClubCategory, GolfClub } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';

export const CLUB_TYPE_OPTIONS: { value: ClubCategory; label: string }[] = [
  { value: 'Driver', label: 'Driver' },
  { value: 'Wood', label: 'Wood' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Iron', label: 'Iron' },
  { value: 'Wedge', label: 'Wedge' },
  { value: 'Putter', label: 'Putter' },
];

export const CLUB_NUMBER_OPTIONS: Partial<Record<ClubCategory, string[]>> = {
  Driver: ['1W', 'mini'],
  Wood: ['3W', '5W', '7W', '9W'],
  Hybrid: ['2H', '3H', '4H', '5H', '6H'],
  Iron: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  Wedge: ['PW', 'GW', 'AW', 'SW', 'LW'],
};

export const CLUB_NUMBER_DEFAULT: Record<ClubCategory, string> = {
  Driver: '1W',
  Wood: '3W',
  Hybrid: '3H',
  Iron: '7',
  Wedge: 'PW',
  Putter: 'Putter',
};

const FALLBACK_CLUB_FIELDS: Omit<GolfClub, 'id' | 'clubType' | 'name' | 'number' | 'flex'> = {
  length: 0,
  weight: 0,
  swingWeight: '',
  lieAngle: 0,
  loftAngle: 0,
  shaftType: '',
  torque: 0,
  distance: 0,
  notes: '',
};

export const normalizeClubNumberForPreset = (
  clubType: ClubCategory,
  value: string,
): string => {
  if (clubType === 'Putter') {
    return 'Putter';
  }

  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
  if (clubType === 'Driver' && !normalized) {
    return '1W';
  }

  return normalized;
};

export const inferNumberPreset = (clubType: ClubCategory, value: string): string => {
  const options = CLUB_NUMBER_OPTIONS[clubType] ?? [];
  const normalized = normalizeClubNumberForPreset(clubType, value);
  return options.includes(normalized) ? normalized : 'Custom';
};

export const buildClubDefaults = (clubType: ClubCategory): Omit<GolfClub, 'id'> => {
  const source = DEFAULT_CLUBS.find((defaultClub) => defaultClub.clubType === clubType);

  if (!source) {
    return {
      clubType,
      name: '',
      number: CLUB_NUMBER_DEFAULT[clubType],
      ...FALLBACK_CLUB_FIELDS,
      flex: clubType === 'Putter' ? undefined : 'S',
    };
  }

  return {
    ...source,
    clubType,
    name: '',
    number: CLUB_NUMBER_DEFAULT[clubType],
  };
};

export const normalizeNumberForMatch = (clubType: ClubCategory, value: string): string => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');

  if (clubType === 'Driver') {
    return normalized.replace(/W$/, '') || '1';
  }

  if (clubType === 'Wood') {
    const match = normalized.match(/^(\d+)/);
    return match?.[1] ?? normalized.replace(/W$/, '');
  }

  if (clubType === 'Hybrid') {
    const match = normalized.match(/^(\d+)/);
    return match?.[1] ?? normalized.replace(/H$/, '');
  }

  if (clubType === 'Putter') {
    return 'P';
  }

  return normalized;
};

export const normalizeSwingWeightInput = (value: string): string => {
  return (value ?? '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９．]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .toUpperCase()
    .replace(/\s+/g, '');
};

export const buildClubDefaultsByTypeAndNumber = (
  clubType: ClubCategory,
  selectedNumber: string,
): Omit<GolfClub, 'id'> => {
  const candidates = DEFAULT_CLUBS.filter((defaultClub) => defaultClub.clubType === clubType);
  if (candidates.length === 0) {
    return {
      ...buildClubDefaults(clubType),
      number: selectedNumber,
    };
  }

  const selectedNormalized = normalizeNumberForMatch(clubType, selectedNumber);
  const exact = candidates.find(
    (candidate) => normalizeNumberForMatch(clubType, candidate.number) === selectedNormalized,
  );

  if (exact) {
    return {
      ...exact,
      number: selectedNumber,
    };
  }

  const selectedNumeric = Number(selectedNormalized);
  if (Number.isFinite(selectedNumeric)) {
    const nearest = candidates
      .map((candidate) => ({
        candidate,
        numeric: Number(normalizeNumberForMatch(clubType, candidate.number)),
      }))
      .filter((entry) => Number.isFinite(entry.numeric))
      .sort(
        (left, right) => Math.abs(left.numeric - selectedNumeric) - Math.abs(right.numeric - selectedNumeric),
      )[0];

    if (nearest) {
      return {
        ...nearest.candidate,
        number: selectedNumber,
      };
    }
  }

  return {
    ...candidates[0],
    number: selectedNumber,
  };
};