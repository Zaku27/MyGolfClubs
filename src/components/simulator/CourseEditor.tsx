import { useEffect, useMemo, useState, useRef } from "react";
import type { GroundCondition, Hazard, HazardType, Hole } from "../../types/game";
import { generateRandomCourse } from "../../utils/courseGenerator";
import { HoleMapCanvas } from "./HoleMapCanvas";

interface CourseEditorProps {
  holes: Hole[];
  onChange: (holes: Hole[]) => void;
}

const DEFAULT_GROUND_CONDITION: GroundCondition = {
  hardness: "medium",
  slopeAngle: 0,
  slopeDirection: 0,
};

const HAZARD_TYPE_LABEL: Record<HazardType, string> = {
  bunker: "バンカー",
  water: "ウォーター",
  ob: "OB",
  rough: "ラフ",
  semirough: "セミラフ",
  bareground: "ベアグラウンド",
};

function normalizeSlopeForDisplay(slopeAngle: number, slopeDirection: number) {
  const normalizedDirection = ((slopeDirection % 360) + 360) % 360;
  if (slopeAngle < 0) {
    return {
      slopeAngle: Math.abs(slopeAngle),
      slopeDirection: (normalizedDirection + 180) % 360,
    };
  }

  return {
    slopeAngle,
    slopeDirection: normalizedDirection,
  };
}

function toCanonicalSlopeSettings(slopeAngle: number, slopeDirection: number) {
  const safeAngle = Number.isFinite(slopeAngle) ? slopeAngle : 0;
  const clampedAngle = Math.min(45, Math.abs(safeAngle));
  const normalizedDirection = Number.isFinite(slopeDirection)
    ? ((slopeDirection % 360) + 360) % 360
    : 0;

  if (safeAngle < 0) {
    return {
      slopeAngle: clampedAngle,
      slopeDirection: (normalizedDirection + 180) % 360,
    };
  }

  return {
    slopeAngle: clampedAngle,
    slopeDirection: normalizedDirection,
  };
}

function formatSlopeGuide(slopeAngle: number, slopeDirection: number) {
  const normalized = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
  if (normalized.slopeAngle === 0) {
    return "平坦です。補正は入りません。";
  }

  const label =
    normalized.slopeDirection === 0 ? "ピン方向上り" :
    normalized.slopeDirection === 90 ? "右側上り" :
    normalized.slopeDirection === 180 ? "ピン反対方向上り" :
    normalized.slopeDirection === 270 ? "左側上り" :
    normalized.slopeDirection < 90 ? "右前上り" :
    normalized.slopeDirection < 180 ? "右後上り" :
    normalized.slopeDirection < 270 ? "左後上り" : "左前上り";

  return `${normalized.slopeAngle}° / ${label}`;
}

function toStoredSlopeDirection(slopeAngle: number, displayedDirection: number) {
  const normalizedDirection = ((displayedDirection % 360) + 360) % 360;
  return slopeAngle < 0 ? (normalizedDirection + 180) % 360 : normalizedDirection;
}

function cloneHazards(hazards: Hazard[] | undefined) {
  return (hazards ?? []).map((hazard) => ({
    ...hazard,
    points: Array.isArray(hazard.points)
      ? hazard.points.map((pt) => ({ ...pt }))
      : undefined,
  }));
}

function buildHazardName(type: HazardType, xCenter: number, width: number) {
  return `${type.toUpperCase()} ${Math.round(xCenter)} ${Math.round(width)}`;
}

function buildEmptyHazard(hole: Hole): Hazard {
  const holeLength = hole.targetDistance ?? hole.distanceFromTee;
  const yFront = Math.max(10, Math.round(holeLength * 0.35));
  const xCenter = 0;
  const width = 30;

  return {
    id: `hazard-${hole.number}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "bunker",
    shape: "rectangle",
    yFront,
    yBack: yFront + 18,
    xCenter,
    width,
    penaltyStrokes: 0,
    groundCondition: { ...DEFAULT_GROUND_CONDITION },
    name: buildHazardName("bunker", xCenter, width),
  };
}

function getPenaltyStrokesByType(type: HazardType): 0 | 1 | 2 {
  if (type === "ob") return 2;
  if (type === "water") return 1;
  return 0;
}

export function CourseEditor({ holes, onChange }: CourseEditorProps) {
  // 保存時データのデバッグ用
  const [lastSavedHoles, setLastSavedHoles] = useState<Hole[] | null>(null);

  const [selectedHoleIndex, setSelectedHoleIndex] = useState(0);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [polygonCreationMode, setPolygonCreationMode] = useState(false);
  const [polygonDraftPoints, setPolygonDraftPoints] = useState<any[]>([]);

  const safeHoleIndex = Math.max(0, Math.min(selectedHoleIndex, holes.length - 1));
  const selectedHole = holes[safeHoleIndex];

  const selectedHazard = useMemo(
    () => selectedHole?.hazards?.find((hazard) => hazard.id === selectedHazardId) ?? null,
    [selectedHazardId, selectedHole],
  );

  const selectedGroundCondition = selectedHazard?.groundCondition ?? selectedHole?.groundCondition ?? DEFAULT_GROUND_CONDITION;
  const normalizedSlope = normalizeSlopeForDisplay(selectedGroundCondition.slopeAngle, selectedGroundCondition.slopeDirection);


  // 五角形のデフォルト多角形を生成
  function buildDefaultPolygonPoints(centerX: number, centerY: number, radius: number, sides: number = 5) {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return points;
  }

  const addPolygonHazard = () => {
    if (!selectedHole) return;
    const holeLength = selectedHole.targetDistance ?? selectedHole.distanceFromTee;
    const centerY = Math.max(10, Math.round(holeLength * 0.35)) + 9;
    const centerX = 0;
    const radius = 12;
    const points = buildDefaultPolygonPoints(centerX, centerY, radius, 5);
    const bounds = {
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
      height: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
      xCenter: centerX,
      yFront: Math.min(...points.map((p) => p.y)),
      yBack: Math.max(...points.map((p) => p.y)),
    };
    const newHazard = {
      id: `hazard-${selectedHole.number}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "bunker",
      shape: "polygon",
      points,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      yFront: bounds.yFront,
      yBack: bounds.yBack,
      xCenter: bounds.xCenter,
      penaltyStrokes: 0,
      groundCondition: { ...DEFAULT_GROUND_CONDITION },
      name: buildHazardName("bunker", centerX, radius * 2),
    };
    updateHole((hole) => ({
      ...hole,
      hazards: [...cloneHazards(hole.hazards), newHazard],
    }));
    setSelectedHazardId(newHazard.id);
  };

  const handleCanvasClick = (point: any) => {
    if (!polygonCreationMode || !selectedHole) return;
    setPolygonDraftPoints((points) => [...points, point]);
  };

  const handleCanvasDoubleClick = () => {
    if (!polygonCreationMode || !selectedHole || polygonDraftPoints.length < 3) return;
    finishPolygonDraft(selectedHole, polygonDraftPoints);
  };

  useEffect(() => {
    if (selectedHoleIndex >= holes.length) {
      setSelectedHoleIndex(Math.max(0, holes.length - 1));
    }
  }, [holes.length, selectedHoleIndex]);

  useEffect(() => {
    setSelectedHazardId(null);
    setPolygonCreationMode(false);
    setPolygonDraftPoints([]);
  }, [safeHoleIndex]);

  const updateHole = (updater: (hole: Hole) => Hole) => {
    const next = holes.map((hole, index) => {
      if (index !== safeHoleIndex) {
        return { ...hole, hazards: cloneHazards(hole.hazards) };
      }
      return updater({ ...hole, hazards: cloneHazards(hole.hazards) });
    });
    setLastSavedHoles(next); // 保存直後のデータを記録
    onChange(next);
  };

  const updateSelectedHoleHazards = (hazards: Hazard[]) => {
    updateHole((hole) => ({ ...hole, hazards }));
  };

  const updateSelectedHazard = (updater: (hazard: Hazard) => Hazard) => {
    if (!selectedHole || !selectedHazardId) return;
    const next = cloneHazards(selectedHole.hazards).map((hazard) => {
      if (hazard.id !== selectedHazardId) return hazard;
      const updated = updater(hazard);
      // polygonの場合、矩形用プロパティをpointsから再計算して上書き
      if (updated.shape === "polygon" && Array.isArray(updated.points) && updated.points.length >= 3) {
        const xs = updated.points.map((p) => p.x);
        const ys = updated.points.map((p) => p.y);
        return {
          ...updated,
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          xCenter: (Math.max(...xs) + Math.min(...xs)) / 2,
          yFront: Math.min(...ys),
          yBack: Math.max(...ys),
        };
      }
      return updated;
    });
    updateSelectedHoleHazards(next);
  };

  const updateGroundCondition = (updater: (condition: GroundCondition) => GroundCondition) => {
    if (!selectedHole) return;

    const normalizeAndSave = (condition: GroundCondition) => {
      const next = updater(condition);
      return { ...next, ...toCanonicalSlopeSettings(next.slopeAngle, next.slopeDirection) };
    };

    if (selectedHazard) {
      updateSelectedHazard((hazard) => ({
        ...hazard,
        groundCondition: normalizeAndSave(hazard.groundCondition ?? DEFAULT_GROUND_CONDITION),
      }));
      return;
    }

    updateHole((hole) => ({
      ...hole,
      groundCondition: normalizeAndSave(hole.groundCondition ?? DEFAULT_GROUND_CONDITION),
    }));
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
    <section className="mx-auto mt-4 w-full max-w-2xl rounded-2xl border border-emerald-300 bg-white/80 p-4 shadow-sm shadow-emerald-300/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black tracking-[0.08em] text-emerald-900">コースエディタ</h2>
          <p className="text-xs text-emerald-700">ホールとハザードを直感的に編集できます。</p>
        </div>
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
            key={`hole-tab-${hole.number}`}
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
          距離 (yd)
          <input
            type="number"
            min={30}
            max={700}
            value={selectedHole.distanceFromTee}
            onChange={(event) => {
              const distance = Math.max(30, Math.min(700, Number(event.target.value) || 30));
              updateHole((hole) => ({ ...hole, distanceFromTee: distance, targetDistance: distance }));
            }}
            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold text-emerald-800">
          グリーン半径 (yd)
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
        {(() => {
          // hazardsを正規化: polygonはpointsが必ず配列
          const normalizedHazards = useMemo(() =>
            (selectedHole.hazards ?? []).map(h => {
              if (h.shape === "polygon") {
                return {
                  ...h,
                  points: Array.isArray(h.points) ? h.points.map(pt => ({ ...pt })) : [],
                };
              }
              if (h.shape === "rectangle") {
                return { ...h };
              }
              throw new Error(`[CourseEditor] 不正なshape値: ${h.shape}`);
            }), [selectedHole.hazards]);
          return (
            <HoleMapCanvas
              hole={{ ...selectedHole, hazards: normalizedHazards }}
              landingResults={[]}
              showTrajectories={false}
              editable
              currentHoleKey={selectedHole.number}
              selectedHazardId={selectedHazardId}
              onSelectHazardId={setSelectedHazardId}
              onSelectHoleArea={() => setSelectedHazardId(null)}
              onHazardsChange={updateSelectedHoleHazards}
            />
          );
        })()}
      </div>

      {/* デバッグ用: 保存時と復元時のhazardsのJSON表示 */}
      <div className="mt-2 mb-2 p-2 bg-yellow-50 border border-yellow-300 text-xs rounded">
        <div className="font-bold text-yellow-900 mb-1">[DEBUG] hazards（保存直後データ）</div>
        <pre style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, background: 'inherit', margin: 0 }}>
          {JSON.stringify(lastSavedHoles?.[safeHoleIndex]?.hazards, null, 2)}
        </pre>
        <div className="font-bold text-yellow-900 mb-1 mt-2">[DEBUG] hazards（復元データ）</div>
        <pre style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, background: 'inherit', margin: 0 }}>
          {JSON.stringify(selectedHole.hazards, null, 2)}
        </pre>
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm shadow-emerald-200/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-emerald-900">地面条件</h3>
            <p className="text-xs text-emerald-700">選択中: {selectedHazard ? 'ハザード' : 'フェアウェイ'}</p>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">
            背景をクリックするとフェアウェイを選択
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            地面硬さ
            <select
              value={selectedGroundCondition.hardness}
              onChange={(event) => {
                const hardness = event.target.value as GroundCondition['hardness'];
                updateGroundCondition((condition) => ({ ...condition, hardness }));
              }}
              className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
            >
              <option value="soft">柔らかい</option>
              <option value="medium">普通</option>
              <option value="firm">硬い</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            上り方向
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={normalizedSlope.slopeDirection}
              onChange={(event) => {
                const slopeDirection = Number(event.target.value);
                updateGroundCondition((condition) => ({
                  ...condition,
                  slopeDirection: toStoredSlopeDirection(condition.slopeAngle, slopeDirection),
                }));
              }}
              className="w-full cursor-pointer"
            />
            <div className="text-right text-[11px] text-emerald-700">{normalizedSlope.slopeDirection}°</div>
          </label>

          <label className="space-y-1 text-xs font-semibold text-emerald-800">
            傾斜角度
            <input
              type="range"
              min={0}
              max={45}
              step={1}
              value={normalizedSlope.slopeAngle}
              onChange={(event) => {
                const slopeAngle = Number(event.target.value);
                updateGroundCondition((condition) => ({ ...condition, slopeAngle }));
              }}
              className="w-full cursor-pointer"
            />
            <div className="text-right text-[11px] text-emerald-700">
              {normalizedSlope.slopeAngle === 0 ? 'フラット' : `${normalizedSlope.slopeAngle}°`}
            </div>
          </label>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-emerald-800">{formatSlopeGuide(selectedGroundCondition.slopeAngle, selectedGroundCondition.slopeDirection)}</p>
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
            onClick={addPolygonHazard}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            フリーポリゴン追加
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
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm shadow-emerald-200/30">
          <div className="grid gap-3 sm:grid-cols-4">
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
                    name: buildHazardName(type, hazard.xCenter, hazard.width),
                  }));
                }}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
              >
                {Object.entries(HAZARD_TYPE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            {/* polygon以外のみ編集UIを表示 */}
            {selectedHazard.shape !== "polygon" && (
              <>
                <label className="space-y-1 text-xs font-semibold text-emerald-800">
                  中心X
                  <input
                    type="number"
                    value={Math.round(selectedHazard.xCenter)}
                    onChange={(event) => {
                      const next = Number(event.target.value) || 0;
                      updateSelectedHazard((hazard) => ({
                        ...hazard,
                        xCenter: next,
                        name: buildHazardName(hazard.type, next, hazard.width),
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
                      const next = Math.max(6, Number(event.target.value) || 6);
                      updateSelectedHazard((hazard) => ({
                        ...hazard,
                        width: next,
                        name: buildHazardName(hazard.type, hazard.xCenter, next),
                      }));
                    }}
                    className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-emerald-800">
                  奥行き
                  <input
                    type="number"
                    min={6}
                    value={Math.max(6, Math.round(selectedHazard.yBack - selectedHazard.yFront))}
                    onChange={(event) => {
                      const next = Math.max(6, Number(event.target.value) || 6);
                      updateSelectedHazard((hazard) => ({
                        ...hazard,
                        yBack: hazard.yFront + next,
                      }));
                    }}
                    className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
