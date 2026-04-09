import { z } from 'zod';

export const CATALOG_CLUB_TYPES = [
  'driver',
  'wood',
  'fairway',
  'hybrid',
  'iron',
  'wedge',
  'putter',
] as const;

export const CATALOG_BRANDS = [
  'TaylorMade',
  'Titleist',
  'Callaway',
  'Ping',
  'Mizuno',
] as const;

export type CatalogClubType = (typeof CATALOG_CLUB_TYPES)[number];
export type CatalogBrand = (typeof CATALOG_BRANDS)[number] | (string & {});

export interface CatalogSpec {
  id: string;
  brand: CatalogBrand;
  model: string;
  variant?: string;
  type: CatalogClubType;
  year: number;
  loft: number | null;
  length: number | null;
  lie?: number | string;
  swingWeight?: string;
  volume?: number;
  hand?: 'RH' | 'LH' | 'RH/LH';
  source?: string;
  importedAt: string;
}

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value == null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === 'null' || normalized === '-') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const catalogSpecSchema = z.object({
  id: z.string().min(1),
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
  variant: z.string().trim().optional().or(z.literal('')),
  type: z.enum(CATALOG_CLUB_TYPES),
  year: z.coerce.number().int().min(1980).max(2100),
  loft: z.preprocess(parseNullableNumber, z.number().nullable()),
  length: z.preprocess(parseNullableNumber, z.number().nullable()),
  lie: z.union([z.number(), z.string().trim().min(1)]).optional(),
  swingWeight: z.string().trim().optional(),
  volume: z.preprocess(parseOptionalNumber, z.number().positive().optional()),
  hand: z.enum(['RH', 'LH', 'RH/LH']).optional(),
  source: z.string().trim().optional(),
  importedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'importedAt must be a valid ISO date string',
  }),
});

export type CatalogSpecInput = z.infer<typeof catalogSpecSchema>;

export const catalogSpecUpdateSchema = catalogSpecSchema
  .pick({
    variant: true,
    loft: true,
    length: true,
    lie: true,
    swingWeight: true,
    volume: true,
    hand: true,
    source: true,
  })
  .partial();

const normalizeForKey = (value: string | undefined): string => {
  return (value ?? '').trim().toLowerCase();
};

export const normalizeLoftForKey = (loft: number | null): string => {
  if (loft == null || Number.isNaN(loft)) {
    return '';
  }
  return loft.toFixed(2);
};

export const buildCatalogSpecKey = (spec: Pick<CatalogSpec, 'brand' | 'model' | 'variant' | 'year' | 'loft'>): string => {
  return [
    normalizeForKey(spec.brand),
    normalizeForKey(spec.model),
    normalizeForKey(spec.variant),
    String(spec.year),
    normalizeLoftForKey(spec.loft),
  ].join('|');
};
