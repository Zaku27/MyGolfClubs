import seedrandom from "seedrandom";
import { getEstimatedDistance } from "./analysisUtils";
import type { GolfClub } from "../types/golf";
import type { ShotQuality } from "../types/game";

export type ClubData = Pick<
  GolfClub,
  "clubType" | "name" | "number" | "length" | "weight" | "swingWeight" | "lieAngle" | "loftAngle" | "shaftType" | "torque" | "flex" | "distance" | "notes"
>;

export type SkillLevel = {
  dispersion: number;
  mishitRate: number;
  sideSpinDispersion: number;
};

export type ShotInput = {
  club: ClubData;
  skillLevel: SkillLevel;
  aimXOffset: number;
  executionQuality?: ShotQuality;
  conditions?: {
    wind: number;
    groundHardness: number;
    headSpeed?: number;
    seed?: string;
  };
};

export type LandingResult = {
  carry: number;
  roll: number;
  totalDistance: number;
  lateralDeviation: number;
  finalX: number;
  finalY: number;
  apexHeight?: number;
  trajectoryPoints?: Array<{ x: number; y: number; z?: number }>;
};

type ExecutionProfile = {
  quality: ShotQuality;
  distanceMultiplier: number;
  sideSpinRPM: number;
};

const DEFAULT_HEAD_SPEED = 44.5;

/**
 * 値を最小〜最大の範囲へ丸めるための共通関数。
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 0〜1の乱数を受け取り、指定範囲の値に線形変換する。
 */
function randomInRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/**
 * スキル値のスケールが 0〜1 でも 0〜100 でも扱えるように正規化する。
 */
function normalizeSkillValue(raw: number): number {
  if (raw <= 1) return clamp(raw, 0, 1);
  return clamp(raw / 100, 0, 1);
}

/**
 * 入力内容から毎回同じシード文字列を組み立て、同一入力なら同一結果にする。
 */
function buildDeterministicSeed(input: ShotInput): string {
  if (input.conditions?.seed) {
    return input.conditions.seed;
  }

  const { club, skillLevel, aimXOffset, conditions } = input;
  return [
    club.clubType,
    club.name,
    club.number,
    club.loftAngle,
    club.distance,
    skillLevel.dispersion,
    skillLevel.mishitRate,
    skillLevel.sideSpinDispersion,
    input.executionQuality ?? "auto",
    aimXOffset,
    conditions?.wind ?? 0,
    conditions?.groundHardness ?? 50,
    conditions?.headSpeed ?? DEFAULT_HEAD_SPEED,
  ].join("|");
}

/**
 * getEstimatedDistance に渡せる最低限の GolfClub 形式へ整形する。
 */
function toGolfClubForDistanceModel(club: ClubData): GolfClub {
  return {
    id: 0,
    clubType: club.clubType,
    name: club.name,
    number: club.number,
    length: club.length,
    weight: club.weight,
    swingWeight: club.swingWeight,
    lieAngle: club.lieAngle,
    loftAngle: club.loftAngle,
    shaftType: club.shaftType,
    torque: club.torque,
    flex: club.flex,
    distance: club.distance,
    notes: club.notes,
  };
}

/**
 * 実行品質をスキル依存で決定する。
 * mishitRate が高いほど mishit へ寄り、dispersion が小さいほど excellent/good が増える。
 */
function resolveExecutionQuality(rng: () => number, skillLevel: SkillLevel): ShotQuality {
  const dispersion01 = normalizeSkillValue(skillLevel.dispersion);
  const mishit01 = normalizeSkillValue(skillLevel.mishitRate);
  const consistency = 1 - dispersion01;

  const excellentChance = 0.08 + consistency * 0.16;
  const goodChance = 0.30 + consistency * 0.18;
  const averageChance = 0.28;
  const poorChance = 0.18 + mishit01 * 0.12;
  const mishitChance = 0.06 + mishit01 * 0.26;

  const total = excellentChance + goodChance + averageChance + poorChance + mishitChance;
  const roll = rng() * total;

  if (roll < excellentChance) return "excellent";
  if (roll < excellentChance + goodChance) return "good";
  if (roll < excellentChance + goodChance + averageChance) return "average";
  if (roll < excellentChance + goodChance + averageChance + poorChance) return "poor";
  return "mishit";
}

/**
 * 品質ごとの距離倍率とサイドスピンの基準幅を返す。
 * sideSpinRPM の係数はチューニング前提の簡易モデル。
 */
function buildExecutionProfile(
  quality: ShotQuality,
  skillLevel: SkillLevel,
  rng: () => number,
): ExecutionProfile {
  const sideSpinDispersion01 = normalizeSkillValue(skillLevel.sideSpinDispersion);
  const sideSpinScale = 1 + sideSpinDispersion01 * 1.6;

  if (quality === "excellent") {
    return {
      quality,
      distanceMultiplier: randomInRange(rng, 1.02, 1.1),
      sideSpinRPM: randomInRange(rng, -300, 300) * sideSpinScale,
    };
  }

  if (quality === "good") {
    return {
      quality,
      distanceMultiplier: randomInRange(rng, 0.96, 1.03),
      sideSpinRPM: randomInRange(rng, -700, 700) * sideSpinScale,
    };
  }

  if (quality === "average") {
    return {
      quality,
      distanceMultiplier: randomInRange(rng, 0.88, 0.98),
      sideSpinRPM: randomInRange(rng, -1200, 1200) * sideSpinScale,
    };
  }

  if (quality === "poor") {
    return {
      quality,
      distanceMultiplier: randomInRange(rng, 0.72, 0.88),
      sideSpinRPM: randomInRange(rng, -2200, 2200) * sideSpinScale,
    };
  }

  return {
    quality,
    distanceMultiplier: randomInRange(rng, 0.45, 0.78),
    sideSpinRPM: randomInRange(rng, -3500, 3500) * sideSpinScale,
  };
}

/**
 * 飛距離方向（Y軸）に対して前後のばらつきを与える。
 */
function applyDispersion(baseCarry: number, skillLevel: SkillLevel, rng: () => number): number {
  const dispersion01 = normalizeSkillValue(skillLevel.dispersion);
  const maxCarryVariationRate = 0.03 + dispersion01 * 0.12;
  const variation = randomInRange(rng, -maxCarryVariationRate, maxCarryVariationRate);
  return baseCarry * (1 + variation);
}

/**
 * サイドスピンから左右ズレを算出する。
 * 簡易式: lateralDeviation = (sideSpinRPM / 1000) * carry * 係数
 * 係数 0.035 は調整ポイント（実測に合わせて将来チューニング可能）。
 */
function calculateSideDeviation(sideSpinRPM: number, carry: number): number {
  const SIDE_DEVIATION_COEFFICIENT = 0.035;
  return (sideSpinRPM / 1000) * carry * SIDE_DEVIATION_COEFFICIENT;
}

/**
 * 番手文字列から先頭の数値を取り出す（例: 7, 3W, 4H -> 7, 3, 4）。
 */
function extractClubNumber(numberText: string): number | null {
  const match = numberText.trim().toUpperCase().match(/^(\d{1,2})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * クラブ種別に応じたラン比率の目安を返す。
 * 番手が取得できる場合は番手補正を優先し、取得できない場合はロフト角で補完する。
 */
function getRollRateByClub(club: Pick<GolfClub, "clubType" | "number" | "loftAngle">): number {
  const clubType = club.clubType;
  const clubNumber = extractClubNumber(club.number ?? "");

  // 一般的な弾道データの目安（通常コンディション）に合わせた基準値。
  // Driver: carryの約5〜12%、Wood/Hybrid: 約4〜10%、Iron: 約2〜7%、Wedge: 約1〜4%。
  if (clubType === "Driver") return 0.09;

  if (clubType === "Wood") {
    if (clubNumber !== null) {
      if (clubNumber <= 3) return 0.085;
      if (clubNumber <= 5) return 0.075;
      if (clubNumber <= 7) return 0.065;
      return 0.055;
    }
    return (club.loftAngle ?? 15) <= 16 ? 0.08 : 0.065;
  }

  if (clubType === "Hybrid") {
    if (clubNumber !== null) {
      if (clubNumber <= 3) return 0.075;
      if (clubNumber <= 4) return 0.068;
      if (clubNumber <= 5) return 0.06;
      return 0.052;
    }
    return (club.loftAngle ?? 22) <= 21 ? 0.07 : 0.058;
  }

  if (clubType === "Iron") {
    if (clubNumber !== null) {
      if (clubNumber <= 4) return 0.06;
      if (clubNumber <= 6) return 0.052;
      if (clubNumber <= 8) return 0.042;
      return 0.032;
    }
    return (club.loftAngle ?? 30) <= 28 ? 0.052 : 0.038;
  }

  if (clubType === "Wedge") {
    const token = (club.number ?? "").trim().toUpperCase();
    if (token.includes("LW")) return 0.012;
    if (token.includes("SW")) return 0.016;
    if (token.includes("GW") || token.includes("AW")) return 0.02;
    if (token.includes("PW")) return 0.024;
    return (club.loftAngle ?? 50) >= 56 ? 0.014 : 0.022;
  }

  return 0.01;
}

/**
 * groundHardness(0〜100) を中心50で正規化し、ラン量へ反映する。
 */
function calculateRollDistance(
  carry: number,
  club: Pick<GolfClub, "clubType" | "number" | "loftAngle">,
  groundHardness: number,
  executionQuality: ShotQuality,
): number {
  const baseRollRate = getRollRateByClub(club);
  const groundHardness01 = clamp(groundHardness, 0, 100) / 100;
  // 地面硬さの影響は過大になりやすいため、0.8〜1.2の狭い範囲で制御する。
  const groundFactor = 0.8 + groundHardness01 * 0.4;

  const qualityFactor =
    executionQuality === "excellent"
      ? 1.06
      : executionQuality === "good"
        ? 1.02
        : executionQuality === "average"
          ? 0.98
          : executionQuality === "poor"
            ? 0.9
            : 0.82;

  const rawRoll = Math.max(0, carry * baseRollRate * groundFactor * qualityFactor);

  // 実装を安定させるため、クラブごとに roll/carry の上限を設定する。
  // これにより異常な長ラン（特に低ロフト時）を抑制できる。
  const maxRollRateByClub =
    club.clubType === "Driver"
      ? 0.16
      : club.clubType === "Wood"
        ? 0.13
        : club.clubType === "Hybrid"
          ? 0.11
          : club.clubType === "Iron"
            ? 0.08
            : club.clubType === "Wedge"
              ? 0.05
              : 0.03;

  const maxRoll = carry * maxRollRateByClub;
  return Math.min(rawRoll, maxRoll);
}

/**
 * 簡易放物線の頂点高さを返す。
 */
function calculateApexHeight(loftAngle: number, carry: number): number {
  const loftFactor = clamp(loftAngle, 3, 62) / 62;
  const carryFactor = Math.sqrt(Math.max(1, carry)) * 0.7;
  return loftFactor * carryFactor;
}

/**
 * 描画用の簡易軌跡点を作る。
 * x は横方向、y はターゲット方向、z は高さとして扱う。
 */
function buildTrajectoryPoints(finalX: number, finalY: number, apexHeight: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = [];
  const stepCount = 10;

  for (let i = 0; i <= stepCount; i += 1) {
    const t = i / stepCount;
    const y = finalY * t;
    const x = finalX * t;
    const z = 4 * apexHeight * t * (1 - t);
    points.push({ x, y, z });
  }

  return points;
}

/**
 * 着地地点を再現可能（seed指定）に計算する純粋関数。
 */
export function calculateLandingPosition(input: ShotInput): LandingResult {
  // シード付き乱数を使うことで、同一入力なら常に同一結果になる。
  const rng = seedrandom(buildDeterministicSeed(input));
  const headSpeed = input.conditions?.headSpeed ?? DEFAULT_HEAD_SPEED;
  const wind = input.conditions?.wind ?? 0;
  const groundHardness = input.conditions?.groundHardness ?? 50;

  // 既存の標準飛距離関数を使って、クラブごとの基準値を作る。
  const clubForDistance = toGolfClubForDistanceModel(input.club);
  const standardDistance = getEstimatedDistance(clubForDistance, headSpeed);

  // 品質を決めて、距離倍率とサイドスピン量を生成する。
  // executionQuality が指定された場合はその品質を優先し、未指定時のみ内部抽選する。
  const quality = input.executionQuality ?? resolveExecutionQuality(rng, input.skillLevel);
  const execution = buildExecutionProfile(quality, input.skillLevel, rng);

  // まず品質倍率を適用し、その後にスキル由来の前後分散を入れる。
  const carryBeforeDispersion = standardDistance * execution.distanceMultiplier;
  let carry = applyDispersion(carryBeforeDispersion, input.skillLevel, rng);

  // 風は簡易的にY方向へ線形反映する（単位と係数は調整余地あり）。
  carry += wind * 0.8;
  carry = Math.max(1, carry);

  // ランはクラブ種別・地面硬さ・品質で決める。
  const roll = calculateRollDistance(carry, input.club, groundHardness, execution.quality);

  // 横ズレは sideSpinRPM に比例する簡易式で計算する。
  const lateralDeviation = calculateSideDeviation(execution.sideSpinRPM, carry);

  // ユーザーの狙いオフセットと横ズレを合成して最終X座標を得る。
  const finalX = input.aimXOffset + lateralDeviation;
  const finalY = carry + roll;
  const totalDistance = finalY;

  // 轨跡可視化向けに頂点高さと点列を生成する。
  const apexHeight = calculateApexHeight(input.club.loftAngle, carry);
  const trajectoryPoints = buildTrajectoryPoints(finalX, finalY, apexHeight);

  return {
    carry: Math.round(carry * 10) / 10,
    roll: Math.round(roll * 10) / 10,
    totalDistance: Math.round(totalDistance * 10) / 10,
    lateralDeviation: Math.round(lateralDeviation * 10) / 10,
    finalX: Math.round(finalX * 10) / 10,
    finalY: Math.round(finalY * 10) / 10,
    apexHeight: Math.round(apexHeight * 10) / 10,
    trajectoryPoints: trajectoryPoints.map((p) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      z: Math.round(p.z * 10) / 10,
    })),
  };
}
