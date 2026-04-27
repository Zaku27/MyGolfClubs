import { useMemo, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import {
  buildInsights,
  calculateKeyRoundStats,
  estimatePredictedScore,
  getPerformanceSummary,
} from "../../utils/roundAnalysis";
import { RoundHistoryService } from "../../db/roundHistoryService";

interface Props {
  onPlayAnotherRound: () => void;
  onViewDetailedScorecard: () => void;
  onBackToMenu: () => void;
  onViewRoundHistory?: () => void;
  courseName?: string;
  bagId?: number | null;
  playMode?: 'bag' | 'robot' | 'measured';
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-300/40">
      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-900">{value}</p>
    </div>
  );
}

function toParString(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function ClubStatList({
  title,
  items,
  accentClass,
}: {
  title: string;
  items: Array<{ clubName: string; timesUsed: number; successRate: number; avgDistanceAchieved: number }>;
  accentClass: string;
}) {
  return (
    <section className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 shadow-sm shadow-emerald-300/40">
      <h3 className="text-lg font-bold text-emerald-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((club) => (
            <div key={`${title}-${club.clubName}`} className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-900">{club.clubName}</p>
                <span className={`text-sm font-bold ${accentClass}`}>{club.successRate}%</span>
              </div>
              <p className="mt-1 text-xs text-emerald-600">
                {club.timesUsed}回使用 | 平均飛距離 {club.avgDistanceAchieved}yd
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-700">
            ラウンドデータがありません。
          </p>
        )}
      </div>
    </section>
  );
}

function RoundClubSummaryTable({
  items,
}: {
  items: Array<{
    clubId: string;
    clubName: string;
    timesUsed: number;
    successes: number;
    successRate: number;
    avgDistanceAchieved: number;
  }>;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-300/40">
      <h2 className="text-sm font-bold tracking-[0.08em] text-emerald-900">ラウンドサマリー（クラブ別）</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-700">
          クラブ使用データがありません。
        </p>
      ) : (
        <div className="mt-3">
          <table className="w-full table-fixed border-separate border-spacing-y-1 text-left text-[10px] sm:text-xs">
            <thead>
              <tr className="text-emerald-300">
                <th className="w-[38%] px-2 py-1 font-semibold">クラブ</th>
                <th className="w-[16%] px-1.5 py-1 font-semibold">使用回数</th>
                <th className="w-[16%] px-1.5 py-1 font-semibold">成功回数</th>
                <th className="w-[14%] px-1.5 py-1 font-semibold">成功率</th>
                <th className="w-[16%] px-1.5 py-1 font-semibold">平均飛距離</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.clubId} className="rounded-xl border border-emerald-300 bg-emerald-50/80 text-emerald-900">
                  <td className="rounded-l-xl break-words px-2 py-2 font-semibold leading-tight">{item.clubName}</td>
                  <td className="px-1.5 py-2">{item.timesUsed}回</td>
                  <td className="px-1.5 py-2">{item.successes}回</td>
                  <td className="px-1.5 py-2">{item.successRate}%</td>
                  <td className="rounded-r-xl px-1.5 py-2">{item.avgDistanceAchieved}yd</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PostRoundAnalysis({
  onPlayAnotherRound,
  onViewDetailedScorecard,
  onBackToMenu,
  onViewRoundHistory,
  courseName,
  bagId,
  playMode,
}: Props) {
  const { finalScore, perHoleResults, clubUsageStats, course, roundShots, roundSeedNonce } = useGameStore();
  const [skipSave, setSkipSave] = useState(false);

  const analysis = useMemo(() => {
    const totalPar = perHoleResults.reduce((sum, hole) => sum + hole.par, 0);
    const final = finalScore ?? perHoleResults.reduce((sum, hole) => sum + hole.strokes, 0);
    const keyStats = calculateKeyRoundStats(perHoleResults, course, roundShots);
    const predicted = estimatePredictedScore(totalPar, perHoleResults.length, clubUsageStats);
    const performance = getPerformanceSummary(final, predicted.predicted);

    const ranked = [...clubUsageStats].filter((club) => club.timesUsed > 0);
    const bestClubs = ranked
      .filter((club) => club.timesUsed >= 2)
      .sort((a, b) => {
        const left = a.successRate * a.timesUsed;
        const right = b.successRate * b.timesUsed;
        return right - left;
      })
      .slice(0, 3);

    const strugglingClubs = ranked
      .filter((club) => club.timesUsed >= 2)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 3);

    const insights = buildInsights(keyStats, clubUsageStats, perHoleResults);
    const clubRoundSummary = [...ranked].sort((a, b) => {
      if (b.timesUsed !== a.timesUsed) return b.timesUsed - a.timesUsed;
      return b.successRate - a.successRate;
    });

    return {
      totalPar,
      final,
      predicted,
      performance,
      keyStats,
      bestClubs,
      strugglingClubs,
      insights,
      clubRoundSummary,
    };
  }, [clubUsageStats, course, finalScore, perHoleResults, roundShots]);

  // ラウンド保存ハンドラー
  const handleSaveAndNavigate = async (callback: () => void) => {
    if (!skipSave) {
      try {
        await RoundHistoryService.saveRound({
          courseName: courseName || '不明なコース',
          courseHoleCount: course.length,
          playMode: playMode || 'bag',
          bagId: bagId ?? undefined,
          totalScore: analysis.final,
          totalPar: analysis.totalPar,
          perHoleResults: perHoleResults,
          clubUsageStats: clubUsageStats,
          keyStats: {
            totalStrokes: analysis.keyStats.totalStrokes,
            girPercent: analysis.keyStats.girPercent,
            fairwayHitPercent: analysis.keyStats.fairwayHitPercent,
            puttsPerHole: analysis.keyStats.puttsPerHole,
          },
          isFavorite: false,
          roundSeedNonce: roundSeedNonce,
        });
      } catch (error) {
        console.error('Failed to save round:', error);
      }
    }
    callback();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 px-4 py-6 text-emerald-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        <header className="rounded-3xl border border-emerald-300 bg-emerald-50/90 px-5 py-6 shadow-sm shadow-emerald-300/40 sm:px-7 sm:py-7">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">ラウンド完了</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl text-emerald-900">ラウンド分析</h1>

          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-300/40">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">最終スコア</p>
              <p className="mt-2 text-5xl font-black leading-none text-emerald-900">{toParString(analysis.final, analysis.totalPar)}</p>
              <p className="mt-2 text-sm text-emerald-600">ストローク{analysis.final}/パー{analysis.totalPar}</p>
            </div>

            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-300/40">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">全体結果</p>
              <p className="mt-2 text-xl font-bold text-emerald-900">
                {analysis.final} (予測 {analysis.predicted.predicted} ± {analysis.predicted.variance})
              </p>
              <p className={`mt-3 text-base font-bold ${analysis.performance.toneClass}`}>
                {analysis.performance.label}
              </p>
            </div>
          </div>

          <RoundClubSummaryTable items={analysis.clubRoundSummary} />
        </header>

        <section className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 sm:p-6 shadow-sm shadow-emerald-300/40">
          <h2 className="text-xl font-bold text-emerald-900">主要統計</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="総ストローク数" value={String(analysis.keyStats.totalStrokes)} />
            <StatCard label="GIR" value={`${analysis.keyStats.girPercent}%`} />
            <StatCard label="フェアウェイキープ" value={`${analysis.keyStats.fairwayHitPercent}%`} />
            <StatCard label="パット数/ホール" value={analysis.keyStats.puttsPerHole.toFixed(2)} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ClubStatList title="ベストクラブTOP3" items={analysis.bestClubs} accentClass="text-emerald-700" />
          <ClubStatList title="苦戦クラブTOP3" items={analysis.strugglingClubs} accentClass="text-rose-600" />
        </section>

        <section className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 sm:p-6 shadow-sm shadow-emerald-300/40">
          <h2 className="text-xl font-bold text-emerald-900">分析と提案</h2>
          <ul className="mt-3 space-y-2">
            {analysis.insights.map((insight) => (
              <li
                key={insight}
                className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900"
              >
                • {insight}
              </li>
            ))}
          </ul>
        </section>

        <footer className="space-y-4 pb-4">
          {/* 統計保存チェックボックス */}
          <label className="flex items-center justify-center gap-2 text-sm text-emerald-700">
            <input
              type="checkbox"
              checked={skipSave}
              onChange={(e) => setSkipSave(e.target.checked)}
              className="h-4 w-4 rounded border-emerald-400 bg-emerald-50 text-emerald-600 focus:ring-emerald-500"
            />
            統計に保存しない
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleSaveAndNavigate(onPlayAnotherRound)}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
            >
              もう一度プレー
            </button>
            <button
              type="button"
              onClick={() => handleSaveAndNavigate(onViewDetailedScorecard)}
              className="rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 transition hover:border-emerald-500"
            >
              スコアカードを見る
            </button>
            <button
              type="button"
              onClick={() => handleSaveAndNavigate(onBackToMenu)}
              className="rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 transition hover:border-emerald-500"
            >
              メニューに戻る
            </button>
          </div>
          {onViewRoundHistory && (
            <button
              type="button"
              onClick={() => handleSaveAndNavigate(onViewRoundHistory)}
              className="w-full rounded-xl border border-sky-400 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 transition hover:border-sky-500"
            >
              📊 ラウンド履歴・統計を見る
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
