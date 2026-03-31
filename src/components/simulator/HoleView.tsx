import { useGameStore } from "../../store/gameStore";
import { useMemo, useState, useEffect } from "react";
import type { LieType, SimClub } from "../../types/game";
import { useClubStore } from "../../store/clubStore";
import { estimateEffectiveSuccessRate } from "../../utils/shotSimulation";
import { formatSimClubLabel } from "../../utils/simClubLabel";
import { resolvePersonalDataForSimClub } from "../../utils/personalData";
import { CompactScorecard } from "./Scorecard";

interface Props {
  onBack: () => void;
}

const LIE_LABEL: Record<LieType, string> = {
  tee: "ティー",
  fairway: "フェアウェイ",
  rough: "ラフ",
  bunker: "バンカー",
  green: "グリーン",
  penalty: "ペナルティ",
};

export function HoleView({ onBack }: Props) {
  const {
    phase,
    course,
    currentHoleIndex,
    shotContext,
    holeStrokes,
    scores,
    bag,
    roundShots,
    confidenceBoost,
    shotPowerPercent,
    setShotPowerPercent,
    selectClub,
    takeShot,
    lastShotResult,
  } = useGameStore();
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showMobileScorecard, setShowMobileScorecard] = useState(false);
  const [selectedClub, setSelectedClub] = useState<SimClub | null>(null);

  // ショット結果モーダルが閉じられたらクラブ選択をリセット
  const showResultModal = useGameStore((state) => state.showResultModal);
  useEffect(() => {
    if (!showResultModal) {
      setSelectedClub(null);
    }
  }, [showResultModal]);
  const personalData = useClubStore((state) => state.personalData);
  const playerSkillLevel = useClubStore((state) => state.playerSkillLevel);

  const currentHole = course[currentHoleIndex];
  if (!currentHole) return null;

  const { remainingDistance, lie, hazards = [] } = shotContext;
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
  const clubPreview = useMemo(() => {
    const preview = new Map<string, { effectiveRate: number }>();

    for (const club of bag) {
      const effectiveRate = estimateEffectiveSuccessRate(
        club,
        { lie },
        "normal",
        {
          confidenceBoost,
          personalData: resolvePersonalDataForSimClub(club, personalData),
          playerSkillLevel,
        },
      );

      preview.set(club.id, { effectiveRate });
    }

    return preview;
  }, [bag, confidenceBoost, lie, personalData, playerSkillLevel]);

  const recommendedClubs = useMemo(
    () => {
      const scoredClubs = [...bag].sort((a, b) => {
        const gapA = Math.abs(a.avgDistance - remainingDistance);
        const gapB = Math.abs(b.avgDistance - remainingDistance);
        if (gapA !== gapB) return gapA - gapB;
        return b.avgDistance - a.avgDistance;
      });

      if (lie === "green") {
        return scoredClubs.filter((club) => club.type === "Putter");
      }
      // グリーン以外の時はPutterを除外
      return scoredClubs.filter((club) => club.type !== "Putter").slice(0, 5);
    },
    [bag, lie, remainingDistance],
  );
  const allClubsSorted = useMemo(
    () =>
      [...bag].sort((a, b) => {
        if (b.avgDistance !== a.avgDistance) return b.avgDistance - a.avgDistance;
        return a.number.localeCompare(b.number, "ja");
      }),
    [bag],
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
  const handleQuitGame = () => {
    const shouldQuit = window.confirm("このラウンドを終了してクラブ管理に戻りますか？");
    if (!shouldQuit) return;
    onBack();
  };

  // ショット注意案内の内容生成
  const selectedClubIsUnstable = selectedClub ? (selectedClub.isWeakClub === true || (clubPreview.get(selectedClub.id)?.effectiveRate ?? selectedClub.successRate) < 60) : false;
  const selectedEffectiveRate = selectedClub ? (clubPreview.get(selectedClub.id)?.effectiveRate ?? selectedClub.successRate) : null;
  const selectedTodayStats = selectedClub ? clubStatsToday.get(selectedClub.id) : undefined;
  const selectedTodayRate = selectedTodayStats && selectedTodayStats.attempts > 0 ? Math.round((selectedTodayStats.successes / selectedTodayStats.attempts) * 100) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 text-emerald-900">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-emerald-300 bg-emerald-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 text-xs font-semibold tracking-wide text-emerald-800 sm:h-16 sm:gap-4 sm:text-sm">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <span>{currentHole.number}H</span>
            <span className="text-emerald-500">|</span>
            <span>PAR {currentHole.par}</span>
            <span className="text-emerald-500">|</span>
            <span>スコア {scoreLabel}</span>
            <span className="text-emerald-500">|</span>
            <span>残り {remainingDistance}ヤード</span>
          </div>
          <button
            type="button"
            onClick={handleQuitGame}
            className="rounded-full border border-emerald-400/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-rose-400/70 hover:text-rose-700 sm:text-xs"
          >
            ラウンド終了
          </button>
        </div>
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-20 sm:px-6 sm:pt-24">
        <div className="mb-4 lg:hidden">
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
        </div>

        <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          <div>
        {confidenceBoost > 0 && (
          <section className="mb-4 rounded-2xl border border-lime-300/70 bg-lime-100 px-5 py-4 text-lime-900 shadow-sm shadow-lime-200/50 sm:mb-6">
            <p className="text-xs font-bold tracking-[0.25em] text-lime-700">勢いボーナス発動中</p>
            <p className="mt-2 text-sm sm:text-base">良いショットが3連続したので、次の1打に成功率 +{confidenceBoost}% が付きます。</p>
          </section>
        )}




        <section className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-emerald-300 bg-emerald-50/90 px-6 py-10 text-center shadow-sm shadow-emerald-300/40 sm:px-10 sm:py-14">
          <p className="text-sm tracking-[0.25em] text-emerald-600">現在の状況</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-emerald-900 sm:text-6xl">
            ピンまで {remainingDistance}ヤード
          </h1>
          <p className="mt-6 text-lg font-medium text-emerald-800 sm:text-2xl">ライ: {LIE_LABEL[lie]}</p>
          <p className="mt-1 text-lg font-medium text-emerald-800 sm:text-2xl">{holeStrokes + 1}打目</p>

          {/* ハザード表示（OB等）を打数の下に移動 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {hazards.length > 0 ? (
              hazards.map((hazard, index) => (
                <span
                  key={`${hazard}-${index}`}
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 sm:px-4 sm:text-sm"
                >
                  {hazard}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 sm:px-4 sm:text-sm">
                大きなハザードなし
              </span>
            )}
          </div>



        {/* ショット結果表示（インライン） */}
        {lastShotResult && (
          <div className="mt-8 w-full max-w-md mx-auto rounded-2xl border border-emerald-300 bg-emerald-50/95 p-5 shadow-xl shadow-emerald-300/40">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-4xl leading-none">
                {(() => {
                  const iconMap = { excellent: "🌟", good: "✅", average: "👍", poor: "😬", mishit: "💥" };
                  return iconMap[lastShotResult.shotQuality] || "";
                })()}
              </span>
              <div>
                <p className="text-lg font-bold text-emerald-900">
                  {lastShotResult.penalty
                    ? "ペナルティ"
                    : lastShotResult.newRemainingDistance === 0
                    ? "カップイン"
                    : lastShotResult.shotQuality === "excellent"
                    ? "会心のショット"
                    : lastShotResult.shotQuality === "good"
                    ? "ナイスショット"
                    : lastShotResult.shotQuality === "average"
                    ? "まずまずの一打"
                    : lastShotResult.shotQuality === "poor"
                    ? "ミス気味"
                    : "苦しい結果"}
                </p>
                <p className="text-sm text-emerald-700">飛距離: {lastShotResult.distanceHit}ヤード</p>
            </div>
              {lastShotResult.penalty && (
                <div className="ml-auto rounded-md border border-red-300/70 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                  +1
                </div>
              )}
            </div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold text-emerald-800">
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                実効成功率 {lastShotResult.effectiveSuccessRate}%
              </span>
              {lastShotResult.confidenceBoostApplied && (
                <span className="rounded-full border border-lime-300/70 bg-lime-100 px-3 py-1 text-lime-800">
                  勢いボーナス適用
                </span>
              )}
              {!lastShotResult.confidenceBoostApplied && confidenceBoost > 0 && (
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
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  次のホールへ
                </button>
              ) : phase === "round_complete" ? (
                <button
                  onClick={useGameStore.getState().dismissResult}
                  className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
                >
                  スコアカードを見る
                </button>
              ) : null}
              {/* 通常時は自動でdismissResultを呼ぶ */}
              {lastShotResult && phase !== "hole_complete" && phase !== "round_complete" && (
                (() => { setTimeout(() => useGameStore.getState().dismissResult(), 800); return null; })()
              )}
            </div>
          </div>
        )}
        </section>
        
        {/* おすすめクラブセクション ...existing code... */}

        {/* ショット操作グループ */}
        <section className="mt-8 w-full max-w-md mx-auto flex flex-col gap-5 items-stretch">
          {/* ショット方針の注意案内 */}
          <div className={[
            "rounded-xl px-4 py-3 text-left",
            selectedClub && selectedClubIsUnstable ? "border border-amber-300/70 bg-amber-50 text-amber-900" : "border border-emerald-300/70 bg-emerald-100/70 text-emerald-900"
          ].join(" ")}>
            <p className={["text-[11px] font-bold tracking-[0.16em]",
              selectedClub && selectedClubIsUnstable ? "text-amber-700" : "text-emerald-700"
            ].join(" ")}>ショット方針の注意</p>
            <p className="mt-1 text-xs sm:text-sm">
              {!selectedClub && "クラブを選ぶと、この位置にショット前の注意が表示されます。"}
              {selectedClub && !selectedClubIsUnstable && (
                selectedEffectiveRate !== null
                  ? `ショットは有効成功率:${selectedEffectiveRate}%で実行されます。`
                  : "ショットは有効成功率:--%で実行されます。"
              )}
              {selectedClub && selectedClubIsUnstable && (
                <>
                  {formatSimClubLabel(selectedClub)} は安定度が低めです。
                  {selectedEffectiveRate !== null ? ` 有効成功率 ${selectedEffectiveRate}%` : ""}
                  {selectedTodayRate !== null && selectedTodayStats
                    ? ` / 今日 ${selectedTodayStats.successes}/${selectedTodayStats.attempts}本 (${selectedTodayRate}%)`
                    : ""}
                </>
              )}
            </p>
          </div>

          {/* ショットボタン */}
          <button
            type="button"
            disabled={!selectedClub}
            onClick={() => {
              if (selectedClub) {
                selectClub(selectedClub.id);
                takeShot();
              }
            }}
            className={[
              "w-full rounded-2xl px-4 py-8 text-2xl font-black tracking-[0.08em] transition",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70",
              selectedClub ? "bg-emerald-600 text-white shadow-lg shadow-emerald-300/70 hover:bg-emerald-500" : "cursor-not-allowed bg-emerald-200 text-emerald-500"
            ].join(" ")}
          >
            ショット
          </button>

          {/* パワー調整スライダー */}
          <div className="w-full rounded-xl border border-emerald-300/70 bg-emerald-100/70 px-4 py-4">
            <div className="mb-2 flex items-center justify-between text-xs font-bold tracking-[0.08em] text-emerald-800">
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
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200 accent-emerald-600"
              aria-label="ショットパワー"
              disabled={!selectedClub}
            />
            <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-emerald-700">
              <span>0%</span>

              <span>110%</span>
            </div>
          </div>

        </section>


        <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-5 py-6 sm:mt-8 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-emerald-900 sm:text-2xl">
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
              const weakClub = club.isWeakClub === true || effectiveRate < 60;
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
                    <p className="text-base font-bold text-emerald-900">{formatSimClubLabel(club)}</p>
                    {showAllClubs && recommendedClubIds.has(club.id) && (
                      <span className="rounded-full border border-lime-300/70 bg-lime-100 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-lime-800">
                        おすすめ5本
                      </span>
                    )}
                    {weakClub && (
                      <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-bold tracking-[0.18em] text-amber-800">
                        不安定
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-emerald-700">平均飛距離: {club.avgDistance}ヤード</p>
                  <p className={`mt-1 text-sm ${weakClub ? "text-amber-700" : "text-emerald-700"}`}>
                    有効成功率(通常): {effectiveRate}%
                  </p>
                  {todayRate !== null && (
                    <p className={`mt-1 text-xs ${todayRate < 50 ? "text-amber-700" : "text-emerald-700"}`}>
                      今日の成功: {todayStats?.successes}/{todayStats?.attempts}本 ({todayRate}%)
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* ...existing code... */}
        </section>
          </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <CompactScorecard
            course={course}
            scores={scores}
            currentHoleIndex={currentHoleIndex}
            holeStrokes={holeStrokes}
            phase={phase}
          />
        </aside>
      </div>
    </main>
  </div>
  );
}
