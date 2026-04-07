import type { Hole } from "../../types/game";
import type { GolfClub } from "../../types/golf";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { toSimClub } from "../../utils/clubSimAdapter";
import { COURSE_1HOLE, COURSE_3HOLES, COURSE_9HOLES, COURSE_18HOLES } from "../../data/defaultCourses";
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

function SetupScreen({ onStart, onBack, bagClubCount, robotClubCount, activeBagName, bagId }: {
  onStart: (holes: Hole[], mode: "bag" | "robot") => void;
  onBack: () => void;
  bagClubCount: number;
  robotClubCount: number;
  activeBagName?: string;
  bagId?: number | null;
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
            <span>バッグのクラブを選択し、パワーを決定してショット</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold flex-shrink-0">3.</span>
            <span>距離・難易度・成功率が絡み、結果が確定する</span>
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
