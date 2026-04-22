import type { GolfClub } from '../types/golf';

export const getClubTypeDisplay = (clubType: string, number: string): string => {
  const normalizedNumber = (number ?? '').trim();

  if (clubType === 'Driver') {
    if (/^mini(?:\s*driver)?$/i.test(normalizedNumber)) {
      return 'miniDriver';
    }

    return 'Driver';
  }

  if (clubType === 'Wood') {
    const base = normalizedNumber
      .replace(/\s*wood\s*$/i, '')
      .replace(/\s*w\s*$/i, '')
      .trim();
    return `${base || normalizedNumber}Wood`;
  }

  if (clubType === 'Hybrid') {
    const base = normalizedNumber
      .replace(/\s*hybrid\s*$/i, '')
      .replace(/\s*h\s*$/i, '')
      .trim();
    return `${base || normalizedNumber}Hybrid`;
  }

  if (clubType === 'Iron') return `${number}Iron`;
  if (clubType === 'Wedge') return number;
  return clubType || 'Unknown';
};

export const getClubTypeShort = (name: string): string => {
  const normalized = name.trim();

  if (/^(\d+)-Wood$/i.test(normalized)) {
    return normalized.replace(/-(Wood)$/i, 'W');
  }

  if (/^(\d+)-Iron$/i.test(normalized)) {
    return normalized.replace(/-(Iron)$/i, 'I');
  }

  if (/^Hybrid\s*\((\d+H)\)$/i.test(normalized)) {
    return normalized.match(/\((\d+H)\)/i)?.[1] ?? normalized;
  }

  if (/^Driver$/i.test(normalized)) {
    return 'D';
  }

  if (/^(PW|GW|SW|UW|AW)$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^Putter$/i.test(normalized)) {
    return 'P';
  }

  return normalized;
};

export const getClubLabel = (clubType: string, number: string, name?: string): string => {
  const typeName = getClubTypeDisplay(clubType, number).trim();
  return name ? `${typeName} ${name}` : typeName;
};

export const getAnalysisClubKey = (
  club: Pick<GolfClub, 'id' | 'clubType' | 'name' | 'number' | 'createdAt'>,
): string => {
  if (club.id != null) {
    return `id:${club.id}`;
  }

  return [club.clubType, club.name, club.number, club.createdAt ?? ''].join('|');
};
