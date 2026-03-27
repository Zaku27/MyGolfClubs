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
