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

// ─── Course ───────────────────────────────────────────────────────────────────
export interface Hole {
  number: number;
  par: 3 | 4 | 5;
  distanceFromTee: number; // yards
  hazards?: string[];      // human-readable descriptions e.g. "water left"
}

// ─── Shot context ─────────────────────────────────────────────────────────────
export type LieType = "tee" | "fairway" | "rough" | "bunker" | "green" | "penalty";
export type RiskLevel = "safe" | "normal" | "aggressive";
export type WindDirection = "headwind" | "tailwind" | "crosswind" | "none";

export interface ShotContext {
  remainingDistance: number;
  lie: LieType;
  wind?: WindDirection;
  windStrength?: number; // mph
  hazards?: string[];
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
