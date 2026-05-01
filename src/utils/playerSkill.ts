export type SkillPreset = {
  label: string;
  value: number;
  score: string;
};

export const SKILL_PRESETS: readonly SkillPreset[] = [
  { label: "初心者", value: 0.1, score: "120以上" },
  { label: "初級者", value: 0.2, score: "110～119" },
  { label: "中級者", value: 0.5, score: "90～109" },
  { label: "上級者", value: 0.8, score: "80～89" },
  { label: "超上級者", value: 1.0, score: "79以下" },
] as const;

export function getSkillLabel(level: number): string {
  if (level < 0.15) return "初心者";
  if (level < 0.35) return "初級者";
  if (level < 0.65) return "中級者";
  if (level < 0.9) return "上級者";
  return "超上級者";
}

export function formatSkillLevelLabel(level: number): string {
  return `${(level * 100).toFixed(0)}% (${getSkillLabel(level)})`;
}

/**
 * 実績データからプレーヤースキルレベルを推定する
 * @param shotRecords ショット実績データの配列
 * @returns 推定スキルレベル (0.0〜1.0)
 */
export function estimateSkillLevelFromActualShots(
  shotRecords: Array<Record<string, string>>
): number {
  if (shotRecords.length === 0) {
    return 0.5; // デフォルト値
  }

  // 数値パーサー
  const parseNum = (val: string | undefined): number | null => {
    if (!val) return null;
    const n = parseFloat(val);
    return isFinite(n) ? n : null;
  };

  // 各ショットの指標を収集
  const metrics: {
    carry: number;
    lateral: number;
    smash: number;
    launchV: number;
  }[] = [];

  for (const row of shotRecords) {
    const carry = parseNum(row["Carry (yds)"]);
    const lateral = parseNum(row["Lateral (yds)"]);
    const smash = parseNum(row["Smash"]);
    const launchV = parseNum(row["Launch V (°)"]);

    if (carry != null && lateral != null) {
      metrics.push({
        carry,
        lateral: Math.abs(lateral),
        smash: smash ?? 1.4,
        launchV: launchV ?? 12,
      });
    }
  }

  if (metrics.length < 3) {
    return 0.5; // データが少なすぎる場合はデフォルト
  }

  // 1. キャリーの変動係数（CV）で一貫性を評価
  const carries = metrics.map((m) => m.carry);
  const avgCarry = carries.reduce((a, b) => a + b, 0) / carries.length;
  const variance = carries.reduce((sum, val) => sum + Math.pow(val - avgCarry, 2), 0) / carries.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgCarry > 0 ? stdDev / avgCarry : 0;

  // CVが小さいほど高スキル（0.03以下=高スキル、0.12以上=低スキル）
  const consistencyScore = Math.max(0, Math.min(1, 1 - (cv - 0.03) / 0.09));

  // 2. ラテラル分散（方向性の一貫性）
  const laterals = metrics.map((m) => m.lateral);
  const avgLateral = laterals.reduce((a, b) => a + b, 0) / laterals.length;
  // 平均ラテラルが小さいほど高スキル（10yds以下=高スキル、35yds以上=低スキル）
  const accuracyScore = Math.max(0, Math.min(1, 1 - (avgLateral - 10) / 25));

  // 3. Smash Factor（インパクトの質）
  const smashes = metrics.map((m) => m.smash);
  const avgSmash = smashes.reduce((a, b) => a + b, 0) / smashes.length;
  // 1.48以上=高スキル、1.38以下=低スキル
  const smashScore = Math.max(0, Math.min(1, (avgSmash - 1.38) / 0.1));

  // 4. ローンチ角度の適正範囲内率（高スキルは適正角度で打てる）
  const goodLaunchCount = metrics.filter(
    (m) => m.launchV >= 8 && m.launchV <= 20
  ).length;
  const launchScore = goodLaunchCount / metrics.length;

  // 重み付け合成
  // 一貫性35%、精度35%、スマッシュ20%、ローンチ10%
  const rawScore =
    consistencyScore * 0.35 +
    accuracyScore * 0.35 +
    smashScore * 0.2 +
    launchScore * 0.1;

  // スコアをスキルレベル範囲にマッピング（0.3〜0.95）
  const skillLevel = 0.3 + rawScore * 0.65;

  // 小数第2位で丸め
  return Math.round(skillLevel * 100) / 100;
}
