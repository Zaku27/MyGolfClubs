import type { ClubPersonalData } from "../types/golf";

/**
 * Adjusts a club's base success rate using personal tendencies, weak-club status,
 * and an overall player skill level.
 *
 * @param baseSuccessRate - Raw successRate from SimClub (0-100)
 * @param personalData - Player-reported miss/weakness data for this club
 * @param isWeakClub - Whether the club is flagged as weak
 * @param playerSkillLevel - 0.0 (beginner) to 1.0 (advanced)
 * @returns Clamped adjusted rate in [5, 95]
 */
export function calculateEffectiveSuccessRate(
  baseSuccessRate: number,
  personalData: ClubPersonalData | undefined,
  isWeakClub: boolean,
  playerSkillLevel: number,
): number {
  // Slight global uplift so overall outcomes feel less punishing.
  const baseRateAdjustment = 1.3;
  let rate = baseSuccessRate * baseRateAdjustment;

  // 1) Skill boost logic (updated):
  // Low/mid success clubs get a stronger boost from high skill.
  // High success clubs (85%+) still get almost no boost.
  const lowSuccessBoost = Math.max(0, (72 - baseSuccessRate) / 52);
  const highSuccessMicroBoost =
    baseSuccessRate >= 85 ? Math.max(0, (90 - baseSuccessRate) / 25) : 0;
  const skillBoostFactor = 0.68;
  const skillMultiplier =
    1.0 +
    lowSuccessBoost * playerSkillLevel * skillBoostFactor +
    highSuccessMicroBoost * playerSkillLevel * 0.08;
  // Examples (skill = 0.9):
  // - base 40% -> lowSuccessBoost=0.615 -> skillMultiplier=1.377 -> about +37.7%
  // - base 65% -> lowSuccessBoost=0.135 -> skillMultiplier=1.083 -> about +8.3%
  // - base 85% -> microBoost=0.200 -> skillMultiplier=1.014 -> about +1.4%

  // 2) Personal miss-rate penalty.
  const missMultiplier = personalData ? 1 - personalData.missRate / 100 : 1.0;

  // 3) Weakness penalty:
  // Weak clubs have a minimum penalty, but high skill relaxes that minimum.
  let weakness = personalData ? personalData.weaknessFactor : 0;
  if (isWeakClub) {
    const minWeaknessPenalty = 0.28 - playerSkillLevel * 0.16; // 0.28 -> 0.12
    weakness = Math.max(weakness, minWeaknessPenalty);
  }
  const weaknessMultiplier =
    1 - weakness * (isWeakClub ? 1.65 : 1.0) * (1 - playerSkillLevel * 0.65);

  rate = rate * skillMultiplier * missMultiplier * weaknessMultiplier;

  // 4) Clamp final success rate to simulator bounds.
  return Math.max(5, Math.min(95, Math.round(rate)));
}
