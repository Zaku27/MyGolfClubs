import type { Hole } from "../../types/game";
import type { GolfClub } from "../../types/golf";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { toSimClub } from "../../utils/clubSimAdapter";
import { COURSE_1HOLE, COURSE_3HOLES, COURSE_9HOLES, COURSE_18HOLES } from "../../data/defaultCourses";
import { loadStoredCustomCourse, type CustomCoursePreset } from "./CustomCourseEditorScreen";
import { HoleView } from "./HoleView";

import { Scorecard } from "./Scorecard";

interface Props {
  onBack: () => void;
  selectedClubs: GolfClub[];
  allClubs: GolfClub[];
  activeBagName?: string;
  bagId?: number | null;
}

const SIMULATOR_PLAY_MODE_STORAGE_KEY = "golfbag-simulator-play-mode-v1";

function loadStoredSimulatorPlayMode(): "bag" | "robot" {
  if (typeof window === "undefined") {
    return "bag";
  }
  const raw = window.localStorage.getItem(SIMULATOR_PLAY_MODE_STORAGE_KEY);
  return raw === "robot" ? "robot" : "bag";
}

interface SelectableCourse {
  id: string;
  name: string;
  holes: Hole[];
  source: "builtin" | "custom";
}

function buildSelectableCourses(customCourses: CustomCoursePreset[]): SelectableCourse[] {
  const builtinCourses: SelectableCourse[] = [
    { id: "builtin-1", name: "標準 1ホール", holes: COURSE_1HOLE, source: "builtin" },
    { id: "builtin-3", name: "標準 3ホール", holes: COURSE_3HOLES, source: "builtin" },
    { id: "builtin-9", name: "標準 9ホール", holes: COURSE_9HOLES, source: "builtin" },
    { id: "builtin-18", name: "標準 18ホール", holes: COURSE_18HOLES, source: "builtin" },
  ];

  const customSelectable = customCourses.map((course) => ({
    id: course.id,
    name: `${course.name} (${course.holeCount}ホール)`,
    holes: course.course,
    source: "custom" as const,
  }));

  return [...builtinCourses, ...customSelectable];
}

function SetupScreen({
  onStart,
  onBack,
  bagClubCount,
  robotClubCount,
  activeBagName,
  bagId,
  courses,
  selectedCourse,
  onChangeSelectedCourse,
}: {
  onStart: (holes: Hole[], mode: "bag" | "robot") => void;
  onBack: () => void;
  bagClubCount: number;
  robotClubCount: number;
  activeBagName?: string;
  bagId?: number | null;
  courses: SelectableCourse[];
  selectedCourse: SelectableCourse;
  onChangeSelectedCourse: (courseId: string) => void;
}) {
  const [playMode, setPlayMode] = useState<"bag" | "robot">(() => loadStoredSimulatorPlayMode());
  const bagQuery = typeof bagId === 'number' ? `?bagId=${bagId}` : '';
  const clubCount = playMode === "robot" ? robotClubCount : bagClubCount;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIMULATOR_PLAY_MODE_STORAGE_KEY, playMode);
    }
  }, [playMode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-black text-emerald-900 tracking-tight">
          コースシミュレーター
        </h1>
        <p className="text-emerald-700 mt-1 text-sm">
          クラブ選択と戦略でスコアを目指せ
        </p>
      </div>

      <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-sm shadow-emerald-300/40">
        <div className="rounded-xl border border-emerald-200 bg-white/80 p-4">
          <p className="text-xs font-bold tracking-[0.12em] text-emerald-700">プレイするコース</p>
          <select
            value={selectedCourse.id}
            onChange={(event) => onChangeSelectedCourse(event.target.value)}
            className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow-sm focus:border-emerald-500 focus:outline-none"
          >
            <optgroup label="標準コース">
              {courses.filter((course) => course.source === "builtin").map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </optgroup>
            {courses.some((course) => course.source === "custom") && (
              <optgroup label="マイコース">
                {courses.filter((course) => course.source === "custom").map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-2 text-sm text-emerald-700">
            選択中: <span className="font-semibold text-emerald-900">{selectedCourse.name}</span> ・ {selectedCourse.holes.length}ホール
          </p>
          <Link
            to={`/course-editor${bagQuery}`}
            className="mt-3 inline-block text-sm text-sky-700 hover:text-sky-900 underline"
          >
            コースエディタでマイコースを作成・編集
          </Link>
        </div>
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
            <span>クラブを選択し、方向とパワーを決定してショット</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold flex-shrink-0">3.</span>
            <span>距離・難易度・成功率が絡み、結果が確定する</span>
          </div>
        </div>

        <button
          onClick={() => onStart(selectedCourse.holes, playMode)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700/60 disabled:text-emerald-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          {selectedCourse.holes.length}ホールでプレー
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
    startRound,
    resetGame,
  } = useGameStore();
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const bagSource = selectedClubs;
  const robotSource = allClubs;

  const storedCustomCourses = loadStoredCustomCourse();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => storedCustomCourses.selectedCourseId);
  const selectableCourses = buildSelectableCourses(storedCustomCourses.courses);
  const selectedCourse = selectableCourses.find((course) => course.id === selectedCourseId) ?? selectableCourses[0];

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
        courses={selectableCourses}
        selectedCourse={selectedCourse}
        onChangeSelectedCourse={setSelectedCourseId}
      />
    );
  }

  if (phase === "round_complete" && showDetailedScorecard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 p-4 overflow-y-auto">
        <Scorecard
          onPlayAgain={() => { setShowDetailedScorecard(false); resetGame(); }}
          onBack={() => { setShowDetailedScorecard(false); resetGame(); onBack(); }}
        />
      </div>
    );
  }

  return (
    <>
      <HoleView
        onBack={() => { resetGame(); onBack(); }}
        onViewFinalScorecard={() => {
          setShowDetailedScorecard(true);
        }}
      />

      {/* ショット結果モーダルの表示を廃止 */}
    </>
  );
}
