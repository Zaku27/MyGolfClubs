import type { Hole } from "../../types/game";
import { HoleMapCanvas } from "./HoleMapCanvas";

interface CourseInfoPreviewProps {
  hole: Hole;
  onClose: () => void;
}

function formatGroundCondition(condition?: Hole["groundCondition"]) {
  if (!condition) {
    return "地面: 標準";
  }

  return `地面: ${condition.hardness} / 傾斜 ${Math.abs(condition.slopeAngle)}° ${
    condition.slopeAngle === 0
      ? "平坦"
      : condition.slopeDirection === 0
        ? "ピン方向上り"
        : condition.slopeDirection === 90
          ? "右側上り"
          : condition.slopeDirection === 180
            ? "スライス方向"
            : condition.slopeDirection === 270
              ? "左側上り"
              : `${condition.slopeDirection}°`}
  `;
}

export function CourseInfoPreview({ hole, onClose }: CourseInfoPreviewProps) {
  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/40 p-4">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">コース情報プレビュー</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{hole.number}H • PAR {hole.par}</h2>
            <p className="text-sm text-slate-600">{targetDistance}ヤード</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <HoleMapCanvas
              hole={hole}
              landingResults={[]}
              showTrajectories={false}
              useExtendedYAxis
              currentHoleKey={hole.number}
              holeComplete={false}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">ホール</p>
              <p>{hole.number}H</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">パー</p>
              <p>{hole.par}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">距離</p>
              <p>{targetDistance}ヤード</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p>{formatGroundCondition(hole.groundCondition)}</p>
            {hole.hazards?.length ? (
              <p className="mt-2">ハザード: {hole.hazards.map((hazard) => hazard.name ?? hazard.type).join("、")}</p>
            ) : (
              <p className="mt-2">ハザード: なし</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
