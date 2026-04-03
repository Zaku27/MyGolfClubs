import type { Hole } from "../../types/game";
import type { GolfClub } from "../../types/golf";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { toSimClub } from "../../utils/clubSimAdapter";
import { COURSE_1HOLE, COURSE_3HOLES, COURSE_9HOLES, COURSE_18HOLES } from "../../data/defaultCourses";
import { HoleView } from "./HoleView";
import { PostRoundAnalysis } from "./PostRoundAnalysis";

import { Scorecard } from "./Scorecard";

interface Props {
  onBack: () => void;
  selectedClubs: GolfClub[];
}

function SetupScreen({ onStart, onBack, clubCount }: {
  onStart: (holes: Hole[]) => void;
  onBack: () => void;
  clubCount: number;
}) {
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
          onClick={() => onStart(COURSE_1HOLE)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:bg-emerald-700/60 disabled:text-emerald-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          1ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_3HOLES)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-lime-500 hover:bg-lime-400 disabled:bg-lime-700/60 disabled:text-lime-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
        >
          3ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_9HOLES)}
          disabled={clubCount === 0}
          className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-700/60 disabled:text-green-100/70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-lg"
        >
          9ホールでプレー
        </button>
        <button
          onClick={() => onStart(COURSE_18HOLES)}
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
        to="/range"
        className="text-emerald-700 hover:text-emerald-900 text-sm underline transition-colors"
      >
        練習場に戻る
      </Link>
      <Link
        to="/personal-data"
        className="text-emerald-700 hover:text-emerald-900 text-sm underline transition-colors"
      >
        パーソナルデータを調整
      </Link>
    </div>
  );
}

export function SimulatorApp({ onBack, selectedClubs }: Props) {
  const {
    phase,
    course,
    startRound,
    resetGame,
    showResultModal,
  } = useGameStore();
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const bagSource = selectedClubs;

  const handleStart = (holes: Hole[]) => {
    const bag = bagSource.map(toSimClub);
    setShowDetailedScorecard(false);
    startRound(holes, bag);
  };

  if (phase === "setup") {
    return <SetupScreen onStart={handleStart} onBack={onBack} clubCount={bagSource.length} />;
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
