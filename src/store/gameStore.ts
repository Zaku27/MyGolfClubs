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
import { simulateShot, simulateShotFromActualData, getAbsoluteLandingPoint, projectAlongLineToPin } from "../utils/shotSimulation";
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
import { simulateAutoPutts } from "../utils/shotResultEvaluation";

/** ロボット設定 */
export interface RobotSettings {
  headSpeed: number;
  skillLevel: number;
}

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

function generateWind(
  random: () => number = Math.random,
  previousWindStrength: number | null = null,
): Pick<ShotContext, "windStrength" | "windDirectionDegrees"> {
  let windStrength: number;
  if (previousWindStrength === null) {
    // 最初のホール：0–20 mph、風速が高くなるほど確率が下がる分布（指数分布）
    const exponentialRoll = -Math.log(random());
    windStrength = Math.round(exponentialRoll * 5);
    if (windStrength > 20) windStrength = 20;
  } else {
    // 次のホール：前の風速に近い値（±5 mph以内）、最小0
    const minWind = Math.max(0, previousWindStrength - 5);
    const maxWind = Math.min(25, previousWindStrength + 5);
    windStrength = Math.round(minWind + random() * (maxWind - minWind));
  }

  // 風向はランダム（0-359度）
  const windDirectionDegrees = Math.floor(random() * 360);
  return { windStrength, windDirectionDegrees };
}

// ─── State & action types ─────────────────────────────────────────────────────

interface GameStoreState {
  phase: GamePhase;
  course: Hole[];
  courseName: string;
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
  playMode: "robot" | "bag" | "measured";
  /** 前のホールの風速（mph）。次のホールで近い値を選ぶために使用。 */
  previousWindStrength: number | null;
  /** 実測データモード用のパタースキルレベル (0.5-0.9)。開始時に一回決定。 */
  measuredModePutterSkillLevel: number | null;
  /** 現在のホールで使用したパット数 */
  currentHolePutts: number;
  /** グリーン上で最初のパットを済ませたか */
  hasTakenFirstPutt: boolean;
  /** ロボットモード設定 */
  robotSettings: RobotSettings | null;
}

interface GameStoreActions {
  startRound: (course: Hole[], bag: SimClub[], playMode?: "robot" | "bag" | "measured", courseName?: string, robotSettings?: RobotSettings, bagSkillLevel?: number) => void;
  selectClub: (clubId: string) => void;
  setShotPowerPercent: (powerPercent: number) => void;
  setAimXOffset: (aimXOffset: number) => void;
  takeShot: () => void;
  advanceHole: () => void;
  resetGame: () => void;
  /** 自動パットを実行（グリーン上で最初のパット後にカップインまで） */
  executeAutoPutts: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: GameStoreState = {
  phase: "setup",
  course: [],
  courseName: "",
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
  playMode: "bag" as "robot" | "bag" | "measured",
  previousWindStrength: null,
  measuredModePutterSkillLevel: null,
  currentHolePutts: 0,
  hasTakenFirstPutt: false,
  robotSettings: null,
};

function buildInitialContext(hole: Hole, roundSeedNonce: string, holeIndex: number, previousWindStrength: number | null = null): ShotContext {
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
    ...generateWind(windRandom, previousWindStrength),
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

  startRound: (course, bag, playMode = "bag", courseName = "", robotSettings, bagSkillLevel) => {
    const roundSeedNonce = createRoundSeedNonce();
    const initialContext = buildInitialContext(course[0], roundSeedNonce, 0, null);

    // 実測データモードの場合、パタースキルレベルを0.5～0.8の範囲でランダムに決定
    const measuredModePutterSkillLevel = playMode === "measured"
      ? 0.5 + Math.random() * 0.3
      : null;

    // スキルレベルの決定（優先順位: ロボット設定 > バッグ設定 > グローバル設定 > デフォルト0.5）
    let playerSkillLevel = 0.5;
    if (playMode === "robot" && robotSettings) {
      playerSkillLevel = robotSettings.skillLevel;
    } else if (playMode === "bag" && bagSkillLevel != null) {
      playerSkillLevel = bagSkillLevel;
    } else if (playMode === "measured") {
      // 実測データモード: パター用にグローバルスキルレベルを取得（DBから非同期取得）
      playerSkillLevel = 0.5; // 一時的にデフォルト値、後でDBから上書き
    }

    set({
      ...INITIAL_STATE,
      phase: "playing",
      course,
      courseName,
      bag,
      playMode,
      roundSeedNonce,
      currentHoleIndex: 0,
      shotContext: initialContext,
      previousWindStrength: initialContext.windStrength ?? null,
      measuredModePutterSkillLevel,
      currentHolePutts: 0,
      hasTakenFirstPutt: false,
      playerSkillLevel,
      robotSettings: playMode === "robot" ? robotSettings : null,
    });
    // バッグ・実測データモードの場合は、指定されていなければDBからスキルレベルを非同期取得
    if (playMode !== "robot" && bagSkillLevel == null) {
      ClubService.getPlayerSkillLevel()
        .then((level) => set({ playerSkillLevel: level }))
        .catch(() => {/* デフォルト 0.5 を維持 */});
    }
  },

  selectClub: (clubId) => set({ selectedClubId: clubId }),

  setShotPowerPercent: (powerPercent) => {
    const { playMode } = get();
    const maxPower = playMode === "measured" ? 100 : 110;
    set({
      shotPowerPercent: Math.max(0, Math.min(maxPower, Math.round(powerPercent))),
    });
  },

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
      currentHolePutts,
      hasTakenFirstPutt,
    } = get();

    if (!selectedClubId) return;
    const club = bag.find((c) => c.id === selectedClubId);
    if (!club) return;

    set({ shotInProgress: true });

    setTimeout(() => {
      const isRobotMode = playMode === "robot";
      const isMeasuredMode = playMode === "measured";
      const allClubs = useClubStore.getState().clubs;
      const actualShotRows = useClubStore.getState().actualShotRows;
      const activeBagId = useClubStore.getState().activeBagId;
      
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

      // 実測データモード: 実測データからランダムにショットを選択
      // ロボット: 非パターは成功率100固定。バッグモード: 個人データを使って通常計算。
      const isPutter = club.type === "Putter";
      const { measuredModePutterSkillLevel, robotSettings } = get();
      let result;

      if (isMeasuredMode && !isPutter) {
        const shots = activeBagId ? actualShotRows[String(activeBagId)] ?? [] : [];
        result = simulateShotFromActualData(club, shotContext, shots, {
          shotPowerPercent,
          aimXOffset,
          shotIndex: currentHoleShots.length,
          seedNonce: `${roundSeedNonce}|hole:${currentHoleIndex}`,
        });
      } else {
        result = simulateShot(clubForSimulation, shotContext, {
          personalData: isRobotMode ? undefined : clubPersonalData,
          playerSkillLevel: isMeasuredMode && isPutter
            ? (measuredModePutterSkillLevel ?? 0.5)
            : isRobotMode
              ? (isPutter ? playerSkillLevel : 1)
              : playerSkillLevel,
          forceEffectiveSuccessRate: isRobotMode && !isPutter ? 100 : undefined,
          shotPowerPercent,
          aimXOffset,
          useStoredDistance: !isRobotMode,
          shotIndex: currentHoleShots.length,
          seedNonce: `${roundSeedNonce}|hole:${currentHoleIndex}`,
          headSpeed: isRobotMode && robotSettings ? robotSettings.headSpeed : undefined,
        });
      }
      const newHoleStrokes = holeStrokes + result.strokesAdded;
      const streakAfterShot = result.wasSuccessful ? goodShotStreak + 1 : 0;
      const wasOnGreenBefore = shotContext.lie === "green";
      const isFirstPuttOnGreen = isPutter && wasOnGreenBefore;

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

      // パットカウント更新
      const puttsAdded = isPutter ? 1 : 0;
      const newPuttCount = currentHolePutts + puttsAdded;
      const newHasTakenFirstPutt = hasTakenFirstPutt || isFirstPuttOnGreen;

      const nextHoleShots = [...currentHoleShots, shotLog];
      const nextRoundShots = [...roundShots, shotLog];

      // Parの倍のスコアになった時点でホールアウト
      const currentHole = course[currentHoleIndex];
      const maxStrokes = currentHole.par * 2;
      if (newHoleStrokes >= maxStrokes) {
        const holeSummary = buildHoleSummary(currentHole, nextHoleShots, nextRoundShots);
        const newScores: HoleScore[] = [
          ...scores,
          { holeNumber: currentHole.number, par: currentHole.par, strokes: newHoleStrokes, putts: newPuttCount },
        ];
        const isRoundComplete = currentHoleIndex >= course.length - 1;
        const clubUsageStats = isRoundComplete ? buildClubUsageStats(nextRoundShots, bag) : [];
        const finalScore = isRoundComplete
          ? newScores.reduce((sum, hole) => sum + hole.strokes, 0)
          : null;

        set({
          holeStrokes: newHoleStrokes,
          lastShotResult: {
            ...result,
            outcomeMessage: `最大打数（${maxStrokes}打）に達しました`,
            strokesAdded: result.strokesAdded,
          },
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
          currentHolePutts: newPuttCount,
          hasTakenFirstPutt: newHasTakenFirstPutt,
        });
        return;
      }

      // パット後に残りがある場合は自動的にカップインまでパット
      if (isPutter && result.newRemainingDistance > 0 && result.lie === "green") {
        // 自動パットシミュレーション（フィート単位）
        const puttResult = simulateAutoPutts(
          result.newRemainingDistance * 3, // ヤードをフィートに変換
          playerSkillLevel,
          5, // 最大5パットまで
        );

        const autoPuttLogs: ShotLog[] = [];
        let autoRemainingDistance = result.newRemainingDistance;

        for (const detail of puttResult.puttDetails) {
          const puttLog: ShotLog = {
            holeNumber: course[currentHoleIndex].number,
            clubId: bag.find((c) => c.type === "Putter")?.id ?? "putter",
            clubLabel: "パター",
            success: detail.success,
            distanceHit: (detail.fromDistance - detail.remainingAfterPutt) / 3, // フィートをヤードに変換
            distanceBeforeShot: autoRemainingDistance,
            distanceAfterShot: detail.remainingAfterPutt / 3, // フィートをヤードに変換
            strokeNumber: newHoleStrokes + autoPuttLogs.length + 1,
            lieBefore: "green",
            lieAfter: "green",
            shotQuality: detail.success ? "good" : "average",
            wasWeakClub: false,
          };
          autoPuttLogs.push(puttLog);
          autoRemainingDistance = detail.remainingAfterPutt / 3; // フィートをヤードに変換
        }

        const finalHoleShots = [...nextHoleShots, ...autoPuttLogs];
        const finalRoundShots = [...nextRoundShots, ...autoPuttLogs];
        const finalPuttCount = newPuttCount + puttResult.putts;
        const finalHoleStrokes = newHoleStrokes + puttResult.putts;

        // ホール完了処理
        const currentHole = course[currentHoleIndex];
        const holeSummary = buildHoleSummary(currentHole, finalHoleShots, finalRoundShots);
        const newScores: HoleScore[] = [
          ...scores,
          { holeNumber: currentHole.number, par: currentHole.par, strokes: finalHoleStrokes, putts: finalPuttCount },
        ];
        const isRoundComplete = currentHoleIndex >= course.length - 1;
        const clubUsageStats = isRoundComplete ? buildClubUsageStats(finalRoundShots, bag) : [];
        const finalScore = isRoundComplete
          ? newScores.reduce((sum, hole) => sum + hole.strokes, 0)
          : null;

        set({
          holeStrokes: finalHoleStrokes,
          lastShotResult: {
            newRemainingDistance: 0,
            outcomeMessage: puttResult.success ? "カップイン" : "カップイン（自動パット）",
            strokesAdded: result.strokesAdded + puttResult.putts,
            lie: "green",
            penalty: false,
            distanceHit: result.distanceHit + puttResult.puttDetails.reduce((sum, d) => sum + (d.fromDistance - d.remainingAfterPutt), 0) / 3,
            shotQuality: puttResult.success ? "good" : "average",
            wasSuccessful: puttResult.success,
            effectiveSuccessRate: 100,
            finalOutcome: "green",
            penaltyStrokes: 0,
            autoPuttResult: puttResult,
            distanceBeforeShot: shotContext.remainingDistance, // 1パット目の開始距離
            distanceAfterShot: result.newRemainingDistance, // 1パット目の終了距離（自動パット開始距離）
          } as unknown as ShotResult,
          scores: newScores,
          perHoleResults: newScores,
          clubUsageStats,
          finalScore,
          phase: isRoundComplete ? "round_complete" : "hole_complete",
          selectedClubId: null,
          shotPowerPercent: 100,
          aimXOffset: 0,
          currentHoleShots: finalHoleShots,
          roundShots: finalRoundShots,
          lastHoleSummary: holeSummary,
          holeSummaries: [...holeSummaries, holeSummary],
          goodShotStreak: streakAfterShot + (puttResult.success ? 1 : 0),
          shotInProgress: false,
          currentHolePutts: finalPuttCount,
          hasTakenFirstPutt: true,
        });
        return;
      }

      if (result.newRemainingDistance === 0) {
        // ── Hole complete ──
        const currentHole = course[currentHoleIndex];
        const holeSummary = buildHoleSummary(currentHole, nextHoleShots, nextRoundShots);
        const newScores: HoleScore[] = [
          ...scores,
          { holeNumber: currentHole.number, par: currentHole.par, strokes: newHoleStrokes, putts: newPuttCount },
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
          currentHolePutts: newPuttCount,
          hasTakenFirstPutt: newHasTakenFirstPutt,
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
          currentHolePutts: newPuttCount,
          hasTakenFirstPutt: newHasTakenFirstPutt,
        });
      }
    }, 0);
  },

  advanceHole: () => {
    const { currentHoleIndex, course, roundSeedNonce, previousWindStrength } = get();
    const nextIndex = currentHoleIndex + 1;
    if (nextIndex >= course.length) return; // safety guard

    const nextContext = buildInitialContext(course[nextIndex], roundSeedNonce, nextIndex, previousWindStrength);
    set({
      currentHoleIndex: nextIndex,
      phase: "playing",
      holeStrokes: 0,
      lastShotResult: null,
      selectedClubId: null,
      currentHoleShots: [],
      shotContext: nextContext,
      previousWindStrength: nextContext.windStrength ?? null,
      currentHolePutts: 0,
      hasTakenFirstPutt: false,
    });
  },

  executeAutoPutts: () => {
    const {
      currentHolePutts,
      shotContext,
      holeStrokes,
      course,
      currentHoleIndex,
      scores,
      currentHoleShots,
      roundShots,
      goodShotStreak,
      holeSummaries,
      playerSkillLevel,
      bag,
    } = get();

    // 残り距離が0なら何もしない
    if (shotContext.remainingDistance === 0) return;

    // グリーン上でない場合は何もしない
    if (shotContext.lie !== "green") return;

    // パットシミュレーション実行（フィート単位に変換）
    const puttResult = simulateAutoPutts(
      shotContext.remainingDistance * 3, // ヤードをフィートに変換
      playerSkillLevel,
      5, // 最大5パットまで
    );

    const currentHole = course[currentHoleIndex];
    const totalPutts = currentHolePutts + puttResult.putts;
    const strokesAdded = puttResult.putts;
    const newHoleStrokes = holeStrokes + strokesAdded;

    // パットログを生成（フィートをヤードに戻して記録）
    let remainingDistance = shotContext.remainingDistance;
    const newShotLogs: ShotLog[] = [];

    for (const detail of puttResult.puttDetails) {
      const puttLog: ShotLog = {
        holeNumber: currentHole.number,
        clubId: bag.find((c) => c.type === "Putter")?.id ?? "putter",
        clubLabel: "パター",
        success: detail.success,
        distanceHit: (detail.fromDistance - detail.remainingAfterPutt) / 3, // フィートをヤードに変換
        distanceBeforeShot: remainingDistance,
        distanceAfterShot: detail.remainingAfterPutt / 3, // フィートをヤードに変換
        strokeNumber: holeStrokes + newShotLogs.length + 1,
        lieBefore: "green",
        lieAfter: "green",
        shotQuality: detail.success ? "good" : "average",
        wasWeakClub: false,
      };
      newShotLogs.push(puttLog);
      remainingDistance = detail.remainingAfterPutt / 3; // フィートをヤードに変換
    }

    const nextHoleShots = [...currentHoleShots, ...newShotLogs];
    const nextRoundShots = [...roundShots, ...newShotLogs];

    // ホール完了処理
    const holeSummary = buildHoleSummary(currentHole, nextHoleShots, nextRoundShots);
    const newScores: typeof scores = [
      ...scores,
      { holeNumber: currentHole.number, par: currentHole.par, strokes: newHoleStrokes, putts: totalPutts },
    ];
    const isRoundComplete = currentHoleIndex >= course.length - 1;
    const clubUsageStats = isRoundComplete ? buildClubUsageStats(nextRoundShots, bag) : [];
    const finalScore = isRoundComplete
      ? newScores.reduce((sum, hole) => sum + hole.strokes, 0)
      : null;

    set({
      holeStrokes: newHoleStrokes,
      lastShotResult: {
        newRemainingDistance: 0,
        outcomeMessage: "カップイン（自動パット）",
        strokesAdded,
        lie: "green",
        penalty: false,
        distanceHit: puttResult.puttDetails.reduce((sum, d) => sum + (d.fromDistance - d.remainingAfterPutt), 0) / 3, // フィートをヤードに変換
        shotQuality: puttResult.success ? "good" : "average",
        wasSuccessful: puttResult.success,
        effectiveSuccessRate: 100,
        finalOutcome: "green",
        penaltyStrokes: 0,
        autoPuttResult: puttResult,
      } as unknown as ShotResult,
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
      goodShotStreak: goodShotStreak + (puttResult.success ? 1 : 0),
      shotInProgress: false,
      currentHolePutts: totalPutts,
      hasTakenFirstPutt: true,
      shotContext: {
        ...shotContext,
        remainingDistance: 0,
      },
    });
  },

  resetGame: () => set(INITIAL_STATE),
}));
