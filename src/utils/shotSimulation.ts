import type {
  SimClub,
  ShotContext,
  ShotResult,
  ShotQuality,
  RiskLevel,
  LieType,
  WindDirection,
} from "../types/game";
import type { ClubPersonalData } from "../types/golf";
import { calculateBaseClubSuccessRate } from "./calculateSuccessRate";
import { ClubService } from "../db/clubService";
import { estimateTheoreticalDistance } from "./distanceEstimation";
import { calculateLandingOutcome } from "./landingPosition";
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
  confidenceBoost?: number;
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

// 風向(0=北へ, 180=南へ)から「ショット進行方向成分」の mph を返す。
// 本プロジェクトでは角度を「その方角へ吹く風」として扱う。
function getHeadTailWindComponentMph(strength: number, windDirectionDegrees: number): number {
  const normalized = normalizeDegrees(windDirectionDegrees);
  const rad = (normalized * Math.PI) / 180;
  return Math.cos(rad) * strength;
}

// 風向(0=北へ, 90=東へ)から横風成分 mph を返す。
function getCrossWindComponentMph(strength: number, windDirectionDegrees: number): number {
  const normalized = normalizeDegrees(windDirectionDegrees);
  const rad = (normalized * Math.PI) / 180;
  return Math.sin(rad) * strength;
}

function getWindYards(
  wind: WindDirection | undefined,
  strength: number,
  windDirectionDegrees?: number,
): number {
  // 360度風向がある場合は、向かい/追いの連続成分を優先して距離へ反映する。
  if (typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)) {
    const componentMph = getHeadTailWindComponentMph(strength, windDirectionDegrees);
    // 既存チューニングとの連続性を保つため、向かい風と追い風で係数を分ける。
    return componentMph < 0 ? componentMph * 1.5 : componentMph * 0.8;
  }

  if (!wind || wind === "none") return 0;
  switch (wind) {
    case "headwind":  return -(strength * 1.5);
    case "tailwind":  return  strength * 0.8;
    case "crosswind": return -(strength * 0.4); // slight distance loss
    default:          return 0;
  }
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
 * @param context lie, wind, windStrength
 * @param riskLevel RiskLevel
 * @param options personalData, headSpeed, useTheoretical（理論値も加味する場合true）
 */
export function estimateShotDistance(
  club: SimClub,
  context: Pick<ShotContext, "lie" | "wind" | "windStrength" | "windDirectionDegrees">,
  _riskLevel: RiskLevel,
  options?: {
    personalData?: ClubPersonalData;
    headSpeed?: number;
    playerSkillLevel?: number;
    useTheoretical?: boolean;
  }
): number {
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance));

  const lieMultiplier = getLieDistanceMultiplier(context.lie, club.type);
  const windYards = getWindYards(context.wind, context.windStrength ?? 7, context.windDirectionDegrees);
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
  risk: RiskLevel,
  confidenceBoost: number,
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
  if (lie === "rough")   rate -= 12;
  if (lie === "bunker")  rate -= 20;
  if (risk === "aggressive") rate -= 15;
  if (risk === "safe")       rate +=  8;
  if (weakClub) {
    const weakPenaltyBase = club.successRate < 60 ? 16 : 14;
    rate -= weakPenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  }
  rate += confidenceBoost;
  return Math.max(15, Math.min(95, rate));
}

function resolveNewLie(
  remaining: number,
  isGoodShot: boolean,
  risk: RiskLevel,
  random: () => number,
): LieType {
  if (remaining === 0) return "green";
  if (remaining <= 30) return "green";
  if (!isGoodShot) {
    return random() < 0.28 ? "bunker" : "rough";
  }
  const roughChance = risk === "aggressive" ? 0.20 : risk === "safe" ? 0.05 : 0.12;
  return random() < roughChance ? "rough" : "fairway";
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
  wind: WindDirection | undefined,
  windStrength: number,
  windDirectionDegrees?: number,
): number {
  // 360度風向がある場合は、ランディング計算にも連続成分を渡す。
  if (typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)) {
    return getHeadTailWindComponentMph(windStrength, windDirectionDegrees);
  }

  if (wind === "headwind") return -windStrength;
  if (wind === "tailwind") return windStrength;
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

function distanceToPinFromLanding(
  remainingDistance: number,
  finalX: number,
  finalY: number,
): number {
  const dx = finalX;
  const dy = remainingDistance - finalY;
  return Math.sqrt(dx * dx + dy * dy);
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
  confidenceBoost: number,
  playerSkillLevel: number = 0.5,
  random: () => number = Math.random,
): {
  made: boolean;
  newRemaining: number;
  message: string;
  effectiveSuccessRate: number;
} {

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
  // 信頼度ブーストも加味
  makeChance = Math.min(0.98, makeChance + confidenceBoost / 100);

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
  riskLevel: RiskLevel,
  options: SimulationOptions & { isPractice?: boolean } = {},
): ShotResult {
  const { remainingDistance, lie, wind, windStrength = 7, windDirectionDegrees } = context;
  const confidenceBoost = options.confidenceBoost ?? 0;
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  const shotPowerPercent = Math.max(0, Math.min(110, options.shotPowerPercent ?? 100));
  const powerMultiplier = shotPowerPercent / 100;
  const { personalData } = options;
  const confidenceBoostApplied = confidenceBoost > 0;
  const simulationSeedBase = [
    club.id,
    club.avgDistance,
    remainingDistance,
    lie,
    wind ?? "none",
    windStrength,
    typeof windDirectionDegrees === "number" ? normalizeDegrees(windDirectionDegrees) : "legacy",
    riskLevel,
    playerSkillLevel,
    options.shotIndex ?? 0,
    options.seedNonce ?? "default",
  ].join("|");
  const random = createSeededRandom(simulationSeedBase);

  // ── Putter path ────────────────────────────────────────────────────────────
  if (club.type === "Putter") {
    const putt = simulatePutt(remainingDistance, confidenceBoost, playerSkillLevel, random);
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
      confidenceBoostApplied,
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
    };
  }

  // ── Success/quality roll ────────────────────────────────────────────────────
  const forcedEffectiveRate = options.forceEffectiveSuccessRate;
  const effectiveRate = typeof forcedEffectiveRate === "number"
    ? Math.max(0, Math.min(100, Math.round(forcedEffectiveRate)))
    : getEffectiveSuccessRate(
        club,
        lie,
        riskLevel,
        confidenceBoost,
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
    wind ?? "none",
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
    },
    aimXOffset: options.aimXOffset ?? 0,
    conditions: {
      wind: mapWindToLanding(wind, windStrength, windDirectionDegrees),
      groundHardness: mapGroundHardnessByLie(lie),
      headSpeed: options.headSpeed,
      seed: landingSeed,
      baseDistanceOverride: options.useStoredDistance && club.avgDistance > 0 ? club.avgDistance : undefined,
    },
  });

  const shotQuality = landingOutcome.shotQuality;
  const rawLanding = landingOutcome.landing;
  const lieDistanceMultiplier = getLieDistanceMultiplier(lie, club.type);
  const weakDistancePenaltyBase = isWeakClub(club)
    ? (club.successRate < 60 ? 0.14 : 0.10)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * WEAK_CLUB_EFFECT_SCALE;
  const distanceConditionMultiplier = lieDistanceMultiplier * weakDistanceMultiplier;

  // 360度風向がある場合は横風成分を着弾Xへ加算する。
  // 係数は現行モデルと同様に簡易線形として、調整しやすい形で定義する。
  const crossWindComponentMph =
    typeof windDirectionDegrees === "number" && Number.isFinite(windDirectionDegrees)
      ? getCrossWindComponentMph(windStrength, windDirectionDegrees)
      : wind === "crosswind"
        ? windStrength
        : 0;
  const lateralWindYards = crossWindComponentMph * 0.9;

  const scaledCarry = Math.max(0.1, rawLanding.carry * powerMultiplier * distanceConditionMultiplier);
  const scaledRoll = Math.max(0, rawLanding.roll * powerMultiplier * distanceConditionMultiplier);
  const scaledTotalDistance = Math.max(0.1, scaledCarry + scaledRoll);
  const scaledFinalX = rawLanding.finalX * powerMultiplier + lateralWindYards;
  const scaledFinalY = scaledTotalDistance;
  const scaledLateralDeviation = rawLanding.lateralDeviation * powerMultiplier + lateralWindYards;
  const landing = {
    ...rawLanding,
    carry: Math.round(scaledCarry * 10) / 10,
    roll: Math.round(scaledRoll * 10) / 10,
    totalDistance: Math.round(scaledTotalDistance * 10) / 10,
    lateralDeviation: Math.round(scaledLateralDeviation * 10) / 10,
    finalX: Math.round(scaledFinalX * 10) / 10,
    finalY: Math.round(scaledFinalY * 10) / 10,
    trajectoryPoints: rawLanding.trajectoryPoints?.map((point) => ({
      // 横風ドリフトは飛行進行に応じて徐々に効くよう、Y進捗比で配分する。
      x: Math.round((point.x * powerMultiplier + lateralWindYards * (Math.max(0, point.y) / Math.max(1, rawLanding.finalY))) * 10) / 10,
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
  newRemaining = Math.round(
    distanceToPinFromLanding(remainingDistance, landing.finalX, landing.finalY),
  );

  // Non-putter hole-outs are intentionally rare.
  if (newRemaining === 0) {
    const holeOutChance = getNonPutterHoleOutChance(remainingDistance, shotQuality);
    const holedOut = random() < holeOutChance;
    if (!holedOut) {
      newRemaining = getNearCupLeaveDistance(shotQuality, random);
    }
  }

  const newLie = resolveNewLie(newRemaining, isGoodShot, riskLevel, random);

  // ── Message ────────────────────────────────────────────────────────────────
  const clubLabel = `${club.name}${club.number ? " " + club.number : ""}`;
  let message: string;
  if (newRemaining === 0) {
    message = `${QUALITY_LABELS[shotQuality]} ${clubLabel} — ${actualDistance}yのショットがカップイン！🎉`;
  } else {
    message = `${QUALITY_LABELS[shotQuality]} ${clubLabel} — ${actualDistance}y、残り${newRemaining}y（${LIE_LABELS[newLie]}）`;
  }

  return {
    newRemainingDistance: newRemaining,
    outcomeMessage: message,
    strokesAdded: 1,
    lie: newLie,
    penalty: false,
    distanceHit: actualDistance,
    shotQuality,
    wasSuccessful: isGoodShot,
    effectiveSuccessRate: effectiveRate,
    confidenceBoostApplied,
    landing,
  };
}

export function estimateEffectiveSuccessRate(
  club: SimClub,
  context: Pick<ShotContext, "lie">,
  riskLevel: RiskLevel,
  options: Pick<SimulationOptions, "confidenceBoost" | "personalData" | "playerSkillLevel"> = {},
): number {
  const confidenceBoost = options.confidenceBoost ?? 0;
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  return getEffectiveSuccessRate(
    club,
    context.lie,
    riskLevel,
    confidenceBoost,
    playerSkillLevel,
    options.personalData,
  );
}
