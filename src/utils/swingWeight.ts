import {
  SWING_WEIGHT_BASE_LETTER_CODE,
  SWING_WEIGHT_FULL_PATTERN,
  SWING_WEIGHT_LEGACY_PATTERN,
} from './analysisConstants';

export const normalizeSwingWeightText = (value: string): string => {
  return (value ?? '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９．]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .toUpperCase()
    .replace(/\s+/g, '');
};

const parseNormalizedSwingWeight = (normalized: string) => {
  const fullMatch = normalized.match(SWING_WEIGHT_FULL_PATTERN);
  const legacyMatch = normalized.match(SWING_WEIGHT_LEGACY_PATTERN);
  if (!fullMatch && !legacyMatch) return null;

  const letter = fullMatch ? fullMatch[1] : 'D';
  const point = Number(fullMatch ? fullMatch[2] : legacyMatch?.[1]);
  if (!Number.isFinite(point) || point < 0 || point > 9.9) return null;

  return { letter, point };
};

export const swingWeightToNumeric = (swingWeightRaw: string): number => {
  const normalized = normalizeSwingWeightText(swingWeightRaw);
  const parsed = parseNormalizedSwingWeight(normalized);
  if (!parsed) return 0;

  const letterIndex = parsed.letter.charCodeAt(0) - SWING_WEIGHT_BASE_LETTER_CODE;

  return letterIndex * 10 + parsed.point;
};

export const numericToSwingWeightLabel = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const letterIndex = Math.floor(rounded / 10);
  const point = rounded - letterIndex * 10;
  const letterCode = SWING_WEIGHT_BASE_LETTER_CODE + letterIndex;

  if (letterCode < 'A'.charCodeAt(0) || letterCode > 'Z'.charCodeAt(0)) {
    return rounded.toFixed(1);
  }

  const pointLabel = Number.isInteger(point) ? point.toFixed(0) : point.toFixed(1);
  return `${String.fromCharCode(letterCode)}${pointLabel}`;
};

export const parseSwingWeightInput = (value: string): number | null => {
  const normalized = normalizeSwingWeightText(value);
  if (!normalized) return null;

  if (!parseNormalizedSwingWeight(normalized)) return null;

  return swingWeightToNumeric(normalized);
};
