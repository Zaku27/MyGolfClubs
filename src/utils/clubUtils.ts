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

  if (/^(PW|GW|SW)$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^Putter$/i.test(normalized)) {
    return 'P';
  }

  return normalized;
};

export const getAnalysisClubKey = (
  club: Pick<GolfClub, 'id' | 'clubType' | 'name' | 'number' | 'createdAt'>,
): string => {
  if (club.id != null) {
    return `id:${club.id}`;
  }

  return [club.clubType, club.name, club.number, club.createdAt ?? ''].join('|');
};

/**
 * クラブ・個人データ・スキルレベルから有効成功率を計算
 * missRate: 0-1, weaknessFactor: 0.0-1.0, skill: 0.0-1.0
 * 例: missRate=0.2, weakness=0.9, skill=0.7 → 1 - (0.2 * 0.9 * (1-skill))
 */
export function calculateEffectiveSuccessRate(
  club: GolfClub,
  personal: { missRate?: number; weaknessFactor?: number } = {},
  playerSkillLevel: number = 0.5
): number {
  const missRate = typeof personal.missRate === 'number' ? personal.missRate : 0.15;
  const weakness = typeof personal.weaknessFactor === 'number' ? personal.weaknessFactor : 1.0;
  // skill: 0 (初心者)～1 (上級者)
  const skill = Math.max(0, Math.min(1, playerSkillLevel));
  // missRateは0-1で扱う（100なら1.0）
  const miss = missRate > 1 ? missRate / 100 : missRate;
  // 有効成功率 = 1 - (miss * weakness * (1-skill))
  const effective = 1 - (miss * weakness * (1 - skill));
  return Math.max(0, Math.min(1, effective));
}
