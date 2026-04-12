import * as seedrandomModule from "seedrandom";
import { estimateTheoreticalDistance } from "./distanceEstimation";
import type { GolfClub } from "../types/golf";
import type { GroundCondition } from "../types/game";
import type { ShotQuality, ShotQualityMetrics } from "../types/game";

const seedrandom = ((seedrandomModule as unknown as { default?: typeof seedrandomModule }).default ?? seedrandomModule) as (
  seed?: string
) => () => number;

export type ClubData = Pick<
  GolfClub,
  "clubType" | "name" | "number" | "length" | "weight" | "swingWeight" | "lieAngle" | "loftAngle" | "shaftType" | "torque" | "flex" | "distance" | "notes"
>;

export type SkillLevel = {
  dispersion: number;
  mishitRate: number;
  sideSpinDispersion: number;
  hazardRecoveryFactor: number;
};

export type AdjustedLandingResult = LandingResult & {
  nextShotAdjustment: {
    dispersionMultiplier: number;
    mishitRateBonus: number;
    groundCondition: GroundCondition;
  };
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
  baseDistanceOverride?: number;
  };
};

export type LandingResult = {
  carry: number;
  roll: number;
  totalDistance: number;
  lateralDeviation: number;
  finalX: number;
  finalY: number;
  shotQuality?: ShotQuality;
  qualityMetrics?: ShotQualityMetrics;
  apexHeight?: number;
  trajectoryPoints?: Array<{ x: number; y: number; z?: number }>;
};

export type MonteCarloResult = {
  shots: LandingResult[];
  stats: {
    meanX: number;
    meanY: number;
    stdDevX: number;
    stdDevY: number;
    correlation?: number;
    hazardRate?: number;
  };
};

export type LandingOutcome = {
  landing: LandingResult;
  shotQuality: ShotQuality;
};

type ExecutionProfile = {
  quality: ShotQuality;
  carrySigmaMultiplier: number;
  lateralSigmaMultiplier: number;
  carryBiasRatio: number;
};

type DispersionProfile = {
  carrySigma: number;
  lateralSigma: number;
  mishitProbability: number;
  effectiveSkill: number;
};

const DEFAULT_HEAD_SPEED = 44.5;
const GLOBAL_CARRY_TUNING = 1;
const DISPERSION_SKILL_CURVE_POWER = 1.8;
const LOW_SKILL_NEAR_TARGET_RADIUS = 15;
const LOW_SKILL_AVOID_START_SKILL = 0.45;
const LOW_SKILL_AVOID_FULL_SKILL = 0.15;
const MAX_GROUND_SLOPE_ANGLE = 60; // 極端な斜面を避けるための上限
const HARDNESS_MULTIPLIER_BY_TYPE: Record<GroundCondition["hardness"], number> = {
  firm: 1.35,
  medium: 1.0,
  soft: 0.65,
};
const MAX_SLOPE_DISPERSION_BONUS = 0.35; // 斜面が強いほど次のショットのブレが増す
const SOFT_GROUND_MISHIT_BONUS = 0.06;
const UPHILL_MISHIT_BONUS_PER_DEGREE = 0.0025; // 10度で約0.025
const GROUND_CONDITION_SEED_PREFIX = "ground-condition";

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

function buildGroundConditionSeed(
  landingResult: LandingResult,
  ground: GroundCondition,
  club: ClubData,
  skillLevel: SkillLevel,
): string {
  const normalizedSlope = normalizeGroundSlope(ground);

  return [
    GROUND_CONDITION_SEED_PREFIX,
    club.clubType,
    club.name,
    club.number,
    club.loftAngle,
    club.distance,
    landingResult.carry,
    landingResult.roll,
    landingResult.lateralDeviation,
    ground.hardness,
    normalizedSlope.slopeAngle,
    normalizedSlope.slopeDirection,
    skillLevel.dispersion,
    skillLevel.mishitRate,
    skillLevel.sideSpinDispersion,
  ].join("|");
}

function clampGroundSlopeAngle(angle: number): number {
  return clamp(angle, -MAX_GROUND_SLOPE_ANGLE, MAX_GROUND_SLOPE_ANGLE);
}

export function normalizeGroundSlope(ground: GroundCondition): { slopeAngle: number; slopeDirection: number } {
  const slopeAngle = clampGroundSlopeAngle(ground.slopeAngle);
  const normalizedDirection = ((ground.slopeDirection % 360) + 360) % 360;

  if (slopeAngle < 0) {
    return {
      slopeAngle: Math.abs(slopeAngle),
      slopeDirection: (normalizedDirection + 180) % 360,
    };
  }

  return {
    slopeAngle,
    slopeDirection: normalizedDirection,
  };
}

/**
 * 着地後の地面条件を反映して、ラン量 / 位置 / 次ショット罰則を決定する純粋関数。
 */
export function applyGroundCondition(
  landingResult: LandingResult,
  ground: GroundCondition,
  club: ClubData,
  skillLevel: SkillLevel,
): AdjustedLandingResult {
  const rng = seedrandom(buildGroundConditionSeed(landingResult, ground, club, skillLevel));
  const hardnessMultiplier = HARDNESS_MULTIPLIER_BY_TYPE[ground.hardness];
  const normalizedSlope = normalizeGroundSlope(ground);
  const adjustedSlopeAngle = normalizedSlope.slopeAngle;
  const slopeAngleRad = (adjustedSlopeAngle * Math.PI) / 180;
  const slopeStrength = Math.min(1, Math.abs(adjustedSlopeAngle) / 45);
  const slopeDirectionRad = (normalizedSlope.slopeDirection * Math.PI) / 180;

  // 0度はピン方向uphillのため、+値ほどキャリーが減る。
  const forwardSlopeComponent = slopeStrength * Math.cos(slopeDirectionRad);
  // 90度は右uphillのため、横方向（左右）への影響に使う。
  const crossSlopeComponent = slopeStrength * Math.sin(slopeDirectionRad);

  const carryMultiplier = clamp(1 - forwardSlopeComponent * 0.08, 0.9, 1.1);
  const rollMultiplier = clamp(hardnessMultiplier * Math.cos(slopeAngleRad) * (1 - forwardSlopeComponent * 0.22), 0.4, 1.7);
  const adjustedCarry = Math.max(0.1, landingResult.carry * carryMultiplier);
  const adjustedRoll = Math.max(0, landingResult.roll * rollMultiplier);

  const dispersionMultiplier = 1 + slopeStrength * MAX_SLOPE_DISPERSION_BONUS * (0.4 + Math.abs(crossSlopeComponent) * 0.6);
  const mishitRateBonus =
    (ground.hardness === "soft" ? SOFT_GROUND_MISHIT_BONUS : 0) +
    (adjustedSlopeAngle > 0 ? Math.min(0.12, adjustedSlopeAngle * UPHILL_MISHIT_BONUS_PER_DEGREE) : 0);

  const adjustedLateralDeviation = landingResult.lateralDeviation * dispersionMultiplier;
  // 横傾斜は常に「高い側から低い側」へ流れるよう、符号は方向からのみ決める。
  const slopeShiftMagnitude = Math.abs(
    sampleTruncatedNormal(rng, slopeStrength * (0.2 + Math.abs(crossSlopeComponent) * 0.25), 1.0),
  );
  const slopeShift = slopeShiftMagnitude * -2 * crossSlopeComponent;
  const finalX = landingResult.finalX + (adjustedLateralDeviation - landingResult.lateralDeviation) + slopeShift;
  const finalY = Math.max(0, adjustedCarry + adjustedRoll);
  const totalDistance = finalY;
  const apexHeight = calculateApexHeight(club.loftAngle, adjustedCarry);
  const trajectoryPoints = buildTrajectoryPoints(finalX, finalY, apexHeight);

  return {
    ...landingResult,
    carry: Math.round(adjustedCarry * 10) / 10,
    roll: Math.round(adjustedRoll * 10) / 10,
    totalDistance: Math.round(totalDistance * 10) / 10,
    lateralDeviation: Math.round(adjustedLateralDeviation * 10) / 10,
    finalX: Math.round(finalX * 10) / 10,
    finalY: Math.round(finalY * 10) / 10,
    apexHeight: Math.round(apexHeight * 10) / 10,
    trajectoryPoints: trajectoryPoints.map((p) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      z: Math.round(p.z * 10) / 10,
    })),
    nextShotAdjustment: {
      dispersionMultiplier: Math.round(dispersionMultiplier * 100) / 100,
      mishitRateBonus: Math.round(mishitRateBonus * 100) / 100,
      groundCondition: ground,
    },
  };
}

/**
 * Box-Muller 法で平均0・標準偏差1の正規乱数を作る。
 */
function sampleStandardNormal(rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleTruncatedNormal(rng: () => number, sigma: number, maxSigma = 1.5): number {
  const value = sampleStandardNormal(rng);
  const clipped = Math.max(-maxSigma, Math.min(maxSigma, value));
  return clipped * sigma;
}

/**
 * 品質ラベルが外部から与えられたときに、分散を条件付きで制御する。
 */
function buildForcedExecutionProfile(quality: ShotQuality): ExecutionProfile {
  if (quality === "excellent") {
    return { quality, carrySigmaMultiplier: 0.45, lateralSigmaMultiplier: 0.45, carryBiasRatio: 0.02 };
  }
  if (quality === "good") {
    return { quality, carrySigmaMultiplier: 0.75, lateralSigmaMultiplier: 0.75, carryBiasRatio: 0 };
  }
  if (quality === "average") {
    return { quality, carrySigmaMultiplier: 1, lateralSigmaMultiplier: 1, carryBiasRatio: -0.01 };
  }
  if (quality === "poor") {
    return { quality, carrySigmaMultiplier: 1.35, lateralSigmaMultiplier: 1.45, carryBiasRatio: -0.08 };
  }
  return { quality, carrySigmaMultiplier: 1.85, lateralSigmaMultiplier: 2.1, carryBiasRatio: -0.2 };
}

/**
 * クラブ種別ごとの「通常ショット時のばらつき基準」を返す。
 * 数値は実測レンジに寄せた目安で、低スキルほど大きい分散になる。
 */
function getBaseDispersionByClubType(clubType: GolfClub["clubType"]): {
  carrySigmaLow: number;
  carrySigmaHigh: number;
  lateralSigmaLow: number;
  lateralSigmaHigh: number;
  mishitLow: number;
  mishitHigh: number;
} {
  if (clubType === "Driver") {
    return { carrySigmaLow: 6, carrySigmaHigh: 20, lateralSigmaLow: 10, lateralSigmaHigh: 35, mishitLow: 0.04, mishitHigh: 0.24 };
  }
  if (clubType === "Wood") {
    return { carrySigmaLow: 6, carrySigmaHigh: 16, lateralSigmaLow: 9, lateralSigmaHigh: 30, mishitLow: 0.04, mishitHigh: 0.21 };
  }
  if (clubType === "Hybrid") {
    return { carrySigmaLow: 5, carrySigmaHigh: 14, lateralSigmaLow: 8, lateralSigmaHigh: 26, mishitLow: 0.04, mishitHigh: 0.2 };
  }
  if (clubType === "Iron") {
    return { carrySigmaLow: 4, carrySigmaHigh: 12, lateralSigmaLow: 6, lateralSigmaHigh: 20, mishitLow: 0.03, mishitHigh: 0.16 };
  }
  if (clubType === "Wedge") {
    return { carrySigmaLow: 3, carrySigmaHigh: 9, lateralSigmaLow: 4, lateralSigmaHigh: 12, mishitLow: 0.02, mishitHigh: 0.12 };
  }
  return { carrySigmaLow: 1, carrySigmaHigh: 4, lateralSigmaLow: 1, lateralSigmaHigh: 4, mishitLow: 0.01, mishitHigh: 0.08 };
}

/**
 * スキル値を、キャリー/横ブレ/大ミス確率に変換する。
 */
function buildDispersionProfile(club: ClubData, skillLevel: SkillLevel): DispersionProfile {
  const skill01 = 1 - normalizeSkillValue(skillLevel.dispersion);
  const mishitSkill01 = 1 - normalizeSkillValue(skillLevel.mishitRate);
  const sideSkill01 = 1 - normalizeSkillValue(skillLevel.sideSpinDispersion);

  const base = getBaseDispersionByClubType(club.clubType);
  // 中級から初心者にかけて分散の増加が加速するよう、スキルを非線形カーブへ変換する。
  const carrySkillCurve = Math.pow(clamp(skill01, 0, 1), DISPERSION_SKILL_CURVE_POWER);
  const lateralSkillCurve = Math.pow(clamp(sideSkill01, 0, 1), DISPERSION_SKILL_CURVE_POWER);
  const carrySigma = base.carrySigmaHigh - (base.carrySigmaHigh - base.carrySigmaLow) * carrySkillCurve;
  const lateralSigma = base.lateralSigmaHigh - (base.lateralSigmaHigh - base.lateralSigmaLow) * lateralSkillCurve;
  // 上級者では大ミス発生率を急減、初心者では発生率を高める非線形カーブ。
  const mishitSkillCurve = Math.pow(clamp(mishitSkill01, 0, 1), 1.7);
  const mishitProbability = base.mishitHigh - (base.mishitHigh - base.mishitLow) * mishitSkillCurve;
  const effectiveSkill = clamp((skill01 + mishitSkill01 + sideSkill01) / 3, 0, 1);

  return {
    carrySigma: Math.max(1, carrySigma),
    lateralSigma: Math.max(1, lateralSigma),
    mishitProbability: clamp(mishitProbability, 0.003, 0.40),
    effectiveSkill,
  };
}

export function classifyShotQualityByTargetError(
  expectedCarry: number,
  carry: number,
  lateralDeviation: number,
): { quality: ShotQuality; percentError: number; distanceError: number } {
  const deltaY = carry - expectedCarry;
  const distanceError = Math.sqrt(deltaY * deltaY + lateralDeviation * lateralDeviation);
  const percentError = expectedCarry > 0
    ? (distanceError / expectedCarry) * 100
    : distanceError === 0
      ? 0
      : Number.POSITIVE_INFINITY;

  if (percentError <= 3) return { quality: "excellent", percentError, distanceError };
  if (percentError <= 7) return { quality: "good", percentError, distanceError };
  if (percentError <= 13) return { quality: "average", percentError, distanceError };
  if (percentError <= 25) return { quality: "misshot", percentError, distanceError };
  return { quality: "poor", percentError, distanceError };
}

/**
 * 生成したキャリー誤差と横ブレ量から品質ラベルを後判定する。
 */
function classifyQualityByOutcome(
  carry: number,
  expectedCarry: number,
  clubType: GolfClub["clubType"],
  lateralDeviation: number,
  profile: DispersionProfile,
): { quality: ShotQuality; metrics: ShotQualityMetrics } {
  const carryDelta = carry - expectedCarry;
  const rawCarryZ = Math.abs(carryDelta) / Math.max(1e-6, profile.carrySigma);
  // Driverは「飛びすぎ」を原則ネガティブ評価しない。
  // 方向性ミスは lateral 側で評価し、距離上振れ単体では品質を落としにくくする。
  const carryZ = clubType === "Driver" && carryDelta > 0 ? 0 : rawCarryZ;
  const lateralZ = Math.abs(lateralDeviation) / Math.max(1e-6, profile.lateralSigma);
  // 横ブレだけで poor へ落ちすぎると「Missなのに距離はGood相当」が増えるため、
  // 距離誤差をやや重く、横ブレをやや軽く評価する。
  const weightedCarry = carryZ * 1.1;
  const weightedLateral = lateralZ * 0.75;
  const score = Math.max(weightedCarry, weightedLateral);
  const poorThreshold = 1.6;

  const decisiveAxis: ShotQualityMetrics["decisiveAxis"] =
    Math.abs(weightedCarry - weightedLateral) < 0.05
      ? "mixed"
      : weightedCarry > weightedLateral
        ? "carry"
        : "lateral";

  const qualityResult = classifyShotQualityByTargetError(expectedCarry, carry, lateralDeviation);

  const metrics: ShotQualityMetrics = {
    carryZ,
    lateralZ,
    weightedCarry,
    weightedLateral,
    score,
    poorThreshold,
    decisiveAxis,
    distanceError: qualityResult.distanceError,
    percentError: qualityResult.percentError,
  };

  return { quality: qualityResult.quality, metrics };
}

/**
 * 低スキル時、目標15y圏内に入るショットを減らすための補正。
 * 目標近傍に着弾した場合のみ、外側リングへ確率的に押し出す。
 */
function applyLowSkillTargetAvoidance(
  carry: number,
  lateralDeviation: number,
  expectedCarry: number,
  effectiveSkill: number,
  rng: () => number,
): { carry: number; lateralDeviation: number } {
  const avoidanceStrength = clamp(
    (LOW_SKILL_AVOID_START_SKILL - effectiveSkill) / (LOW_SKILL_AVOID_START_SKILL - LOW_SKILL_AVOID_FULL_SKILL),
    0,
    1,
  );
  if (avoidanceStrength <= 0) {
    return { carry, lateralDeviation };
  }

  const carryDelta = carry - expectedCarry;
  const distanceFromTarget = Math.hypot(lateralDeviation, carryDelta);
  if (distanceFromTarget > LOW_SKILL_NEAR_TARGET_RADIUS) {
    return { carry, lateralDeviation };
  }

  // 低スキルほど発動率を高め、15y以内の着弾を起こしにくくする。
  const avoidChance = 0.65 + avoidanceStrength * 0.35;
  if (rng() > avoidChance) {
    return { carry, lateralDeviation };
  }

  const angle =
    distanceFromTarget > 1e-6
      ? Math.atan2(carryDelta, lateralDeviation)
      : randomInRange(rng, -Math.PI, Math.PI);
  const pushedDistance = randomInRange(
    rng,
    LOW_SKILL_NEAR_TARGET_RADIUS + 1,
    LOW_SKILL_NEAR_TARGET_RADIUS + 8 + 14 * avoidanceStrength,
  );

  return {
    carry: expectedCarry + Math.sin(angle) * pushedDistance,
    lateralDeviation: Math.cos(angle) * pushedDistance,
  };
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
 * 推定距離を「トータル距離」とみなし、クラブ別ロール率からキャリー基準へ変換する。
 */
function estimateCarryFromTotalDistance(
  estimatedTotalDistance: number,
  club: Pick<GolfClub, "clubType" | "number" | "loftAngle">,
  groundHardness: number,
): number {
  const baseRollRate = getRollRateByClub(club);
  const groundHardness01 = clamp(groundHardness, 0, 100) / 100;
  const groundFactor = 0.8 + groundHardness01 * 0.4;
  const typicalQualityFactor = 0.98; // average品質寄り

  const effectiveRollRate = Math.max(0, baseRollRate * groundFactor * typicalQualityFactor);
  const carry = estimatedTotalDistance / (1 + effectiveRollRate);
  return Math.max(1, carry * GLOBAL_CARRY_TUNING);
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
 * 着地地点と品質を再現可能（seed指定）に計算する純粋関数。
 */
export function calculateLandingOutcome(input: ShotInput): LandingOutcome {
  // シード付き乱数を使うことで、同一入力なら常に同一結果になる。
  const rng = seedrandom(buildDeterministicSeed(input));
  const headSpeed = input.conditions?.headSpeed ?? DEFAULT_HEAD_SPEED;
  const wind = input.conditions?.wind ?? 0;
  const groundHardness = input.conditions?.groundHardness ?? 50;

  // baseDistanceOverrideが指定されていればそれを実測ベースとして使う。
  const estimatedTotalDistance = (input.conditions?.baseDistanceOverride ?? 0) > 0
    ? input.conditions!.baseDistanceOverride!
    : estimateTheoreticalDistance(input.club, headSpeed);
  const expectedCarry = estimateCarryFromTotalDistance(estimatedTotalDistance, input.club, groundHardness);

  // スキルレベルに応じた分散パラメータを作る。
  const profile = buildDispersionProfile(input.club, input.skillLevel);

  const forcedQuality = input.executionQuality;
  const isForced = typeof forcedQuality === "string";

  let carry: number;
  let lateralDeviation: number;
  let resolvedQuality: ShotQuality;
  let qualityMetrics: ShotQualityMetrics;

  if (isForced && forcedQuality) {
    // 既存の shotQuality と同期させる場合は、品質に応じた条件付き分布で生成する。
    const forced = buildForcedExecutionProfile(forcedQuality);
    const carryNoise = sampleStandardNormal(rng) * profile.carrySigma * forced.carrySigmaMultiplier;
    carry = expectedCarry * (1 + forced.carryBiasRatio) + carryNoise;

    const startLine = sampleStandardNormal(rng) * profile.lateralSigma * 0.7 * forced.lateralSigmaMultiplier;
    const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.45 * forced.lateralSigmaMultiplier;
    lateralDeviation = startLine + curve;
    const forcedResult = classifyQualityByOutcome(
      carry,
      expectedCarry,
      input.club.clubType,
      lateralDeviation,
      profile,
    );
    resolvedQuality = forcedQuality;
    qualityMetrics = forcedResult.metrics;
  } else {
    // 通常ショット分布 + 大ミス分布の混合モデルで carry と横ブレを生成する。
    const isPerfectRobot =
      input.skillLevel.dispersion === 0 &&
      input.skillLevel.mishitRate === 0 &&
      input.skillLevel.sideSpinDispersion === 0;
    let wasMishit = rng() < profile.mishitProbability;
    if (isPerfectRobot) {
      wasMishit = false;
    }

    if (wasMishit) {
      // 初心者ほど極端ミスが大きく、上級者ほど「軽いミス」で収まりやすくする。
      const noviceFactor = 1 - profile.effectiveSkill;
      const minCarryRate = 0.78 - noviceFactor * 0.42; // 上級: ~0.78 / 初心者: ~0.36
      const maxCarryRate = 0.95 - noviceFactor * 0.14; // 上級: ~0.95 / 初心者: ~0.81
      carry = expectedCarry * randomInRange(rng, minCarryRate, maxCarryRate);
      const lateralMin = 1.15 + noviceFactor * 0.65; // 上級: ~1.15 / 初心者: ~1.80
      const lateralMax = 1.65 + noviceFactor * 1.45; // 上級: ~1.65 / 初心者: ~3.10
      const lateralScale = randomInRange(rng, lateralMin, lateralMax);
      const startLine = sampleStandardNormal(rng) * profile.lateralSigma * lateralScale;
      const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.8 * lateralScale;
      lateralDeviation = startLine + curve;
      const adjusted = applyLowSkillTargetAvoidance(carry, lateralDeviation, expectedCarry, profile.effectiveSkill, rng);
      carry = adjusted.carry;
      lateralDeviation = adjusted.lateralDeviation;
      const classified = classifyQualityByOutcome(
        carry,
        expectedCarry,
        input.club.clubType,
        lateralDeviation,
        profile,
      );
      resolvedQuality = classified.quality;
      qualityMetrics = classified.metrics;
    } else {
      if (isPerfectRobot) {
        carry = expectedCarry + sampleTruncatedNormal(rng, profile.carrySigma, 1.25);
        const startLine = sampleTruncatedNormal(rng, profile.lateralSigma * 0.25, 1.25);
        const curve = sampleTruncatedNormal(rng, profile.lateralSigma * 0.15, 1.25);
        lateralDeviation = startLine + curve;
      } else {
        carry = expectedCarry + sampleStandardNormal(rng) * profile.carrySigma;
        const startLine = sampleStandardNormal(rng) * profile.lateralSigma * 0.75;
        const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.4;
        lateralDeviation = startLine + curve;
      }
      const adjusted = applyLowSkillTargetAvoidance(carry, lateralDeviation, expectedCarry, profile.effectiveSkill, rng);
      carry = adjusted.carry;
      lateralDeviation = adjusted.lateralDeviation;
      const classified = classifyQualityByOutcome(
        carry,
        expectedCarry,
        input.club.clubType,
        lateralDeviation,
        profile,
      );
      resolvedQuality = classified.quality;
      qualityMetrics = classified.metrics;
    }
  }

  // 風は簡易的にY方向へ線形反映する（単位と係数は調整余地あり）。
  carry += wind * 0.8;
  carry = Math.max(1, carry);

  // ランはクラブ種別・地面硬さ・品質で決める。
  const roll = calculateRollDistance(carry, input.club, groundHardness, resolvedQuality);

  // ユーザーの狙いオフセットと横ズレを合成して最終X座標を得る。
  const finalX = input.aimXOffset + lateralDeviation;
  const finalY = carry + roll;
  const totalDistance = finalY;

  // 轨跡可視化向けに頂点高さと点列を生成する。
  const apexHeight = calculateApexHeight(input.club.loftAngle, carry);
  const trajectoryPoints = buildTrajectoryPoints(finalX, finalY, apexHeight);

  return {
    shotQuality: resolvedQuality,
    landing: {
      carry: Math.round(carry * 10) / 10,
      roll: Math.round(roll * 10) / 10,
      totalDistance: Math.round(totalDistance * 10) / 10,
      lateralDeviation: Math.round(lateralDeviation * 10) / 10,
      finalX: Math.round(finalX * 10) / 10,
      finalY: Math.round(finalY * 10) / 10,
      qualityMetrics: {
        carryZ: Math.round(qualityMetrics.carryZ * 100) / 100,
        lateralZ: Math.round(qualityMetrics.lateralZ * 100) / 100,
        weightedCarry: Math.round(qualityMetrics.weightedCarry * 100) / 100,
        weightedLateral: Math.round(qualityMetrics.weightedLateral * 100) / 100,
        score: Math.round(qualityMetrics.score * 100) / 100,
        poorThreshold: qualityMetrics.poorThreshold,
        decisiveAxis: qualityMetrics.decisiveAxis,
      },
      apexHeight: Math.round(apexHeight * 10) / 10,
      trajectoryPoints: trajectoryPoints.map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        z: Math.round(p.z * 10) / 10,
      })),
    },
  };
}

/**
 * 既存呼び出しとの互換性維持用: 着地地点のみ返すラッパー。
 */
export function calculateLandingPosition(input: ShotInput): LandingResult {
  return calculateLandingOutcome(input).landing;
}
