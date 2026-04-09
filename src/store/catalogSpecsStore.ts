import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  buildCatalogSpecKey,
  catalogSpecSchema,
  catalogSpecUpdateSchema,
  type CatalogSpec,
} from '../types/catalog';

type CatalogSpecsState = {
  specs: CatalogSpec[];
  loading: boolean;
  error: string | null;
};

type CatalogSpecsActions = {
  addMany: (items: CatalogSpec[]) => { added: number; skipped: number };
  updateOne: (id: string, patch: Partial<CatalogSpec>) => boolean;
  clearError: () => void;
};

type CatalogSpecsStore = CatalogSpecsState & CatalogSpecsActions;

const STORAGE_KEY = 'mygolfbag-catalog-specs-v1';

const defaultTaylorMadeSeed: CatalogSpec[] = [
  {
    id: crypto.randomUUID(),
    brand: 'TaylorMade',
    model: 'Qi4D Driver',
    variant: 'Standard',
    type: 'driver',
    year: 2026,
    loft: 10.5,
    length: 45.5,
    lie: 58,
    swingWeight: 'D3',
    volume: 460,
    hand: 'RH/LH',
    source: 'TaylorMade 2026 Product Specs',
    importedAt: new Date().toISOString(),
  },
];

const parseCatalogSpec = (item: unknown): CatalogSpec | null => {
  const parsed = catalogSpecSchema.safeParse(item);
  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    variant: parsed.data.variant || undefined,
    swingWeight: parsed.data.swingWeight || undefined,
    source: parsed.data.source || undefined,
  };
};

export const useCatalogSpecsStore = create<CatalogSpecsStore>()(
  persist(
    (set, get) => ({
      specs: defaultTaylorMadeSeed,
      loading: false,
      error: null,

      addMany: (items) => {
        const existing = get().specs;
        const seen = new Set(existing.map(buildCatalogSpecKey));
        const toAdd: CatalogSpec[] = [];
        let skipped = 0;

        for (const item of items) {
          const normalized = parseCatalogSpec(item);
          if (!normalized) {
            skipped += 1;
            continue;
          }

          const key = buildCatalogSpecKey(normalized);
          if (seen.has(key)) {
            skipped += 1;
            continue;
          }

          seen.add(key);
          toAdd.push(normalized);
        }

        if (toAdd.length > 0) {
          set((state) => ({
            specs: [...toAdd, ...state.specs],
            error: null,
          }));
        }

        return { added: toAdd.length, skipped };
      },

      updateOne: (id, patch) => {
        const validatedPatch = catalogSpecUpdateSchema.safeParse(patch);
        if (!validatedPatch.success) {
          set({ error: validatedPatch.error.issues[0]?.message ?? 'Invalid update payload' });
          return false;
        }

        const specs = get().specs;
        const target = specs.find((item) => item.id === id);
        if (!target) {
          set({ error: 'Catalog spec not found' });
          return false;
        }

        const merged = {
          ...target,
          ...validatedPatch.data,
          variant: validatedPatch.data.variant || undefined,
          swingWeight: validatedPatch.data.swingWeight || undefined,
          source: validatedPatch.data.source || undefined,
        } satisfies CatalogSpec;

        const result = catalogSpecSchema.safeParse(merged);
        if (!result.success) {
          set({ error: result.error.issues[0]?.message ?? 'Invalid catalog spec' });
          return false;
        }

        set((state) => ({
          specs: state.specs.map((item) => (item.id === id ? result.data : item)),
          error: null,
        }));
        return true;
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
