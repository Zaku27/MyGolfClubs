import type { GolfClub, ClubPersonalData } from '../types/golf';

/**
 * Adjusts weaknessFactor based on session results.
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
