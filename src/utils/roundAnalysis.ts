import type { ClubUsageStat, Hole, HoleScore, ShotLog, SimClub } from "../types/game";
import { formatSimClubDisplayName } from "./simClubLabel";

export interface KeyRoundStats {
  totalStrokes: number;
  girPercent: number;
  fairwayHitPercent: number;
  puttsPerHole: number;
}

export interface PredictedScore {
  predicted: number;
  variance: number;
}

export interface PerformanceSummary {
  label: "素晴らしいラウンド" | "平均的" | "苦戦した";
  toneClass: string;
}

export function buildClubUsageStats(roundShots: ShotLog[], bag: SimClub[]): ClubUsageStat[] {
  const bagById = new Map(bag.map((club) => [club.id, club]));
  const statsMap = new Map<string, { clubName: string; uses: number; successes: number; distanceSum: number }>();

  for (const shot of roundShots) {
    const club = bagById.get(shot.clubId);
    const base = statsMap.get(shot.clubId) ?? {
      clubName: club ? formatSimClubDisplayName(club) : shot.clubLabel,
      uses: 0,
      successes: 0,
      distanceSum: 0,
    };

    const isPutter = club?.type === "Putter";
    // パターは残り距離が3フィート（約1ヤード）以内なら成功とみなす
    const isSuccessfulShot = isPutter 
      ? shot.distanceAfterShot <= 1 
      : shot.success;

    base.uses += 1;
    if (isSuccessfulShot) base.successes += 1;
    base.distanceSum += shot.distanceHit;
    statsMap.set(shot.clubId, base);
  }

  return [...statsMap.entries()]
    .map(([clubId, value]) => {
      const successRate = value.uses > 0 ? Math.round((value.successes / value.uses) * 100) : 0;
      const avgDistanceAchieved = value.uses > 0 ? Math.round(value.distanceSum / value.uses) : 0;
      return {
        clubId,
        clubName: value.clubName,
        timesUsed: value.uses,
        successes: value.successes,
        successRate,
        avgDistanceAchieved,
      };
    })
    .sort((a, b) => b.timesUsed - a.timesUsed);
}

export function calculateKeyRoundStats(
  perHoleResults: HoleScore[],
  course: Hole[],
  roundShots: ShotLog[],
): KeyRoundStats {
  const totalStrokes = perHoleResults.reduce((sum, score) => sum + score.strokes, 0);
  const holesPlayed = perHoleResults.length || 1;

  const putts = roundShots.filter((shot) => shot.lieBefore === "green").length;
  const puttsPerHole = Number((putts / holesPlayed).toFixed(2));

  const parByHole = new Map(course.map((hole) => [hole.number, hole.par]));
  const shotsByHole = new Map<number, ShotLog[]>();
  for (const shot of roundShots) {
    const holeShots = shotsByHole.get(shot.holeNumber) ?? [];
    holeShots.push(shot);
    shotsByHole.set(shot.holeNumber, holeShots);
  }

  let girCount = 0;
  for (const score of perHoleResults) {
    const par = parByHole.get(score.holeNumber) ?? score.par;
    const girStrokes = Math.max(1, par - 2);
    const shots = shotsByHole.get(score.holeNumber) ?? [];
    const reachedGreenInRegulation = shots.some(
      (shot) =>
        shot.strokeNumber <= girStrokes &&
        (shot.lieAfter === "green" || shot.distanceAfterShot === 0),
    );

    if (reachedGreenInRegulation) girCount += 1;
  }

  const girPercent = Math.round((girCount / holesPlayed) * 100);

  const fairwayTargets = course.filter((hole) => hole.par >= 4);
  const fairwayTargetCount = fairwayTargets.length;
  const fairwayHitCount = fairwayTargets.filter((hole) => {
    const firstShot = (shotsByHole.get(hole.number) ?? []).find((shot) => shot.strokeNumber === 1);
    return firstShot?.lieAfter === "fairway";
  }).length;
  const fairwayHitPercent = fairwayTargetCount > 0
    ? Math.round((fairwayHitCount / fairwayTargetCount) * 100)
    : 0;

  return {
    totalStrokes,
    girPercent,
    fairwayHitPercent,
    puttsPerHole,
  };
}

// スキルレベルに対応する基準スコア（パー72基準）を線形補間で計算
function getSkillBasedExpectedScore(skillLevel: number): number {
  // より現実的なスコア基準に調整
  // 0.1→110 (+38), 0.3→95 (+23), 0.5→90 (+18), 0.8→80 (+8), 1.0→72 (E)
  const skillPoints = [0.1, 0.3, 0.5, 0.8, 1.0];
  const expectedScores = [110, 95, 90, 80, 72];

  // 範囲外の場合は端の値を返す
  if (skillLevel <= skillPoints[0]) return expectedScores[0];
  if (skillLevel >= skillPoints[skillPoints.length - 1]) return expectedScores[expectedScores.length - 1];

  // 線形補間
  for (let i = 0; i < skillPoints.length - 1; i++) {
    if (skillLevel <= skillPoints[i + 1]) {
      const t = (skillLevel - skillPoints[i]) / (skillPoints[i + 1] - skillPoints[i]);
      return expectedScores[i] + t * (expectedScores[i + 1] - expectedScores[i]);
    }
  }
  return expectedScores[expectedScores.length - 1];
}

export interface CourseAverageScore {
  avgScore: number;
  avgToPar: number;
  totalPar: number;
  rounds: number;
}

export function estimatePredictedScore(
  totalPar: number,
  holesPlayed: number,
  clubUsageStats: ClubUsageStat[],
  playerSkillLevel?: number,
  isMeasuredMode?: boolean,
  courseAverage?: CourseAverageScore | null,
): PredictedScore {
  if (holesPlayed === 0) {
    return { predicted: totalPar, variance: 5 };
  }

  const skillLevel = playerSkillLevel ?? 0.5;
  const totalUses = clubUsageStats.reduce((sum, stat) => sum + stat.timesUsed, 0);
  const weightedSuccessRate = totalUses > 0
    ? clubUsageStats.reduce((sum, stat) => sum + stat.successRate * stat.timesUsed, 0) / totalUses
    : 60;

  // スキルレベルの基準スコア（パー72基準=18ホール）を取得
  const skillBasedExpectedScore = getSkillBasedExpectedScore(skillLevel);
  // 18ホール基準のtoParを、プレイしたホール数に比例して換算
  const expectedToPar72 = skillBasedExpectedScore - 72; // par72に対する差分
  const expectedToPar = expectedToPar72 * (holesPlayed / 18); // プレイしたホール数に比例
  const skillBasedPredicted = totalPar + expectedToPar;

  // コース別平均スコアがある場合は、それも考慮に入れる
  // 同じパーを基準にして、過去の実績とスキルベースの予測をブレンド
  let courseAdjustedPredicted: number;
  if (courseAverage && courseAverage.rounds >= 3) {
    // パーの差分を考慮してコース平均を現在のパーに換算
    const courseParDiff = totalPar - courseAverage.totalPar;
    const courseAvgAdjusted = courseAverage.avgScore + courseParDiff;

    // スキルベース予測とコース平均をブレンド（コース実績40%、スキル60%）
    courseAdjustedPredicted = skillBasedPredicted * 0.6 + courseAvgAdjusted * 0.4;
  } else {
    courseAdjustedPredicted = skillBasedPredicted;
  }

  // 実測データモードでは、実測データの特性（ショットの分散が大きい）を考慮し、
  // スキルベースの基準値を中心に、成功率の影響を小さくする
  let performanceBonus: number;
  if (isMeasuredMode) {
    // 実測データモード: 成功率の影響を半分にし、スキルベースを重視
    performanceBonus = (weightedSuccessRate - 65) / 20; // 調整係数を/10から/20に
  } else {
    // 通常モード: 標準的な調整
    performanceBonus = (weightedSuccessRate - 65) / 10;
  }
  const consistencyAdjusted = courseAdjustedPredicted - performanceBonus;

  // 最終予測スコア（スキルベースと実績ベースのバランス）
  const predicted = Math.round(consistencyAdjusted);
  const variance = Math.max(4, Math.min(7, Math.round(5 + (62 - weightedSuccessRate) / 20)));

  console.log('estimatePredictedScore:', {
    skillLevel,
    skillBasedExpectedScore,
    expectedToPar,
    skillBasedPredicted,
    courseAdjustedPredicted,
    weightedSuccessRate,
    performanceBonus,
    consistencyAdjusted,
    predicted,
    totalPar,
    holesPlayed,
  });

  return { predicted, variance };
}

export function getPerformanceSummary(
  finalScore: number,
  finalPar: number,
  predictedScore: number,
  predictedPar: number,
  playerSkillLevel?: number,
): PerformanceSummary {
  const skillLevel = playerSkillLevel ?? 0.5;
  // スキルレベルに応じて閾値を調整
  // 初心者(0.1): ±3, 中級者(0.5): ±2, 上級者(0.9): ±1
  // 予測よりかなり良いスコアの場合のみ「素晴らしい」と判定（閾値を厳しく設定）
  // 0.1→5, 0.5→4, 0.9→3
  const amazingThreshold = Math.round(5 - skillLevel * 2);
  // 通常の閾値（平均的判定用）
  const normalThreshold = Math.round(2 - skillLevel); // 0.1→2, 0.5→1, 0.9→0

  // Parを考慮してtoParで比較（9ホールと18ホールを正しく比較するため）
  const finalToPar = finalScore - finalPar;
  const predictedToPar = predictedScore - predictedPar;

  if (finalToPar <= predictedToPar - amazingThreshold) {
    return { label: "素晴らしいラウンド", toneClass: "text-emerald-300" };
  }

  if (finalToPar <= predictedToPar + normalThreshold) {
    return { label: "平均的", toneClass: "text-amber-300" };
  }

  return { label: "苦戦した", toneClass: "text-rose-300" };
}

export function buildInsights(
  keyStats: KeyRoundStats,
  clubUsageStats: ClubUsageStat[],
  perHoleResults: HoleScore[],
): string[] {
  const insights: string[] = [];
  const strugglingClub = [...clubUsageStats]
    .filter((club) => club.timesUsed >= 2)
    .sort((a, b) => a.successRate - b.successRate)[0];

  if (strugglingClub) {
    insights.push(`今日の${strugglingClub.clubName}は安定していませんでした（成功率${strugglingClub.successRate}%）`);
  }

  const par5Scores = perHoleResults.filter((hole) => hole.par === 5);
  if (par5Scores.length > 0) {
    const par5AvgDiff = par5Scores.reduce((sum, hole) => sum + (hole.strokes - hole.par), 0) / par5Scores.length;
    if (par5AvgDiff <= 0.5) {
      insights.push("パー5での判断力が良かった");
    }
  }

  if (keyStats.girPercent < 40) {
    insights.push("100-120ヤードのアプローチ練習を検討してください");
  } else if (keyStats.puttsPerHole > 2.0) {
    insights.push("ショートゲームの安定性が次のラウンドでスコアを下げられます");
  }

  if (insights.length < 3) {
    insights.push("信頼できるクラブで自信を積み上げ続けてください");
  }

  return insights.slice(0, 4);
}
