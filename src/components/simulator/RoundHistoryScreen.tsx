import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoundHistoryService, type RoundFilter, type AggregateStats, type ClubSuccessTrend } from '../../db/roundHistoryService';
import type { RoundHistory } from '../../db/database';

interface Props {
  bagId?: number | null;
  onBack?: () => void;
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
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-300/40">
      <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-900">{value}</p>
      {subValue && <p className="mt-1 text-sm text-emerald-600">{subValue}</p>}
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

export function RoundHistoryScreen({ bagId, onBack }: Props) {
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
      <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 flex items-center justify-center">
        <div className="text-emerald-900">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 via-emerald-100 to-lime-100 px-4 py-6 text-emerald-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
        {/* ヘッダー */}
        <header className="rounded-3xl border border-emerald-300 bg-emerald-50/90 px-5 py-6 shadow-sm shadow-emerald-300/40 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">Statistics</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl text-emerald-900">ラウンド履歴・統計</h1>
            </div>
            <div className="flex items-center gap-2">
              {onBack ? (
                <button
                  onClick={onBack}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  コースシミュレーターに戻る
                </button>
              ) : (
                <Link
                  to={`/simulator${bagQuery}`}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  コースシミュレーターに戻る
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* フィルターセクション */}
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 shadow-sm shadow-emerald-300/40">
          <h2 className="text-sm font-bold text-emerald-900">フィルター</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* コース選択 */}
            <div>
              <label className="text-xs text-emerald-700">コース</label>
              <select
                value={filter.courseName || ''}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
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
              <label className="text-xs text-emerald-700">期間</label>
              <select
                value={typeof filter.dateRange === 'string' ? filter.dateRange : 'all'}
                onChange={(e) => handleDateRangeChange(e.target.value as 'last10' | 'last30' | 'last50' | 'all')}
                className="mt-1 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
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
                  <label key={mode} className="flex items-center gap-1.5 text-sm text-emerald-900">
                    <input
                      type="checkbox"
                      checked={filter.playModes?.includes(mode) ?? false}
                      onChange={(e) => handlePlayModeChange(mode, e.target.checked)}
                      className="rounded border-emerald-400 bg-emerald-50 text-emerald-600"
                    />
                    {PLAY_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </div>

            {/* お気に入りのみ */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-emerald-900">
                <input
                  type="checkbox"
                  checked={filter.favoritesOnly ?? false}
                  onChange={handleFavoritesToggle}
                  className="rounded border-emerald-400 bg-emerald-50 text-emerald-600"
                />
                お気に入りのみ
              </label>
            </div>
          </div>
        </section>

        {/* 統計ダッシュボード */}
        {stats && stats.totalRounds > 0 && (
          <section className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 sm:p-6 shadow-sm shadow-emerald-300/40">
            <h2 className="text-xl font-bold text-emerald-900">統計サマリー</h2>
            <p className="mt-1 text-sm text-emerald-700">{stats.totalRounds} ラウンド</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="ベストスコア"
                value={stats.bestScore !== null && stats.bestScoreTotalPar !== null && !isNaN(stats.bestScore) && !isNaN(stats.bestScoreTotalPar) ? toParString(stats.bestScore, stats.bestScoreTotalPar) : (stats.bestScore?.toString() ?? '-')}
                subValue={stats.bestScore !== null && stats.bestScoreTotalPar !== null ? `ストローク${stats.bestScore}/パー${stats.bestScoreTotalPar}` : undefined}
              />
              <StatCard
                label="ワーストスコア"
                value={stats.worstScore !== null && stats.worstScoreTotalPar !== null && !isNaN(stats.worstScore) && !isNaN(stats.worstScoreTotalPar) ? toParString(stats.worstScore, stats.worstScoreTotalPar) : (stats.worstScore?.toString() ?? '-')}
                subValue={stats.worstScore !== null && stats.worstScoreTotalPar !== null ? `ストローク${stats.worstScore}/パー${stats.worstScoreTotalPar}` : undefined}
              />
              <StatCard
                label="平均スコア"
                value={stats.avgToPar !== null && stats.avgToPar !== undefined ? (stats.avgToPar > 0 ? `+${stats.avgToPar}` : stats.avgToPar.toString()) : (stats.avgScore?.toString() ?? '-')}
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

        {/* クラブ別成功率トレンド */}
        {clubTrends.length > 0 && (
          <section className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 sm:p-6 shadow-sm shadow-emerald-300/40">
            <h2 className="text-xl font-bold text-emerald-900">クラブ別成功率推移</h2>
            <p className="mt-1 text-sm text-emerald-700">
              使用回数3回以上のクラブのみ表示（パターを除く）
            </p>

            <div className="mt-4 space-y-4">
              {clubTrends.map((trend) => (
                <div
                  key={trend.clubId}
                  className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4"
                >
                  <h3 className="font-bold text-emerald-900">{trend.clubName}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trend.data.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center rounded-lg bg-emerald-100 px-3 py-2"
                      >
                        <span className="text-xs text-emerald-600">
                          {point.roundDate.slice(5)}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            point.successRate >= 70
                              ? 'text-emerald-700'
                              : point.successRate >= 50
                              ? 'text-yellow-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {point.successRate}%
                        </span>
                        <span className="text-xs text-emerald-600">
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

        {/* ラウンド一覧 */}
        <section className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 sm:p-6 shadow-sm shadow-emerald-300/40">
          <h2 className="text-xl font-bold text-emerald-900">ラウンド一覧</h2>

          {rounds.length === 0 ? (
            <p className="mt-4 text-emerald-700">ラウンド履歴がありません。</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-emerald-50/95">
                    <tr className="border-b border-emerald-300 text-emerald-700">
                      <th className="px-3 py-2">日付</th>
                      <th className="px-3 py-2">コース</th>
                      <th className="px-3 py-2">モード</th>
                      <th className="px-3 py-2 text-right">Par</th>
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
                        className="border-b border-emerald-200 hover:bg-emerald-100/50"
                      >
                        <td className="px-3 py-3 text-emerald-900">{formatDate(round.completedAt)}</td>
                        <td className="px-3 py-3 text-emerald-900">
                          {round.courseName} ({round.courseHoleCount}H)
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-emerald-200 px-2 py-1 text-xs text-emerald-800">
                            {PLAY_MODE_LABELS[round.playMode]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700">
                          {round.totalPar}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-900">
                          {round.totalScore}
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700">
                          {toParString(round.totalScore, round.totalPar)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => round.id && handleToggleFavorite(round.id)}
                            className={`text-xl transition ${
                              round.isFavorite ? 'text-yellow-500' : 'text-emerald-400 hover:text-emerald-600'
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
              <p className="mt-2 text-xs text-emerald-600 text-center">
                全{rounds.length}件を表示
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default RoundHistoryScreen;
