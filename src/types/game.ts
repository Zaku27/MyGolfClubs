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
export type HazardType = "bunker" | "water" | "ob" | "rough";
export type HazardShape = "rectangle" | "polygon";

export interface Hazard {
  id: string;
  type: HazardType;
  shape: HazardShape;
  yFront: number;   // distance to the front edge from tee direction, yards
  yBack: number;    // distance to the back edge, yards
  xCenter: number;  // lateral offset from center line, yards
  width: number;    // total width, yards
  penaltyStrokes: 1 | 2;
  name?: string;
}

// ─── Course ───────────────────────────────────────────────────────────────────
export interface Hole {
  number: number;
  par: 3 | 4 | 5;
  distanceFromTee: number; // yards
  targetDistance?: number; // ピンまでの距離。未指定時は distanceFromTee を使用
  greenRadius?: number; // ヤード。未指定時は既定値を使用
  hazards?: Hazard[];
}

// ─── Shot context ─────────────────────────────────────────────────────────────
export type LieType = "tee" | "fairway" | "semirough" | "rough" | "bareground" | "bunker" | "green";
export type RiskLevel = "safe" | "normal" | "aggressive";
export type WindDirection = "headwind" | "tailwind" | "crosswind" | "none";

export interface ShotContext {
  remainingDistance: number;
  lie: LieType;
  wind?: WindDirection;
  windStrength?: number; // mph
  windDirectionDegrees?: number; // 0=北へ吹く, 時計回り
  greenRadius?: number; // ヤード。ピン中心の捕捉半径
  hazards?: Hazard[];
}

// ─── Shot result ──────────────────────────────────────────────────────────────
export type ShotQuality = "excellent" | "good" | "average" | "poor" | "mishit";

export interface ShotQualityMetrics {
  carryZ: number;
  lateralZ: number;
  weightedCarry: number;
  weightedLateral: number;
  score: number;
  poorThreshold: number;
  decisiveAxis: "carry" | "lateral" | "mixed";
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
  confidenceBoostApplied?: boolean;
  landing?: ShotLanding;
  finalOutcome: "fairway" | "bunker" | "water" | "ob" | "green";
  penaltyStrokes: number;
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
  riskLevel: RiskLevel;
  wasWeakClub: boolean;
  confidenceBoostApplied: boolean;
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
}

// ─── Overall game state ───────────────────────────────────────────────────────
export type GamePhase = "setup" | "playing" | "hole_complete" | "round_complete";
