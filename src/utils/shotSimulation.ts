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
import { calculateLandingOutcome, applyGroundCondition } from "./landingPosition";
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

interface SimulationOptions {
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
}

const WEAK_CLUB_EFFECT_SCALE = 0.5;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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
  switch (lie) {
    case "tee":        return 1.00;
    case "fairway":    return 0.98;
    case "semirough":  return 0.90;
    case "rough":      return 0.82;
    case "bareground": return 0.60;
    case "bunker":     return clubType === "Wedge" ? 0.70 : 0.50;
    case "green":      return 1.00; // putter path handles this separately
    default:           return 0.95;
  }
}

export function getLieDistanceMultiplierValue(lie: LieType, clubType: string): number {
  return getLieDistanceMultiplier(lie, clubType);
}

function normalizeDegrees(degrees: number): number {
  const normalized = Math.round(degrees) % 360;
  return (normalized + 360) % 360;
}

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
    return componentMph < 0 ? componentMph * 1.5 : componentMph * 0.8;
  }
  return 0;
}


function isWeakClub(club: SimClub): boolean {
  return club.isWeakClub === true || club.successRate < 65;
}

function clampSkillLevel(playerSkillLevel?: number): number {
  return Math.max(0, Math.min(1, playerSkillLevel ?? 0.5));
}

function getSkillDistanceMultiplier(playerSkillLevel?: number): number {
  const skillLevel = clampSkillLevel(playerSkillLevel);
  return 0.92 + skillLevel * 0.16;
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
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance));

  const baseDistance = resolveBaseDistanceWithTheoretical(
    club,
    headSpeed,
    useTheoretical ? "theoretical" : "blend",
  );
  const skillDistanceMultiplier = getSkillDistanceMultiplier(playerSkillLevel);
  const result = baseDistance * skillDistanceMultiplier;

  return Math.max(5, Math.round(result));
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
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance));

  const lieMultiplier = getLieDistanceMultiplier(context.lie, club.type);
  const windYards = getWindYards(context.windStrength ?? 7, context.windDirectionDegrees);
  const weakDistancePenaltyBase = isWeakClub(club)
    ? (club.successRate < 60 ? 0.14 : 0.10)
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

  return Math.max(5, Math.round(expected));
}

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
  if (lie === "semirough") rate -= 8;
  if (lie === "rough")     rate -= 12;
  if (lie === "bareground") rate -= 18;
  if (lie === "bunker")    rate -= 20;
  if (weakClub) {
    const weakPenaltyBase = club.successRate < 60 ? 16 : 14;
    rate -= weakPenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  }
  return Math.max(15, Math.min(95, rate));
}

function getNonPutterHoleOutChance(remainingDistance: number, shotQuality: ShotQuality): number {
  if (remainingDistance <= 20) {
    if (shotQuality === "excellent") return 0.08;
    if (shotQuality === "good") return 0.03;
    if (shotQuality === "average") return 0.01;
    return 0;
  }

  if (remainingDistance <= 40) {
    if (shotQuality === "excellent") return 0.03;
    if (shotQuality === "good") return 0.01;
    if (shotQuality === "average") return 0.005;
    return 0;
  }

  if (remainingDistance <= 80) {
    if (shotQuality === "excellent") return 0.01;
    if (shotQuality === "good") return 0.004;
    if (shotQuality === "average") return 0.002;
    return 0;
  }

  return shotQuality === "excellent" ? 0.001 : 0;
}

function getNearCupLeaveDistance(shotQuality: ShotQuality, random: () => number): number {
  if (shotQuality === "excellent") return 1 + Math.floor(random() * 2); // 1-2y
  if (shotQuality === "good") return 1 + Math.floor(random() * 4); // 1-4y
  if (shotQuality === "average") return 2 + Math.floor(random() * 5); // 2-6y
  return 3 + Math.floor(random() * 6); // 3-8y
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
  if (lie === "bunker") return 20;
  if (lie === "bareground") return 35;
  if (lie === "semirough") return 60;
  if (lie === "rough") return 45;
  if (lie === "fairway") return 75;
  if (lie === "tee") return 78;
  if (lie === "green") return 85;
  return 60;
}

function getHazardRecoveryFactor(playerSkillLevel: number): number {
  const skill = Math.max(0, Math.min(1, playerSkillLevel));
  if (skill < 0.35) return 0.4;
  if (skill < 0.65) return 0.7;
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
  const normalized = (rate - 15) / 80;
  return Math.max(0, Math.min(1, normalized));
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

export const LIE_LABELS: Record<LieType, string> = {
  tee: "ティー", fairway: "フェアウェイ", semirough: "セミラフ", rough: "ラフ",
  bareground: "ベアグラウンド", bunker: "バンカー", green: "グリーン",
};

const QUALITY_LABELS: Record<ShotQuality, string> = {
  excellent: "会心の一打！",
  good:      "ナイスショット！",
  average:   "まずまず",
  poor:      "ミス気味...",
  mishit:    "ミスショット",
};

// ─── Putting ──────────────────────────────────────────────────────────────────

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

  // 距離ごとの基礎成功率
  let baseChance: number;
  if      (remaining <=  3) baseChance = 0.96;
  else if (remaining <=  5) baseChance = 0.77;
  else if (remaining <=  8) baseChance = 0.50;
  else if (remaining <= 10) baseChance = 0.40;
  else if (remaining <= 15) baseChance = 0.23;
  else if (remaining <= 20) baseChance = 0.15;
  else if (remaining <= 30) baseChance = 0.07;
  else                      baseChance = 0.03;

  // スキルレベルを反映（最低50%保証）
  let makeChance = baseChance * (0.5 + 0.5 * playerSkillLevel);
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

// ─── Main export ──────────────────────────────────────────────────────────────

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
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  const shotPowerPercent = Math.max(0, Math.min(110, options.shotPowerPercent ?? 100));
  const powerMultiplier = shotPowerPercent / 100;
  const { personalData } = options;
  const simulationSeedBase = [
    club.id,
    club.avgDistance,
    remainingDistance,
    lie,
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    playerSkillLevel,
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
  ].join("|");
  const random = createSeededRandom(simulationSeedBase);

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

  // ── Success/quality roll ────────────────────────────────────────────────────
  const forcedEffectiveRate = options.forceEffectiveSuccessRate;
  const effectiveRate = typeof forcedEffectiveRate === "number"
    ? Math.max(0, Math.min(100, Math.round(forcedEffectiveRate)))
    : getEffectiveSuccessRate(
        club,
        lie,
        playerSkillLevel,
        personalData,
      );
  const effectiveSkill = composeEffectiveSkill(
    playerSkillLevel,
    effectiveRate
  );
  const landingSeed = [
    club.id,
    remainingDistance,
    effectiveRate,
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    playerSkillLevel,
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
  const lateralWindYards = windComponents.crossWind * 0.9;

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
    ? (club.successRate < 60 ? 0.14 : 0.10)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  const distanceConditionMultiplier = lieDistanceMultiplier * weakDistanceMultiplier;

  const scaledCarry = Math.max(0.1, adjustedLanding.carry * powerMultiplier * distanceConditionMultiplier);
  const scaledRoll = Math.max(0, adjustedLanding.roll * powerMultiplier * distanceConditionMultiplier);
  const scaledTotalDistance = Math.max(0.1, scaledCarry + scaledRoll);
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
