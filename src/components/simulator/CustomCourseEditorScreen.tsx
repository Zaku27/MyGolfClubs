import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { Hole } from "../../types/game";
import { CourseEditor } from "./CourseEditor";
import { cloneCourse, generateRandomCourse } from "../../utils/courseGenerator";
import { readStoredJson, writeStoredJson } from "../../utils/storage";
import type { CustomCoursePreset, CustomCourseStorage } from "./courseTypes";

export type { CustomCoursePreset, CustomCourseStorage };

const CUSTOM_COURSE_STORAGE_KEY = "golfbag-custom-course-library-v1";

function createCourseId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeCourseName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "マイコース";
  }
  return trimmed.slice(0, 40);
}

function createUniqueCourseName(
  requestedName: string,
  courses: CustomCoursePreset[],
  excludeCourseId?: string,
): string {
  const baseName = sanitizeCourseName(requestedName);
  const exists = (name: string) => courses.some((course) => {
    if (excludeCourseId && course.id === excludeCourseId) {
      return false;
    }
    return course.name === name;
  });

  if (!exists(baseName)) {
    return baseName;
  }

  for (let i = 2; i <= 999; i += 1) {
    const candidate = `${baseName} (${i})`;
    if (!exists(candidate)) {
      return candidate;
    }
  }

  return `${baseName} (${Date.now()})`;
}

function normalizeHoleCount(value: unknown): 1 | 3 | 9 | 18 {
  if (value === 1 || value === 3 || value === 9 || value === 18) {
    return value;
  }
  return 9;
}

function normalizeGroundCondition(value: unknown): Hole['groundCondition'] | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  type GroundConditionHardness = NonNullable<Hole['groundCondition']>['hardness'];
  const hardness = raw.hardness === "soft" || raw.hardness === "medium" || raw.hardness === "firm"
    ? (raw.hardness as GroundConditionHardness)
    : undefined;
  const slopeAngle = Number(raw.slopeAngle);
  const slopeDirection = Number(raw.slopeDirection);

  if (hardness === undefined && !Number.isFinite(slopeAngle) && !Number.isFinite(slopeDirection)) {
    return undefined;
  }

  return {
    hardness: hardness ?? "medium",
    slopeAngle: Number.isFinite(slopeAngle) ? slopeAngle : 0,
    slopeDirection: Number.isFinite(slopeDirection)
      ? ((slopeDirection % 360) + 360) % 360
      : 0,
  };
}

function normalizePreset(preset: Partial<CustomCoursePreset>, fallbackName: string): CustomCoursePreset | null {
  const holeCount = normalizeHoleCount(preset.holeCount);

  if (!Array.isArray(preset.course) || preset.course.length === 0) {
    return null;
  }

  const normalizedCourse = preset.course.slice(0, 18).reduce<Hole[]>((acc, hole, index) => {
    if (!hole || typeof hole !== "object") {
      return acc;
    }

    const raw = hole as Partial<Hole>;
    const par = raw.par === 3 || raw.par === 4 || raw.par === 5 ? raw.par : 4;
    const distance = Number(raw.distanceFromTee) || 360;
    const greenRadius = Math.max(6, Math.min(25, Number(raw.greenRadius) || 12));
    const hazards = Array.isArray(raw.hazards)
      ? raw.hazards
          .filter((hazard) => hazard && typeof hazard === "object")
          .map((hazard, hazardIndex) => {
            const h = hazard as NonNullable<Hole["hazards"]>[number];
            const yFront = Math.max(0, Number(h.yFront) || 0);
            const yBack = Math.max(yFront + 3, Number(h.yBack) || yFront + 15);
            const width = Math.max(6, Number(h.width) || 20);
            const type = h.type === "bunker" || h.type === "water" || h.type === "ob" || h.type === "rough" || h.type === "semirough" || h.type === "bareground"
              ? h.type
              : "bunker";
            const penaltyStrokes: 0 | 1 | 2 = type === "ob" ? 2 : type === "water" ? 1 : 0;
            const points = Array.isArray(h.points)
              ? h.points
                  .filter((point) => point && typeof point === "object")
                  .map((point) => {
                    const rawPoint = point as Record<string, unknown>;
                    return {
                      x: Number(rawPoint.x) || 0,
                      y: Number(rawPoint.y) || 0,
                    };
                  })
              : [];
            const isPolygon = h.shape === "polygon" && points.length >= 3;

            if (isPolygon) {
              const xs = points.map((p) => p.x);
              const ys = points.map((p) => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);
              const xCenter = Number(h.xCenter) || (minX + maxX) / 2;

              return {
                id: typeof h.id === "string" && h.id.length > 0
                  ? h.id
                  : `restored-${index + 1}-${hazardIndex + 1}`,
                type,
                shape: "polygon" as const,
                points,
                x: Number(h.x) || minX,
                y: Number(h.y) || minY,
                width: Number(h.width) || maxX - minX,
                height: Number(h.height) || maxY - minY,
                xCenter,
                yFront: Number(h.yFront) || minY,
                yBack: Number(h.yBack) || maxY,
                penaltyStrokes,
                name: typeof h.name === "string" && h.name.length > 0 ? h.name : undefined,
                groundCondition: normalizeGroundCondition(h.groundCondition),
              };
            }

            return {
              id: typeof h.id === "string" && h.id.length > 0
                ? h.id
                : `restored-${index + 1}-${hazardIndex + 1}`,
              type,
              shape: "rectangle" as const,
              yFront,
              yBack,
              xCenter: Number(h.xCenter) || 0,
              width,
              penaltyStrokes,
              name: typeof h.name === "string" && h.name.length > 0 ? h.name : undefined,
              groundCondition: normalizeGroundCondition(h.groundCondition),
            };
          })
        : [];

    const greenPolygon = Array.isArray(raw.greenPolygon)
      ? raw.greenPolygon
          .filter((pt) => pt && typeof pt === "object")
          .map((pt) => {
            const rawPoint = pt as Record<string, unknown>;
            return {
              x: Number(rawPoint.x) || 0,
              y: Number(rawPoint.y) || 0,
            };
          })
      : [];

    acc.push({
      number: index + 1,
      par,
      distanceFromTee: distance,
      targetDistance: distance,
      greenRadius,
      greenPolygon: greenPolygon.length >= 3 ? greenPolygon : undefined,
      hazards,
      groundCondition: normalizeGroundCondition(raw.groundCondition),
    });

    return acc;
  }, []);

  if (normalizedCourse.length === 0) {
    return null;
  }

  const courseId = typeof preset.id === "string" && preset.id.length > 0
    ? preset.id
    : createCourseId();

  return {
    id: courseId,
    name: typeof preset.name === "string" && preset.name.length > 0 ? preset.name : fallbackName,
    holeCount,
    course: normalizedCourse,
  };
}

function parseImportedCustomCourses(value: unknown): CustomCoursePreset[] {
  const payload = value as Record<string, unknown>;

  if (payload.format === "custom-course-library-v1" && Array.isArray(payload.courses)) {
    return payload.courses
      .map((course, index) => normalizePreset(course, `インポートコース ${index + 1}`))
      .filter((course): course is CustomCoursePreset => course !== null);
  }

  if (payload.format === "custom-course-v1" && payload.course) {
    const course = normalizePreset(payload.course, "インポートコース");
    return course ? [course] : [];
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item, index) => normalizePreset(item, `インポートコース ${index + 1}`))
      .filter((course): course is CustomCoursePreset => course !== null);
  }

  if ("courses" in payload && Array.isArray(payload.courses)) {
    return payload.courses
      .map((course, index) => normalizePreset(course, `インポートコース ${index + 1}`))
      .filter((course): course is CustomCoursePreset => course !== null);
  }

  if ("course" in payload) {
    const course = normalizePreset(payload, "インポートコース");
    return course ? [course] : [];
  }

  throw new Error("インポートできるコースデータが見つかりません");
}

function buildDefaultPreset(): CustomCoursePreset {
  return {
    id: createCourseId(),
    name: "マイコース 1",
    holeCount: 9,
    course: generateRandomCourse(9),
  };
}

function parseStoredCustomCourse(value: unknown): CustomCourseStorage {
  const fallbackPreset = buildDefaultPreset();
  const fallback: CustomCourseStorage = {
    selectedCourseId: fallbackPreset.id,
    courses: [fallbackPreset],
  };

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<CustomCourseStorage>;
  const legacyCandidate = value as Partial<{ holeCount: 1 | 3 | 9 | 18; course: Hole[] }>;

  if (Array.isArray(legacyCandidate.course) && legacyCandidate.course.length > 0) {
    const migrated = normalizePreset(
      {
        id: createCourseId(),
        name: "マイコース 1",
        holeCount: legacyCandidate.holeCount,
        course: legacyCandidate.course,
      },
      "マイコース 1",
    );
    if (migrated) {
      return {
        selectedCourseId: migrated.id,
        courses: [migrated],
      };
    }
  }

  if (!Array.isArray(candidate.courses) || candidate.courses.length === 0) {
    return fallback;
  }

  const normalizedCourses = candidate.courses
    .map((course, index) => normalizePreset(course, `マイコース ${index + 1}`))
    .filter((course): course is CustomCoursePreset => course !== null);

  if (normalizedCourses.length === 0) {
    return fallback;
  }

  const selectedCourseId = typeof candidate.selectedCourseId === "string"
    ? candidate.selectedCourseId
    : normalizedCourses[0].id;
  const selectedExists = normalizedCourses.some((course) => course.id === selectedCourseId);

  return {
    selectedCourseId: selectedExists ? selectedCourseId : normalizedCourses[0].id,
    courses: normalizedCourses,
  };
}

export function loadStoredCustomCourse(): CustomCourseStorage {
  return readStoredJson<CustomCourseStorage>(
    CUSTOM_COURSE_STORAGE_KEY,
    (() => {
      const preset = buildDefaultPreset();
      return {
        selectedCourseId: preset.id,
        courses: [preset],
      };
    })(),
    parseStoredCustomCourse,
  );
}

export function CustomCourseEditorScreen() {
  const [initialCustom] = useState<CustomCourseStorage>(() => loadStoredCustomCourse());
  const initialPreset = initialCustom.courses.find((course) => course.id === initialCustom.selectedCourseId)
    ?? initialCustom.courses[0];

  const [savedCustomCourses, setSavedCustomCourses] = useState<CustomCoursePreset[]>(
    initialCustom.courses.map((course) => ({
      ...course,
      course: cloneCourse(course.course),
    })),
  );
  const [selectedCustomCourseId, setSelectedCustomCourseId] = useState(initialPreset.id);
  const [customNameInput, setCustomNameInput] = useState(initialPreset.name);
  const [customHoleCount, setCustomHoleCount] = useState<1 | 3 | 9 | 18>(initialPreset.holeCount);
  const [customCourse, setCustomCourse] = useState<Hole[]>(cloneCourse(initialPreset.course));
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCustomCourseIndex = savedCustomCourses.findIndex((course) => course.id === selectedCustomCourseId);

  const handleChangeHoleCount = (holeCount: 1 | 3 | 9 | 18) => {
    setCustomHoleCount(holeCount);
    const randomized = generateRandomCourse(holeCount);
    setCustomCourse(randomized);
  };

  const handleSelectCustomCourse = (courseId: string) => {
    const selected = savedCustomCourses.find((course) => course.id === courseId);
    if (!selected) {
      return;
    }

    setSelectedCustomCourseId(selected.id);
    setCustomNameInput(selected.name);
    setCustomHoleCount(selected.holeCount);
    setCustomCourse(cloneCourse(selected.course));
  };

  const handleSaveAsNew = () => {
    const name = createUniqueCourseName(customNameInput, savedCustomCourses);
    const newPreset: CustomCoursePreset = {
      id: createCourseId(),
      name,
      holeCount: customHoleCount,
      course: cloneCourse(customCourse),
    };

    setSavedCustomCourses((prev) => [...prev, newPreset]);
    setSelectedCustomCourseId(newPreset.id);
    setCustomNameInput(newPreset.name);
  };

  const handleSaveOverwrite = () => {
    const name = createUniqueCourseName(customNameInput, savedCustomCourses, selectedCustomCourseId);

    setSavedCustomCourses((prev) => {
      const next = prev.map((course) => {
        if (course.id !== selectedCustomCourseId) {
          return course;
        }

        return {
          ...course,
          name,
          holeCount: customHoleCount,
          course: cloneCourse(customCourse),
        };
      });
      writeStoredJson(CUSTOM_COURSE_STORAGE_KEY, {
        selectedCourseId: selectedCustomCourseId,
        courses: next,
      } satisfies CustomCourseStorage);
      return next;
    });
    setCustomNameInput(name);
  };

  const handleExportCustomCourseLibrary = () => {
    const payload = {
      format: 'custom-course-library-v1',
      exportedAt: new Date().toISOString(),
      courses: savedCustomCourses,
    };

    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `custom_course_library_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportCustomCourseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setImportError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedCourses = parseImportedCustomCourses(parsed);

      if (importedCourses.length === 0) {
        throw new Error('インポートできるコースが見つかりません');
      }

      const nextCourses = [...savedCustomCourses];
      const normalizedNewCourses = importedCourses.map((course) => {
        const name = createUniqueCourseName(course.name, nextCourses);
        const nextCourse: CustomCoursePreset = {
          ...course,
          id: createCourseId(),
          name,
        };
        nextCourses.push(nextCourse);
        return nextCourse;
      });

      const selected = normalizedNewCourses[0];

      setSavedCustomCourses(nextCourses);
      setSelectedCustomCourseId(selected.id);
      setCustomNameInput(selected.name);
      setCustomHoleCount(selected.holeCount);
      setCustomCourse(cloneCourse(selected.course));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'インポートに失敗しました');
    }
  };

  const handleOpenImportDialog = () => {
    fileInputRef.current?.click();
  };

  const handleMoveSelected = (direction: "up" | "down") => {
    if (selectedCustomCourseIndex < 0) {
      return;
    }

    const targetIndex = direction === "up"
      ? selectedCustomCourseIndex - 1
      : selectedCustomCourseIndex + 1;

    if (targetIndex < 0 || targetIndex >= savedCustomCourses.length) {
      return;
    }

    setSavedCustomCourses((prev) => {
      const next = [...prev];
      const temp = next[selectedCustomCourseIndex];
      next[selectedCustomCourseIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (savedCustomCourses.length <= 1) {
      return;
    }

    const nextCourses = savedCustomCourses.filter((course) => course.id !== selectedCustomCourseId);
    const fallbackCourse = nextCourses[0];

    setSavedCustomCourses(nextCourses);
    setSelectedCustomCourseId(fallbackCourse.id);
    setCustomNameInput(fallbackCourse.name);
    setCustomHoleCount(fallbackCourse.holeCount);
    setCustomCourse(cloneCourse(fallbackCourse.course));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 flex flex-col items-center justify-center p-6 gap-6">
      <div className="w-full" style={{ maxWidth: '1080px' }}>
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm shadow-emerald-300/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-emerald-900">
            <div>
              <h1 className="text-3xl font-black tracking-tight">コースエディタ</h1>
              <p className="text-emerald-700 mt-1 text-sm">カスタムコースを独立して編集・保存できます。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              to="/"
              state={{ openSimulator: true }}
              className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-900 shadow-sm shadow-sky-200 transition hover:bg-sky-100"
            >
              コースシミュレーターへ
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm shadow-emerald-200 transition hover:bg-emerald-50"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm shadow-emerald-300/40" style={{ maxWidth: '1080px' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-emerald-900 tracking-tight">保存済みコース</h2>
            <p className="text-xs text-emerald-700 mt-1">名前とホール数を切り替え、コースを保存できます。</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 3, 9, 18].map((count) => (
              <button
                key={`custom-count-${count}`}
                type="button"
                onClick={() => handleChangeHoleCount(count as 1 | 3 | 9 | 18)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                  customHoleCount === count
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100",
                ].join(" ")}
              >
                {count}H
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              編集するカスタムコース
              <select
                value={selectedCustomCourseId}
                onChange={(event) => handleSelectCustomCourse(event.target.value)}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-2 text-sm"
              >
                {savedCustomCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-semibold text-emerald-800">
              コース名
              <input
                type="text"
                value={customNameInput}
                onChange={(event) => setCustomNameInput(event.target.value)}
                maxLength={40}
                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-2 text-sm"
                placeholder="例: 風が強い海沿いコース"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-end justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveAsNew}
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
            >
              新規保存
            </button>
            <button
              type="button"
              onClick={handleSaveOverwrite}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
            >
              上書き保存
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCustomCourseLibrary}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            コースをエクスポート
          </button>
          <button
            type="button"
            onClick={handleOpenImportDialog}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            コースをインポート
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={savedCustomCourses.length <= 1}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            選択中を削除
          </button>
          <button
            type="button"
            onClick={() => handleMoveSelected("up")}
            disabled={selectedCustomCourseIndex <= 0}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            順番を上へ
          </button>
          <span className="text-xs text-emerald-700">保存済み: {savedCustomCourses.length}件</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportCustomCourseFile}
          className="hidden"
        />

        {importError && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {importError}
          </div>
        )}

        <CourseEditor holes={customCourse} onChange={setCustomCourse} />
      </div>
    </div>
  );
}

export default CustomCourseEditorScreen;
