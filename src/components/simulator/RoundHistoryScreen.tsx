import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoundHistoryService, type RoundFilter, type AggregateStats, type ClubSuccessTrend } from '../../db/roundHistoryService';
import type { RoundHistory } from '../../db/database';

interface Props {
  bagId?: number | null;
}

const PLAY_MODE_LABELS: Record<string, string> = {
  bag: 'バッグ',
  robot: 'ロボット',
  measured: '実測データ',
};

const DATE_RANGE_LABELS: Record<string, string> = {
  last10: '直近10ラウンド',
  last30: '直近30ラウンド',
  last50: '直近50ラウンド',
  all: '全期間',
};

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-2xl border border-emerald-700/45 bg-emerald-900/35 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-50">{value}</p>
      {subValue && <p className="mt-1 text-sm text-emerald-200">{subValue}</p>}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toParString(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

export function RoundHistoryScreen({ bagId }: Props) {
  const [rounds, setRounds] = useState<RoundHistory[]>([]);
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [clubTrends, setClubTrends] = useState<ClubSuccessTrend[]>([]);
  const [courseNames, setCourseNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルター状態
  const [filter, setFilter] = useState<RoundFilter>({
    dateRange: 'last30',
    favoritesOnly: false,
  });

  const bagQuery = typeof bagId === 'number' ? `?bagId=${bagId}` : '';

  // データ読み込み
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const courses = await RoundHistoryService.getCourseNames();
        setCourseNames(courses);

        // フィルター適用
        const filteredRounds = await RoundHistoryService.getRoundsWithFilters(filter);
        setRounds(filteredRounds);

        // 統計計算
        const aggregateStats = await RoundHistoryService.getAggregateStats(filteredRounds);
        setStats(aggregateStats);

        // クラブトレンド
        const trends = await RoundHistoryService.getClubSuccessTrends(filteredRounds);
        setClubTrends(trends);
      } catch (error) {
        console.error('Failed to load round history:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [filter]);

  // フィルター変更ハンドラー
  const handleCourseChange = (courseName: string) => {
    setFilter((prev) => ({
      ...prev,
      courseName: courseName || undefined,
    }));
  };

  const handlePlayModeChange = (mode: 'bag' | 'robot' | 'measured', checked: boolean) => {
    setFilter((prev) => {
      const currentModes = prev.playModes ?? [];
      const newModes = checked
        ? [...currentModes, mode]
        : currentModes.filter((m) => m !== mode);
      return {
        ...prev,
        playModes: newModes.length > 0 ? newModes : undefined,
      };
    });
  };

  const handleDateRangeChange = (dateRange: RoundFilter['dateRange']) => {
    setFilter((prev) => ({ ...prev, dateRange }));
  };

  const handleFavoritesToggle = () => {
    setFilter((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }));
  };

  // アクション
  const handleToggleFavorite = async (id: number) => {
    const newFavorite = await RoundHistoryService.toggleFavorite(id);
    setRounds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorite: newFavorite } : r))
    );
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このラウンドを削除しますか？')) return;
    await RoundHistoryService.deleteRound(id);
    setRounds((prev) => prev.filter((r) => r.id !== id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-green-900 to-green-950 flex items-center justify-center">
        <div className="text-emerald-300">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-green-900 to-green-950 px-4 py-6 text-emerald-50 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
        {/* ヘッダー */}
        <header className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 px-5 py-6 shadow-2xl shadow-emerald-950/40 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Statistics</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">ラウンド履歴・統計</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/simulator${bagQuery}`}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
              >
                コースシミュレーターに戻る
              </Link>
            </div>
          </div>
        </header>

        {/* フィルターセクション */}
        <section className="rounded-2xl border border-emerald-700/45 bg-emerald-900/25 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-emerald-200">フィルター</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* コース選択 */}
            <div>
              <label className="text-xs text-emerald-400">コース</label>
              <select
                value={filter.courseName || ''}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-600/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100"
              >
                <option value="">すべて</option>
                {courseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* 期間選択 */}
            <div>
              <label className="text-xs text-emerald-400">期間</label>
              <select
                value={typeof filter.dateRange === 'string' ? filter.dateRange : 'all'}
                onChange={(e) => handleDateRangeChange(e.target.value as 'last10' | 'last30' | 'last50' | 'all')}
                className="mt-1 w-full rounded-lg border border-emerald-600/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100"
              >
                {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* プレーモード */}
            <div>
              <label className="text-xs text-emerald-400">プレーモード</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['bag', 'robot', 'measured'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-1.5 text-sm text-emerald-200">
                    <input
                      type="checkbox"
                      checked={filter.playModes?.includes(mode) ?? false}
                      onChange={(e) => handlePlayModeChange(mode, e.target.checked)}
                      className="rounded border-emerald-600 bg-emerald-950 text-emerald-500"
                    />
                    {PLAY_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </div>

            {/* お気に入りのみ */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-emerald-200">
                <input
                  type="checkbox"
                  checked={filter.favoritesOnly ?? false}
                  onChange={handleFavoritesToggle}
                  className="rounded border-emerald-600 bg-emerald-950 text-emerald-500"
                />
                お気に入りのみ
              </label>
            </div>
          </div>
        </section>

        {/* 統計ダッシュボード */}
        {stats && stats.totalRounds > 0 && (
          <section className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-emerald-50">統計サマリー</h2>
            <p className="mt-1 text-sm text-emerald-300">{stats.totalRounds} ラウンド</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="ベストスコア"
                value={stats.bestScore !== null && stats.bestScoreTotalPar !== null && !isNaN(stats.bestScore) && !isNaN(stats.bestScoreTotalPar) ? toParString(stats.bestScore, stats.bestScoreTotalPar) : (stats.bestScore?.toString() ?? '-')}
                subValue={stats.bestScore !== null ? stats.bestScore.toString() : undefined}
              />
              <StatCard
                label="ワーストスコア"
                value={stats.worstScore !== null && stats.worstScoreTotalPar !== null && !isNaN(stats.worstScore) && !isNaN(stats.worstScoreTotalPar) ? toParString(stats.worstScore, stats.worstScoreTotalPar) : (stats.worstScore?.toString() ?? '-')}
                subValue={stats.worstScore !== null ? stats.worstScore.toString() : undefined}
              />
              <StatCard
                label="平均スコア"
                value={stats.avgToPar !== null && stats.avgToPar !== undefined ? (stats.avgToPar > 0 ? `+${stats.avgToPar}` : stats.avgToPar.toString()) : (stats.avgScore?.toString() ?? '-')}
                subValue={stats.avgScore !== null ? stats.avgScore.toString() : undefined}
              />
              <StatCard
                label="GIR平均"
                value={stats.avgGirPercent !== null ? `${stats.avgGirPercent}%` : '-'}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StatCard
                label="フェアウェイキープ率"
                value={stats.avgFairwayHitPercent !== null ? `${stats.avgFairwayHitPercent}%` : '-'}
              />
              <StatCard
                label="平均パット数/ホール"
                value={stats.avgPuttsPerHole?.toFixed(2) ?? '-'}
              />
            </div>
          </section>
        )}

        {/* ラウンド一覧 */}
        <section className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-emerald-50">ラウンド一覧</h2>

          {rounds.length === 0 ? (
            <p className="mt-4 text-emerald-300">ラウンド履歴がありません。</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-700/50 text-emerald-300">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2">コース</th>
                    <th className="px-3 py-2">モード</th>
                    <th className="px-3 py-2 text-right">ストローク</th>
                    <th className="px-3 py-2 text-right">スコア</th>
                    <th className="px-3 py-2 text-center">お気に入り</th>
                    <th className="px-3 py-2 text-center">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => (
                    <tr
                      key={round.id}
                      className="border-b border-emerald-800/30 hover:bg-emerald-900/20"
                    >
                      <td className="px-3 py-3 text-emerald-100">{formatDate(round.completedAt)}</td>
                      <td className="px-3 py-3 text-emerald-100">
                        {round.courseName} ({round.courseHoleCount}H)
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-emerald-900/50 px-2 py-1 text-xs text-emerald-300">
                          {PLAY_MODE_LABELS[round.playMode]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-50">
                        {round.totalScore}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-300">
                        {toParString(round.totalScore, round.totalPar)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => round.id && handleToggleFavorite(round.id)}
                          className={`text-xl transition ${
                            round.isFavorite ? 'text-yellow-400' : 'text-emerald-700 hover:text-emerald-500'
                          }`}
                        >
                          {round.isFavorite ? '★' : '☆'}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => round.id && handleDelete(round.id)}
                          className="rounded-lg bg-rose-900/50 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-900/70"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* クラブ別成功率トレンド */}
        {clubTrends.length > 0 && (
          <section className="rounded-3xl border border-emerald-700/50 bg-emerald-950/60 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-emerald-50">クラブ別成功率推移</h2>
            <p className="mt-1 text-sm text-emerald-300">
              使用回数5回以上のクラブのみ表示
            </p>

            <div className="mt-4 space-y-4">
              {clubTrends.map((trend) => (
                <div
                  key={trend.clubId}
                  className="rounded-2xl border border-emerald-700/35 bg-emerald-900/25 p-4"
                >
                  <h3 className="font-bold text-emerald-100">{trend.clubName}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trend.data.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center rounded-lg bg-emerald-950/50 px-3 py-2"
                      >
                        <span className="text-xs text-emerald-400">
                          {point.roundDate.slice(5)}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            point.successRate >= 70
                              ? 'text-emerald-300'
                              : point.successRate >= 50
                              ? 'text-yellow-300'
                              : 'text-rose-300'
                          }`}
                        >
                          {point.successRate}%
                        </span>
                        <span className="text-xs text-emerald-500">
                          {point.timesUsed}回使用
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
