import type { SimClub } from "../types/game";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns a simulator label aligned with list/card display style.
 * Examples: Driver, 3Wood, 4Hybrid, 7Iron, PW, Putter
 */
export function formatSimClubLabel(club: Pick<SimClub, "number" | "type">): string {
  const number = club.number?.trim() ?? "";
  const type = club.type?.trim() ?? "";

  if (!type) return number;

  if (type === "Driver") {
    if (/^mini(?:\s*driver)?$/i.test(number)) {
      return "miniDriver";
    }
    return "Driver";
  }

  if (type === "Wood") {
    const base = number
      .replace(/\s*wood\s*$/i, "")
      .replace(/\s*w\s*$/i, "")
      .trim();
    const token = base || number;
    return token ? `${token}Wood` : "Wood";
  }

  if (type === "Hybrid") {
    const base = number
      .replace(/\s*hybrid\s*$/i, "")
      .replace(/\s*h\s*$/i, "")
      .trim();
    const token = base || number;
    return token ? `${token}Hybrid` : "Hybrid";
  }

  if (type === "Iron") {
    return number ? `${number}Iron` : "Iron";
  }

  if (type === "Wedge") {
    return number || "Wedge";
  }

  if (type === "Putter") {
    return "Putter";
  }

  if (!number) return type;
  if (normalizeToken(number) === normalizeToken(type)) return number;
  return `${number}${type}`;
}
