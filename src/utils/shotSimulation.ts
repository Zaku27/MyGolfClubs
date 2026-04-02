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
import { calculateEffectiveSuccessRate } from "./calculateSuccessRate";
import { ClubService } from "../db/clubService";
import { getEstimatedDistance } from "./analysisUtils";
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
  headSpeed?: number;
  useTheoretical?: boolean;
  shotIndex?: number;
  seedNonce?: string;
  skillWeights?: {
    baseSkillWeight: number;
    effectiveRateWeight: number;
  };
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
    case "tee":     return 1.00;
    case "fairway": return 0.98;
    case "rough":   return 0.82;
    case "bunker":  return clubType === "Wedge" ? 0.70 : 0.50;
    case "green":   return 1.00; // putter path handles this separately
    case "penalty": return 0.60;
    default:        return 0.95;
  }
}

function getWindYards(wind: WindDirection | undefined, strength: number): number {
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

/**
 * SimClub から GolfClub 相当の情報を生成（推定値は0や空文字で埋める）
 */
function simClubToGolfClub(club: SimClub): import("../types/golf").GolfClub {
  return {
    clubType: club.type as any, // ClubCategory互換
    name: club.name,
    number: club.number,
    length: 0,
    weight: 0,
    swingWeight: '',
    lieAngle: 0,
    // SimClub 側のロフト角を理論飛距離計算へ引き継ぐ
    loftAngle: club.loftAngle ?? 0,
    shaftType: '',
    torque: 0,
    flex: 'S',
    distance: club.avgDistance,
    notes: '',
    id: Number(club.id),
  };
}

/**
 * 高精度な飛距離推定（個人データ・ヘッドスピード・理論値も加味可能）
 * @param club SimClub
 * @param context lie, wind, windStrength
 * @param riskLevel RiskLevel
 * @param options personalData, headSpeed, useTheoretical（理論値も加味する場合true）
 */
export function estimateShotDistance(
  club: SimClub,
  context: Pick<ShotContext, "lie" | "wind" | "windStrength">,
  _riskLevel: RiskLevel,
  options?: {
    personalData?: ClubPersonalData;
    headSpeed?: number;
    useTheoretical?: boolean;
  }
): number {
  if (club.type === "Putter") return Math.max(1, Math.round(club.avgDistance));

  const lieMultiplier = getLieDistanceMultiplier(context.lie, club.type);
  const windYards = getWindYards(context.wind, context.windStrength ?? 7);
  const weakDistancePenaltyBase = isWeakClub(club)
    ? (club.successRate < 60 ? 0.14 : 0.10)
    : 0;
  const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * WEAK_CLUB_EFFECT_SCALE;

  // --- ヘッドスピード・理論値を加味したベース飛距離 ---
  let baseDistance = club.avgDistance;
  const headSpeed = options?.headSpeed;
  // ロボット（successRate=100, personalData未指定, useTheoretical=true, headSpeed指定）なら理論値のみ
  const isRobot =
    club.successRate === 100 &&
    !options?.personalData &&
    options?.useTheoretical &&
    typeof headSpeed === "number";
  if (isRobot) {
    const golfClub = simClubToGolfClub(club);
    baseDistance = getEstimatedDistance(golfClub, headSpeed);
  } else if (options?.useTheoretical && typeof headSpeed === "number") {
    // 実測値と理論値の中間値を取る（重みは要調整）
    const golfClub = simClubToGolfClub(club);
    const theoretical = getEstimatedDistance(golfClub, headSpeed);
    baseDistance = (baseDistance * 0.7 + theoretical * 0.3);
  }

  let expected = baseDistance * lieMultiplier * weakDistanceMultiplier + windYards;

  return Math.max(5, Math.round(expected));
}

export function estimateShotDistanceRange(
  club: SimClub,
  context: Pick<ShotContext, "lie" | "wind" | "windStrength">,
): { min: number; max: number } {
  // デフォルトリスクレベルを "normal" として扱う
  const riskLevel: RiskLevel = "normal";
  const center = estimateShotDistance(club, context, riskLevel);

  if (club.type === "Putter") {
    const min = Math.max(1, Math.round(center * 0.8));
    const max = Math.max(min, Math.round(center * 1.15));
    return { min, max };
  }

  const weakClub = isWeakClub(club);
  const varianceFactor = getVarianceFactor(club.successRate, riskLevel, weakClub);
  const spreadMultiplier = 1.0;
  let spreadRatio = Math.min(0.3, Math.max(0.08, varianceFactor * 1.8 * spreadMultiplier));

  // excellent時のドライバー上振れをsimulateShotと同じく強化
  let max = Math.max(center, Math.round(center * (1 + spreadRatio)));
  if (club.type === "Driver") {
    // excellent時の最大上振れをsimulateShotのロジックに合わせてさらに強化
    // 1.7倍+0.12分の上振れ幅を考慮
    max = Math.max(max, Math.round(center * (1 + Math.abs(1) * varianceFactor * 1.7 + 0.12)));
  }
  const min = Math.max(5, Math.round(center * (1 - spreadRatio)));
  return { min, max };
}

/** Lower success rate + aggressive risk → more variance. */
function getVarianceFactor(successRate: number, risk: RiskLevel, weakClub: boolean): number {
  const base = (100 - successRate) / 250; // 0.0 – 0.34
  const riskMult = risk === "aggressive" ? 2.0 : risk === "safe" ? 0.4 : 1.0;
  return base * riskMult + (weakClub ? 0.06 * WEAK_CLUB_EFFECT_SCALE : 0);
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
  let rate = calculateEffectiveSuccessRate(
    club.successRate,
    personalData,
    weakClub,
    playerSkillLevel,
  );
  if (lie === "rough")   rate -= 12;
  if (lie === "bunker")  rate -= 20;
  if (lie === "penalty") rate -= 30;
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
  penalty: boolean,
  risk: RiskLevel,
  random: () => number,
): LieType {
  if (penalty)         return "penalty";
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

function mapWindToLanding(wind: WindDirection | undefined, windStrength: number): number {
  if (wind === "headwind") return -windStrength;
  if (wind === "tailwind") return windStrength;
  return 0;
}

function mapGroundHardnessByLie(lie: LieType): number {
  if (lie === "bunker") return 20;
  if (lie === "rough") return 45;
  if (lie === "fairway") return 75;
  if (lie === "green") return 85;
  return 60;
}

/**
 * 有効成功率(15〜95)を 0〜1 のスキル寄与へ正規化する。
 * 分布モデルへ直接渡して、表示成功率と体感を近づける。
 */
function normalizeEffectiveRateToSkill(rate: number): number {
  const normalized = (rate - 15) / 80;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * 基本スキルと有効成功率を合成し、分布モデル用の実効スキルを作る。
 * lie/risk/個人データ補正を体感へ反映しやすいよう、有効成功率の重みを高く設定する。
 * @param playerSkillLevel 0-1の基本スキル
 * @param effectiveRate 15-95の有効成功率
 * @param baseWeight 基本スキルの重み（デフォルト: 0.35）
 * @param rateWeight 有効成功率の重み（デフォルト: 0.65）
 */
export function composeEffectiveSkill(
  playerSkillLevel: number,
  effectiveRate: number,
  baseWeight: number = 0.35,
  rateWeight: number = 0.65
): number {
  const baseSkill = Math.max(0, Math.min(1, playerSkillLevel));
  const rateSkill = normalizeEffectiveRateToSkill(effectiveRate);
  // 重みが0に近い場合も対応
  const totalWeight = baseWeight + rateWeight;
  if (totalWeight === 0) return 0.5;
  const normalized = (baseSkill * baseWeight + rateSkill * rateWeight) / totalWeight;
  return Math.max(0, Math.min(1, normalized));
}

export const LIE_LABELS: Record<LieType, string> = {
  tee: "ティー", fairway: "フェアウェイ", rough: "ラフ",
  bunker: "バンカー", green: "グリーン", penalty: "ペナルティ",
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
  const { remainingDistance, lie, wind, windStrength = 7, hazards = [] } = context;
  const confidenceBoost = options.confidenceBoost ?? 0;
  const playerSkillLevel = options.playerSkillLevel ?? 0.5;
  const { personalData } = options;
  const confidenceBoostApplied = confidenceBoost > 0;
  const simulationSeedBase = [
    club.id,
    club.avgDistance,
    remainingDistance,
    lie,
    wind ?? "none",
    windStrength,
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
  const effectiveRate = getEffectiveSuccessRate(
    club,
    lie,
    riskLevel,
    confidenceBoost,
    playerSkillLevel,
    personalData,
  );
  const { baseSkillWeight = 0.35, effectiveRateWeight = 0.65 } = options.skillWeights ?? {};
  const effectiveSkill = composeEffectiveSkill(
    playerSkillLevel,
    effectiveRate,
    baseSkillWeight,
    effectiveRateWeight
  );
  const landingSeed = [
    club.id,
    remainingDistance,
    effectiveRate,
    wind ?? "none",
    windStrength,
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
    aimXOffset: 0,
    conditions: {
      wind: mapWindToLanding(wind, windStrength),
      groundHardness: mapGroundHardnessByLie(lie),
      seed: landingSeed,
    },
  });

  const shotQuality = landingOutcome.shotQuality;
  const landing = landingOutcome.landing;
  const actualDistance = Math.round(Math.max(5, landing.totalDistance));

  // 結果先行モデルでは品質から成功判定を導く。
  const isGoodShot = shotQuality === "excellent" || shotQuality === "good" || shotQuality === "average";

  // ── Penalty check ──────────────────────────────────────────────────────────
  const penaltyBase =
    shotQuality === "mishit"
      ? (hazards.length > 0 ? 0.42 : 0.10)
      : shotQuality === "poor"
        ? (hazards.length > 0 ? 0.18 : 0.04)
        : 0;
  const penalty = penaltyBase > 0 && random() < penaltyBase;

  // ── New remaining ──────────────────────────────────────────────────────────
  let newRemaining: number;

  // 池ポチャ判定: hazardsに"water"が含まれていて、練習場でない場合のみ特別処理
  const isPractice = options.isPractice === true;
  const isWaterHazard = !isPractice && hazards.some(h => typeof h === "string" && h.toLowerCase().includes("water"));
  if (penalty && isWaterHazard) {
    // 池ポチャ: 距離は進めてワンペナ
    if (actualDistance > remainingDistance + 15) {
      newRemaining = actualDistance - remainingDistance;
    } else {
      newRemaining = Math.max(0, remainingDistance - actualDistance);
    }
    newRemaining = Math.round(newRemaining);
  } else if (penalty) {
    // OB等: その場に留まる
    newRemaining = remainingDistance;
  } else if (actualDistance > remainingDistance + 15) {
    // Overshoot: ended up past the pin
    newRemaining = actualDistance - remainingDistance;
  } else {
    newRemaining = Math.max(0, remainingDistance - actualDistance);
  }
  newRemaining = Math.round(newRemaining);

  // Non-putter hole-outs are intentionally rare.
  if (!penalty && newRemaining === 0) {
    const holeOutChance = getNonPutterHoleOutChance(remainingDistance, shotQuality);
    const holedOut = random() < holeOutChance;
    if (!holedOut) {
      newRemaining = getNearCupLeaveDistance(shotQuality, random);
    }
  }

  const newLie = resolveNewLie(newRemaining, isGoodShot, penalty, riskLevel, random);

  // ── Message ────────────────────────────────────────────────────────────────
  const clubLabel = `${club.name}${club.number ? " " + club.number : ""}`;
  let message: string;
  if (penalty) {
    const hazardName = hazards[0] ?? "ハザード";
    message = `${QUALITY_LABELS["mishit"]} ${clubLabel} — ${hazardName}に入りました。ペナルティ +1。(${actualDistance}y方向)`;
  } else if (newRemaining === 0) {
    message = `${QUALITY_LABELS[shotQuality]} ${clubLabel} — ${actualDistance}yのショットがカップイン！🎉`;
  } else {
    message = `${QUALITY_LABELS[shotQuality]} ${clubLabel} — ${actualDistance}y、残り${newRemaining}y（${LIE_LABELS[newLie]}）`;
  }

  return {
    newRemainingDistance: newRemaining,
    outcomeMessage: message,
    strokesAdded: penalty ? 2 : 1,
    lie: newLie,
    penalty,
    distanceHit: actualDistance,
    shotQuality,
    wasSuccessful: isGoodShot && !penalty,
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
