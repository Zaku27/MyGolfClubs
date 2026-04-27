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
    const isSuccessfulShot = isPutter ? shot.distanceAfterShot === 0 : shot.success;

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
        (shot.lieAfter === "green" || shot.distanceAfterShot <= 20 || shot.distanceAfterShot === 0),
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

export function estimatePredictedScore(
  totalPar: number,
  holesPlayed: number,
  clubUsageStats: ClubUsageStat[],
): PredictedScore {
  if (holesPlayed === 0) {
    return { predicted: totalPar, variance: 5 };
  }

  const totalUses = clubUsageStats.reduce((sum, stat) => sum + stat.timesUsed, 0);
  const weightedSuccessRate = totalUses > 0
    ? clubUsageStats.reduce((sum, stat) => sum + stat.successRate * stat.timesUsed, 0) / totalUses
    : 60;

  const holesFactor = holesPlayed / 9;
  const consistencyPenalty = Math.max(0, (65 - weightedSuccessRate) / 6) * holesFactor;
  const predicted = Math.round(totalPar + consistencyPenalty);
  const variance = Math.max(4, Math.min(7, Math.round(5 + (62 - weightedSuccessRate) / 20)));

  return { predicted, variance };
}

export function getPerformanceSummary(finalScore: number, predictedScore: number): PerformanceSummary {
  if (finalScore <= predictedScore - 2) {
    return { label: "素晴らしいラウンド", toneClass: "text-emerald-300" };
  }

  if (finalScore <= predictedScore + 2) {
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
