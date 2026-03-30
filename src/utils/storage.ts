type StoredNumberOptions = {
  min?: number;
  max?: number;
  decimals?: number;
};

export const readStoredNumber = (
  key: string,
  fallback: number,
  options: StoredNumberOptions = {},
): number => {
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number(raw) : fallback;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options.min != null && parsed < options.min) {
    return fallback;
  }

  if (options.max != null && parsed > options.max) {
    return fallback;
  }

  if (options.decimals == null) {
    return parsed;
  }

  const factor = 10 ** options.decimals;
  return Math.round(parsed * factor) / factor;
};

export const readStoredJson = <T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T,
): T => {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
};

export const writeStoredValue = (key: string, value: string | number): void => {
  window.localStorage.setItem(key, String(value));
};

export const writeStoredJson = (key: string, value: unknown): void => {
  window.localStorage.setItem(key, JSON.stringify(value));
};