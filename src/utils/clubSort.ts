import type { GolfClub } from '../types/golf';

const normalizeSortText = (value: string | undefined): string => {
  return (value ?? '').toUpperCase().replace(/\s|-/g, '');
};

export const isPutterClub = (club: Pick<GolfClub, 'clubType' | 'name'>): boolean => {
  const type = normalizeSortText(club.clubType);
  const name = normalizeSortText(club.name);
  return type === 'P' || type === 'PUTTER' || name.includes('PUTTER');
};

export const compareClubsForDisplay = (a: GolfClub, b: GolfClub): number => {
  const aPutter = isPutterClub(a);
  const bPutter = isPutterClub(b);
  if (aPutter && !bPutter) return 1;
  if (!aPutter && bPutter) return -1;

  const loftA = a.loftAngle ?? Number.MAX_SAFE_INTEGER;
  const loftB = b.loftAngle ?? Number.MAX_SAFE_INTEGER;
  if (loftA !== loftB) return loftA - loftB;

  const lengthDiff = (a.length ?? 0) - (b.length ?? 0);
  if (lengthDiff !== 0) return lengthDiff;

  return (a.name ?? '').localeCompare(b.name ?? '');
};

export const sortClubsForDisplay = (clubs: GolfClub[]): GolfClub[] => {
  return [...clubs].sort(compareClubsForDisplay);
};
