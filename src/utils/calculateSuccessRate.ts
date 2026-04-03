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
  const skill = Math.max(0, Math.min(1, playerSkillLevel));
  const difficulty = Math.max(0, Math.min(1, (100 - baseSuccessRate) / 100));

  // At low skill, difficult clubs are penalized more strongly to widen the
  // putter-to-driver gap.
  const lowSkillDifficultyPenalty = Math.pow(1 - skill, 1.15) * difficulty * 22;
  const lowSkillRate = Math.max(5, baseSuccessRate - lowSkillDifficultyPenalty);

  // At high skill, all clubs converge into a narrow high-success band near 100.
  const highSkillTarget = 99 - difficulty * 2.2;
  const normalizedSkill = Math.pow(skill, 0.78);
  let rate = lowSkillRate * (1 - normalizedSkill) + highSkillTarget * normalizedSkill;

  // Miss-rate penalty is still applied, but high skill significantly dampens it.
  const missPenaltyWeight = 1 - skill * 0.93;
  const missMultiplier = personalData
    ? 1 - (personalData.missRate / 100) * missPenaltyWeight
    : 1.0;

  // Weak-club weakness is stricter at low skill and mostly relaxed at high skill.
  let weakness = personalData ? personalData.weaknessFactor : 0;
  if (isWeakClub) {
    const minWeaknessPenalty = 0.35 - skill * 0.34; // 0.35 -> 0.01
    weakness = Math.max(weakness, minWeaknessPenalty);
  }
  const weaknessMultiplier =
    1 - weakness * (isWeakClub ? 1.28 : 0.82) * (1 - skill * 0.92);

  rate = rate * missMultiplier * weaknessMultiplier;

  // Allow near-100 outcomes for high-skill players.
  return Math.max(5, Math.min(99, Math.round(rate)));
}
