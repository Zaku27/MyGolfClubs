import { useMemo } from "react";
import { useGameStore } from "../../store/gameStore";
import {
  buildInsights,
  calculateKeyRoundStats,
  estimatePredictedScore,
  getPerformanceSummary,
} from "../../utils/roundAnalysis";

interface Props {
  onPlayAnotherRound: () => void;
  onViewDetailedScorecard: () => void;
  onBackToMenu: () => void;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-700/45 bg-emerald-900/35 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-50">{value}</p>
    </div>
  );
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
    <section className="rounded-2xl border border-emerald-700/45 bg-emerald-950/50 p-4 sm:p-5">
      <h3 className="text-lg font-bold text-emerald-50">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((club) => (
            <div key={`${title}-${club.clubName}`} className="rounded-xl border border-emerald-700/35 bg-emerald-900/35 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-50">{club.clubName}</p>
                <span className={`text-sm font-bold ${accentClass}`}>{club.successRate}%</span>
              </div>
              <p className="mt-1 text-xs text-emerald-300">
                Used {club.timesUsed} times | Avg distance {club.avgDistanceAchieved} yds
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-700/35 bg-emerald-900/30 px-3 py-3 text-sm text-emerald-300">
            No round data available.
          </p>
        )}
      </div>
    </section>
  );
}

export function PostRoundAnalysis({
  onPlayAnotherRound,
  onViewDetailedScorecard,
  onBackToMenu,
}: Props) {
  const { finalScore, perHoleResults, clubUsageStats, course, roundShots } = useGameStore();

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

    return {
      totalPar,
      final,
      predicted,
      performance,
      keyStats,
      bestClubs,
      strugglingClubs,
      insights,
    };
  }, [clubUsageStats, course, finalScore, perHoleResults, roundShots]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-green-900 to-green-950 px-4 py-6 text-emerald-50 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        <header className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 px-5 py-6 shadow-2xl shadow-emerald-950/40 sm:px-7 sm:py-7">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Round Complete</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Round Analysis</h1>

          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-emerald-700/45 bg-emerald-900/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Final Score</p>
              <p className="mt-2 text-5xl font-black leading-none text-emerald-50">{analysis.final}</p>
              <p className="mt-2 text-sm text-emerald-200">PAR {analysis.totalPar}</p>
            </div>

            <div className="rounded-2xl border border-emerald-700/45 bg-emerald-900/35 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Overall Result</p>
              <p className="mt-2 text-xl font-bold text-emerald-50">
                {analysis.final} (Predicted {analysis.predicted.predicted} +- {analysis.predicted.variance})
              </p>
              <p className={`mt-3 text-base font-bold ${analysis.performance.toneClass}`}>
                {analysis.performance.label}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-emerald-50">Key Stats</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Strokes" value={String(analysis.keyStats.totalStrokes)} />
            <StatCard label="Greens in Regulation" value={`${analysis.keyStats.girPercent}%`} />
            <StatCard label="Fairways Hit" value={`${analysis.keyStats.fairwayHitPercent}%`} />
            <StatCard label="Putts per Hole" value={analysis.keyStats.puttsPerHole.toFixed(2)} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ClubStatList title="Top 3 Best Clubs" items={analysis.bestClubs} accentClass="text-emerald-300" />
          <ClubStatList title="Top 3 Struggling Clubs" items={analysis.strugglingClubs} accentClass="text-rose-300" />
        </section>

        <section className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-emerald-50">Insights & Suggestions</h2>
          <ul className="mt-3 space-y-2">
            {analysis.insights.map((insight) => (
              <li
                key={insight}
                className="rounded-xl border border-emerald-700/35 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100"
              >
                • {insight}
              </li>
            ))}
          </ul>
        </section>

        <footer className="grid gap-3 pb-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={onPlayAnotherRound}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
          >
            Play Another Round
          </button>
          <button
            type="button"
            onClick={onViewDetailedScorecard}
            className="rounded-xl border border-emerald-400/60 bg-emerald-900/40 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:border-emerald-300"
          >
            View Detailed Scorecard
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="rounded-xl border border-emerald-700/70 bg-transparent px-4 py-3 text-sm font-bold text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-100"
          >
            Back to Menu
          </button>
        </footer>
      </div>
    </div>
  );
}
