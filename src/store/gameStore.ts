import { create } from "zustand";
import type {
  ClubUsageStat,
  SimClub,
  Hole,
  ShotContext,
  ShotResult,
  ShotLog,
  HoleScore,
  GamePhase,
  HoleSummary,
} from "../types/game";
import { simulateShot, getAbsoluteLandingPoint, projectAlongLineToPin } from "../utils/shotSimulation";
import { buildClubUsageStats } from "../utils/roundAnalysis";
import { formatSimClubDisplayName } from "../utils/simClubLabel";
import { ClubService } from "../db/clubService";
import { useClubStore } from "./clubStore";
import { resolvePersonalDataForSimClub } from "../utils/personalData";
import {
  buildAnalysisPenaltyByClubId,
  getAnalysisAdjustedBaseSuccessRate,
  isWeakClubByAnalysisAdjustedRate,
} from "../utils/clubSuccessDisplay";

// ─── Wind generation ──────────────────────────────────────────────────────────

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

function createRoundSeedNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateWind(random: () => number = Math.random): Pick<ShotContext, "windStrength" | "windDirectionDegrees"> {
  const roll = random();
  if (roll < 0.40) return { windStrength: 0, windDirectionDegrees: 0 };
  const windStrength = Math.round(5 + random() * 15); // 5–20 mph
  const windDirectionDegrees = Math.floor(random() * 360);
  return { windStrength, windDirectionDegrees };
}

// ─── State & action types ─────────────────────────────────────────────────────

interface GameStoreState {
  phase: GamePhase;
  course: Hole[];
  currentHoleIndex: number;
  shotContext: ShotContext;
  holeStrokes: number;
  scores: HoleScore[];
  finalScore: number | null;
  perHoleResults: HoleScore[];
  clubUsageStats: ClubUsageStat[];
  bag: SimClub[];
  lastShotResult: ShotResult | null;
  selectedClubId: string | null;
  shotPowerPercent: number;
  aimXOffset: number;
  shotInProgress: boolean;
  confidenceBoost: number;
  currentHoleShots: ShotLog[];
  roundShots: ShotLog[];
  lastHoleSummary: HoleSummary | null;
  holeSummaries: HoleSummary[];
  goodShotStreak: number;
  roundSeedNonce: string;
  /** DBから取得したプレイヤースキルレベル (0-1)。パット確率に使用。 */
  playerSkillLevel: number;
  playMode: "robot" | "bag";
}

interface GameStoreActions {
  startRound: (course: Hole[], bag: SimClub[], playMode?: "robot" | "bag") => void;
  selectClub: (clubId: string) => void;
  setShotPowerPercent: (powerPercent: number) => void;
  setAimXOffset: (aimXOffset: number) => void;
  takeShot: () => void;
  advanceHole: () => void;
  resetGame: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: GameStoreState = {
  phase: "setup",
  course: [],
  currentHoleIndex: 0,
  shotContext: {
    remainingDistance: 0,
    lie: "tee",
    targetDistance: 0,
    originX: 0,
    originY: 0,
    hazards: [],
  },
  holeStrokes: 0,
  scores: [],
  finalScore: null,
  perHoleResults: [],
  clubUsageStats: [],
  bag: [],
  lastShotResult: null,
  selectedClubId: null,
  shotPowerPercent: 100,
  aimXOffset: 0,
  shotInProgress: false,
  currentHoleShots: [],
  roundShots: [],
  confidenceBoost: 0,
  lastHoleSummary: null,
  holeSummaries: [],
  goodShotStreak: 0,
  roundSeedNonce: "default",
  playerSkillLevel: 0.5,
  playMode: "bag",
};

function buildInitialContext(hole: Hole, roundSeedNonce: string, holeIndex: number): ShotContext {
  const windRandom = createSeededRandom(`${roundSeedNonce}|hole:${holeIndex}|wind`);
  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;
  return {
    remainingDistance: targetDistance,
    lie: "tee",
    targetDistance,
    originX: 0,
    originY: 0,
    greenRadius: hole.greenRadius,
    greenPolygon: hole.greenPolygon,
    hazards: hole.hazards ?? [],
    ...generateWind(windRandom),
  };
}

function getClubLabel(club: SimClub): string {
  return formatSimClubDisplayName(club);
}

function buildHoleInsight(hole: Hole, holeShots: ShotLog[], roundShots: ShotLog[]): string {
  const successfulShots = holeShots.filter((shot) => shot.success);

  if (hole.hazards?.length && holeShots.some((shot) => shot.success)) {
    return `${hole.number}番ホールは慎重な判断が良かったです`;
  }

  const clubStats = new Map<string, { attempts: number; successes: number }>();
  for (const shot of roundShots) {
    const current = clubStats.get(shot.clubLabel) ?? { attempts: 0, successes: 0 };
    current.attempts += 1;
    if (shot.success) current.successes += 1;
    clubStats.set(shot.clubLabel, current);
  }

  const strugglingClub = [...clubStats.entries()]
    .map(([clubLabel, stats]) => ({
      clubLabel,
      attempts: stats.attempts,
      successRate: stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0,
    }))
    .filter((entry) => entry.attempts >= 2 && entry.successRate < 50)
    .sort((left, right) => left.successRate - right.successRate)[0];

  if (strugglingClub) {
    return `今日は ${strugglingClub.clubLabel} がやや苦戦しています`;
  }


  const holeSuccessRate = holeShots.length > 0 ? Math.round((successfulShots.length / holeShots.length) * 100) : 0;
  if (holeSuccessRate >= 70) {
    return `${hole.number}番ホールは落ち着いてマネジメントできています`;
  }

  return `${hole.number}番ホールはクラブ選択でしっかり前進できました`;
}

function buildHoleSummary(hole: Hole, holeShots: ShotLog[], roundShots: ShotLog[]): HoleSummary {
  const clubsUsed = [...new Set(holeShots.map((shot) => shot.clubLabel))];
  const successfulShots = holeShots.filter((shot) => shot.success).length;
  const successRate = holeShots.length > 0 ? Math.round((successfulShots / holeShots.length) * 100) : 0;

  return {
    holeNumber: hole.number,
    clubsUsed,
    successRate,
    insight: buildHoleInsight(hole, holeShots, roundShots),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  startRound: (course, bag, playMode = "bag") => {
    const roundSeedNonce = createRoundSeedNonce();
    set({
      ...INITIAL_STATE,
      phase: "playing",
      course,
      bag,
      playMode,
      roundSeedNonce,
      currentHoleIndex: 0,
      shotContext: buildInitialContext(course[0], roundSeedNonce, 0),
    });
    // パット確率用にプレイヤースキルレベルを非同期取得
    ClubService.getPlayerSkillLevel()
      .then((level) => set({ playerSkillLevel: level }))
      .catch(() => {/* デフォルト 0.5 を維持 */});
  },

  selectClub: (clubId) => set({ selectedClubId: clubId }),

  setShotPowerPercent: (powerPercent) => set({
    shotPowerPercent: Math.max(0, Math.min(110, Math.round(powerPercent))),
  }),

  setAimXOffset: (aimXOffset) => set({
    aimXOffset: Math.max(-50, Math.min(50, Math.round(aimXOffset))),
  }),

  takeShot: () => {
    const {
      selectedClubId,
      bag,
      shotContext,
      shotPowerPercent,
      aimXOffset,
      holeStrokes,
      course,
      currentHoleIndex,
      scores,
      currentHoleShots,
      roundShots,
      goodShotStreak,
      holeSummaries,
      playerSkillLevel,
      playMode,
      roundSeedNonce,
    } = get();

    if (!selectedClubId) return;
    const club = bag.find((c) => c.id === selectedClubId);
    if (!club) return;

    set({ shotInProgress: true });

    setTimeout(() => {
      const isRobotMode = playMode === "robot";
      const allClubs = useClubStore.getState().clubs;
      const analysisPenaltyByClubId = buildAnalysisPenaltyByClubId(allClubs);
      const analysisPenaltyPoints = analysisPenaltyByClubId[club.id] ?? 0;
      const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(
        club,
        analysisPenaltyPoints,
      );
      const treatedAsWeakClub = isWeakClubByAnalysisAdjustedRate(club, analysisPenaltyPoints);
      const clubPersonalData = resolvePersonalDataForSimClub(club, useClubStore.getState().personalData);
      const clubForSimulation = isRobotMode
        ? { ...club, successRate: 100, isWeakClub: false }
        : {
            ...club,
            successRate: adjustedBaseSuccessRate,
            isWeakClub: treatedAsWeakClub,
          };

      // ロボット: 非パターは成功率100固定。バッグモード: 個人データを使って通常計算。
      const isPutter = club.type === "Putter";
      const result = simulateShot(clubForSimulation, shotContext, {
        personalData: isRobotMode ? undefined : clubPersonalData,
        playerSkillLevel: isRobotMode
          ? (isPutter ? playerSkillLevel : 1)
          : playerSkillLevel,
        forceEffectiveSuccessRate: isRobotMode && !isPutter ? 100 : undefined,
        shotPowerPercent,
        aimXOffset,
        useStoredDistance: !isRobotMode,
        shotIndex: currentHoleShots.length,
        seedNonce: `${roundSeedNonce}|hole:${currentHoleIndex}`,
      });
      const newHoleStrokes = holeStrokes + result.strokesAdded;
      const streakAfterShot = result.wasSuccessful ? goodShotStreak + 1 : 0;
      const shotLog: ShotLog = {
        holeNumber: course[currentHoleIndex].number,
        clubId: club.id,
        clubLabel: getClubLabel(club),
        success: result.wasSuccessful,
        distanceHit: result.distanceHit,
        distanceBeforeShot: shotContext.remainingDistance,
        distanceAfterShot: result.newRemainingDistance,
        strokeNumber: newHoleStrokes,
        lieBefore: shotContext.lie,
        lieAfter: result.lie,
        shotQuality: result.shotQuality,
        wasWeakClub: isRobotMode ? false : treatedAsWeakClub,
      };
      const nextHoleShots = [...currentHoleShots, shotLog];
      const nextRoundShots = [...roundShots, shotLog];

      if (result.newRemainingDistance === 0) {
        // ── Hole complete ──
        const currentHole = course[currentHoleIndex];
        const holeSummary = buildHoleSummary(currentHole, nextHoleShots, nextRoundShots);
        const newScores: HoleScore[] = [
          ...scores,
          { holeNumber: currentHole.number, par: currentHole.par, strokes: newHoleStrokes },
        ];
        const isRoundComplete = currentHoleIndex >= course.length - 1;
        const clubUsageStats = isRoundComplete ? buildClubUsageStats(nextRoundShots, bag) : [];
        const finalScore = isRoundComplete
          ? newScores.reduce((sum, hole) => sum + hole.strokes, 0)
          : null;

        set({
          holeStrokes: newHoleStrokes,
          lastShotResult: result,
          scores: newScores,
          perHoleResults: newScores,
          clubUsageStats,
          finalScore,
          phase: isRoundComplete ? "round_complete" : "hole_complete",
          selectedClubId: null,
          shotPowerPercent: 100,
          aimXOffset: 0,
          currentHoleShots: nextHoleShots,
          roundShots: nextRoundShots,
          lastHoleSummary: holeSummary,
          holeSummaries: [...holeSummaries, holeSummary],
          goodShotStreak: streakAfterShot,
          shotInProgress: false,
        });
      } else {
        // ── Still playing ──
        const nextOrigin = result.penalty && result.finalOutcome === "water" && result.penaltyDropOrigin
          ? result.penaltyDropOrigin
          : result.penalty && result.finalOutcome === "ob"
          ? projectAlongLineToPin(
              shotContext.originX,
              shotContext.originY,
              shotContext.targetDistance,
              result.newRemainingDistance,
            )
          : getAbsoluteLandingPoint(
              shotContext.originX,
              shotContext.originY,
              shotContext.targetDistance,
              result.landing?.finalX ?? 0,
              result.landing?.finalY ?? 0,
            );

        set({
          holeStrokes: newHoleStrokes,
          lastShotResult: result,
          shotContext: {
            ...shotContext,
            remainingDistance: result.newRemainingDistance,
            lie: result.lie,
            originX: nextOrigin.x,
            originY: nextOrigin.y,
            penaltyDropOrigin: result.penalty && result.finalOutcome === "water" ? nextOrigin : undefined,
            // Keep wind and hazards from current hole
          },
          selectedClubId: null,
          shotPowerPercent: 100,
          aimXOffset: 0,
          currentHoleShots: nextHoleShots,
          roundShots: nextRoundShots,
          goodShotStreak: streakAfterShot,
          shotInProgress: false,
        });
      }
    }, 0);
  },

  advanceHole: () => {
    const { currentHoleIndex, course, roundSeedNonce } = get();
    const nextIndex = currentHoleIndex + 1;
    if (nextIndex >= course.length) return; // safety guard

    set({
      currentHoleIndex: nextIndex,
      phase: "playing",
      holeStrokes: 0,
      lastShotResult: null,
      selectedClubId: null,
      currentHoleShots: [],
      shotContext: buildInitialContext(course[nextIndex], roundSeedNonce, nextIndex),
    });
  },

  resetGame: () => set(INITIAL_STATE),
}));
