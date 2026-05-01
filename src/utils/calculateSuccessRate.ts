import type { ClubPersonalData } from "../types/golf";

export interface BaseClubSuccessRateOptions {
  baseSuccessRate: number;
  personalData?: ClubPersonalData;
  isWeakClub: boolean;
  playerSkillLevel: number;
}

/**
 * Adjusts a club's base success rate using weakness tendencies, weak-club status,
 * and an overall player skill level.
 *
 * @param baseSuccessRate - Raw successRate from SimClub (0-100)
 * @param personalData - Player-reported weakness data for this club
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
  return calculateBaseClubSuccessRate({
    baseSuccessRate,
    personalData,
    isWeakClub,
    playerSkillLevel,
  });
}

export function calculateBaseClubSuccessRate({
  baseSuccessRate,
  personalData,
  isWeakClub,
  playerSkillLevel,
}: BaseClubSuccessRateOptions): number {
  const skill = Math.max(0, Math.min(1, playerSkillLevel));
  const difficulty = Math.max(0, Math.min(1, (100 - baseSuccessRate) / 100));

  // At low skill, difficult clubs are penalized more strongly to widen the
  // putter-to-driver gap.
  // 初心者・初級者のペナルティを強化（22→28）
  const lowSkillDifficultyPenalty = Math.pow(1 - skill, 1.3) * difficulty * 28;
  const lowSkillRate = Math.max(5, baseSuccessRate - lowSkillDifficultyPenalty);

  // At high skill, all clubs converge into a narrow high-success band near 100.
  // 上級者の成功率目標をさらに高く設定（99→99.5）
  const highSkillTarget = 99.5 - difficulty * 1.5;
  // スキルの影響をより強く反映（0.78→0.65）
  const normalizedSkill = Math.pow(skill, 0.65);
  let rate = lowSkillRate * (1 - normalizedSkill) + highSkillTarget * normalizedSkill;

  // Weak-club weakness is stricter at low skill and mostly relaxed at high skill.
  // 弱いクラブのペナルティを低スキルでさらに厳しく
  let weakness = personalData ? personalData.weaknessFactor : 0;
  if (isWeakClub) {
    const minWeaknessPenalty = 0.45 - skill * 0.43; // 0.45 -> 0.02
    weakness = Math.max(weakness, minWeaknessPenalty);
  }
  const weaknessMultiplier =
    1 - weakness * (isWeakClub ? 1.45 : 0.95) * (1 - skill * 0.88);

  rate = rate * weaknessMultiplier;

  // Allow near-100 outcomes for high-skill players.
  return Math.max(5, Math.min(99.5, Math.round(rate * 10) / 10));
}
