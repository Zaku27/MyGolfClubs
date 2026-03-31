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
  RiskLevel,
  WindDirection,
} from "../types/game";
import { simulateShot } from "../utils/shotSimulation";
import { buildClubUsageStats } from "../utils/roundAnalysis";
import { useClubStore } from "./clubStore";
import { formatSimClubLabel } from "../utils/simClubLabel";
import { resolvePersonalDataForSimClub } from "../utils/personalData";

// ─── Wind generation ──────────────────────────────────────────────────────────

function generateWind(): Pick<ShotContext, "wind" | "windStrength"> {
  const roll = Math.random();
  if (roll < 0.40) return { wind: "none", windStrength: 0 };
  const directions: WindDirection[] = ["headwind", "tailwind", "crosswind"];
  const wind = directions[Math.floor(Math.random() * directions.length)];
  const windStrength = Math.round(5 + Math.random() * 15); // 5–20 mph
  return { wind, windStrength };
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
  riskLevel: RiskLevel;
  showResultModal: boolean;
  currentHoleShots: ShotLog[];
  roundShots: ShotLog[];
  lastHoleSummary: HoleSummary | null;
  holeSummaries: HoleSummary[];
  goodShotStreak: number;
  confidenceBoost: number;
}

interface GameStoreActions {
  startRound: (course: Hole[], bag: SimClub[]) => void;
  selectClub: (clubId: string) => void;
  setShotPowerPercent: (powerPercent: number) => void;
  setRiskLevel: (risk: RiskLevel) => void;
  takeShot: () => void;
  dismissResult: () => void;
  advanceHole: () => void;
  resetGame: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: GameStoreState = {
  phase: "setup",
  course: [],
  currentHoleIndex: 0,
  shotContext: { remainingDistance: 0, lie: "tee", hazards: [] },
  holeStrokes: 0,
  scores: [],
  finalScore: null,
  perHoleResults: [],
  clubUsageStats: [],
  bag: [],
  lastShotResult: null,
  selectedClubId: null,
  shotPowerPercent: 100,
  riskLevel: "normal",
  showResultModal: false,
  currentHoleShots: [],
  roundShots: [],
  lastHoleSummary: null,
  holeSummaries: [],
  goodShotStreak: 0,
  confidenceBoost: 0,
};

function buildInitialContext(hole: Hole): ShotContext {
  return {
    remainingDistance: hole.distanceFromTee,
    lie: "tee",
    hazards: hole.hazards ?? [],
    ...generateWind(),
  };
}

function getClubLabel(club: SimClub): string {
  return formatSimClubLabel(club);
}

function buildHoleInsight(hole: Hole, holeShots: ShotLog[], roundShots: ShotLog[]): string {
  const successfulShots = holeShots.filter((shot) => shot.success);

  if (hole.hazards?.length && holeShots.some((shot) => shot.riskLevel === "safe" && shot.success)) {
    return `${hole.number}番ホールは無理をせず刻んだ判断が良かったです`;
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

  if (holeShots.some((shot) => shot.confidenceBoostApplied && shot.success)) {
    return "良い流れが次のショットにもつながりました";
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

  startRound: (course, bag) => {
    set({
      ...INITIAL_STATE,
      phase: "playing",
      course,
      bag,
      currentHoleIndex: 0,
      shotContext: buildInitialContext(course[0]),
    });
  },

  selectClub: (clubId) => set({ selectedClubId: clubId }),

  setShotPowerPercent: (powerPercent) => set({
    shotPowerPercent: Math.max(0, Math.min(110, Math.round(powerPercent))),
  }),

  setRiskLevel: (risk) => set({ riskLevel: risk }),

  takeShot: () => {
    const {
      selectedClubId,
      shotPowerPercent,
      bag,
      shotContext,
      riskLevel,
      holeStrokes,
      course,
      currentHoleIndex,
      scores,
      currentHoleShots,
      roundShots,
      goodShotStreak,
      confidenceBoost,
      holeSummaries,
    } = get();

    if (!selectedClubId) return;
    const club = bag.find((c) => c.id === selectedClubId);
    if (!club) return;

    const personalData = useClubStore.getState().personalData;
    const result = simulateShot(club, shotContext, riskLevel, {
      confidenceBoost,
      shotPowerPercent,
      personalData: resolvePersonalDataForSimClub(club, personalData),
      playerSkillLevel: useClubStore.getState().playerSkillLevel,
    });
    const newHoleStrokes = holeStrokes + result.strokesAdded;
    const confidenceBoostApplied = result.confidenceBoostApplied === true;
    const streakAfterShot = confidenceBoostApplied
      ? (result.wasSuccessful ? 1 : 0)
      : (result.wasSuccessful ? goodShotStreak + 1 : 0);
    const nextConfidenceBoost = !confidenceBoostApplied && streakAfterShot === 3 ? 6 : 0;
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
      riskLevel,
      wasWeakClub: club.isWeakClub === true || club.successRate < 65,
      confidenceBoostApplied: result.confidenceBoostApplied === true,
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
        showResultModal: true,
        selectedClubId: null,
        shotPowerPercent: 100,
        currentHoleShots: nextHoleShots,
        roundShots: nextRoundShots,
        lastHoleSummary: holeSummary,
        holeSummaries: [...holeSummaries, holeSummary],
        goodShotStreak: streakAfterShot,
        confidenceBoost: nextConfidenceBoost,
      });
    } else {
      // ── Still playing ──
      set({
        holeStrokes: newHoleStrokes,
        lastShotResult: result,
        shotContext: {
          ...shotContext,
          remainingDistance: result.newRemainingDistance,
          lie: result.lie,
          // Keep wind and hazards from current hole
        },
        showResultModal: true,
        selectedClubId: null,
        shotPowerPercent: 100,
        currentHoleShots: nextHoleShots,
        roundShots: nextRoundShots,
        goodShotStreak: streakAfterShot,
        confidenceBoost: nextConfidenceBoost,
      });
    }
  },

  dismissResult: () => set({ showResultModal: false }),

  advanceHole: () => {
    const { currentHoleIndex, course } = get();
    const nextIndex = currentHoleIndex + 1;
    if (nextIndex >= course.length) return; // safety guard

    set({
      currentHoleIndex: nextIndex,
      phase: "playing",
      holeStrokes: 0,
      lastShotResult: null,
      showResultModal: false,
      selectedClubId: null,
      currentHoleShots: [],
      shotContext: buildInitialContext(course[nextIndex]),
    });
  },

  resetGame: () => set(INITIAL_STATE),
}));
