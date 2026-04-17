import type { GolfClub, ClubPersonalData } from '../types/golf';

/**
 * Adjusts weaknessFactor based on セッション結果.
 */
export function rangeAutoCalibrate(
  _club: GolfClub,
  personal: ClubPersonalData,
  results: Array<{ outcome: string; distance: number }>
): ClubPersonalData {
  const n = results.length;
  if (!n) return personal;
  const penaltyCount = results.filter(r => r.outcome === 'Penalty').length;
  // Weakness factor: if many penalties, increase
  let newWeak = personal.weaknessFactor || 1;
  if (penaltyCount / n > 0.1) newWeak += 0.05;
  if (penaltyCount / n < 0.05) newWeak -= 0.05;
  newWeak = Math.max(0.7, Math.min(1.5, newWeak));
  return {
    ...personal,
    weaknessFactor: Number(newWeak.toFixed(2)),
  };
}

// RangeScreen utility functions
export const LIE_OPTIONS = [
  'Tee',
  'Fairway',
  'Semi Rough',
  'Rough',
  'Bare Ground',
  'Bunker',
];

export const SHOT_COUNTS = [5, 10, 20, 40];

export function qualityLabel(q: string): string {
  switch (q) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "average": return "Average";
    case "misshot": return "Misshot";
    case "poor": return "Poor";
    default: return q;
  }
}

export function getLiePenaltyInfo(lie: string, clubType: string): string {
  switch (lie) {
    case 'Tee':
      return 'Standard lie with minimal distance impact.';
    case 'Fairway':
      return 'Nearly normal lie with minimal distance loss.';
    case 'Semi Rough':
      return 'Distance reduced by ~10% with slightly decreased directional stability.';
    case 'Rough':
      return 'Distance reduced by ~18% with increased shot instability.';
    case 'Bare Ground':
      return 'Distance reduced by ~40% with very difficult lie conditions.';
    case 'Bunker':
      return clubType === 'Wedge'
        ? 'Wedge: ~30% distance reduction. Other clubs: ~50% reduction. Sand affects direction.'
        : '~50% distance reduction. Sand causes directional instability.';
    case 'Green':
      return 'Putting lie. Distance correction depends on putting stroke.';
    default:
      return 'No penalty information available for selected lie.';
  }
}

export function clampAimXOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-50, Math.min(50, Math.round(value)));
}

export type GroundHardness = "soft" | "medium" | "firm";

export function formatGroundHardnessLabel(groundHardness: GroundHardness): string {
  return groundHardness === 'soft' ? '柔らかい' : groundHardness === 'firm' ? '硬い' : '普通';
}

export type RangeConditionSettings = {
  lie: string;
  windDirection: number;
  windSpeed: number;
  groundHardness: GroundHardness;
  slopeAngle: number;
  slopeDirection: number;
};

const RANGE_CONDITION_SETTINGS_KEY = 'rangeConditionSettings';

export function loadRangeConditionSettings(): RangeConditionSettings {
  if (typeof window === 'undefined') {
    return {
      lie: 'Tee',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }

  const stored = localStorage.getItem(RANGE_CONDITION_SETTINGS_KEY);
  if (!stored) {
    return {
      lie: 'Tee',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      lie: parsed.lie ?? 'Tee',
      windDirection: parsed.windDirection ?? 180,
      windSpeed: parsed.windSpeed ?? 0,
      groundHardness: parsed.groundHardness ?? 'medium',
      slopeAngle: parsed.slopeAngle ?? 0,
      slopeDirection: parsed.slopeDirection ?? 0,
    };
  } catch {
    return {
      lie: 'Tee',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }
}

export function saveRangeConditionSettings(settings: RangeConditionSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RANGE_CONDITION_SETTINGS_KEY, JSON.stringify(settings));
}

export type AnalysisPenalty = {
  points: number;
  reasons: string[];
};
