import type { GolfClub, ClubPersonalData } from '../types/golf';

/**
 * Adjusts missRate and weaknessFactor based on session results.
 * Moves values slightly toward observed outcomes.
 */
export function rangeAutoCalibrate(
  _club: GolfClub,
  personal: ClubPersonalData,
  results: Array<{ outcome: string; distance: number }>
): ClubPersonalData {
  const n = results.length;
  if (!n) return personal;
  const missCount = results.filter(r => r.outcome === 'Miss').length;
  const penaltyCount = results.filter(r => r.outcome === 'Penalty').length;
  const baseMiss = personal.missRate || 0.1;
  const observedMiss = (missCount + penaltyCount) / n;
  // Move missRate 20% toward observed
  const newMiss = baseMiss + 0.2 * (observedMiss - baseMiss);
  // Weakness factor: if many penalties, increase
  let newWeak = personal.weaknessFactor || 1;
  if (penaltyCount / n > 0.1) newWeak += 0.05;
  if (penaltyCount / n < 0.05) newWeak -= 0.05;
  newWeak = Math.max(0.7, Math.min(1.5, newWeak));
  return {
    ...personal,
    missRate: Math.max(0, Math.min(0.5, newMiss)),
    weaknessFactor: Number(newWeak.toFixed(2)),
  };
}
