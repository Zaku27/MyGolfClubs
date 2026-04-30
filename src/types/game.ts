// ─── Simulator-specific club type ────────────────────────────────────────────
export type ClubType = "Driver" | "Wood" | "Hybrid" | "Iron" | "Wedge" | "Putter";

/** Lightweight representation of a club used by the game simulator. */
export interface SimClub {
  id: string;
  name: string;        // e.g. "Ping G430"
  type: ClubType;
  number: string;      // "1", "3W", "7", "PW", etc.
  loftAngle?: number;
  avgDistance: number; // yards (carry)
  successRate: number; // 0–100
  isWeakClub?: boolean;
}

// ─── Hazard model ─────────────────────────────────────────────────────────────
export type HazardType = "bunker" | "water" | "ob" | "rough" | "semirough" | "bareground";
export type HazardShape = "rectangle" | "polygon";

export interface Hazard {
  id: string;
  type: HazardType;
  shape: HazardShape;
  yFront: number;   // distance to the front edge from tee direction, yards
  yBack: number;    // distance to the back edge, yards
  xCenter: number;  // lateral offset from center line, yards
  width: number;    // total width, yards
  height?: number;
  x?: number;
  y?: number;
  points?: Array<{ x: number; y: number }>;
  penaltyStrokes: 0 | 1 | 2;
  liePenalty?: {
    distanceMultiplier: number;  // 0.75 = 25%飛距離減
    dispersionMultiplier: number; // 1.8 = 分散1.8倍（方向・飛距離ともにブレやすい）
    mishitRateBonus: number;     // +0.15 = ミスヒット率15%上昇
    sideSpinBonus: number;       // ±RPM増加（曲がりやすくなる）
  };
  groundCondition?: GroundCondition;
  name?: string;
  locked?: boolean; // ハザードを編集不可にするフラグ
}

export type GroundHardness = "soft" | "medium" | "firm";

export interface GroundCondition {
  hardness: GroundHardness;
  slopeAngle: number; // degrees, + = uphill toward the pin
  slopeDirection: number; // 0-359: 0 = uphill toward pin, 90 = uphill to the right
}

// ─── Course ───────────────────────────────────────────────────────────────────
export interface Hole {
  number: number;
  par: 3 | 4 | 5;
  distanceFromTee: number; // yards
  targetDistance?: number; // ピンまでの距離。未指定時は distanceFromTee を使用
  greenRadius?: number; // ヤード。未指定時は既定値を使用
  hazards?: Hazard[];
  greenPolygon?: Array<{ x: number; y: number }>;
  groundCondition?: GroundCondition; // 将来コースエディタで編集する予定の地面パラメータ
}
// ─── Shot context ─────────────────────────────────────────────────────────────
export type LieType = "tee" | "fairway" | "semirough" | "rough" | "bareground" | "bunker" | "green";

export interface ShotContext {
  remainingDistance: number;
  lie: LieType;
  targetDistance: number; // absolute pin distance from tee or hole origin
  originX: number; // absolute shot origin X coordinate in hole space
  originY: number; // absolute shot origin Y coordinate in hole space
  penaltyDropOrigin?: { x: number; y: number };
  windStrength?: number; // mph
  windDirectionDegrees?: number; // 0=北へ吹く, 時計回り
  greenRadius?: number; // ヤード。ピン中心の捕捉半径
  greenPolygon?: Array<{ x: number; y: number }>;
  hazards?: Hazard[];
  groundHardness?: number; // 0-100 地面硬さ
  groundSlopeAngle?: number; // degree
  groundSlopeDirection?: number; // 0-359
}

// ─── Shot result ──────────────────────────────────────────────────────────────
export type ShotQuality = "excellent" | "good" | "average" | "misshot" | "poor";

export interface ShotQualityMetrics {
  carryZ: number;
  lateralZ: number;
  weightedCarry: number;
  weightedLateral: number;
  score: number;
  poorThreshold: number;
  decisiveAxis: "carry" | "lateral" | "mixed";
  distanceError?: number;
  percentError?: number;
}

export interface ShotLanding {
  carry: number;
  roll: number;
  totalDistance: number;
  lateralDeviation: number;
  finalX: number;
  finalY: number;
  qualityMetrics?: ShotQualityMetrics;
  apexHeight?: number;
  trajectoryPoints?: Array<{ x: number; y: number; z?: number }>;
}

export interface ShotResult {
  newRemainingDistance: number;
  outcomeMessage: string;
  strokesAdded: number;   // 1 normally; 2 when penalty stroke is incurred
  lie: LieType;
  penalty: boolean;
  distanceHit: number;    // yards the ball actually traveled
  shotQuality: ShotQuality;
  wasSuccessful: boolean;
  effectiveSuccessRate: number;
  landing?: ShotLanding;
  finalOutcome: "fairway" | "rough" | "bunker" | "water" | "ob" | "green";
  nextShotAdvice?: string;
  penaltyStrokes: number;
  penaltyDropOrigin?: { x: number; y: number };
  origin?: { x: number; y: number };
  confidenceBoostApplied?: boolean;
  /** 自動パット結果（グリーン上で最初のパット後に自動実行された場合） */
  autoPuttResult?: {
    putts: number;
    success: boolean;
    finalDistance: number;
    puttDetails: Array<{
      puttNumber: number;
      fromDistance: number;
      success: boolean;
      remainingAfterPutt: number;
    }>;
  };
  /** ショット前の残り距離（パットの場合に使用） */
  distanceBeforeShot?: number;
  /** ショット後の残り距離（パットの場合に使用） */
  distanceAfterShot?: number;
}

export interface ShotLog {
  holeNumber: number;
  clubId: string;
  clubLabel: string;
  success: boolean;
  distanceHit: number;
  distanceBeforeShot: number;
  distanceAfterShot: number;
  strokeNumber: number;
  lieBefore: LieType;
  lieAfter: LieType;
  shotQuality: ShotQuality;
  wasWeakClub: boolean;
}

export interface ClubUsageStat {
  clubId: string;
  clubName: string;
  timesUsed: number;
  successes: number;
  successRate: number;
  avgDistanceAchieved: number;
}

export interface HoleSummary {
  holeNumber: number;
  clubsUsed: string[];
  successRate: number;
  insight: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
export interface HoleScore {
  holeNumber: number;
  par: number;
  strokes: number;
  putts?: number;
}

// ─── Overall game state ───────────────────────────────────────────────────────
export type GamePhase = "setup" | "playing" | "hole_complete" | "round_complete";
