import { useGameStore } from "../../store/gameStore";
import { useMemo, useState, useEffect } from "react";
import type { SimClub } from "../../types/game";
import { useClubStore } from "../../store/clubStore";
import { estimateBaseDistance } from "../../utils/shotSimulation";
import { getSkillLabel } from "../../utils/playerSkill";
import { formatSimClubLabel } from "../../utils/simClubLabel";
import { CompactScorecard } from "./Scorecard";
import { resolvePersonalDataForSimClub } from "../../utils/personalData";
import { loadRangePlayerSettings } from "../../utils/rangePlayerSettings";
import {
  buildAnalysisPenaltyByClubId,
  calculateDisplayClubSuccessRate,
} from "../../utils/clubSuccessDisplay";
import type { LandingResult } from "../../utils/landingPosition";
import { HoleMapCanvas } from "./HoleMapCanvas";
import { PerspectiveHoleView } from "./PerspectiveHoleView";
import { evaluateShotResult, getScoreCelebration } from "../../utils/shotResultEvaluation";

type LandingHistoryItem = {
  origin: { x: number; y: number };
  landing: LandingResult;
};
import { ConfirmationDialog } from "../ConfirmationDialog";

interface Props {
  onBack: () => void;
  onViewFinalScorecard?: () => void;
}

const SHOT_QUALITY_LABEL: Record<string, string> = {
  excellent: "会心のショット",
  good: "ナイスショット",
  average: "まずまず",
  misshot: "大きく外した",
  poor: "ミス気味",
};

function estimateBaseDistanceWithMode(
  club: SimClub,
  seatType: "robot" | "personal",
  robotHeadSpeed: number,
): number {
  if (seatType === "robot") {
    return estimateBaseDistance(club, robotHeadSpeed, undefined, true);
  }
  return Math.max(1, Math.round(club.avgDistance));
}


export function HoleView({ onBack, onViewFinalScorecard }: Props) {
  const {
    phase,
    course,
    courseName,
    currentHoleIndex,
    shotContext,
    holeStrokes,
    scores,
    bag,
    roundShots,
    confidenceBoost,
    shotPowerPercent,
    setShotPowerPercent,
    aimXOffset,
    setAimXOffset,
    selectClub,
    takeShot,
    lastShotResult,
    playMode,
    playerSkillLevel,
    shotInProgress,
    currentHolePutts,
    hasTakenFirstPutt,
    executeAutoPutts,
  } = useGameStore();
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showMobileScorecard, setShowMobileScorecard] = useState(false);
  const [selectedClub, setSelectedClub] = useState<SimClub | null>(null);
  const [landingHistory, setLandingHistory] = useState<LandingHistoryItem[]>([]);

  useEffect(() => {
    if (lastShotResult) {
      setSelectedClub(null);
    }
  }, [lastShotResult]);

  useEffect(() => {
    const landing = lastShotResult?.landing;
    if (!landing) return;
    if (lastShotResult.finalOutcome === "ob") return;
    setLandingHistory((prev) => [
      ...prev,
      {
        origin: lastShotResult.origin ?? { x: shotContext.originX, y: shotContext.originY },
        landing,
      },
    ]);
  }, [lastShotResult, shotContext.originX, shotContext.originY]);

  useEffect(() => {
    setLandingHistory([]);
  }, [currentHoleIndex]);
  const personalData = useClubStore((state) => state.personalData);
  const allClubs = useClubStore((state) => state.clubs);

  const currentHole = course[currentHoleIndex];
  if (!currentHole) return null;

  const courseCondition = currentHole.groundCondition ?? {
    hardness: "medium" as const,
    slopeAngle: 0,
    slopeDirection: 0,
  };
  const formatGroundHardnessLabel = (hardness: typeof courseCondition.hardness) =>
    hardness === "soft" ? "柔らかい" : hardness === "firm" ? "硬い" : "普通";
  const formatSlopeLabel = (angle: number, direction: number) =>
    angle === 0 ? "フラット" : `${Math.abs(angle)}° / ${direction}°`;
  const formatWindDetail = (strength: number) => {
    if (!strength) return "風なし";
    // mph to m/s conversion: 1 mph = 0.44704 m/s
    const windMps = (strength * 0.44704).toFixed(1);
    return `${windMps} m/s`;
  };
  const getWindColorClass = (strength: number) => {
    if (!strength) return "";
    // 低: 0-8 mph, 中: 9-14 mph, 高: 15+ mph
    if (strength <= 8) return "";
    if (strength <= 14) return "text-yellow-600";
    return "text-red-600";
  };

  const getWindArrowRotation = (direction?: number) => {
    if (typeof direction !== "number") return 0;
    // 0° = 北（上）、90° = 東（右）、180° = 南（下）、270° = 西（左）
    // CSSのrotationは時計回りなので、そのまま使用
    return direction;
  };

  const { remainingDistance, lie, windStrength = 0, windDirectionDegrees } = shotContext;
  const { robotHeadSpeed, robotSkillLevel } = loadRangePlayerSettings();
  const seatType = playMode === "robot" ? "robot" : "personal";
  const displayedSkillLevel = playMode === "robot" ? robotSkillLevel : playerSkillLevel;
  const displayedSkillLabel = getSkillLabel(displayedSkillLevel);
  const completedRelativeToPar = scores.reduce((sum, s) => sum + (s.strokes - s.par), 0);
  const currentHoleRelativeToPar =
    phase === "playing" && holeStrokes > 0 ? holeStrokes - currentHole.par : 0;
  const cumulativeRelativeToPar = completedRelativeToPar + currentHoleRelativeToPar;
  const scoreLabel =
    cumulativeRelativeToPar > 0
      ? `+${cumulativeRelativeToPar}`
      : cumulativeRelativeToPar < 0
        ? `${cumulativeRelativeToPar}`
        : "E";
  const showScoreDisplay = currentHoleIndex > 0 || phase !== "playing";
  const isResultActionVisible = phase === "hole_complete" || phase === "round_complete";
  const analysisPenaltyByClubId = useMemo(
    () => buildAnalysisPenaltyByClubId(allClubs),
    [allClubs],
  );
  const clubPreview = useMemo(() => {
    const preview = new Map<string, { effectiveRate: number }>();
    const isRobotMode = playMode === "robot";

    for (const club of bag) {
      const effectiveRate = isRobotMode
        ? 100
        : calculateDisplayClubSuccessRate(
            club,
            resolvePersonalDataForSimClub(club, personalData),
            playerSkillLevel,
            analysisPenaltyByClubId[club.id] ?? 0,
          );

      preview.set(club.id, { effectiveRate });
    }

    return preview;
  }, [analysisPenaltyByClubId, bag, personalData, playMode, playerSkillLevel]);

  const recommendedClubs = useMemo(
    () => {
      const estimatedDistances = new Map<string, number>();
      for (const club of bag) {
        estimatedDistances.set(
          club.id,
          estimateBaseDistanceWithMode(club, seatType, robotHeadSpeed),
        );
      }

      const scoredClubs = [...bag].sort((a, b) => {
        const distanceA = estimatedDistances.get(a.id) ?? 0;
        const distanceB = estimatedDistances.get(b.id) ?? 0;
        const gapA = Math.abs(distanceA - remainingDistance);
        const gapB = Math.abs(distanceB - remainingDistance);
        if (gapA !== gapB) return gapA - gapB;
        return distanceB - distanceA;
      });

      if (lie === "green") {
        return scoredClubs.filter((club) => club.type === "Putter");
      }

      // ティーグラウンド以外ではドライバーを除外、ラフではWoodも除外
      return scoredClubs
        .filter((club) => club.type !== "Putter" && (lie === "tee" || club.type !== "Driver") && !(lie === "rough" && club.type === "Wood"))
        .slice(0, 5);
    },
    [
      bag,
      lie,
      remainingDistance,
      windStrength,
      seatType,
      robotHeadSpeed,
    ],
  );

  const estimatedDistanceByClub = useMemo(() => {
    const distances = new Map<string, number>();
    for (const club of bag) {
      distances.set(
        club.id,
        estimateBaseDistanceWithMode(club, seatType, robotHeadSpeed),
      );
    }
    return distances;
  }, [bag, seatType, robotHeadSpeed]);

  const allClubsSorted = useMemo(
    () => {
      return [...bag].sort((a, b) => {
        const distanceA = estimatedDistanceByClub.get(a.id) ?? 0;
        const distanceB = estimatedDistanceByClub.get(b.id) ?? 0;
        if (distanceB !== distanceA) return distanceB - distanceA;
        return a.number.localeCompare(b.number, "ja");
      });
    },
    [bag, estimatedDistanceByClub],
  );
  const clubsToRender = showAllClubs ? allClubsSorted : recommendedClubs;
  const recommendedClubIds = new Set(recommendedClubs.map((club) => club.id));
  const clubStatsToday = useMemo(() => {
    const stats = new Map<string, { attempts: number; successes: number }>();

    for (const shot of roundShots) {
      const current = stats.get(shot.clubId) ?? { attempts: 0, successes: 0 };
      current.attempts += 1;
      if (shot.success) current.successes += 1;
      stats.set(shot.clubId, current);
    }

    return stats;
  }, [roundShots]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const handleQuitGame = () => {
    setShowQuitConfirm(true);
  };

  const handleConfirmQuitGame = () => {
    setShowQuitConfirm(false);
    onBack();
  };

  const transientLandingResult = lastShotResult?.finalOutcome === "ob"
    ? (lastShotResult.landing ?? null)
    : null;
  const isGreenLie = lie === "green";
  const isHoleComplete = phase === "hole_complete" || phase === "round_complete";
  const currentStrokeLabel = isHoleComplete
    ? `${holeStrokes}打でホールアウト`
    : isGreenLie
      ? `${holeStrokes + 1}打目 (パット)`
      : `${holeStrokes + 1}打目`;
  const shotResultTitle = lastShotResult?.newRemainingDistance === 0 ? "最終結果" : "結果";
  const showGreenRemaining = lastShotResult?.finalOutcome === "green" && (lastShotResult.newRemainingDistance ?? 0) > 0;
  const lastShotLog = roundShots.length > 0 ? roundShots[roundShots.length - 1] : null;
  const lastShotClub = lastShotLog ? bag.find((club) => club.id === lastShotLog.clubId) : null;
  const lastShotWasPutter = lastShotClub?.type === "Putter";
  const hazardFeedbackMessage = lastShotResult && ["bunker", "water", "rough", "ob"].includes(lastShotResult.finalOutcome)
    ? lastShotResult.finalOutcome === "water"
      ? "ウォーターハザードに入ってしまいました。次は救済またはペナルティで続けます。"
      : lastShotResult.finalOutcome === "bunker"
        ? "バンカーに入りました。落ち着いて次の1打を狙いましょう。"
        : lastShotResult.finalOutcome === "rough"
          ? "ラフにつかまりました。次は脱出を意識しましょう。"
          : "OB でした。仕切り直して次のショットを打ちましょう。"
    : null;
  const resultDistanceLabel = lastShotResult?.finalOutcome === "green"
    ? lastShotWasPutter
      ? `パット距離: ${(lastShotResult.distanceHit ?? 0).toFixed(1)}yd`
      : `飛距離: ${(lastShotResult.distanceHit ?? 0).toFixed(1)}yd`
    : `飛距離: ${((lastShotResult?.landing?.totalDistance ?? lastShotResult?.distanceHit ?? 0)).toFixed(1)}yd`;
  const resultOutcomeLabel = lastShotResult?.finalOutcome === "green"
    ? lastShotResult.newRemainingDistance === 0
      ? "カップイン"
      : "グリーン"
    : lastShotResult?.finalOutcome === "fairway"
      ? "フェアウェイ"
      : lastShotResult?.finalOutcome === "rough"
        ? "ラフ"
        : lastShotResult?.finalOutcome === "bunker"
          ? "バンカー"
          : lastShotResult?.finalOutcome === "water"
            ? "ウォーター"
            : "OB";
  const showShotBadges = !isGreenLie;
  const selectedClubEstimatedDistance = selectedClub
    ? estimatedDistanceByClub.get(selectedClub.id) ?? null
    : null;
  const selectedAimPoint = selectedClubEstimatedDistance !== null
    ? { x: aimXOffset, y: selectedClubEstimatedDistance }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 text-emerald-900">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-emerald-300 bg-emerald-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 text-xs font-semibold tracking-wide text-emerald-800 sm:h-16 sm:gap-4 sm:text-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <span>{currentHole.number}H</span>
            <span className="text-emerald-500">|</span>
            <span>PAR {currentHole.par}</span>
            <span className="text-emerald-500">|</span>
            <span>{currentHole.distanceFromTee}ヤード</span>
            <span className={["rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[0.08em]", playMode === "robot" ? "border-sky-300 bg-sky-50 text-sky-800" : playMode === "measured" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"].join(" ")}>
              {playMode === "robot" ? "ロボットプレイ中" : playMode === "measured" ? "実測データプレイ中" : "ゴルフバッグプレイ中"}
            </span>
            {playMode === "robot" && (
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-sky-800">
                ヘッドスピード {robotHeadSpeed.toFixed(1)} m/s
              </span>
            )}
            {playMode !== "measured" && (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-emerald-900">
                適用スキルレベル {(displayedSkillLevel * 100).toFixed(0)}% ({displayedSkillLabel})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {showScoreDisplay && (
              <span className="font-semibold text-emerald-900">スコア {scoreLabel}</span>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-emerald-400/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-500 hover:text-emerald-900 sm:text-xs"
            >
              ホームに戻る
            </button>
            <button
              type="button"
              onClick={handleQuitGame}
              className="rounded-full border border-emerald-400/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-rose-400/70 hover:text-rose-700 sm:text-xs"
            >
              ラウンド終了
            </button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={showQuitConfirm}
        title="ラウンド終了の確認"
        message="このラウンドを終了してクラブ管理に戻りますか？"
        confirmLabel="終了する"
        cancelLabel="キャンセル"
        onCancel={() => setShowQuitConfirm(false)}
        onConfirm={handleConfirmQuitGame}
      />
      {courseName && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 px-5 py-3 text-center shadow-sm shadow-emerald-300/40">
            <h1 className="text-lg font-black text-emerald-900 tracking-tight sm:text-xl">
              {courseName}
            </h1>
          </div>
        </div>
      )}
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-2 sm:px-6 sm:pt-1">
        {shotInProgress && (
          <div className="fixed inset-0 z-50 cursor-wait bg-black/0 pointer-events-auto" />
        )}
        <div className="mb-4 lg:hidden">
          {showScoreDisplay && (
            <>
              <button
                type="button"
                onClick={() => setShowMobileScorecard((prev) => !prev)}
                className="w-full rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:border-emerald-500"
              >
                {showMobileScorecard ? "スコアカードを閉じる" : "スコアカードを開く"}
              </button>
              {showMobileScorecard && (
                <CompactScorecard
                  course={course}
                  scores={scores}
                  currentHoleIndex={currentHoleIndex}
                  holeStrokes={holeStrokes}
                  phase={phase}
                  className="mt-3"
                />
              )}
            </>
          )}

          <section className="mt-3 rounded-3xl border border-emerald-300 bg-emerald-50/90 px-4 py-8 shadow-sm shadow-emerald-300/30 sm:px-6 sm:py-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-[0.2em] text-emerald-700 sm:text-base">コース情報</h2>
              <span className="text-xs font-medium text-emerald-700">{currentHole.number}H / PAR {currentHole.par}</span>
            </div>

            <div className="mt-6 w-full">
              <HoleMapCanvas
                hole={currentHole}
                landingResults={[]}
                showTrajectories={false}
                useExtendedYAxis
                currentHoleKey={currentHoleIndex}
                holeComplete={false}
                showViewportResetButton={false}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm">
                地面: {formatGroundHardnessLabel(courseCondition.hardness)}
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm">
                傾斜: {formatSlopeLabel(courseCondition.slopeAngle, courseCondition.slopeDirection)}
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm flex items-center gap-2">
                <span className={getWindColorClass(windStrength)}>風: {formatWindDetail(windStrength)}</span>
                {windStrength > 0 && (
                  <span
                    className="inline-block"
                    style={{ transform: `rotate(${getWindArrowRotation(windDirectionDegrees)}deg)` }}
                  >
                    ↑
                  </span>
                )}
              </span>
            </div>
          </section>
        </div>

        <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6">
          <div>
        {confidenceBoost > 0 && (
          <section className="mb-4 rounded-2xl border border-lime-300/70 bg-lime-100 px-5 py-4 text-lime-900 shadow-sm shadow-lime-200/50 sm:mb-6">
            <p className="text-xs font-bold tracking-[0.25em] text-lime-700">勢いボーナス発動中</p>
            <p className="mt-2 text-sm sm:text-base">良いショットが3連続したので、次の1打に成功率 +{confidenceBoost}% が付きます。</p>
          </section>
        )}




        <section className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-emerald-300 bg-emerald-50/90 px-4 py-6 shadow-sm shadow-emerald-300/40 sm:px-6 sm:py-8">
          {/* 3Dパースペクティブビュー */}
          <div className="w-full max-w-4xl">
            <PerspectiveHoleView
              hole={currentHole}
              shotContext={shotContext}
              aimXOffset={aimXOffset}
              selectedClub={selectedClub}
              lastShotResult={lastShotResult}
              strokeLabel={currentStrokeLabel}
              className="h-72 sm:h-80"
            />
          </div>

        {/* ショット結果表示（インライン） */}
        {lastShotResult && (() => {
          // 結果評価を計算
          const isPutter = lastShotClub?.type === "Putter";
          const evaluation = evaluateShotResult(
            lastShotResult.finalOutcome,
            lastShotResult.shotQuality,
            lastShotResult.wasSuccessful,
            lastShotResult.newRemainingDistance,
            isPutter,
          );

          // ホール完了時のスコア演出
          const scoreCelebration = isHoleComplete && currentHole
            ? getScoreCelebration(holeStrokes, currentHole.par)
            : null;

          return (
          <div className="mt-8 w-full max-w-md mx-auto rounded-2xl border border-emerald-300 bg-emerald-50/95 p-5 shadow-xl shadow-emerald-300/40">
            {/* スコア演出バナー（ホール完了時） */}
            {scoreCelebration && (
              <div className={`mb-4 rounded-2xl px-4 py-4 text-center ${scoreCelebration.bgClass} ${scoreCelebration.animationClass}`}>
                <div className="text-3xl mb-1">{scoreCelebration.emoji}</div>
                <div className={`text-xl font-black ${scoreCelebration.textClass}`}>
                  {scoreCelebration.label}
                </div>
                <div className={`text-sm font-semibold mt-1 ${scoreCelebration.textClass} opacity-80`}>
                  {holeStrokes}打 / PAR {currentHole.par}
                </div>
                {currentHolePutts > 0 && (
                  <div className={`text-xs mt-1 ${scoreCelebration.textClass} opacity-70`}>
                    パット {currentHolePutts} 回
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 rounded-3xl border border-emerald-200 bg-emerald-100 px-4 py-4 shadow-sm shadow-emerald-100/80">
              {/* 横方向レイアウト */}
              <div className="flex items-center gap-4">
                {/* 左側：評価と結果 */}
                <div className="flex-shrink-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-2">{shotResultTitle}</div>
                  {/* 評価バッジ */}
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-bold text-white shadow-md"
                    style={{ backgroundColor: evaluation.color }}
                  >
                    <span className="text-base">{evaluation.icon}</span>
                    <span className="text-sm">{evaluation.label}</span>
                  </div>
                </div>

                {/* 中央：評価スコアプログレスバー */}
                <div className="flex-shrink-0 w-32">
                  <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
                    <span>評価</span>
                    <span className="font-bold">{evaluation.score}点</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${evaluation.score}%`,
                        backgroundColor: evaluation.color,
                      }}
                    />
                  </div>
                </div>

                {/* 右側：結果情報 */}
                <div className="flex-1 text-left">
                  <div className="text-xl font-bold text-emerald-900">
                    {resultOutcomeLabel}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-emerald-800">{resultDistanceLabel}</span>
                    {lastShotResult.penaltyStrokes > 0 && (
                      <span className="text-xs text-rose-700">罰打 +{lastShotResult.penaltyStrokes}</span>
                    )}
                    {showGreenRemaining && (
                      <span className="text-xs text-sky-800">残り {lastShotResult.newRemainingDistance}ヤード</span>
                    )}
                  </div>
                  {hazardFeedbackMessage && (
                    <p className="mt-1 text-xs text-emerald-700">{hazardFeedbackMessage}</p>
                  )}
                </div>
              </div>
              {lastShotResult.nextShotAdvice && (
                <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  {lastShotResult.nextShotAdvice}
                </p>
              )}
            </div>

            {showShotBadges && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-emerald-800">
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    backgroundColor: evaluation.bgColor,
                    color: evaluation.color,
                    border: `1px solid ${evaluation.color}`,
                  }}
                >
                  {SHOT_QUALITY_LABEL[lastShotResult.shotQuality] ?? lastShotResult.shotQuality}
                </span>
                {lastShotResult.landing && (
                  <>
                    <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                      キャリー {lastShotResult.landing.carry.toFixed(1)}yd
                    </span>
                    <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                      ラン {lastShotResult.landing.roll.toFixed(1)}yd
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 自動パット結果の詳細表示 */}
            {lastShotResult.autoPuttResult && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <p className="text-sm font-bold text-sky-800 mb-2">自動パット結果</p>
                <div className="space-y-1">
                  {lastShotResult.autoPuttResult.puttDetails.map((detail) => (
                    <div key={detail.puttNumber} className="flex items-center justify-between text-xs">
                      <span className="text-sky-700">
                        {detail.puttNumber}パット目: {detail.fromDistance.toFixed(1)}yd
                      </span>
                      <span className={detail.success ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                        {detail.success ? "成功" : `残り ${detail.remainingAfterPutt.toFixed(1)}yd`}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-bold text-sky-800 mt-2 text-right">
                  合計 {currentHolePutts} パット
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {lastShotResult.confidenceBoostApplied && (
                <span className="rounded-full border border-lime-300/70 bg-lime-100 px-3 py-1 text-lime-800">
                  勢いボーナス適用
                </span>
              )}
              {!lastShotResult.confidenceBoostApplied && confidenceBoost > 0 && !isHoleComplete && (
                <span className="rounded-full border border-lime-300/70 bg-lime-100 px-3 py-1 text-lime-800">
                  次の1打 +{confidenceBoost}%
                </span>
              )}
            </div>

            {/* 続ける/次のホールへ/スコアカードを見るボタン */}
            <div className="mt-4">
              {phase === "hole_complete" ? (
                <button
                  onClick={useGameStore.getState().advanceHole}
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
                >
                  次のホールへ
                </button>
              ) : phase === "round_complete" ? (
                <button
                  onClick={onViewFinalScorecard}
                  className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
                >
                  スコアカードを見る
                </button>
              ) : null}
            </div>
          </div>
          );
        })()}

        {/* グリーン上での自動パットボタン（結果パネルの下） */}
        {isGreenLie && hasTakenFirstPutt && lastShotResult && lastShotResult.newRemainingDistance > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={executeAutoPutts}
              disabled={shotInProgress}
              className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-300/50 transition hover:bg-sky-400 disabled:opacity-50"
            >
              残りのパットを自動で打つ ({currentHolePutts}パット目)
            </button>
          </div>
        )}
        </section>

        {/* おすすめクラブセクション ...existing code... */}

        {/* ショット操作グループ */}
        <section className={["mt-8 w-full max-w-md mx-auto flex flex-col gap-5", isGreenLie || (selectedClub?.type === "Putter") ? "items-center" : "items-stretch", "lg:max-w-none lg:flex-row lg:items-center"].join(" ")}>
          {/* 狙い調整スライダー */}
          <div className={["w-full rounded-xl border px-3 py-3 lg:flex-1", selectedClub && !isResultActionVisible && !isGreenLie && selectedClub.type !== "Putter" ? "border-sky-400/80 bg-sky-50/90" : "border-sky-300/70 bg-sky-50/80"].join(" ")}>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-[0.08em] text-sky-800">
              <span>方向</span>
              <span>
                {aimXOffset > 0 ? `右 ${aimXOffset}yd` : aimXOffset < 0 ? `左 ${Math.abs(aimXOffset)}yd` : "中央"}
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={aimXOffset}
              onChange={e => setAimXOffset(Number(e.target.value))}
              className={["h-1.5 w-full appearance-none rounded-full", selectedClub && !isResultActionVisible && !isGreenLie && selectedClub.type !== "Putter" ? "cursor-pointer bg-sky-200 accent-sky-600" : "cursor-not-allowed bg-sky-100 accent-sky-300"].join(" ")}
              aria-label="方向"
              disabled={!selectedClub || isResultActionVisible || isGreenLie || selectedClub?.type === "Putter"}
            />
            <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-sky-700">
              <span>左 50y</span>
              <span>中央</span>
              <span>右 50y</span>
            </div>
          </div>

          {/* ショットボタン */}
          <button
            type="button"
            disabled={!selectedClub || shotInProgress || isResultActionVisible}
            onClick={() => {
              if (selectedClub && !isResultActionVisible) {
                selectClub(selectedClub.id);
                takeShot();
              }
            }}
            className={[
              "w-full max-w-xs lg:w-48 rounded-2xl px-4 py-8 text-2xl font-black tracking-[0.08em] transition",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70",
              selectedClub && !shotInProgress && !isResultActionVisible
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-300/70 hover:bg-emerald-500"
                : "cursor-not-allowed bg-emerald-200 text-emerald-500"
            ].join(" ")}
          >
            ショット
          </button>

          {/* パワー調整スライダー */}
          <div className={["w-full rounded-xl border px-3 py-3 lg:flex-1", selectedClub && !isResultActionVisible && !isGreenLie && selectedClub.type !== "Putter" ? "border-emerald-400/80 bg-emerald-100/90" : "border-emerald-300/70 bg-emerald-100/70"].join(" ")}>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-[0.08em] text-emerald-800">
              <span>パワー</span>
              <span>{shotPowerPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={110}
              step={1}
              value={shotPowerPercent}
              onChange={e => setShotPowerPercent(Number(e.target.value))}
              className={["h-1.5 w-full appearance-none rounded-full", selectedClub && !isResultActionVisible && !isGreenLie && selectedClub.type !== "Putter" ? "cursor-pointer bg-emerald-200 accent-emerald-600" : "cursor-not-allowed bg-emerald-100 accent-emerald-300"].join(" ")}
              aria-label="ショットパワー"
              disabled={!selectedClub || isResultActionVisible || isGreenLie || selectedClub?.type === "Putter"}
            />
            <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-emerald-700">
              <span>0%</span>

              <span>110%</span>
            </div>
          </div>

        </section>


        {!isResultActionVisible && (
          <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-4 py-4 sm:mt-8 sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-emerald-900 sm:text-xl">
                {showAllClubs ? `全クラブ (${bag.length}本)` : "おすすめクラブ"}
              </h2>
              {bag.length > recommendedClubs.length && (
                <button
                  type="button"
                  onClick={() => setShowAllClubs((prev) => !prev)}
                  className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-500 hover:text-emerald-900 sm:text-sm"
                >
                  {showAllClubs ? "おすすめに戻す" : "全クラブを見る"}
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clubsToRender.map((club) => {
                const isRecommended = !showAllClubs && recommendedClubIds.has(club.id);
                const effectiveRate = clubPreview.get(club.id)?.effectiveRate ?? club.successRate;
                const todayStats = clubStatsToday.get(club.id);
                const todayRate = todayStats && todayStats.attempts > 0
                  ? Math.round((todayStats.successes / todayStats.attempts) * 100)
                  : null;

                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => setSelectedClub(club)}
                    className={[
                      "w-full rounded-xl border bg-emerald-50 p-4 text-left transition active:scale-[0.99]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70",
                      isRecommended
                        ? "border-emerald-400/80 shadow-sm shadow-emerald-200/60"
                        : "border-emerald-200 hover:border-emerald-400/80",
                      selectedClub && selectedClub.id === club.id ? "ring-2 ring-emerald-400" : ""
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <p className="flex items-center gap-2 text-base font-bold text-emerald-900">
                        <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
                          {formatSimClubLabel(club)}
                        </span>
                        <span>{club.name}</span>
                      </p>
                      {showAllClubs && recommendedClubIds.has(club.id) && (
                        <span className="rounded-full border border-lime-300/70 bg-lime-100 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-lime-800">
                          おすすめ5本
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-emerald-700">推定飛距離: {(estimatedDistanceByClub.get(club.id) ?? 0).toFixed(1)}ヤード</p>
                    {playMode !== "measured" && (
                      <p className="mt-1 text-sm text-emerald-700">
                        クラブ成功率: {effectiveRate}%
                      </p>
                    )}
                    {todayRate !== null && (
                      <p className="mt-1 text-xs text-emerald-700">
                        今日の成功: {todayStats?.successes}/{todayStats?.attempts}本 ({todayRate}%)
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ...existing code... */}
          </section>
        )}
          </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          {showScoreDisplay && (
            <CompactScorecard
              course={course}
              scores={scores}
              currentHoleIndex={currentHoleIndex}
              holeStrokes={holeStrokes}
              phase={phase}
            />
          )}

          <section className="mt-4 rounded-3xl border border-emerald-300 bg-emerald-50/90 px-3 py-4 shadow-sm shadow-emerald-300/30">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold tracking-[0.16em] text-emerald-700">コース情報</h2>
              <span className="text-[11px] font-medium text-emerald-700">{currentHole.number}H / PAR {currentHole.par}</span>
            </div>

            <div className="mt-3 w-full">
              <HoleMapCanvas
                hole={currentHole}
                landingResults={landingHistory}
                transientLandingResult={transientLandingResult}
                aimPoint={selectedAimPoint}
                shotOrigin={{ x: shotContext.originX, y: shotContext.originY }}
                highlightPoint={shotContext.penaltyDropOrigin ?? (lastShotResult?.finalOutcome === "water" ? lastShotResult.penaltyDropOrigin : null)}
                showTrajectories
                useExtendedYAxis
                currentHoleKey={currentHoleIndex}
                holeComplete={isHoleComplete}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm">
                地面: {formatGroundHardnessLabel(courseCondition.hardness)}
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm">
                傾斜: {formatSlopeLabel(courseCondition.slopeAngle, courseCondition.slopeDirection)}
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm flex items-center gap-2">
                <span className={getWindColorClass(windStrength)}>風: {formatWindDetail(windStrength)}</span>
                {windStrength > 0 && (
                  <span
                    className="inline-block"
                    style={{ transform: `rotate(${getWindArrowRotation(windDirectionDegrees)}deg)` }}
                  >
                    ↑
                  </span>
                )}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </main>
  </div>
  );
}
