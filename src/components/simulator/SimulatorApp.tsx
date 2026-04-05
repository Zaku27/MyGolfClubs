import type { Hole } from "../../types/game";
import type { GolfClub } from "../../types/golf";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { toSimClub } from "../../utils/clubSimAdapter";
import { COURSE_1HOLE, COURSE_3HOLES, COURSE_9HOLES, COURSE_18HOLES } from "../../data/defaultCourses";
import { HoleView } from "./HoleView";
import { PostRoundAnalysis } from "./PostRoundAnalysis";
import { CourseEditor } from "./CourseEditor";
import { cloneCourse, generateRandomCourse } from "../../utils/courseGenerator";
import { readStoredJson, writeStoredJson } from "../../utils/storage";

import { Scorecard } from "./Scorecard";

interface Props {
  onBack: () => void;
  selectedClubs: GolfClub[];
  allClubs: GolfClub[];
  activeBagName?: string;
  bagId?: number | null;
}

type CustomCoursePreset = {
  id: string;
  name: string;
  holeCount: 1 | 3 | 9 | 18;
  course: Hole[];
};

type CustomCourseStorage = {
  selectedCourseId: string;
  courses: CustomCoursePreset[];
};

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
    const distance = Math.max(80, Math.min(700, Number(raw.distanceFromTee) || 360));
    const greenRadius = Math.max(6, Math.min(25, Number(raw.greenRadius) || 12));
    const hazards = Array.isArray(raw.hazards)
      ? raw.hazards
          .filter((hazard) => hazard && typeof hazard === "object")
          .map((hazard, hazardIndex) => {
            const h = hazard as NonNullable<Hole["hazards"]>[number];
            const yFront = Math.max(0, Number(h.yFront) || 0);
            const yBack = Math.max(yFront + 3, Number(h.yBack) || yFront + 15);
            const width = Math.max(6, Number(h.width) || 20);
            const type = h.type === "bunker" || h.type === "water" || h.type === "ob" || h.type === "rough"
              ? h.type
              : "bunker";
            const penaltyStrokes: 1 | 2 = type === "ob" ? 2 : 1;

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
            };
          })
      : [];

    acc.push({
      number: index + 1,
      par,
      distanceFromTee: distance,
      targetDistance: distance,
      greenRadius,
      hazards,
    });

    return acc;
  }, []);

  if (normalizedCourse.length === 0) {
    return null;
  }

  return {
    id: typeof preset.id === "string" && preset.id.length > 0 ? preset.id : createCourseId(),
    name: sanitizeCourseName(typeof preset.name === "string" ? preset.name : fallbackName),
    holeCount,
    course: normalizedCourse,
  };
}

function buildDefaultPreset(): CustomCoursePreset {
  return {
    id: createCourseId(),
    name: "マイコース 1",
    holeCount: 9,
    course: cloneCourse(COURSE_9HOLES),
  };
}

function normalizeHoleCount(value: unknown): 1 | 3 | 9 | 18 {
  if (value === 1 || value === 3 || value === 9 || value === 18) {
    return value;
  }
  return 9;
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

  // Backward compatibility: old schema { holeCount, course }
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

function loadStoredCustomCourse(): CustomCourseStorage {
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

function SetupScreen({ onStart, onBack, bagClubCount, robotClubCount, activeBagName, bagId }: {
  onStart: (holes: Hole[], mode: "bag" | "robot") => void;
  onBack: () => void;
  bagClubCount: number;
  robotClubCount: number;
  activeBagName?: string;
  bagId?: number | null;
}) {
  const [initialCustom] = useState<CustomCourseStorage>(() => loadStoredCustomCourse());
  const initialPreset = initialCustom.courses.find((course) => course.id === initialCustom.selectedCourseId)
    ?? initialCustom.courses[0];

  const [playMode, setPlayMode] = useState<"bag" | "robot">("bag");
  const [savedCustomCourses, setSavedCustomCourses] = useState<CustomCoursePreset[]>(initialCustom.courses);
  const [selectedCustomCourseId, setSelectedCustomCourseId] = useState(initialPreset.id);
  const [customNameInput, setCustomNameInput] = useState(initialPreset.name);
  const [customHoleCount, setCustomHoleCount] = useState<1 | 3 | 9 | 18>(initialPreset.holeCount);
  const [customCourse, setCustomCourse] = useState<Hole[]>(cloneCourse(initialPreset.course));
  const bagQuery = typeof bagId === 'number' ? `?bagId=${bagId}` : '';
  const clubCount = playMode === "robot" ? robotClubCount : bagClubCount;
  const selectedCustomCourseIndex = savedCustomCourses.findIndex((course) => course.id === selectedCustomCourseId);

  useEffect(() => {
    writeStoredJson(CUSTOM_COURSE_STORAGE_KEY, {
      selectedCourseId: selectedCustomCourseId,
      courses: savedCustomCourses,
    } satisfies CustomCourseStorage);
  }, [savedCustomCourses, selectedCustomCourseId]);

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

    setSavedCustomCourses((prev) => prev.map((course) => {
      if (course.id !== selectedCustomCourseId) {
        return course;
      }

      return {
        ...course,
        name,
        holeCount: customHoleCount,
        course: cloneCourse(customCourse),
      };
    }));
    setCustomNameInput(name);
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

  const handleStartCustom = () => {
    const holes = customCourse.slice(0, customHoleCount).map((hole, index) => ({
      ...hole,
      number: index + 1,
      hazards: (hole.hazards ?? []).map((hazard) => ({ ...hazard })),
    }));
    onStart(holes, playMode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="text-6xl mb-3">⛳</div>
        <h1 className="text-3xl font-black text-emerald-900 tracking-tight">
          コースマネジメント
        </h1>
        <p className="text-emerald-700 mt-1 text-sm">
          クラブ選択と戦略でスコアを目指せ
        </p>
      </div>

      <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-sm shadow-emerald-300/40">
        <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
          <p className="text-xs font-bold tracking-[0.12em] text-emerald-700">プレーモード</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlayMode("bag")}
              className={[
                "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                playMode === "bag"
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
              ].join(" ")}
            >
              ゴルフバッグ
            </button>
            <button
              type="button"
              onClick={() => setPlayMode("robot")}
              className={[
                "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                playMode === "robot"
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100",
              ].join(" ")}
            >
              ロボット
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-700">
            {playMode === "bag"
              ? `個人データを使い、${activeBagName ?? "選択中バッグ"}でプレーします。`
              : "ロボット設定で全クラブを使ってプレーします。"}
          </p>
        </div>

        <div className="text-center text-emerald-700 text-sm border-b border-emerald-200 pb-3">
          <span className="font-bold text-emerald-900">{clubCount}</span> 本のクラブでプレー
        </div>

        {clubCount === 0 && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>プレー対象のクラブがありません。</p>
            <p className="mt-1">クラブ管理でクラブを登録してから開始してください。</p>
          </div>
        )}

        {/* How to play */}
        <div className="space-y-2 text-xs text-emerald-700">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold flex-shrink-0">1.</span>
            <span>ホールごとに状況（残距離・ライ・風・ハザード）を確認</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold flex-shrink-0">2.</span>
            <span>バッグのクラブを選択し、リスクレベルを決定してショット</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold flex-shrink-0">3.</span>
            <span>成功率・距離・ランダム性が絡み、結果が確定する</span>
          </div>
        </div>

        <button
          onClick={() => onStart(COURSE_1HOLE, playMode)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:bg-emerald-700/60 disabled:text-emerald-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          1ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_3HOLES, playMode)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-lime-500 hover:bg-lime-400 disabled:bg-lime-700/60 disabled:text-lime-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          3ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_9HOLES, playMode)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-700/60 disabled:text-green-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-lg"
        >
          9ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_18HOLES, playMode)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/60 disabled:text-emerald-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          18ホールでプレー
        </button>
      </div>

      <div className="w-full max-w-4xl rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm shadow-emerald-300/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-emerald-900 tracking-tight">カスタムコース</h2>
            <p className="text-xs text-emerald-700 mt-1">ハザードをドラッグ移動し、四隅ハンドルでサイズを変えられます。</p>
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

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAsNew}
            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            名前を付けて新規保存
          </button>
          <button
            type="button"
            onClick={handleSaveOverwrite}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
          >
            選択中を上書き保存
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
          <button
            type="button"
            onClick={() => handleMoveSelected("down")}
            disabled={selectedCustomCourseIndex < 0 || selectedCustomCourseIndex >= savedCustomCourses.length - 1}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            順番を下へ
          </button>
          <span className="text-xs text-emerald-700">保存済み: {savedCustomCourses.length}件</span>
        </div>

        <CourseEditor holes={customCourse} onChange={setCustomCourse} />

        <button
          type="button"
          onClick={handleStartCustom}
          disabled={clubCount === 0}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-800/60 disabled:text-emerald-100/70"
        >
          カスタムコースで開始
        </button>
      </div>

      <button
        onClick={onBack}
        className="text-emerald-700 hover:text-emerald-900 text-sm underline transition-colors"
      >
        ← クラブ管理に戻る
      </button>
      <Link
        to={`/range${bagQuery}`}
        className="text-emerald-700 hover:text-emerald-900 text-sm underline transition-colors"
      >
        レンジシミュレーターに戻る
      </Link>
      <Link
        to={`/personal-data${bagQuery}`}
        className="text-emerald-700 hover:text-emerald-900 text-sm underline transition-colors"
      >
        パーソナルデータを調整
      </Link>
    </div>
  );
}

export function SimulatorApp({ onBack, selectedClubs, allClubs, activeBagName, bagId }: Props) {
  const {
    phase,
    course,
    startRound,
    resetGame,
    showResultModal,
  } = useGameStore();
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const bagSource = selectedClubs;
  const robotSource = allClubs;

  const handleStart = (holes: Hole[], mode: "bag" | "robot") => {
    const source = mode === "robot" ? robotSource : bagSource;
    const bag = source.map(toSimClub);
    setShowDetailedScorecard(false);
    startRound(holes, bag, mode);
  };

  if (phase === "setup") {
    return (
      <SetupScreen
        onStart={handleStart}
        onBack={onBack}
        bagClubCount={bagSource.length}
        robotClubCount={robotSource.length}
        activeBagName={activeBagName}
        bagId={bagId}
      />
    );
  }

  // Show Scorecard only after dismissing the final hole result modal
  if (phase === "round_complete" && !showResultModal) {
    const shouldShowPostAnalysis = course.length === 9 || course.length === 18;

    if (!shouldShowPostAnalysis) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 p-4 overflow-y-auto">
          <Scorecard onPlayAgain={resetGame} onBack={onBack} />
        </div>
      );
    }

    if (showDetailedScorecard) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 p-4 overflow-y-auto">
          <Scorecard onPlayAgain={() => { setShowDetailedScorecard(false); resetGame(); }} onBack={() => { setShowDetailedScorecard(false); resetGame(); onBack(); }} />
        </div>
      );
    }

    return (
      <PostRoundAnalysis
        onPlayAnotherRound={() => {
          setShowDetailedScorecard(false);
          resetGame();
        }}
        onViewDetailedScorecard={() => setShowDetailedScorecard(true)}
        onBackToMenu={() => {
          setShowDetailedScorecard(false);
          resetGame();
          onBack();
        }}
      />
    );
  }

  // Playing / hole_complete (modal open) / round_complete (modal open) → HoleView
  return (
    <>
      <HoleView
        onBack={() => { resetGame(); onBack(); }}
        onViewFinalScorecard={() => {
          setShowDetailedScorecard(true);
          useGameStore.getState().dismissResult();
        }}
      />

      {/* ショット結果モーダルの表示を廃止 */}
    </>
  );
}
