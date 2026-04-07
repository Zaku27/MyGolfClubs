import { useEffect, useMemo, useState } from "react";
import type { GroundCondition, Hazard, HazardType, Hole } from "../../types/game";
import { generateRandomCourse } from "../../utils/courseGenerator";
import { buildAutoHazardName } from "../../utils/shotOutcome";
import { HoleMapCanvas } from "./HoleMapCanvas";

interface CourseEditorProps {
  holes: Hole[];
  onChange: (holes: Hole[]) => void;
}

function formatSlopeGuide(slopeAngle: number, slopeDirection: number): string {
  const normalizedDirection = ((slopeDirection % 360) + 360) % 360;
  const normalized = slopeAngle < 0
    ? { slopeAngle: Math.abs(slopeAngle), slopeDirection: (normalizedDirection + 180) % 360 }
    : { slopeAngle, slopeDirection: normalizedDirection };

  if (normalized.slopeAngle === 0) {
    return 'フラット: キャリー・ラン・横ブレの傾斜補正は入りません。';
  }

  let effect = '前後と左右の補正が混在します。';
  if (normalized.slopeDirection === 0) effect = 'ピン方向が上りになり、キャリーとランは減りやすくなります。';
  else if (normalized.slopeDirection === 180) effect = 'ピン方向が下りになり、キャリーとランは伸びやすくなります。';
  else if (normalized.slopeDirection === 90) effect = '右側が上りになり、左へ流れやすくなります。';
  else if (normalized.slopeDirection === 270) effect = '左側が上りになり、右へ流れやすくなります。';
  else if (normalized.slopeDirection > 0 && normalized.slopeDirection < 90) effect = '右前上りで、キャリーとランが減りつつ左へ流れやすくなります。';
  else if (normalized.slopeDirection > 90 && normalized.slopeDirection < 180) effect = '右後上りで、キャリーとランが伸びつつ左へ流れやすくなります。';
  else if (normalized.slopeDirection > 180 && normalized.slopeDirection < 270) effect = '左後上りで、キャリーとランが伸びつつ右へ流れやすくなります。';
  else if (normalized.slopeDirection > 270 && normalized.slopeDirection < 360) effect = '左前上りで、キャリーとランが減りつつ右へ流れやすくなります。';

  return `${normalized.slopeAngle}° / uphill ${normalized.slopeDirection}°: ${effect}`;
}

function toStoredSlopeDirection(slopeAngle: number, displayedDirection: number): number {
  const normalizedDirection = ((displayedDirection % 360) + 360) % 360;
  return slopeAngle < 0
    ? (normalizedDirection + 180) % 360
    : normalizedDirection;
}

const HAZARD_TYPE_LABEL: Record<HazardType, string> = {
  bunker: "バンカー",
  water: "ウォーター",
  ob: "OB",
  rough: "ラフ",
  semirough: "セミラフ",
  bareground: "ベアグラウンド",
};

const SLOPE_DIRECTION_PRESETS = [
  { label: '前', value: 0 },
  { label: '右', value: 90 },
  { label: '後', value: 180 },
  { label: '左', value: 270 },
];

function cloneHazards(hazards: Hazard[] | undefined): Hazard[] {
  return (hazards ?? []).map((hazard) => ({ ...hazard }));
}

function buildHazardNameFromPosition(xCenter: number, width: number, type: HazardType): string {
  return buildAutoHazardName(type, xCenter, width);
}

function buildEmptyHazard(hole: Hole): Hazard {
  const holeLength = hole.targetDistance ?? hole.distanceFromTee;
  const yFront = Math.round(holeLength * 0.45);
  const xCenter = 0;
  const type: HazardType = "bunker";

  return {
    id: `manual-${hole.number}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    shape: "rectangle",
    yFront,
    yBack: yFront + 18,
    xCenter,
    width: 30,
    penaltyStrokes: 0,
    groundCondition: {
      hardness: "medium",
      slopeAngle: 0,
      slopeDirection: 0,
    },
    name: buildHazardNameFromPosition(xCenter, 30, type),
  };
}

function getPenaltyStrokesByType(type: HazardType): 0 | 1 {
  if (type === "water" || type === "ob") return 1;
  return 0;
}

export function CourseEditor({ holes, onChange }: CourseEditorProps) {
  const [selectedHoleIndex, setSelectedHoleIndex] = useState(0);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);

  const safeHoleIndex = Math.max(0, Math.min(selectedHoleIndex, holes.length - 1));
  const selectedHole = holes[safeHoleIndex];

  const defaultGroundCondition: GroundCondition = {
    hardness: "medium",
    slopeAngle: 0,
    slopeDirection: 0,
  };

  const selectedHazard = useMemo(
    () => selectedHole?.hazards?.find((hazard) => hazard.id === selectedHazardId) ?? null,
    [selectedHazardId, selectedHole],
  );

  const selectedGroundCondition = selectedHazard?.groundCondition ?? selectedHole?.groundCondition ?? defaultGroundCondition;
  const normalizedSelectedSlope = (() => {
    const normalizedDirection = ((selectedGroundCondition.slopeDirection % 360) + 360) % 360;
    if (selectedGroundCondition.slopeAngle < 0) {
      return {
        slopeAngle: Math.abs(selectedGroundCondition.slopeAngle),
        slopeDirection: (normalizedDirection + 180) % 360,
      };
    }

    return {
      slopeAngle: selectedGroundCondition.slopeAngle,
      slopeDirection: normalizedDirection,
    };
  })();

  const updateGroundCondition = (updater: (condition: GroundCondition) => GroundCondition) => {
    if (!selectedHole) return;

    if (selectedHazard) {
      updateSelectedHazard((hazard) => ({
        ...hazard,
        groundCondition: updater(hazard.groundCondition ?? defaultGroundCondition),
      }));
      return;
    }

    updateHole((hole) => ({
      ...hole,
      groundCondition: updater(hole.groundCondition ?? defaultGroundCondition),
    }));
  };

  useEffect(() => {
    if (selectedHoleIndex >= holes.length) {
      setSelectedHoleIndex(Math.max(0, holes.length - 1));
    }
  }, [holes.length, selectedHoleIndex]);

  useEffect(() => {
    setSelectedHazardId(null);
  }, [safeHoleIndex]);

  const updateHole = (updater: (hole: Hole) => Hole) => {
    const next = holes.map((hole, index) => {
      if (index !== safeHoleIndex) {
        return {
          ...hole,
          hazards: cloneHazards(hole.hazards),
        };
      }

      return updater({
        ...hole,
        hazards: cloneHazards(hole.hazards),
      });
    });

    onChange(next);
  };

  const updateSelectedHoleHazards = (hazards: Hazard[]) => {
    updateHole((hole) => ({ ...hole, hazards }));
  };

  const addHazard = () => {
    if (!selectedHole) return;

    const newHazard = buildEmptyHazard(selectedHole);
    updateHole((hole) => ({
      ...hole,
      hazards: [...cloneHazards(hole.hazards), newHazard],
    }));
    setSelectedHazardId(newHazard.id);
  };

  const deleteSelectedHazard = () => {
    if (!selectedHole || !selectedHazardId) return;

    updateHole((hole) => ({
      ...hole,
      hazards: cloneHazards(hole.hazards).filter((hazard) => hazard.id !== selectedHazardId),
    }));
    setSelectedHazardId(null);
  };

  const updateSelectedHazard = (updater: (hazard: Hazard) => Hazard) => {
    if (!selectedHole || !selectedHazardId) return;

    const nextHazards = cloneHazards(selectedHole.hazards).map((hazard) => {
      if (hazard.id !== selectedHazardId) return hazard;
      return updater(hazard);
    });

    updateSelectedHoleHazards(nextHazards);
  };

  const randomizeAll = () => {
    const randomized = generateRandomCourse(holes.length || 9);
    onChange(randomized);
    setSelectedHoleIndex(0);
    setSelectedHazardId(null);
  };

  if (!selectedHole) {
    return null;
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-emerald-300 bg-white/80 p-4 shadow-sm shadow-emerald-300/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black tracking-[0.08em] text-emerald-900">コースエディタ</h2>
        <button
          type="button"
          onClick={randomizeAll}
          className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 transition hover:bg-sky-100"
        >
          ランダム生成
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {holes.map((hole, index) => (
          <button
            key={`edit-hole-${hole.number}`}
            type="button"
            onClick={() => {
              setSelectedHoleIndex(index);
              setSelectedHazardId(null);
            }}
            className={[
              "rounded-full border px-3 py-1 text-xs font-bold transition",
              index === safeHoleIndex
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
            ].join(" ")}
          >
            {hole.number}H
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-emerald-800">
          PAR
          <select
            value={selectedHole.par}
            onChange={(event) => {
              const par = Number(event.target.value) as 3 | 4 | 5;
              updateHole((hole) => ({ ...hole, par }));
            }}
            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
          >
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-semibold text-emerald-800">
          距離(yd)
          <input
            type="number"
            min={30}
            max={700}
            value={selectedHole.distanceFromTee}
            onChange={(event) => {
              const distance = Math.max(30, Math.min(700, Number(event.target.value) || 30));
              updateHole((hole) => ({
                ...hole,
                distanceFromTee: distance,
                targetDistance: distance,
              }));
            }}
            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold text-emerald-800">
          グリーン半径 (ヤード)
          <input
            type="number"
            min={6}
            max={25}
            value={selectedHole.greenRadius ?? 12}
            onChange={(event) => {
              const radius = Math.max(6, Math.min(25, Number(event.target.value) || 12));
              updateHole((hole) => ({ ...hole, greenRadius: radius }));
            }}
            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
          />
        </label>
      </div>

      <div className="mt-4 w-full max-w-screen-md">
        <HoleMapCanvas
          hole={selectedHole}
          landingResults={[]}
          showTrajectories={false}
          editable
          currentHoleKey={selectedHole.number}
          selectedHazardId={selectedHazardId}
          onSelectHazardId={setSelectedHazardId}
          onSelectHoleArea={() => setSelectedHazardId(null)}
          onHazardsChange={updateSelectedHoleHazards}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm shadow-emerald-200/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-emerald-900">地面条件</h3>
            <p className="text-xs text-emerald-700">
              {selectedHazardId ? "選択中: ハザード領域" : "選択中: フェアウェイ領域"}
            </p>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">
            背景クリックでフェアウェイ選択
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            地面硬さ
            <select
              value={selectedGroundCondition.hardness}
              onChange={(event) => {
                const hardness = event.target.value as GroundCondition["hardness"];
                updateGroundCondition((condition) => ({ ...condition, hardness }));
              }}
              className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
            >
              <option value="soft">Soft</option>
              <option value="medium">Medium</option>
              <option value="firm">Firm</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            傾斜角度 (度)
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={selectedGroundCondition.slopeAngle}
              onChange={(event) => {
                const slopeAngle = Number(event.target.value);
                updateGroundCondition((condition) => ({ ...condition, slopeAngle }));
              }}
              className="w-full cursor-pointer"
            />
            <div className="text-right text-[11px] text-emerald-700">
              {selectedGroundCondition.slopeAngle === 0 ? "フラット" : `傾斜量 ${Math.abs(selectedGroundCondition.slopeAngle)}°`}
            </div>
          </label>

          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            uphill方向 (0–359)
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={selectedGroundCondition.slopeDirection}
              onChange={(event) => {
                const slopeDirection = Number(event.target.value);
                updateGroundCondition((condition) => ({ ...condition, slopeDirection }));
              }}
              className="w-full cursor-pointer"
            />
            <div className="text-right text-[11px] text-emerald-700">
              {normalizedSelectedSlope.slopeDirection}°
            </div>
            <div className="flex flex-wrap gap-1">
              {SLOPE_DIRECTION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    updateGroundCondition((condition) => ({
                      ...condition,
                      slopeDirection: toStoredSlopeDirection(condition.slopeAngle, preset.value),
                    }));
                  }}
                  className={[
                    'min-w-10 rounded border px-2 py-1 text-[11px] font-bold transition',
                    normalizedSelectedSlope.slopeDirection === preset.value
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                  ].join(' ')}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-emerald-800">
          {formatSlopeGuide(selectedGroundCondition.slopeAngle, selectedGroundCondition.slopeDirection)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addHazard}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
        >
          ハザード追加
        </button>
        <button
          type="button"
          onClick={deleteSelectedHazard}
          disabled={!selectedHazard}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          選択ハザード削除
        </button>
        <p className="text-xs text-emerald-700">ハザードはドラッグで移動、四隅ハンドルでリサイズできます。</p>
      </div>

      {selectedHazard && (
        <>
          <div className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 sm:grid-cols-4">
            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              種別
              <select
                value={selectedHazard.type}
                onChange={(event) => {
                  const type = event.target.value as HazardType;
                  updateSelectedHazard((hazard) => ({
                    ...hazard,
                    type,
                    penaltyStrokes: getPenaltyStrokesByType(type),
                    name: buildHazardNameFromPosition(hazard.xCenter, hazard.width, type),
                  }));
                }}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
              >
                {Object.keys(HAZARD_TYPE_LABEL).map((hazardType) => (
                  <option key={hazardType} value={hazardType}>
                    {HAZARD_TYPE_LABEL[hazardType as HazardType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              中心X
              <input
                type="number"
                value={Math.round(selectedHazard.xCenter)}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  updateSelectedHazard((hazard) => ({
                    ...hazard,
                    xCenter: value,
                    name: buildHazardNameFromPosition(value, hazard.width, hazard.type),
                  }));
                }}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
              />
            </label>

            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              幅
              <input
                type="number"
                min={6}
                value={Math.max(6, Math.round(selectedHazard.width))}
                onChange={(event) => {
                  const value = Math.max(6, Number(event.target.value) || 6);
                  updateSelectedHazard((hazard) => ({
                    ...hazard,
                    width: value,
                    name: buildHazardNameFromPosition(hazard.xCenter, value, hazard.type),
                  }));
                }}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
              />
            </label>

            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              奥行き
              <input
                type="number"
                min={5}
                value={Math.max(5, Math.round(selectedHazard.yBack - selectedHazard.yFront))}
                onChange={(event) => {
                  const depth = Math.max(5, Number(event.target.value) || 5);
                  updateSelectedHazard((hazard) => ({ ...hazard, yBack: hazard.yFront + depth }));
                }}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
              />
            </label>
          </div>

          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <div className="mb-3 text-sm font-bold text-emerald-900">liePenalty</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-semibold text-emerald-800">
                距離係数
                <input
                  type="number"
                  step={0.01}
                  min={0.5}
                  max={1.5}
                  value={selectedHazard.liePenalty?.distanceMultiplier ?? 1}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1;
                    updateSelectedHazard((hazard) => ({
                      ...hazard,
                      liePenalty: {
                        ...(hazard.liePenalty ?? {
                          distanceMultiplier: 1,
                          dispersionMultiplier: 1,
                          mishitRateBonus: 0,
                          sideSpinBonus: 0,
                        }),
                        distanceMultiplier: value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-emerald-800">
                分散係数
                <input
                  type="number"
                  step={0.05}
                  min={0.5}
                  max={3}
                  value={selectedHazard.liePenalty?.dispersionMultiplier ?? 1}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1;
                    updateSelectedHazard((hazard) => ({
                      ...hazard,
                      liePenalty: {
                        ...(hazard.liePenalty ?? {
                          distanceMultiplier: 1,
                          dispersionMultiplier: 1,
                          mishitRateBonus: 0,
                          sideSpinBonus: 0,
                        }),
                        dispersionMultiplier: value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-emerald-800">
                ミス率ボーナス
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={0.5}
                  value={selectedHazard.liePenalty?.mishitRateBonus ?? 0}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 0;
                    updateSelectedHazard((hazard) => ({
                      ...hazard,
                      liePenalty: {
                        ...(hazard.liePenalty ?? {
                          distanceMultiplier: 1,
                          dispersionMultiplier: 1,
                          mishitRateBonus: 0,
                          sideSpinBonus: 0,
                        }),
                        mishitRateBonus: value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-emerald-800">
                サイドスピン補正
                <input
                  type="number"
                  step={1}
                  min={0}
                  max={200}
                  value={selectedHazard.liePenalty?.sideSpinBonus ?? 0}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 0;
                    updateSelectedHazard((hazard) => ({
                      ...hazard,
                      liePenalty: {
                        ...(hazard.liePenalty ?? {
                          distanceMultiplier: 1,
                          dispersionMultiplier: 1,
                          mishitRateBonus: 0,
                          sideSpinBonus: 0,
                        }),
                        sideSpinBonus: value,
                      },
                    }));
                  }}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-emerald-700">該当ハザードでの次ショット対象の飛距離・分散・ミス確率を調整します。</p>
          </div>
        </>
      )}
    </section>
  );
}
