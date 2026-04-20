import type {
  Hazard,
  GroundCondition,
  SimClub,
  ShotContext,
  ShotResult,
  ShotQuality,
  LieType,
} from "../types/game";
import type { ClubPersonalData } from "../types/golf";
import { calculateBaseClubSuccessRate } from "./calculateSuccessRate";
import { ClubService } from "../db/clubService";
import { estimateTheoreticalDistance } from "./distanceEstimation";
import { calculateLandingOutcome, applyGroundCondition, classifyShotQualityByTargetError } from "./landingPosition";
import {
  assessLanding,
  buildDetailedShotMessage,
  buildNextShotAdvice,
  checkLandingInHazard,
  DEFAULT_GREEN_RADIUS,
  determinePenaltyStrokes,
  resolvePenaltyRelief,
  distanceToPinFromLanding,
} from "./shotOutcome";
import { sampleTruncatedNormal } from "./landingPosition";
import { formatSimClubLabel } from "./simClubLabel";

// ═══════════════════════════════════════════════════════════════════════════════
// 定数・設定値
// ═══════════════════════════════════════════════════════════════════════════════

/** 弱いクラブの効果スケール */
const WEAK_CLUB_EFFECT_SCALE = 0.5;

/** パワーペナルティ係数（100%超過ごとのスキル低下率） */
const POWER_PENALTY_PER_PERCENT = 0.02;

/** 風のmph→yards変換係数 */
const WIND_MPH_TO_YARDS = 1.46667;

/** 横風の影響係数 */
const CROSS_WIND_FACTOR = 0.9;

/** ショートショット時の風影響削減閾値（ヤード） */
const SHORT_SHOT_WIND_THRESHOLD = 50;

/** 風の向き風/追い風係数 */
const HEAD_WIND_FACTOR = 1.5;
const TAIL_WIND_FACTOR = 0.8;

/** パター以外のホールアウト確率 */
const HOLE_OUT_CHANCES: Record<string, Partial<Record<ShotQuality, number>>> = {
  short: { excellent: 0.08, good: 0.03, average: 0.01 },
  medium: { excellent: 0.03, good: 0.01, average: 0.005 },
  long: { excellent: 0.01, good: 0.004, average: 0.002 },
  veryLong: { excellent: 0.001 },
};

/** ニアカップ残距離（shotQualityごと） */
const NEAR_CUP_DISTANCES: Record<ShotQuality | "other", { min: number; range: number }> = {
  excellent: { min: 1, range: 2 },
  good: { min: 1, range: 4 },
  average: { min: 2, range: 5 },
  misshot: { min: 3, range: 6 },
  poor: { min: 3, range: 6 },
  other: { min: 3, range: 6 },
};

/** スキルレベルによる距離倍率（最小〜最大） */
const SKILL_DISTANCE_RANGE = { min: 0.92, max: 1.08 };

/** 有効成功率の範囲 */
const SUCCESS_RATE_BOUNDS = { min: 15, max: 95 };

/** パット基礎成功率（距離ごと） */
const PUTT_BASE_CHANCES = [
  { maxDist: 3, chance: 0.96 },
  { maxDist: 5, chance: 0.77 },
  { maxDist: 8, chance: 0.50 },
  { maxDist: 10, chance: 0.40 },
  { maxDist: 15, chance: 0.23 },
  { maxDist: 20, chance: 0.15 },
  { maxDist: 30, chance: 0.07 },
];

/** 弱いクラブの閾値 */
const WEAK_CLUB_THRESHOLD = 65;
const VERY_WEAK_CLUB_THRESHOLD = 60;

/** 弱いクラブの距離ペナルティ */
const WEAK_DISTANCE_PENALTY = {
  normal: 0.10,
  severe: 0.14,
};

/** ショットパワーの上限 */
const MAX_SHOT_POWER_PERCENT = 110;

/** ショット品質ラベル */
export const QUALITY_LABELS: Record<ShotQuality, string> = {
  excellent: "会心の一打！",
  good: "ナイスショット！",
  average: "まずまず",
  misshot: "大きく外した...",
  poor: "ミス気味...",
};

/** ライタイプラベル */
export const LIE_LABELS: Record<LieType, string> = {
  tee: "ティー",
  fairway: "フェアウェイ",
  semirough: "セミラフ",
  rough: "ラフ",
  bareground: "ベアグラウンド",
  bunker: "バンカー",
  green: "グリーン",
};

/** ライごとの距離倍率 */
const LIE_DISTANCE_MULTIPLIERS: Record<LieType, number> = {
  tee: 1.0,
  fairway: 0.98,
  semirough: 0.9,
  rough: 0.82,
  bareground: 0.6,
  bunker: 0.5,
  green: 1.0,
};

/** バンカーでのウェッジの距離倍率 */
const BUNKER_WEDGE_MULTIPLIER = 0.7;

/** ライごとの成功率ペナルティ */
const LIE_SUCCESS_PENALTIES: Partial<Record<LieType, number>> = {
  semirough: 8,
  rough: 12,
  bareground: 18,
  bunker: 20,
};

/** スキルレベルごとのハザード回復係数 */
const HAZARD_RECOVERY_FACTORS = [
  { threshold: 0.35, factor: 0.4 },
  { threshold: 0.65, factor: 0.7 },
  { threshold: 1.0, factor: 0.95 },
];

/** 地面の硬さマッピング */
const GROUND_HARDNESS_BY_LIE: Record<LieType, number> = {
  bunker: 20,
  bareground: 35,
  rough: 45,
  semirough: 60,
  fairway: 75,
  tee: 78,
  green: 85,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 型定義
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimulationOptions {
  personalData?: ClubPersonalData;
  playerSkillLevel?: number;
  forceEffectiveSuccessRate?: number;
  shotPowerPercent?: number;
  headSpeed?: number;
  useTheoretical?: boolean;
  shotIndex?: number;
  seedNonce?: string;
  useStoredDistance?: boolean;
  aimXOffset?: number;
  isPractice?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// プレイヤースキル取得
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 個人データ（DB）からプレイヤースキルレベルを取得する非同期関数
 * @returns Promise<number> 0.0〜1.0（なければ0.5）
 */
export async function fetchPlayerSkillLevelFromPersonalData(): Promise<number> {
  try {
    const level = await ClubService.getPlayerSkillLevel();
    return typeof level === "number" ? level : 0.5;
  } catch {
    return 0.5;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 乱数・シード関連ユーティリティ
// ═══════════════════════════════════════════════════════════════════════════════

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 座標・ジオメトリ計算
// ═══════════════════════════════════════════════════════════════════════════════

/** 値を範囲内に制限 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 角度を0-360度に正規化 */
function normalizeDegrees(degrees: number): number {
  const normalized = Math.round(degrees) % 360;
  return (normalized + 360) % 360;
}

export function getAbsoluteLandingPoint(
  originX: number,
  originY: number,
  targetDistance: number,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const pinX = 0;
  const pinY = targetDistance;
  const toPinX = pinX - originX;
  const toPinY = pinY - originY;
  const toPinDistance = Math.hypot(toPinX, toPinY);
  const forward = toPinDistance > 1e-6
    ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
    : { x: 0, y: 1 };
  const right = { x: forward.y, y: -forward.x };

  return {
    x: originX + forward.x * localY + right.x * localX,
    y: originY + forward.y * localY + right.y * localX,
  };
}

export function projectAlongLineToPin(
  originX: number,
  originY: number,
  targetDistance: number,
  newRemainingDistance: number,
): { x: number; y: number } {
  const pinX = 0;
  const pinY = targetDistance;
  const toPinX = pinX - originX;
  const toPinY = pinY - originY;
  const totalDistance = Math.hypot(toPinX, toPinY);
  if (totalDistance < 1e-6) {
    return { x: originX, y: originY };
  }
  if (Math.abs(toPinY) < 1e-6) {
    return { x: originX, y: originY };
  }
  const desiredY = targetDistance - newRemainingDistance;
  const t = (desiredY - originY) / toPinY;

  return {
    x: originX + toPinX * t,
    y: originY + toPinY * t,
  };
}

function getHazardRectangleBounds(hazard: Hazard) {
  const halfWidth = hazard.width / 2;
  return {
    left: hazard.xCenter - halfWidth,
    right: hazard.xCenter + halfWidth,
    front: Math.min(hazard.yFront, hazard.yBack),
    back: Math.max(hazard.yFront, hazard.yBack),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ハザード関連計算
// ═══════════════════════════════════════════════════════════════════════════════

function calculateSegmentHazardBoundaryIntersection(
  hazard: Hazard,
  previousPoint: { x: number; y: number },
  entryPoint: { x: number; y: number },
): { x: number; y: number } | null {
  const bounds = getHazardRectangleBounds(hazard);
  const dx = entryPoint.x - previousPoint.x;
  const dy = entryPoint.y - previousPoint.y;
  const candidates: Array<{ t: number; x: number; y: number }> = [];

  if (Math.abs(dx) > 1e-6) {
    const txLeft = (bounds.left - previousPoint.x) / dx;
    const yAtLeft = previousPoint.y + dy * txLeft;
    if (txLeft >= 0 && txLeft <= 1 && yAtLeft >= bounds.front && yAtLeft <= bounds.back) {
      candidates.push({ t: txLeft, x: bounds.left, y: yAtLeft });
    }

    const txRight = (bounds.right - previousPoint.x) / dx;
    const yAtRight = previousPoint.y + dy * txRight;
    if (txRight >= 0 && txRight <= 1 && yAtRight >= bounds.front && yAtRight <= bounds.back) {
      candidates.push({ t: txRight, x: bounds.right, y: yAtRight });
    }
  }

  if (Math.abs(dy) > 1e-6) {
    const tyFront = (bounds.front - previousPoint.y) / dy;
    const xAtFront = previousPoint.x + dx * tyFront;
    if (tyFront >= 0 && tyFront <= 1 && xAtFront >= bounds.left && xAtFront <= bounds.right) {
      candidates.push({ t: tyFront, x: xAtFront, y: bounds.front });
    }

    const tyBack = (bounds.back - previousPoint.y) / dy;
    const xAtBack = previousPoint.x + dx * tyBack;
    if (tyBack >= 0 && tyBack <= 1 && xAtBack >= bounds.left && xAtBack <= bounds.right) {
      candidates.push({ t: tyBack, x: xAtBack, y: bounds.back });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.t - b.t);
  return { x: candidates[0].x, y: candidates[0].y };
}

function findWaterHazardEntryPoint(
  hazard: Hazard,
  trajectoryPoints: Array<{ x: number; y: number }>,
): { x: number; y: number } | null {
  let previousPoint = trajectoryPoints[0];
  if (checkLandingInHazard(previousPoint.x, previousPoint.y, [hazard])) {
    return previousPoint;
  }

  for (let i = 1; i < trajectoryPoints.length; i++) {
    const point = trajectoryPoints[i];
    if (checkLandingInHazard(point.x, point.y, [hazard])) {
      const intersection = calculateSegmentHazardBoundaryIntersection(hazard, previousPoint, point);
      return intersection ?? point;
    }
    previousPoint = point;
  }

  return null;
}

export function getWaterHazardDropOrigin(
  hazard: Hazard,
  absoluteLanding: { x: number; y: number },
  trajectoryPoints?: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  if (trajectoryPoints?.length) {
    const entryPoint = findWaterHazardEntryPoint(hazard, trajectoryPoints);
    if (entryPoint) {
      return entryPoint;
    }
  }

  const bounds = getHazardRectangleBounds(hazard);
  const entryX = absoluteLanding.x;
  const entryY = absoluteLanding.y;
  const frontDistance = entryY - bounds.front;
  const leftDistance = Math.abs(entryX - bounds.left);
  const rightDistance = Math.abs(entryX - bounds.right);

  if (frontDistance <= Math.min(leftDistance, rightDistance)) {
    const dropX = clamp(entryX, bounds.left, bounds.right);
    return {
      x: dropX,
      y: bounds.front,
    };
  }

  const dropY = clamp(entryY, bounds.front, bounds.back);
  if (leftDistance <= rightDistance) {
    return {
      x: bounds.left,
      y: dropY,
    };
  }

  return {
    x: bounds.right,
    y: dropY,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getLieDistanceMultiplier(lie: LieType, clubType: string): number {
  const baseMultiplier = LIE_DISTANCE_MULTIPLIERS[lie] ?? 0.95;
  // バンカーでウェッジの場合は別倍率
  if (lie === "bunker" && clubType === "Wedge") {
    return BUNKER_WEDGE_MULTIPLIER;
  }
  return baseMultiplier;
}

export function getLieDistanceMultiplierValue(lie: LieType, clubType: string): number {
  return getLieDistanceMultiplier(lie, clubType);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 風計算
// ═══════════════════════════════════════════════════════════════════════════════

// 風向(0=北へ, 180=南へ)から風の世界座標成分を返す。
// 本プロジェクトでは角度を「その方角へ吹く風」として扱う。
function getWindVector(strength: number, windDirectionDegrees: number): { x: number; y: number } {
  const normalized = normalizeDegrees(windDirectionDegrees);
  const rad = (normalized * Math.PI) / 180;
  return {
    x: Math.sin(rad) * strength,
    y: Math.cos(rad) * strength,
  };
}

// 風の世界座標成分をショットの進行方向に投影して、
// その方向に沿った向風/追い風成分と横風成分を得る。
function getWindComponentsRelativeToShotDirection(
  strength: number,
  windDirectionDegrees: number,
  originX: number,
  originY: number,
  targetDistance: number,
): { headTail: number; crossWind: number } {
  const wind = getWindVector(strength, windDirectionDegrees);
  const pinX = 0;
  const pinY = targetDistance;
  const toPinX = pinX - originX;
  const toPinY = pinY - originY;
  const toPinDistance = Math.hypot(toPinX, toPinY);
  const forward = toPinDistance > 1e-6
    ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
    : { x: 0, y: 1 };
  const right = { x: forward.y, y: -forward.x };
  return {
    headTail: forward.x * wind.x + forward.y * wind.y,
    crossWind: right.x * wind.x + right.y * wind.y,
  };
}

// 風向(0=北へ, 180=南へ)から「ショット進行方向成分」の mph を返す。
// 本プロジェクトでは角度を「その方角へ吹く風」として扱う。
function getHeadTailWindComponentMph(strength: number, windDirectionDegrees: number): number {
  const normalized = normalizeDegrees(windDirectionDegrees);
  const rad = (normalized * Math.PI) / 180;
  return Math.cos(rad) * strength;
}

function getWindYards(
  strength: number,
  windDirectionDegrees?: number,
): number {
  if (typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)) {
    const componentMph = getHeadTailWindComponentMph(strength, windDirectionDegrees);
    return componentMph < 0
      ? componentMph * HEAD_WIND_FACTOR
      : componentMph * TAIL_WIND_FACTOR;
  }
  return 0;
}


function isWeakClub(club: SimClub): boolean {
  return club.isWeakClub === true || club.successRate < WEAK_CLUB_THRESHOLD;
}

function clampSkillLevel(playerSkillLevel?: number): number {
  return Math.max(0, Math.min(1, playerSkillLevel ?? 0.5));
}

function getSkillDistanceMultiplier(playerSkillLevel?: number): number {
  const skillLevel = clampSkillLevel(playerSkillLevel);
  return SKILL_DISTANCE_RANGE.min + skillLevel * (SKILL_DISTANCE_RANGE.max - SKILL_DISTANCE_RANGE.min);
}

function resolveBaseDistanceWithTheoretical(
  club: SimClub,
  headSpeed: number | undefined,
  mode: "none" | "blend" | "theoretical",
): number {
  if (typeof headSpeed !== "number" || mode === "none") {
    return club.avgDistance;
  }

  const theoretical = estimateTheoreticalDistance(
    {
      clubType: club.type,
      name: club.name,
      number: club.number,
      loftAngle: club.loftAngle,
      distance: club.avgDistance,
    },
    headSpeed,
  );

  if (mode === "theoretical") {
    return theoretical;
  }

  return club.avgDistance * 0.7 + theoretical * 0.3;
}

/**
 * ヘッドスピードとロフト角のみで推定飛距離を計算（ライ・風は考慮しない）
 * @param club SimClub
 * @param headSpeed ヘッドスピード（m/s）
 * @param playerSkillLevel スキルレベル 0-1（オプション、デフォルト 0.5）
 * @param useTheoretical 理論値を使用するか（ロボット用、デフォルト false）
 * @returns 推定飛距離（ヤード）
 */
export function estimateBaseDistance(
  club: SimClub,
  headSpeed?: number,
  playerSkillLevel?: number,
  useTheoretical?: boolean,
): number {
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance * 10) / 10);

  const baseDistance = resolveBaseDistanceWithTheoretical(
    club,
    headSpeed,
    useTheoretical ? "theoretical" : "blend",
  );
  const skillDistanceMultiplier = getSkillDistanceMultiplier(playerSkillLevel);
  const result = baseDistance * skillDistanceMultiplier;

  return Math.max(5, Math.round(result * 10) / 10);
}

/**
 * ライ・風を考慮した飛距離推定（個人データ・ヘッドスピード・理論値も加味可能）
 * @param club SimClub
 * @param context lie, windStrength, windDirectionDegrees
 * @param options personalData, headSpeed, useTheoretical（理論値も加味する場合true）
 */
export function estimateShotDistance(
  club: SimClub,
  context: Pick<ShotContext, "lie" | "windStrength" | "windDirectionDegrees">,
  options?: {
    personalData?: ClubPersonalData;
    headSpeed?: number;
    playerSkillLevel?: number;
    useTheoretical?: boolean;
  }
): number {
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance * 10) / 10);

  const lieMultiplier = getLieDistanceMultiplier(context.lie, club.type);
  const windYards = getWindYards(context.windStrength ?? 7, context.windDirectionDegrees);
  const weakDistancePenaltyBase = isWeakClub(club)
    ? (club.successRate < VERY_WEAK_CLUB_THRESHOLD ? WEAK_DISTANCE_PENALTY.severe : WEAK_DISTANCE_PENALTY.normal)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * WEAK_CLUB_EFFECT_SCALE;

  const headSpeed = options?.headSpeed;
  const playerSkillLevel = clampSkillLevel(options?.playerSkillLevel);
  // ロボット（successRate=100, personalData未指定, useTheoretical=true, headSpeed指定）なら理論値のみ
  const isRobot =
    club.successRate === 100 &&
    !options?.personalData &&
    options?.useTheoretical &&
    typeof headSpeed === "number";
  const baseDistanceMode: "none" | "blend" | "theoretical" = isRobot
    ? "theoretical"
    : options?.useTheoretical
      ? "blend"
      : "none";
  const baseDistance = resolveBaseDistanceWithTheoretical(club, headSpeed, baseDistanceMode);

  // Skill level also affects expected distance slightly so UI estimates follow robot/person skill settings.
  const skillDistanceMultiplier = getSkillDistanceMultiplier(playerSkillLevel);
  let expected = baseDistance * lieMultiplier * weakDistanceMultiplier * skillDistanceMultiplier + windYards;

  return Math.max(5, Math.round(expected * 10) / 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 成功率・スキル計算
// ═══════════════════════════════════════════════════════════════════════════════

/** Effective success rate after personal data, lie, and risk adjustments. */
function getEffectiveSuccessRate(
  club: SimClub,
  lie: LieType,
  playerSkillLevel: number,
  personalData?: ClubPersonalData,
): number {
  const weakClub = isWeakClub(club);
  let rate = calculateBaseClubSuccessRate({
    baseSuccessRate: club.successRate,
    personalData,
    isWeakClub: weakClub,
    playerSkillLevel,
  });
  // ライによる成功率ペナルティ適用
  const liePenalty = LIE_SUCCESS_PENALTIES[lie];
  if (liePenalty) rate -= liePenalty;

  if (weakClub) {
    const weakPenaltyBase = club.successRate < VERY_WEAK_CLUB_THRESHOLD ? 16 : 14;
    rate -= weakPenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  }
  return clamp(rate, SUCCESS_RATE_BOUNDS.min, SUCCESS_RATE_BOUNDS.max);
}

function getNonPutterHoleOutChance(remainingDistance: number, shotQuality: ShotQuality): number {
  const chances =
    remainingDistance <= 20 ? HOLE_OUT_CHANCES.short
    : remainingDistance <= 40 ? HOLE_OUT_CHANCES.medium
    : remainingDistance <= 80 ? HOLE_OUT_CHANCES.long
    : HOLE_OUT_CHANCES.veryLong;

  return chances[shotQuality] ?? 0;
}

function getNearCupLeaveDistance(shotQuality: ShotQuality, random: () => number): number {
  const dist = NEAR_CUP_DISTANCES[shotQuality] ?? NEAR_CUP_DISTANCES.other;
  return dist.min + Math.floor(random() * dist.range);
}

function mapWindToLanding(
  windStrength: number,
  windDirectionDegrees: number | undefined,
  originX: number,
  originY: number,
  targetDistance: number,
): number {
  if (typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)) {
    const windComponents = getWindComponentsRelativeToShotDirection(
      windStrength,
      windDirectionDegrees,
      originX,
      originY,
      targetDistance,
    );
    return windComponents.headTail;
  }
  return 0;
}

function mapGroundHardnessByLie(lie: LieType): number {
  return GROUND_HARDNESS_BY_LIE[lie] ?? 60;
}

function getHazardRecoveryFactor(playerSkillLevel: number): number {
  const skill = clamp(playerSkillLevel, 0, 1);
  for (const { threshold, factor } of HAZARD_RECOVERY_FACTORS) {
    if (skill < threshold) return factor;
  }
  return 0.95;
}

function getEffectiveHazardDistanceMultiplier(
  hazard: Hazard | null,
  hazardRecoveryFactor: number,
): number {
  if (!hazard?.liePenalty) return 1;
  return Math.pow(hazard.liePenalty.distanceMultiplier, 1 - hazardRecoveryFactor);
}

function getEffectiveLieDistanceMultiplier(
  lie: LieType,
  clubType: string,
  skillLevel: { hazardRecoveryFactor: number },
  originX: number,
  originY: number,
  hazards: Hazard[],
): number {
  const base = getLieDistanceMultiplier(lie, clubType);
  const hazard = checkLandingInHazard(originX, originY, hazards);
  const effectivePenalty = getEffectiveHazardDistanceMultiplier(hazard, skillLevel.hazardRecoveryFactor);
  return base * effectivePenalty;
}

/**
 * クラブ成功率(15〜95)を 0〜1 のスキル寄与へ正規化する。
 * 分布モデルへ直接渡して、表示成功率と体感を近づける。
 */
function normalizeEffectiveRateToSkill(rate: number): number {
  const normalized = (rate - SUCCESS_RATE_BOUNDS.min) / (SUCCESS_RATE_BOUNDS.max - SUCCESS_RATE_BOUNDS.min);
  return clamp(normalized, 0, 1);
}

/**
 * 基本スキルとクラブ成功率を合成し、分布モデル用の実効スキルを作る。
 * lie/risk/個人データ補正を体感へ反映しやすいよう、クラブ成功率の重みを高く設定する。
 * @param playerSkillLevel 0-1の基本スキル
 * @param effectiveRate 15-95のクラブ成功率
 * @param baseWeight 基本スキルの重み（デフォルト: 0.35）
 * @param rateWeight クラブ成功率の重み（デフォルト: 0.65）
 */
export function composeEffectiveSkill(
  playerSkillLevel: number,
  effectiveRate: number
): number {
  const baseSkill = Math.max(0, Math.min(1, playerSkillLevel));
  const rateSkill = normalizeEffectiveRateToSkill(effectiveRate);
  const normalized = (baseSkill + rateSkill) / 2;
  return Math.max(0, Math.min(1, normalized));
}

// ═══════════════════════════════════════════════════════════════════════════════
// パットシミュレーション
// ═══════════════════════════════════════════════════════════════════════════════

function simulatePutt(
  remaining: number,
  playerSkillLevel: number = 0.5,
  random: () => number = Math.random,
): {
  made: boolean;
  newRemaining: number;
  message: string;
  effectiveSuccessRate: number;
} {

  if (remaining <= 1) {
    return {
      made: true,
      newRemaining: 0,
      message: `パットが決まりました！ (${remaining}y)`,
      effectiveSuccessRate: 100,
    };
  }

  // 距離ごとの基礎成功率を取得
  let baseChance = 0.03; // デフォルト: 30ヤード超
  for (const { maxDist, chance } of PUTT_BASE_CHANCES) {
    if (remaining <= maxDist) {
      baseChance = chance;
      break;
    }
  }

  // スキルレベルを反映（最低50%保証）
  const minSkillMultiplier = 0.5;
  let makeChance = baseChance * (minSkillMultiplier + (1 - minSkillMultiplier) * playerSkillLevel);
  makeChance = Math.min(0.98, makeChance);

  if (random() < makeChance) {
    return {
      made: true,
      newRemaining: 0,
      message: `パットが決まりました！ (${remaining}y)`,
      effectiveSuccessRate: Math.round(makeChance * 100),
    };
  }

  // Miss – how much distance remains?
  let leftOver: number;
  if (remaining <= 30) {
    // Normal putt: leave a short tap-in
    leftOver = Math.max(1, Math.round(remaining * (0.05 + random() * 0.12)));
  } else {
    // Very long putt from off-green: ball advances somewhat
    const advanced = Math.round(20 + random() * 15);
    leftOver = Math.max(1, remaining - advanced);
  }

  return {
    made: false,
    newRemaining: leftOver,
    message: `パット外れ… 残り ${leftOver}y`,
    effectiveSuccessRate: Math.round(makeChance * 100),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// シミュレーションシード・コンテキスト構築
// ═══════════════════════════════════════════════════════════════════════════════

interface SimulationContext {
  seed: string;
  random: () => number;
  playerSkillLevel: number;
  adjustedPlayerSkillLevel: number;
  shotPowerPercent: number;
  powerMultiplier: number;
  effectiveRate: number;
  effectiveSkill: number;
}

function buildSimulationContext(
  club: SimClub,
  context: ShotContext,
  options: SimulationOptions,
): SimulationContext {
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  const shotPowerPercent = clamp(options.shotPowerPercent ?? 100, 0, MAX_SHOT_POWER_PERCENT);
  const powerMultiplier = shotPowerPercent / 100;

  // パワーペナルティ計算（100%超過でスキル低下）
  const powerPenalty = (club.type !== "Putter" && shotPowerPercent > 100)
    ? (shotPowerPercent - 100) * POWER_PENALTY_PER_PERCENT
    : 0;
  const adjustedPlayerSkillLevel = Math.max(0, playerSkillLevel - powerPenalty);

  const simulationSeedBase = [
    club.id,
    club.avgDistance,
    context.remainingDistance,
    context.lie,
    context.windStrength ?? 7,
    typeof context.windDirectionDegrees === "number"
      ? normalizeDegrees(context.windDirectionDegrees)
      : "legacy",
    playerSkillLevel,
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
  ].join("|");

  const random = createSeededRandom(simulationSeedBase);

  // 有効成功率の計算
  const forcedEffectiveRate = options.forceEffectiveSuccessRate;
  const effectiveRate = typeof forcedEffectiveRate === "number"
    ? clamp(Math.round(forcedEffectiveRate), 0, 100)
    : getEffectiveSuccessRate(club, context.lie, adjustedPlayerSkillLevel, options.personalData);

  const effectiveSkill = composeEffectiveSkill(adjustedPlayerSkillLevel, effectiveRate);

  return {
    seed: simulationSeedBase,
    random,
    playerSkillLevel,
    adjustedPlayerSkillLevel,
    shotPowerPercent,
    powerMultiplier,
    effectiveRate,
    effectiveSkill,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// メインシミュレーション関数
// ═══════════════════════════════════════════════════════════════════════════════

export function simulateShot(
  club: SimClub,
  context: ShotContext,
  options: SimulationOptions & { isPractice?: boolean } = {},
): ShotResult {
  const {
    remainingDistance,
    lie,
    windStrength = 7,
    windDirectionDegrees,
    greenRadius = DEFAULT_GREEN_RADIUS,
    hazards = [],
  } = context;

  // シミュレーションコンテキスト構築
  const simContext = buildSimulationContext(club, context, options);
  const {
    random,
    playerSkillLevel,
    adjustedPlayerSkillLevel,
    powerMultiplier,
    effectiveRate,
    effectiveSkill,
  } = simContext;

  // ── Putter path ────────────────────────────────────────────────────────────
  if (club.type === "Putter") {
    const putt = simulatePutt(remainingDistance, playerSkillLevel, random);
    const puttDistance = Math.max(0, remainingDistance - putt.newRemaining);
    return {
      newRemainingDistance: putt.newRemaining,
      outcomeMessage: putt.message,
      strokesAdded: 1,
      lie: "green",
      penalty: false,
      distanceHit: puttDistance,
      shotQuality: putt.made ? "good" : "poor",
      wasSuccessful: putt.made || putt.newRemaining <= 3,
      effectiveSuccessRate: putt.effectiveSuccessRate,
      landing: {
        carry: puttDistance,
        roll: 0,
        totalDistance: puttDistance,
        lateralDeviation: 0,
        finalX: 0,
        finalY: puttDistance,
        apexHeight: 0,
        trajectoryPoints: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: puttDistance, z: 0 },
        ],
      },
      finalOutcome: "green",
      penaltyStrokes: 0,
    };
  }

  // ── Landing calculation ────────────────────────────────────────────────────
  const landingSeed = [
    club.id,
    remainingDistance,
    effectiveRate,
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    adjustedPlayerSkillLevel,
    effectiveSkill,
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
  ].join("|");

  const landingOutcome = calculateLandingOutcome({
    club: {
      clubType: club.type,
      name: club.name,
      number: club.number,
      length: 0,
      weight: 0,
      swingWeight: "D0",
      lieAngle: 0,
      loftAngle: club.loftAngle ?? 30,
      shaftType: "",
      torque: 0,
      flex: "S",
      distance: club.avgDistance,
      notes: "",
    },
    skillLevel: {
      dispersion: 1 - effectiveSkill,
      mishitRate: 1 - effectiveSkill,
      sideSpinDispersion: 1 - effectiveSkill,
      hazardRecoveryFactor: getHazardRecoveryFactor(effectiveSkill),
    },
    aimXOffset: options.aimXOffset ?? 0,
    conditions: {
      wind: mapWindToLanding(
        windStrength,
        windDirectionDegrees,
        context.originX,
        context.originY,
        context.targetDistance,
      ),
      // 初期着地は medium 相当で計算し、硬さ差分は後段 applyGroundCondition で反映する。
      groundHardness: 75,
      headSpeed: options.headSpeed,
      seed: landingSeed,
      baseDistanceOverride: options.useStoredDistance && club.avgDistance > 0 ? club.avgDistance : undefined,
    },
  });

  const shotQuality = landingOutcome.shotQuality;
  const rawLanding = landingOutcome.landing;
  const groundHardnessValue = context.groundHardness ?? mapGroundHardnessByLie(lie);
  const groundCondition: GroundCondition = {
    hardness: groundHardnessValue >= 85 ? "firm" : groundHardnessValue <= 65 ? "soft" : "medium",
    slopeAngle: context.groundSlopeAngle ?? 0,
    slopeDirection: context.groundSlopeDirection ?? 0,
  };
  const adjustedLanding = applyGroundCondition(
    rawLanding,
    groundCondition,
    {
      clubType: club.type,
      name: club.name,
      number: club.number,
      length: 0,
      weight: 0,
      swingWeight: "D0",
      lieAngle: 0,
      loftAngle: club.loftAngle ?? 30,
      shaftType: "",
      torque: 0,
      flex: "S",
      distance: club.avgDistance,
      notes: "",
    },
    {
      dispersion: 1 - effectiveSkill,
      mishitRate: 1 - effectiveSkill,
      sideSpinDispersion: 1 - effectiveSkill,
      hazardRecoveryFactor: getHazardRecoveryFactor(effectiveSkill),
    },
  );

  // 360度風向がある場合は横風成分を着弾Xへ加算する。
  // 係数は現行モデルと同様に簡易線形として、調整しやすい形で定義する。
  const windComponents =
    typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)
      ? getWindComponentsRelativeToShotDirection(
          windStrength,
          windDirectionDegrees,
          context.originX,
          context.originY,
          context.targetDistance,
        )
      : { headTail: 0, crossWind: 0 };
  const lateralWindYards = windComponents.crossWind * CROSS_WIND_FACTOR;

  const lieDistanceMultiplier = getEffectiveLieDistanceMultiplier(
    lie,
    club.type,
    {
      hazardRecoveryFactor: getHazardRecoveryFactor(effectiveSkill),
    },
    context.originX,
    context.originY,
    hazards,
  );
  const weakDistancePenaltyBase = isWeakClub(club)
    ? (club.successRate < VERY_WEAK_CLUB_THRESHOLD ? WEAK_DISTANCE_PENALTY.severe : WEAK_DISTANCE_PENALTY.normal)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  const distanceConditionMultiplier = lieDistanceMultiplier * weakDistanceMultiplier;

  const scaledCarry = Math.max(0.1, adjustedLanding.carry * powerMultiplier * distanceConditionMultiplier);
  const scaledRoll = Math.max(0.1, adjustedLanding.roll * powerMultiplier * distanceConditionMultiplier);
  const scaledTotalDistanceBase = Math.max(0.1, scaledCarry + scaledRoll);

  // 風の影響を適用（headTail風）
  const headTailWindMph = windComponents.headTail;
  const headTailWindYards = headTailWindMph < 0
    ? headTailWindMph * HEAD_WIND_FACTOR * WIND_MPH_TO_YARDS
    : headTailWindMph * TAIL_WIND_FACTOR * WIND_MPH_TO_YARDS;
  // ショートショットでは風の影響を減らす
  const distanceFactor = Math.min(1, scaledTotalDistanceBase / SHORT_SHOT_WIND_THRESHOLD);
  const adjustedHeadTailWindYards = headTailWindYards * distanceFactor;
  const scaledTotalDistance = scaledTotalDistanceBase + adjustedHeadTailWindYards;

  const scaledFinalX = adjustedLanding.finalX * powerMultiplier + lateralWindYards;
  const scaledFinalY = scaledTotalDistance;
  const scaledLateralDeviation = adjustedLanding.lateralDeviation * powerMultiplier + lateralWindYards;
  const landing = {
    ...adjustedLanding,
    carry: Math.round(scaledCarry * 10) / 10,
    roll: Math.round(scaledRoll * 10) / 10,
    totalDistance: Math.round(scaledTotalDistance * 10) / 10,
    lateralDeviation: Math.round(scaledLateralDeviation * 10) / 10,
    finalX: Math.round(scaledFinalX * 10) / 10,
    finalY: Math.round(scaledFinalY * 10) / 10,
    trajectoryPoints: adjustedLanding.trajectoryPoints?.map((point) => ({
      // 横風ドリフトは飛行進行に応じて徐々に効くよう、Y進捗比で配分する。
      x: Math.round((point.x * powerMultiplier + lateralWindYards * (Math.max(0, point.y) / Math.max(1, adjustedLanding.finalY))) * 10) / 10,
      y: Math.round(point.y * powerMultiplier * distanceConditionMultiplier * 10) / 10,
      z: Math.round((point.z ?? 0) * powerMultiplier * 10) / 10,
    })),
  };
  const actualDistance = Math.round(Math.max(5, landing.totalDistance));

  // 結果先行モデルでは品質から成功判定を導く。
  const isGoodShot = shotQuality === "excellent" || shotQuality === "good" || shotQuality === "average";

  // ── New remaining ──────────────────────────────────────────────────────────
  // New model: use landing X/Y to compute the geometric distance to the pin.
  // Pin is at (0, remainingDistance) in the shot coordinate system.
  let newRemaining: number;
  const absoluteLanding = getAbsoluteLandingPoint(
    context.originX,
    context.originY,
    context.targetDistance,
    landing.finalX,
    landing.finalY,
  );
  const absoluteTrajectoryPoints = landing.trajectoryPoints?.map((point) =>
    getAbsoluteLandingPoint(context.originX, context.originY, context.targetDistance, point.x, point.y),
  );
  const assessment = assessLanding(
    absoluteLanding.x,
    absoluteLanding.y,
    context.targetDistance,
    hazards,
    greenRadius,
    context.greenPolygon,
    absoluteTrajectoryPoints,
  );
  let { geometricRemainingDistance: geometricRemaining, hazard: landedHazard, isOnGreen } = assessment;
  newRemaining = geometricRemaining;

  // Non-putter hole-outs are intentionally rare.
  if (newRemaining === 0 && !landedHazard) {
    const holeOutChance = getNonPutterHoleOutChance(remainingDistance, shotQuality);
    const holedOut = random() < holeOutChance;
    if (!holedOut) {
      newRemaining = getNearCupLeaveDistance(shotQuality, random);
    }
  }

  const penaltyStrokes = determinePenaltyStrokes(landedHazard);
  const penalty = penaltyStrokes > 0;

  let newLie: LieType;
  let finalOutcome: ShotResult["finalOutcome"];
  let penaltyDropOrigin: { x: number; y: number } | undefined;

  if (landedHazard?.type === "water") {
    const relief = resolvePenaltyRelief("water", lie, remainingDistance, newRemaining, landedHazard.penaltyStrokes ?? 3);
    penaltyDropOrigin = getWaterHazardDropOrigin(landedHazard, absoluteLanding, absoluteTrajectoryPoints);
    newRemaining = Math.round(distanceToPinFromLanding(context.targetDistance, penaltyDropOrigin.x, penaltyDropOrigin.y));
    newLie = relief.newLie;
    finalOutcome = "water";
  } else if (landedHazard?.type === "ob") {
    const relief = resolvePenaltyRelief("ob", lie, remainingDistance, newRemaining, landedHazard.penaltyStrokes ?? 3);
    newRemaining = relief.newRemaining;
    newLie = relief.newLie;
    finalOutcome = "ob";
  } else if (landedHazard?.type === "bunker") {
    newLie = "bunker";
    finalOutcome = "bunker";
  } else if (landedHazard?.type === "rough") {
    newLie = "rough";
    finalOutcome = "rough";
  } else if (landedHazard?.type === "semirough") {
    newLie = "semirough";
    finalOutcome = "rough";
  } else if (landedHazard?.type === "bareground") {
    newLie = "bareground";
    finalOutcome = "rough";
  } else if (isOnGreen || newRemaining === 0) {
    newLie = "green";
    finalOutcome = "green";
  } else {
    newLie = "fairway";
    finalOutcome = "fairway";
  }

  // ── Message ────────────────────────────────────────────────────────────────
  const clubLabel = `${club.name}${club.number ? " " + club.number : ""}`;
  const nextShotAdvice = buildNextShotAdvice(finalOutcome, newLie);
  const message = buildDetailedShotMessage({
    qualityLabel: QUALITY_LABELS[shotQuality],
    clubLabel,
    actualDistance,
    finalOutcome,
    newRemainingDistance: newRemaining,
    lieLabel: LIE_LABELS[newLie],
    hazard: landedHazard,
    penaltyStrokes,
  });

  return {
    newRemainingDistance: newRemaining,
    outcomeMessage: message,
    nextShotAdvice,
    strokesAdded: 1 + penaltyStrokes,
    lie: newLie,
    penalty,
    distanceHit: actualDistance,
    shotQuality,
    wasSuccessful: landedHazard ? false : isGoodShot,
    effectiveSuccessRate: effectiveRate,
    landing,
    finalOutcome,
    penaltyStrokes,
    penaltyDropOrigin,
    origin: { x: context.originX, y: context.originY },
  };
}

/**
 * 実測データモード用のショットシミュレーション
 * 実測データからランダムに1つのショットを選択し、その結果を返す
 */
export function simulateShotFromActualData(
  club: SimClub,
  context: ShotContext,
  actualShotRows: Array<Record<string, string>>,
  options: SimulationOptions = {},
): ShotResult {
  const {
    remainingDistance,
    lie,
    windStrength = 0,
    windDirectionDegrees,
    greenRadius = DEFAULT_GREEN_RADIUS,
    hazards = [],
  } = context;
  
  const shotPowerPercent = Math.max(0, Math.min(110, options.shotPowerPercent ?? 100));
  const powerMultiplier = shotPowerPercent / 100;
  
  // クラブの実測データを取得
  const clubLabel = formatSimClubLabel(club);
  let clubShots = actualShotRows.filter((row) => row.club === clubLabel);

  if (clubShots.length === 0) {
    // 実測データがない場合は通常のシミュレーションにフォールバック
    return simulateShot(club, context, options);
  }

  // ラフに入っている場合、excellent品質のデータを除外
  if (lie === "rough") {
    const parseShotValue = (value: string): number | null => {
      const withoutDirection = value.replace(/[RL]/gi, '').trim();
      const normalized = withoutDirection.replace(/,/g, '').replace(/ /g, '').trim();
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const nonExcellentShots = clubShots.filter((shot) => {
      const carry = parseShotValue(shot['Carry (yds)']);
      const lateral = parseShotValue(shot['Lateral (yds)']);
      if (carry === null) return true; // パースできない場合は除外しない
      const qualityResult = classifyShotQualityByTargetError(carry, carry, lateral ?? 0);
      return qualityResult.quality !== "excellent";
    });

    // 除外後のデータがある場合はそれを使用、ない場合は全データを使用
    if (nonExcellentShots.length > 0) {
      clubShots = nonExcellentShots;
    }
  }

  // シードベースの乱数生成器を作成（ゲームごとに異なるショットを選択するため）
  const shotSelectionSeedBase = [
    club.id,
    club.avgDistance,
    remainingDistance,
    lie,
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
    "shot-selection",
  ].join("|");
  const shotSelectionRng = createSeededRandom(shotSelectionSeedBase);

  // ランダムに1つのショットを選択（シードベースの乱数を使用）
  const randomIndex = Math.floor(shotSelectionRng() * clubShots.length);
  const selectedShot = clubShots[randomIndex];
  
  // 実測データから数値をパース
  const parseShotValue = (value: string, fieldName: string): number | null => {
    // 方向指示子（R/L）を削除
    const withoutDirection = value.replace(/[RL]/gi, '').trim();
    const normalized = withoutDirection.replace(/,/g, '').replace(/ /g, '').trim();
    const numeric = Number(normalized);
    const result = Number.isFinite(numeric) ? numeric : null;
    if (result === null) {
      console.warn(`[simulateShotFromActualData] Failed to parse ${fieldName}: "${value}"`);
    }
    return result;
  };
  
  const carry = parseShotValue(selectedShot['Carry (yds)'], 'Carry (yds)') ?? club.avgDistance;
  const total = parseShotValue(selectedShot['Total (yds)'], 'Total (yds)') ?? carry;
  const roll = total - carry;
  const lateral = parseShotValue(selectedShot['Lateral (yds)'], 'Lateral (yds)') ?? 0;

  // 実測データの生の値で品質を評価（ライ補正前の値を使用）
  // ラフに入った後のショットでも、実測データの本来の品質を評価する
  const qualityResult = classifyShotQualityByTargetError(
    carry,
    carry,
    lateral
  );
  const shotQuality = qualityResult.quality;

  // パワーとライを適用
  const lieMultiplier = getLieDistanceMultiplier(lie, club.type);
  const weakDistancePenalty = isWeakClub(club)
    ? (club.successRate < VERY_WEAK_CLUB_THRESHOLD ? WEAK_DISTANCE_PENALTY.severe : WEAK_DISTANCE_PENALTY.normal)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenalty * WEAK_CLUB_EFFECT_SCALE;

  const adjustedCarry = Math.max(0.1, carry * powerMultiplier * lieMultiplier * weakDistanceMultiplier);
  const adjustedRoll = Math.max(0, roll * powerMultiplier * lieMultiplier * weakDistanceMultiplier);
  const adjustedTotal = adjustedCarry + adjustedRoll;
  
  // 風の影響を適用
  const windYards = getWindYards(windStrength, windDirectionDegrees);
  // ショートショットでは風の影響を減らす
  const distanceFactor = Math.min(1, adjustedTotal / SHORT_SHOT_WIND_THRESHOLD);
  const adjustedWindYards = windYards * distanceFactor;
  const finalTotalDistance = adjustedTotal + adjustedWindYards;
  
  // 横風の影響を計算（通常のシミュレーションと同様）
  const windComponents =
    typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)
      ? getWindComponentsRelativeToShotDirection(
          windStrength,
          windDirectionDegrees,
          context.originX,
          context.originY,
          context.targetDistance,
        )
      : { headTail: 0, crossWind: 0 };
  const lateralWindYards = windComponents.crossWind * CROSS_WIND_FACTOR;
  
  // 通常のシミュレーションと同様の補正を適用
  // landingPosition.ts の applyGroundCondition と同様のロジック
  const lateralDeviation = lateral * powerMultiplier;
  const dispersionMultiplier = 1.0; // 実測データなので分散補正は不要（固定値）
  const adjustedLateralDeviation = lateralDeviation * dispersionMultiplier;
  
  // 傾斜によるシフトを計算（landingPosition.ts と同様）
  const groundHardnessValue = context.groundHardness ?? mapGroundHardnessByLie(lie);
  const groundCondition: GroundCondition = {
    hardness: groundHardnessValue >= 85 ? "firm" : groundHardnessValue <= 65 ? "soft" : "medium",
    slopeAngle: context.groundSlopeAngle ?? 0,
    slopeDirection: context.groundSlopeDirection ?? 0,
  };
  
  // 傾斜シフトの計算
  const slopeAngle = groundCondition.slopeAngle;
  const slopeDirection = groundCondition.slopeDirection;
  const normalizedSlopeDirection = normalizeDegrees(slopeDirection);
  const slopeRad = (normalizedSlopeDirection * Math.PI) / 180;
  const crossSlopeComponent = Math.abs(Math.sin(slopeRad)); // 横傾斜成分
  const slopeStrength = slopeAngle;
  
  // ランダムシードベースの乱数生成
  const simulationSeedBase = [
    club.id,
    club.avgDistance,
    remainingDistance,
    lie,
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
  ].join("|");
  const rng = createSeededRandom(simulationSeedBase);
  
  // 横傾斜は常に「高い側から低い側」へ流れるよう、符号は方向からのみ決める
  const slopeShiftMagnitude = Math.abs(
    sampleTruncatedNormal(rng, slopeStrength * (0.2 + Math.abs(crossSlopeComponent) * 0.25), 1.0),
  );
  const slopeShift = slopeShiftMagnitude * -2 * crossSlopeComponent;
  
  // finalX を計算（landingPosition.ts と同様のロジック）
  const baseFinalX = lateral;
  const aimOffset = options.aimXOffset ?? 0;
  const finalXWithoutWind = baseFinalX + aimOffset + (adjustedLateralDeviation - lateralDeviation) + slopeShift;
  const finalX = finalXWithoutWind + lateralWindYards;
  
  // 着地位置を計算
  const landing = {
    carry: Math.round(adjustedCarry * 10) / 10,
    roll: Math.round(adjustedRoll * 10) / 10,
    totalDistance: Math.round(finalTotalDistance * 10) / 10,
    lateralDeviation: Math.round(lateralDeviation * 10) / 10,
    finalX: Math.round(finalX * 10) / 10,
    finalY: Math.round(finalTotalDistance * 10) / 10,
    trajectoryPoints: [
      { x: 0, y: 0, z: 0 },
      { x: finalXWithoutWind, y: finalTotalDistance, z: 0 },
    ],
  };
  
  // trajectoryPointsの横風ドリフトを補正（通常のシミュレーションと同様）
  if (landing.trajectoryPoints && landing.trajectoryPoints.length > 0) {
    landing.trajectoryPoints = landing.trajectoryPoints.map((point) => ({
      x: Math.round((point.x + lateralWindYards * (Math.max(0, point.y) / Math.max(1, finalTotalDistance))) * 10) / 10,
      y: point.y,
      z: point.z ?? 0,
    }));
  }
  
  // 絶対座標での着地位置
  const absoluteLanding = getAbsoluteLandingPoint(
    context.originX,
    context.originY,
    context.targetDistance,
    landing.finalX,
    landing.finalY,
  );
  
  // 着地判定
  const assessment = assessLanding(
    absoluteLanding.x,
    absoluteLanding.y,
    context.targetDistance,
    hazards,
    greenRadius,
    context.greenPolygon,
    landing.trajectoryPoints?.map((point) =>
      getAbsoluteLandingPoint(context.originX, context.originY, context.targetDistance, point.x, point.y),
    ),
  );
  
  let { geometricRemainingDistance: geometricRemaining, hazard: landedHazard, isOnGreen } = assessment;
  let newRemaining = geometricRemaining;
  
  // ホールアウト判定
  if (newRemaining === 0 && !landedHazard) {
    const holeOutChance = getNonPutterHoleOutChance(remainingDistance, "average");
    const holedOut = Math.random() < holeOutChance;
    if (!holedOut) {
      newRemaining = 1 + Math.floor(Math.random() * 3);
    }
  }
  
  // ペナルティ判定
  const penaltyStrokes = determinePenaltyStrokes(landedHazard);
  const penalty = penaltyStrokes > 0;
  
  let newLie: LieType;
  let finalOutcome: ShotResult["finalOutcome"];
  let penaltyDropOrigin: { x: number; y: number } | undefined;
  
  if (landedHazard?.type === "water") {
    const relief = resolvePenaltyRelief("water", lie, remainingDistance, newRemaining, landedHazard.penaltyStrokes ?? 3);
    penaltyDropOrigin = getWaterHazardDropOrigin(landedHazard, absoluteLanding, landing.trajectoryPoints?.map((point) =>
      getAbsoluteLandingPoint(context.originX, context.originY, context.targetDistance, point.x, point.y),
    ));
    newRemaining = Math.round(distanceToPinFromLanding(context.targetDistance, penaltyDropOrigin.x, penaltyDropOrigin.y));
    newLie = relief.newLie;
    finalOutcome = "water";
  } else if (landedHazard?.type === "ob") {
    const relief = resolvePenaltyRelief("ob", lie, remainingDistance, newRemaining, landedHazard.penaltyStrokes ?? 3);
    newRemaining = relief.newRemaining;
    newLie = relief.newLie;
    finalOutcome = "ob";
  } else if (landedHazard?.type === "bunker") {
    newLie = "bunker";
    finalOutcome = "bunker";
  } else if (landedHazard?.type === "rough") {
    newLie = "rough";
    finalOutcome = "rough";
  } else if (landedHazard?.type === "semirough") {
    newLie = "semirough";
    finalOutcome = "rough";
  } else if (landedHazard?.type === "bareground") {
    newLie = "bareground";
    finalOutcome = "rough";
  } else if (isOnGreen || newRemaining === 0) {
    newLie = "green";
    finalOutcome = "green";
  } else {
    newLie = "fairway";
    finalOutcome = "fairway";
  }
  
  // メッセージ構築
  const clubDisplayName = `${club.name}${club.number ? " " + club.number : ""}`;
  const nextShotAdvice = buildNextShotAdvice(finalOutcome, newLie);
  const message = buildDetailedShotMessage({
    qualityLabel: "実測データ",
    clubLabel: clubDisplayName,
    actualDistance: Math.round(finalTotalDistance),
    finalOutcome,
    newRemainingDistance: newRemaining,
    lieLabel: LIE_LABELS[newLie],
    hazard: landedHazard,
    penaltyStrokes,
  });
  
  return {
    newRemainingDistance: newRemaining,
    outcomeMessage: message,
    nextShotAdvice,
    strokesAdded: 1 + penaltyStrokes,
    lie: newLie,
    penalty,
    distanceHit: Math.round(finalTotalDistance),
    shotQuality,
    wasSuccessful: landedHazard ? false : true,
    effectiveSuccessRate: 100,
    landing,
    finalOutcome,
    penaltyStrokes,
    penaltyDropOrigin,
    origin: { x: context.originX, y: context.originY },
  };
}

export function estimateEffectiveSuccessRate(
  club: SimClub,
  context: Pick<ShotContext, "lie">,
  options: Pick<SimulationOptions, "personalData" | "playerSkillLevel"> = {},
): number {
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  return getEffectiveSuccessRate(
    club,
    context.lie,
    playerSkillLevel,
    options.personalData,
  );
}
