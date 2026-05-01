import type { Hole, SimClub } from "../../types/game";
import type { GolfClub } from "../../types/golf";
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { useClubStore } from "../../store/clubStore";
import { toSimClub } from "../../utils/clubSimAdapter";
import { COURSE_1HOLE, COURSE_3HOLES, COURSE_9HOLES, COURSE_18HOLES } from "../../data/defaultCourses";
import { cloneCourse } from "../../utils/courseGenerator";
import { loadStoredCustomCourse, type CustomCoursePreset } from "../../utils/customCourseStorage";
import { HoleView } from "./HoleView";
import { filterClubsWithActualShots } from "../../utils/actualShotFilter";
import { PostRoundAnalysis } from "./PostRoundAnalysis";
import { RoundHistoryScreen } from "./RoundHistoryScreen";
import { SHOW_HOME_RELEASE_LIMITED_ACTIONS } from "../../config/featureFlags";

import { Scorecard } from "./Scorecard";

interface Props {
  onBack: () => void;
  selectedClubs: GolfClub[];
  allClubs: GolfClub[];
  activeBagName?: string;
  bagId?: number | null;
}

const SIMULATOR_PLAY_MODE_STORAGE_KEY = "golfbag-simulator-play-mode-v1";
const SIMULATOR_ROBOT_SETTINGS_KEY = "golfbag-simulator-robot-settings-v1";

const DEFAULT_ROBOT_HEAD_SPEED = 40;
const DEFAULT_ROBOT_SKILL_LEVEL = 0.5;

interface RobotSettings {
  headSpeed: number;
  skillLevel: number;
}

function loadStoredSimulatorPlayMode(): "bag" | "robot" | "measured" {
  if (typeof window === "undefined") {
    return "bag";
  }
  const raw = window.localStorage.getItem(SIMULATOR_PLAY_MODE_STORAGE_KEY);
  if (raw === "robot") return "robot";
  if (raw === "measured") return "measured";
  return "bag";
}

function loadStoredRobotSettings(): RobotSettings {
  if (typeof window === "undefined") {
    return { headSpeed: DEFAULT_ROBOT_HEAD_SPEED, skillLevel: DEFAULT_ROBOT_SKILL_LEVEL };
  }
  try {
    const raw = window.localStorage.getItem(SIMULATOR_ROBOT_SETTINGS_KEY);
    if (!raw) {
      return { headSpeed: DEFAULT_ROBOT_HEAD_SPEED, skillLevel: DEFAULT_ROBOT_SKILL_LEVEL };
    }
    const parsed = JSON.parse(raw);
    return {
      headSpeed: Math.max(20, Math.min(60, Number(parsed.headSpeed) || DEFAULT_ROBOT_HEAD_SPEED)),
      skillLevel: Math.max(0, Math.min(1, Number(parsed.skillLevel) || DEFAULT_ROBOT_SKILL_LEVEL)),
    };
  } catch {
    return { headSpeed: DEFAULT_ROBOT_HEAD_SPEED, skillLevel: DEFAULT_ROBOT_SKILL_LEVEL };
  }
}

function saveRobotSettings(settings: RobotSettings): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SIMULATOR_ROBOT_SETTINGS_KEY, JSON.stringify(settings));
  }
}

interface SelectableCourse {
  id: string;
  name: string;
  holes: Hole[];
  source: "builtin" | "custom";
}

function buildSelectableCourses(customCourses: CustomCoursePreset[]): SelectableCourse[] {
  const builtinCourses: SelectableCourse[] = [
    { id: "builtin-1", name: "標準コース 1H", holes: COURSE_1HOLE, source: "builtin" },
    { id: "builtin-3", name: "標準コース 3H", holes: COURSE_3HOLES, source: "builtin" },
    { id: "builtin-9", name: "標準コース OUT", holes: COURSE_9HOLES, source: "builtin" },
    { id: "builtin-18", name: "標準コース", holes: COURSE_18HOLES, source: "builtin" },
  ];

  // SHOW_HOME_RELEASE_LIMITED_ACTIONS が false の時はマイコースを表示しない
  if (!SHOW_HOME_RELEASE_LIMITED_ACTIONS) {
    return builtinCourses;
  }

  const customSelectable = customCourses.map((course) => ({
    id: course.id,
    name: `${course.name} (${course.holeCount}ホール)`,
    holes: cloneCourse(course.course),
    source: "custom" as const,
  }));

  return [...builtinCourses, ...customSelectable];
}

function SetupScreen({
  onStart,
  onBack,
  bagClubCount,
  robotClubCount,
  measuredClubCount,
  measuredPlayableClubCount,
  activeBagName,
  bagId,
  courses,
  selectedCourse,
  onChangeSelectedCourse,
  bags,
  selectedBagId,
  onSelectBag,
  selectedBagSkillLevel,
}: {
  onStart: (holes: Hole[], mode: "bag" | "robot" | "measured", robotSettings?: RobotSettings) => void;
  onBack: () => void;
  bagClubCount: number;
  robotClubCount: number;
  measuredClubCount: number;
  measuredPlayableClubCount: number;
  activeBagName?: string;
  bagId?: number | null;
  courses: SelectableCourse[];
  selectedCourse: SelectableCourse;
  onChangeSelectedCourse: (courseId: string) => void;
  bags: { id?: number; name: string; playerSkillLevel?: number }[];
  selectedBagId: number | null;
  onSelectBag: (bagId: number) => void;
  selectedBagSkillLevel: number;
}) {
  const [playMode, setPlayMode] = useState<"bag" | "robot" | "measured">(() => loadStoredSimulatorPlayMode());
  const [robotSettings, setRobotSettings] = useState<RobotSettings>(() => loadStoredRobotSettings());
  const bagQuery = typeof bagId === 'number' ? `?bagId=${bagId}` : '';
  const clubCount = playMode === "robot" ? robotClubCount : playMode === "measured" ? measuredClubCount : bagClubCount;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIMULATOR_PLAY_MODE_STORAGE_KEY, playMode);
    }
  }, [playMode]);

  useEffect(() => {
    saveRobotSettings(robotSettings);
  }, [robotSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 flex flex-col">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-emerald-300 bg-emerald-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 text-xs font-semibold tracking-wide text-emerald-800 sm:h-16 sm:gap-4 sm:text-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-sm font-bold text-emerald-900">コースシミュレーター</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={`/round-history${bagQuery}`}
              className="rounded-full border border-emerald-400/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-500 hover:text-emerald-900 sm:text-xs"
            >
              統計
            </Link>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-emerald-500 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-600 hover:text-emerald-900 sm:text-xs"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 pt-10">
      <div className="text-center">
        <h1 className="text-3xl font-black text-emerald-900 tracking-tight">
          コースシミュレーター
        </h1>
        <p className="text-emerald-700 mt-1 text-sm">
          クラブ選択と戦略でコースを攻略
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
        <div className="rounded-xl border border-emerald-200 bg-white/80 p-4">
          <p className="text-xs font-bold tracking-[0.12em] text-emerald-700">プレーモード</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setPlayMode("bag")}
              className={[
                "rounded-lg border px-4 py-3 text-sm font-semibold transition flex items-center justify-between gap-3",
                playMode === "bag"
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-lg shadow-emerald-300/50"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
              ].join(" ")}
            >
              <span>🏌️ ゴルフバッグ</span>
              <span className="text-xs opacity-80">{bagClubCount}本</span>
            </button>
            <button
              type="button"
              onClick={() => setPlayMode("robot")}
              className={[
                "rounded-lg border px-4 py-3 text-sm font-semibold transition flex items-center justify-between gap-3",
                playMode === "robot"
                  ? "border-sky-700 bg-sky-700 text-white shadow-lg shadow-sky-300/50"
                  : "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100",
              ].join(" ")}
            >
              <span>🤖 ロボット</span>
              <span className="text-xs opacity-80">{robotClubCount}本</span>
            </button>
            <button
              type="button"
              onClick={() => setPlayMode("measured")}
              disabled={measuredPlayableClubCount === 0}
              className={[
                "rounded-lg border px-4 py-3 text-sm font-semibold transition flex items-center justify-between gap-3",
                playMode === "measured"
                  ? "border-amber-700 bg-amber-700 text-white shadow-lg shadow-amber-300/50"
                  : measuredPlayableClubCount === 0
                    ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
              ].join(" ")}
            >
              <span>📊 実測データ</span>
              <span className="text-xs opacity-80">{measuredClubCount}本</span>
            </button>
          </div>
          <p className="mt-3 text-xs text-emerald-700 leading-relaxed">
            {playMode === "bag"
              ? `個人データを使い、${activeBagName ?? "選択中バッグ"}でプレーします。`
              : playMode === "robot"
              ? "ロボット設定で全クラブを使ってプレーします。"
              : measuredPlayableClubCount === 0
              ? "パター以外の実測データが登録されていません。パーソナルデータ画面でCSVをインポートしてください。"
              : "実測データからランダムにショットを選択してプレーします。"}
          </p>

          {/* バッグ選択UI */}
          {playMode === "bag" && bags.length > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold tracking-[0.1em] text-emerald-700">バッグ選択</p>
              <div className="mt-3 space-y-2">
                {bags.map((bag) => (
                  <button
                    key={bag.id}
                    type="button"
                    onClick={() => bag.id != null && onSelectBag(bag.id)}
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-sm font-medium transition flex items-center justify-between gap-3",
                      selectedBagId === bag.id
                        ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                        : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50",
                    ].join(" ")}
                  >
                    <span className="flex-1 truncate text-left">{bag.name}</span>
                    <span className="flex-shrink-0 text-xs opacity-70">{Math.round((bag.playerSkillLevel ?? 0.5) * 100)}%</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-emerald-600">
                選択中: {activeBagName ?? "バッグなし"} · スキルレベル {Math.round(selectedBagSkillLevel * 100)}%
              </p>
            </div>
          )}

          {/* ロボット設定UI */}
          {playMode === "robot" && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <p className="text-xs font-bold tracking-[0.1em] text-sky-700">ロボット設定</p>
              <div className="mt-3 space-y-4">
                {/* ヘッドスピード */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-sky-800">ヘッドスピード</label>
                    <span className="text-sm font-semibold text-sky-700">{robotSettings.headSpeed} m/s</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={60}
                    step={1}
                    value={robotSettings.headSpeed}
                    onChange={(e) => setRobotSettings((prev) => ({ ...prev, headSpeed: Number(e.target.value) }))}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-sky-200 accent-sky-600"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-sky-600">
                    <span>20</span>
                    <span>40</span>
                    <span>60</span>
                  </div>
                </div>
                {/* スキルレベル */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-sky-800">スキルレベル</label>
                    <span className="text-sm font-semibold text-sky-700">{(robotSettings.skillLevel * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={robotSettings.skillLevel}
                    onChange={(e) => setRobotSettings((prev) => ({ ...prev, skillLevel: Number(e.target.value) }))}
                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-sky-200 accent-sky-600"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-sky-600">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          onClick={() => onStart(selectedCourse.holes, playMode, playMode === "robot" ? robotSettings : undefined)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700/60 disabled:text-emerald-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          {selectedCourse.holes.length}ホールでプレー
        </button>
      </div>
    </div>
    </div>
  );
}

export function SimulatorApp({ onBack, selectedClubs, allClubs, activeBagName, bagId }: Props) {
  const { phase, startRound, resetGame, playMode } = useGameStore();
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(true);
  const [showPostRoundAnalysis, setShowPostRoundAnalysis] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const bagSource = selectedClubs;

  const actualShotRows = useClubStore((state) => state.actualShotRows);
  const bags = useClubStore((state) => state.bags);
  const activeBagId = useClubStore((state) => state.activeBagId);
  const setActiveBag = useClubStore((state) => state.setActiveBag);
  const loadActualShotRows = useClubStore((state) => state.loadActualShotRows);
  const bagSimClubs = bagSource.map(toSimClub);

  // 選択中バッグのスキルレベルを取得
  const selectedBag = bags.find((b) => b.id === activeBagId);
  const selectedBagSkillLevel = selectedBag?.playerSkillLevel ?? 0.5;

  // 先頭のバッグに含まれるクラブをロボットモードで使用
  const firstBag = bags[0] ?? null;
  const firstBagClubIds = firstBag?.clubIds ?? [];
  const robotSource = useMemo(() => {
    return allClubs.filter((club) => club.id != null && firstBagClubIds.includes(club.id));
  }, [allClubs, firstBagClubIds]);

  // 実測データをロード
  useEffect(() => {
    loadActualShotRows();
  }, [loadActualShotRows]);
  const measuredSource = useMemo(() => {
    if (!activeBagId) return [];
    return filterClubsWithActualShots(bagSimClubs, actualShotRows[String(activeBagId)] ?? []);
  }, [activeBagId, actualShotRows, bagSimClubs]);

  // 実測データモードでプレー可能なクラブ数（パター以外をカウント）
  const measuredPlayableClubCount = measuredSource.filter(club => club.type !== "Putter").length;

  // バッグにパターが含まれていれば本数に加える（実測データがなくても表示に含める）
  const hasPutterInBag = bagSource.some(club => club.clubType === "Putter");
  const measuredClubCount = measuredSource.length + (hasPutterInBag ? 1 : 0);

  const storedCustomCourses = loadStoredCustomCourse();
  const selectableCourses = buildSelectableCourses(storedCustomCourses.courses);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => storedCustomCourses.selectedCourseId);
  const selectedCourse = selectableCourses.find((course) => course.id === selectedCourseId) ?? selectableCourses[0];
  
  const handleStart = (holes: Hole[], mode: "bag" | "robot" | "measured", robotSettings?: RobotSettings) => {
    let bag: SimClub[];
    if (mode === "measured") {
      bag = measuredSource;
    } else {
      const source = mode === "robot" ? robotSource : bagSource;
      bag = source.map(toSimClub);
    }
    setShowDetailedScorecard(false);
    // バッグモード時は選択中バッグのスキルレベルを渡す
    const bagSkillLevel = mode === "bag" ? selectedBagSkillLevel : undefined;
    startRound(cloneCourse(holes), bag, mode, selectedCourse.name, robotSettings, bagSkillLevel);
  };

  if (phase === "setup") {
    return (
      <SetupScreen
        onStart={handleStart}
        onBack={onBack}
        bagClubCount={bagSource.length}
        robotClubCount={robotSource.length}
        measuredClubCount={measuredClubCount}
        measuredPlayableClubCount={measuredPlayableClubCount}
        activeBagName={activeBagName}
        bagId={bagId}
        courses={selectableCourses}
        selectedCourse={selectedCourse}
        onChangeSelectedCourse={setSelectedCourseId}
        bags={bags}
        selectedBagId={activeBagId}
        onSelectBag={(id) => void setActiveBag(id)}
        selectedBagSkillLevel={selectedBagSkillLevel}
      />
    );
  }

  if (phase === "round_complete" && showDetailedScorecard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 p-4 overflow-y-auto">
        <Scorecard
          onViewStatistics={() => { setShowDetailedScorecard(false); setShowPostRoundAnalysis(true); }}
        />
      </div>
    );
  }

  if (phase === "round_complete" && showPostRoundAnalysis) {
    return (
      <PostRoundAnalysis
        onPlayAnotherRound={() => { setShowPostRoundAnalysis(false); resetGame(); }}
        onViewDetailedScorecard={() => { setShowPostRoundAnalysis(false); setShowDetailedScorecard(true); }}
        onBackToMenu={() => { resetGame(); onBack(); }}
        onViewRoundHistory={() => { setShowPostRoundAnalysis(false); setShowRoundHistory(true); }}
        courseName={selectedCourse?.name}
        bagId={bagId}
        playMode={playMode}
      />
    );
  }

  if (showRoundHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 p-4 overflow-y-auto">
        <RoundHistoryScreen
          bagId={bagId}
          onBack={() => { setShowRoundHistory(false); resetGame(); }}
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
