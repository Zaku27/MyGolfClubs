import type { GolfClub, GolfBag, AccessoryItem } from '../types/golf';

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

type ExportableBag = Omit<GolfBag, 'id' | 'createdAt' | 'updatedAt'>;

type ExportableAccessory = Omit<AccessoryItem, 'id' | 'createdAt'>;

type CompleteDataExportPayload = {
  format: 'complete-data-v1';
  exportedAt: string;
  clubCount: number;
  bagCount: number;
  accessoryCount: number;
  clubs: ExportableClub[];
  bags: ExportableBag[];
  accessories: ExportableAccessory[];
};

const sanitizeClubForTransfer = (club: GolfClub): ExportableClub => {
  const { id, createdAt, updatedAt, ...rest } = club;
  return rest;
};

const sanitizeBagForTransfer = (bag: GolfBag): ExportableBag => {
  const { id, createdAt, updatedAt, ...rest } = bag;
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

export const readCompleteDataFromJsonFile = async (
  file: File,
): Promise<{ clubs: Omit<GolfClub, 'id'>[]; bags: Omit<GolfBag, 'id'>[]; accessories: Omit<AccessoryItem, 'id' | 'createdAt'>[] }> => {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON形式が不正です');
  }

  const data = parsed as { format?: unknown; clubs?: unknown; bags?: unknown; accessories?: unknown };

  if (data.format === 'complete-data-v1') {
    if (!isExportableClubArray(data.clubs)) {
      throw new Error('クラブ配列が見つかりません');
    }
    if (!Array.isArray(data.bags)) {
      throw new Error('バッグ配列が見つかりません');
    }
    if (!Array.isArray(data.accessories)) {
      throw new Error('アクセサリー配列が見つかりません');
    }

    return {
      clubs: data.clubs.map((club) => ({ ...club })),
      bags: data.bags.map((bag) => ({ ...bag })),
      accessories: data.accessories.map((acc) => ({ ...acc })),
    };
  }

  // Fallback to old format (only clubs)
  const clubs = parseTransferPayload(parsed);
  return {
    clubs: clubs.map((club) => ({ ...club })),
    bags: [],
    accessories: [],
  };
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

export const downloadCompleteDataAsJson = (
  clubs: GolfClub[],
  bags: GolfBag[],
  accessories: AccessoryItem[],
  filename = 'golf_complete_data.json',
): void => {
  const payload: CompleteDataExportPayload = {
    format: 'complete-data-v1',
    exportedAt: new Date().toISOString(),
    clubCount: clubs.length,
    bagCount: bags.length,
    accessoryCount: accessories.length,
    clubs: clubs.map(sanitizeClubForTransfer),
    bags: bags.map(sanitizeBagForTransfer),
    accessories: accessories.map((acc) => {
      const { id, createdAt, ...rest } = acc;
      return rest;
    }),
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