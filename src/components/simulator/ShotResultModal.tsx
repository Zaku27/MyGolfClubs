import type { ShotQuality } from "../../types/game";
import { useGameStore } from "../../store/gameStore";

interface Props {
  onDismiss: () => void;
  onAdvance?: () => void;
}

const QUALITY_ICON: Record<ShotQuality, string>  = {
  excellent: "🌟", good: "✅", average: "👍", poor: "😬", mishit: "💥",
};

export function ShotResultModal({ onDismiss, onAdvance }: Props) {
  const { lastShotResult, phase, scores, lastHoleSummary, confidenceBoost } = useGameStore();

  // 自動で進める: phaseがhole_completeまたはround_complete以外ならonDismissを即時実行
  if (lastShotResult && phase !== "hole_complete" && phase !== "round_complete") {
    setTimeout(() => {
      onDismiss();
    }, 800); // 0.8秒だけ表示して自動で閉じる
  }

  if (!lastShotResult) return null;

  const {
    outcomeMessage,
    shotQuality,
    newRemainingDistance,
    penalty,
    effectiveSuccessRate,
    confidenceBoostApplied,
    landing,
  } = lastShotResult;
  const holeComplete = phase === "hole_complete" || phase === "round_complete";
  const lastScore    = holeComplete ? scores[scores.length - 1] : null;
  const scoreDiff = lastScore ? lastScore.strokes - lastScore.par : null;

  const mainLabel =
    penalty
      ? "ペナルティ"
      : newRemainingDistance === 0
        ? "カップイン"
        : shotQuality === "excellent"
          ? "会心のショット"
          : shotQuality === "good"
            ? "ナイスショット"
            : shotQuality === "average"
              ? "まずまずの一打"
              : shotQuality === "poor"
                ? "ミス気味"
                : "苦しい結果";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center sm:p-6" onClick={onDismiss}>
      <div
        className="w-full max-w-md rounded-2xl border border-emerald-300 bg-emerald-50/95 p-5 shadow-xl shadow-emerald-300/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl leading-none">{QUALITY_ICON[shotQuality]}</span>
          <div>
            <p className="text-lg font-bold text-emerald-900">{mainLabel}</p>
            <p className="text-sm text-emerald-700">飛距離: {(landing?.totalDistance ?? lastShotResult.distanceHit).toFixed(1)}ヤード</p>
          </div>
          {penalty && (
            <div className="ml-auto rounded-md border border-red-300/70 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
              +1
            </div>
          )}
        </div>

        <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-100/80 p-3 text-sm leading-relaxed text-emerald-800">
          {outcomeMessage}
        </p>

        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold text-emerald-800">
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
            実効成功率 {effectiveSuccessRate}%
          </span>
          {landing && (
            <>
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                キャリー {landing.carry.toFixed(1)}y
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                ラン {landing.roll.toFixed(1)}y
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1">
                着地 X:{landing.finalX.toFixed(1)} / Y:{landing.finalY.toFixed(1)}
              </span>
            </>
          )}
          {confidenceBoostApplied && (
            <span className="rounded-full border border-lime-300/70 bg-lime-100 px-3 py-1 text-lime-800">
              勢いボーナス適用
            </span>
          )}
          {!confidenceBoostApplied && confidenceBoost > 0 && (
            <span className="rounded-full border border-lime-300/70 bg-lime-100 px-3 py-1 text-lime-800">
              次の1打 +{confidenceBoost}%
            </span>
          )}
        </div>

        {holeComplete && lastScore && scoreDiff !== null && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-emerald-300 bg-emerald-100/70 p-3 text-sm text-emerald-800">
            <div>{lastScore.holeNumber}H</div>
            <div className="text-right">PAR {lastScore.par}</div>
            <div>打数 {lastScore.strokes}</div>
            <div className="text-right font-semibold">
              スコア {scoreDiff === 0 ? "E" : scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
            </div>
          </div>
        )}

        {holeComplete && lastHoleSummary && (
          <div className="mb-4 rounded-2xl border border-sky-300/70 bg-sky-100/80 p-4 text-sky-900">
            <p className="text-sm font-bold tracking-[0.22em] text-sky-700">ホールサマリー</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs tracking-[0.18em] text-sky-700/90">使用クラブ</p>
                <p className="mt-1 font-medium text-sky-900">
                  {lastHoleSummary.clubsUsed.length > 0 ? lastHoleSummary.clubsUsed.join("、") : "なし"}
                </p>
              </div>
              <div>
                <p className="text-xs tracking-[0.18em] text-sky-700/90">このホールの成功率</p>
                <p className="mt-1 font-medium text-sky-900">{lastHoleSummary.successRate}%</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-sky-300/70 bg-sky-50 p-3 text-sm text-sky-800">
              {lastHoleSummary.insight}
            </div>
          </div>
        )}

        {phase === "hole_complete" && onAdvance ? (
          <button
            onClick={onAdvance}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
          >
            次のホールへ
          </button>
        ) : phase === "round_complete" ? (
          <button
            onClick={onDismiss}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
          >
            スコアカードを見る
          </button>
        ) : null}
      </div>
    </div>
  );
}
