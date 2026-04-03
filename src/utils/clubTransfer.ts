import type { GolfClub } from '../types/golf';

type ExportableClub = Omit<GolfClub, 'id' | 'createdAt' | 'updatedAt'>;

type AllClubsExportPayload = {
  format: 'all-clubs-v1';
  exportedAt: string;
  clubCount: number;
  clubs: ExportableClub[];
};

type BagClubsExportPayload = {
  format: 'bag-clubs-v1';
  exportedAt: string;
  bag: {
    name: string;
    clubCount: number;
  };
  clubs: ExportableClub[];
};

const sanitizeClubForTransfer = (club: GolfClub): ExportableClub => {
  const { id, createdAt, updatedAt, ...rest } = club;
  return rest;
};

const isExportableClubArray = (value: unknown): value is ExportableClub[] => {
  return Array.isArray(value);
};

const parseTransferPayload = (value: unknown): ExportableClub[] => {
  if (Array.isArray(value)) {
    return value as ExportableClub[];
  }

  if (!value || typeof value !== 'object') {
    throw new Error('JSON形式が不正です');
  }

  const parsed = value as { format?: unknown; clubs?: unknown };
  if (!isExportableClubArray(parsed.clubs)) {
    throw new Error('クラブ配列が見つかりません');
  }

  if (parsed.format === 'all-clubs-v1' || parsed.format === 'bag-clubs-v1') {
    return parsed.clubs;
  }

  return parsed.clubs;
};

export const readClubsFromJsonFile = async (
  file: File,
): Promise<Omit<GolfClub, 'id'>[]> => {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const clubs = parseTransferPayload(parsed);
  return clubs.map((club) => ({ ...club }));
};

export const downloadAllClubsAsJson = (
  clubs: GolfClub[],
  filename = 'golf_clubs.json',
): void => {
  const payload: AllClubsExportPayload = {
    format: 'all-clubs-v1',
    exportedAt: new Date().toISOString(),
    clubCount: clubs.length,
    clubs: clubs.map(sanitizeClubForTransfer),
  };
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const downloadBagClubsAsJson = (
  bagName: string,
  clubs: GolfClub[],
  filename?: string,
): void => {
  const normalizedBagName = bagName.trim() || 'golf_bag';
  const safeFileBagName = normalizedBagName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
  const payload: BagClubsExportPayload = {
    format: 'bag-clubs-v1',
    exportedAt: new Date().toISOString(),
    bag: {
      name: normalizedBagName,
      clubCount: clubs.length,
    },
    clubs: clubs.map(sanitizeClubForTransfer),
  };
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename ?? `golf_bag_${safeFileBagName || 'main'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};