import type { ShotResult, ShotQuality } from "../types/game";

// ─── 結果評価タイプ ───────────────────────────────────────────────────────────

export type ResultRating = "excellent" | "good" | "ok" | "bad" | "terrible";

export interface ShotEvaluation {
  rating: ResultRating;
  score: number; // 0-100
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

// ─── 評価基準 ─────────────────────────────────────────────────────────────────

const OUTCOME_RATINGS: Record<string, ResultRating> = {
  green: "excellent",
  fairway: "good",
  semirough: "ok",
  rough: "ok",
  bareground: "bad",
  bunker: "bad",
  water: "terrible",
  ob: "terrible",
};

const RATING_CONFIG: Record<ResultRating, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  baseScore: number;
}> = {
  excellent: {
    label: "Excellent",
    color: "#059669", // emerald-600
    bgColor: "#d1fae5", // emerald-100
    icon: "★",
    baseScore: 95,
  },
  good: {
    label: "Good",
    color: "#16a34a", // green-600
    bgColor: "#dcfce7", // green-100
    icon: "◎",
    baseScore: 80,
  },
  ok: {
    label: "OK",
    color: "#65a30d", // lime-600
    bgColor: "#ecfccb", // lime-100
    icon: "○",
    baseScore: 60,
  },
  bad: {
    label: "Bad",
    color: "#dc2626", // red-600
    bgColor: "#fee2e2", // red-100
    icon: "△",
    baseScore: 30,
  },
  terrible: {
    label: "Terrible",
    color: "#7f1d1d", // red-900
    bgColor: "" + "#fecaca", // red-200
    icon: "✕",
    baseScore: 10,
  },
};

// ─── 評価関数 ─────────────────────────────────────────────────────────────────

/**
 * finalOutcome に基づいて結果評価を計算
 */
export function evaluateShotResult(
  finalOutcome: ShotResult["finalOutcome"],
  shotQuality: ShotQuality,
  wasSuccessful: boolean,
  newRemainingDistance: number,
  isPutter: boolean,
): ShotEvaluation {
  // アウトカムから基本評価を決定
  const baseRating = OUTCOME_RATINGS[finalOutcome] ?? "ok";
  const config = RATING_CONFIG[baseRating];

  // ショット品質によるスコア調整
  let qualityModifier = 0;
  switch (shotQuality) {
    case "excellent":
      qualityModifier = 5;
      break;
    case "good":
      qualityModifier = 0;
      break;
    case "average":
      qualityModifier = -5;
      break;
    case "misshot":
      qualityModifier = -15;
      break;
    case "poor":
      qualityModifier = -20;
      break;
  }

  // グリーンに乗った場合の距離ボーナス
  let distanceBonus = 0;
  if (finalOutcome === "green" && !isPutter) {
    // 残り距離が近いほど高得点
    if (newRemainingDistance <= 3) distanceBonus = 5;
    else if (newRemainingDistance <= 6) distanceBonus = 3;
    else if (newRemainingDistance <= 10) distanceBonus = 1;
  }

  // カップインした場合は最高評価
  if (newRemainingDistance === 0) {
    return {
      rating: "excellent",
      score: 100,
      label: "カップイン！",
      color: "#059669",
      bgColor: "#d1fae5",
      icon: "★",
    };
  }

  const finalScore = Math.max(0, Math.min(100, config.baseScore + qualityModifier + distanceBonus));

  // 成功/失敗によるラベル調整
  let label = config.label;
  if (!wasSuccessful && baseRating !== "terrible") {
    label = "ミスショット";
  }

  // パットの場合は特別なラベル
  if (isPutter && finalOutcome === "green") {
    if (newRemainingDistance === 0) {
      label = "パット成功！";
    } else {
      label = "残った...";
    }
  }

  return {
    rating: baseRating,
    score: finalScore,
    label,
    color: config.color,
    bgColor: config.bgColor,
    icon: config.icon,
  };
}

/**
 * 評価用のプログレスバーカラー取得
 */
export function getScoreColorClass(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-lime-500";
  if (score >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * 評価用のテキストカラー取得
 */
export function getScoreTextColorClass(score: number): string {
  if (score >= 90) return "text-emerald-700";
  if (score >= 70) return "text-green-700";
  if (score >= 50) return "text-lime-700";
  if (score >= 30) return "text-yellow-700";
  return "text-red-700";
}

// ─── パットシミュレーション ───────────────────────────────────────────────────

export interface PuttResult {
  putts: number;
  success: boolean;
  finalDistance: number;
  puttDetails: Array<{
    puttNumber: number;
    fromDistance: number;
    success: boolean;
    remainingAfterPutt: number;
  }>;
}

/**
 * グリーン上での自動パットシミュレーション
 * 最初のパット（プレイヤー操作）は除き、残りを自動計算
 */
export function simulateAutoPutts(
  firstPuttRemainingDistance: number,
  playerSkillLevel: number,
  maxAutoPutts: number = 5,
): PuttResult {
  const puttDetails: PuttResult["puttDetails"] = [];
  let currentDistance = firstPuttRemainingDistance;
  let totalPutts = 0; // 最初のパットは除く（プレイヤー操作済み）

  // パット成功率の計算（距離に応じて変動、フィート単位）
  const getPuttSuccessRate = (distance: number): number => {
    // 3フィート以下は98%の成功率
    if (distance <= 3) return 0.98;

    // 線形補間でスムーズなカーブに
    const interpolate = (dist: number, points: Array<{ d: number; r: number }>): number => {
      if (dist <= points[0].d) return points[0].r;
      if (dist >= points[points.length - 1].d) return points[points.length - 1].r;
      for (let i = 0; i < points.length - 1; i++) {
        if (dist >= points[i].d && dist <= points[i + 1].d) {
          const t = (dist - points[i].d) / (points[i + 1].d - points[i].d);
          return points[i].r + t * (points[i + 1].r - points[i].r);
        }
      }
      return points[points.length - 1].r;
    };

    // PGAツアーデータを基準とした成功率カーブ（フィート単位）
    const pgaPoints = [
      { d: 3, r: 0.95 },   // 1yd
      { d: 6, r: 0.75 },   // 2yd
      { d: 10, r: 0.60 },  // 3.3yd
      { d: 15, r: 0.45 },  // 5yd
      { d: 20, r: 0.35 },  // 6.7yd
      { d: 25, r: 0.25 },  // 8.3yd
      { d: 30, r: 0.18 },  // 10yd
      { d: 45, r: 0.10 },  // 15yd
      { d: 60, r: 0.05 },  // 20yd
    ];

    const pgaRate = interpolate(distance, pgaPoints);

    // playerSkillLevelによる調整
    // 0.0: PGAの10%（初心者アマチュア）
    // 0.5: PGAの47.5%（中級アマチュア）
    // 0.8: PGAの70%（上級アマチュア）
    // 1.0: PGAの85%（プロレベル）
    const skillFactor = 0.1 + playerSkillLevel * 0.75; // 0.1-0.85

    // 距離が長くなるほどPGAデータから大きく離れる
    // 短い距離ではPGAに近い、長い距離では大きく下がる
    const distanceGap = Math.min(0.5, distance * 0.01); // フィート単位に合わせて調整
    const adjustedRate = pgaRate * skillFactor - distanceGap;

    return Math.max(0.01, adjustedRate);
  };

  // パット後の残り距離を計算（フィート単位）
  const getPuttResult = (distance: number, success: boolean): number => {
    if (success) return 0;

    // 失敗した場合、残り距離を計算
    const overshootOrUndershoot = Math.random() > 0.5 ? 1 : -1;
    const missDistance = 1.5 + Math.random() * 4.5; // 1.5-6ftのミス
    const newDistance = Math.abs(distance + overshootOrUndershoot * missDistance);

    // 少なくとも少しは近づく（最低1ft残る）
    return Math.max(1, Math.min(distance * 0.8, newDistance));
  };

  // 自動パットをシミュレート
  while (currentDistance > 0 && totalPutts < maxAutoPutts) {
    const successRate = getPuttSuccessRate(currentDistance);
    const success = Math.random() < successRate;

    const remainingAfterPutt = getPuttResult(currentDistance, success);

    totalPutts++;

    puttDetails.push({
      puttNumber: totalPutts,
      fromDistance: currentDistance,
      success,
      remainingAfterPutt,
    });

    if (success) {
      currentDistance = 0;
      break;
    } else {
      currentDistance = remainingAfterPutt;
    }
  }

  return {
    putts: totalPutts,
    success: currentDistance === 0,
    finalDistance: currentDistance,
    puttDetails,
  };
}

// ─── スコア演出判定 ──────────────────────────────────────────────────────────

export type ScoreCelebrationType = "hole_in_one" | "albatross" | "eagle" | "birdie" | "par" | "bogey" | "double_bogey_or_worse";

export interface ScoreCelebration {
  type: ScoreCelebrationType;
  label: string;
  emoji: string;
  bgClass: string;
  textClass: string;
  animationClass: string;
}

export function getScoreCelebration(strokes: number, par: number): ScoreCelebration {
  const diff = strokes - par;

  if (strokes === 1) {
    return {
      type: "hole_in_one",
      label: "ホールインワン！",
      emoji: "🎯",
      bgClass: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400",
      textClass: "text-amber-900",
      animationClass: "animate-bounce",
    };
  }

  if (diff <= -3) {
    return {
      type: "albatross",
      label: "アルバトロス！",
      emoji: "🦅✨",
      bgClass: "bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400",
      textClass: "text-white",
      animationClass: "animate-pulse",
    };
  }

  if (diff === -2) {
    return {
      type: "eagle",
      label: "イーグル！",
      emoji: "🦅",
      bgClass: "bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400",
      textClass: "text-white",
      animationClass: "animate-pulse",
    };
  }

  if (diff === -1) {
    return {
      type: "birdie",
      label: "バーディー！",
      emoji: "🐦",
      bgClass: "bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400",
      textClass: "text-white",
      animationClass: "animate-pulse",
    };
  }

  if (diff === 0) {
    return {
      type: "par",
      label: "パー",
      emoji: "⭕",
      bgClass: "bg-emerald-100",
      textClass: "text-emerald-800",
      animationClass: "",
    };
  }

  if (diff === 1) {
    return {
      type: "bogey",
      label: "ボギー",
      emoji: "📍",
      bgClass: "bg-yellow-100",
      textClass: "text-yellow-800",
      animationClass: "",
    };
  }

  return {
    type: "double_bogey_or_worse",
    label: diff >= 2 ? `+${diff}` : "",
    emoji: "💦",
    bgClass: "bg-red-100",
    textClass: "text-red-800",
    animationClass: "",
  };
}
