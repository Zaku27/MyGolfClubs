import React from "react";
import { formatSimClubLabel } from "../../utils/simClubLabel";

interface ShotActionPanelProps {
  selectedClub: any;
  selectedClubIsUnstable: boolean;
  selectedEffectiveRate: number | null;
  selectedTodayRate: number | null;
  selectedTodayStats: { successes: number; attempts: number } | undefined;
  shotPowerPercent: number;
  setShotPowerPercent: (value: number) => void;
  onTakeShot: () => void;
  showResultModal: boolean;
}

export const ShotActionPanel: React.FC<ShotActionPanelProps> = ({
  selectedClub,
  selectedClubIsUnstable,
  selectedEffectiveRate,
  selectedTodayRate,
  selectedTodayStats,
  shotPowerPercent,
  setShotPowerPercent,
  onTakeShot,
  showResultModal,
}) => (
  <div className="rounded-xl shadow-lg border border-emerald-300/70 bg-white/90 p-4 space-y-3 w-80 max-w-full">
    <div
      className={[
        "rounded-xl px-3 py-3",
        selectedClub && selectedClubIsUnstable
          ? "border border-amber-300/70 bg-amber-50 text-amber-900"
          : "border border-emerald-300/70 bg-emerald-100/70 text-emerald-900",
      ].join(" ")}
    >
      <p
        className={[
          "text-[11px] font-bold tracking-[0.16em]",
          selectedClub && selectedClubIsUnstable ? "text-amber-700" : "text-emerald-700",
        ].join(" ")}
      >
        ショット方針の注意
      </p>
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

    <p className="text-center text-xs font-medium text-emerald-700">
      {selectedClub ? `${formatSimClubLabel(selectedClub)} で打つ` : "先にクラブを選択してください"}
    </p>

    <div className="rounded-xl border border-emerald-300/70 bg-emerald-100/70 px-3 py-3">
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
        onChange={(event) => setShotPowerPercent(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200 accent-emerald-600"
        aria-label="ショットパワー"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-emerald-700">
        <span>0%</span>
        <span>100%</span>
        <span>110%</span>
      </div>
    </div>

    <button
      type="button"
      onClick={onTakeShot}
      disabled={!selectedClub || showResultModal}
      className={[
        "w-full rounded-2xl px-4 py-6 text-lg font-black tracking-[0.08em] transition",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70",
        selectedClub && !showResultModal
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-300/70 hover:bg-emerald-500"
          : "cursor-not-allowed bg-emerald-200 text-emerald-500",
      ].join(" ")}
    >
      ショット
    </button>
  </div>
);
