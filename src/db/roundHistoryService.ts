import { db, type RoundHistory } from './database';
import type { ClubUsageStat } from '../types/game';

const MAX_ROUNDS = 50;

export interface RoundFilter {
  courseName?: string;
  playModes?: ('bag' | 'robot' | 'measured')[];
  dateRange?: { start: Date; end: Date } | 'last10' | 'last30' | 'last50' | 'all';
  favoritesOnly?: boolean;
}

export interface AggregateStats {
  bestScore: number | null;
  bestScoreTotalPar: number | null;
  worstScore: number | null;
  worstScoreTotalPar: number | null;
  avgScore: number | null;
  avgToPar: number | null;
  avgGirPercent: number | null;
  avgFairwayHitPercent: number | null;
  avgPuttsPerHole: number | null;
  totalRounds: number;
}

export interface ClubSuccessTrend {
  clubId: string;
  clubName: string;
  data: Array<{
    roundDate: string;
    successRate: number;
    timesUsed: number;
  }>;
}

export const RoundHistoryService = {
  async saveRound(data: Omit<RoundHistory, 'id' | 'completedAt'>): Promise<number> {
    const record: RoundHistory = {
      ...data,
      completedAt: new Date().toISOString(),
    };

    const id = await db.roundHistory.add(record);

    // 最新50ラウンド以外を削除（お気に入りは除外）
    await this.cleanupOldRounds();

    return id as number;
  },

  async getAllRounds(): Promise<RoundHistory[]> {
    return db.roundHistory.orderBy('completedAt').reverse().toArray();
  },

  async getRoundsWithFilters(filter: RoundFilter): Promise<RoundHistory[]> {
    let collection = db.roundHistory.orderBy('completedAt').reverse();

    // プレーモードフィルター
    if (filter.playModes && filter.playModes.length > 0) {
      collection = collection.filter((round) => filter.playModes!.includes(round.playMode));
    }

    // お気に入りのみ
    if (filter.favoritesOnly) {
      collection = collection.filter((round) => round.isFavorite);
    }

    // コース名フィルター
    if (filter.courseName) {
      collection = collection.filter((round) => round.courseName === filter.courseName);
    }

    const rounds = await collection.toArray();

    // 期間フィルター
    if (filter.dateRange && filter.dateRange !== 'all') {
      if (typeof filter.dateRange === 'object') {
        const { start, end } = filter.dateRange;
        return rounds.filter((round) => {
          const date = new Date(round.completedAt);
          return date >= start && date <= end;
        });
      } else {
        const limit = filter.dateRange === 'last10' ? 10 : filter.dateRange === 'last30' ? 30 : 50;
        return rounds.slice(0, limit);
      }
    }

    return rounds;
  },

  async toggleFavorite(id: number): Promise<boolean> {
    const round = await db.roundHistory.get(id);
    if (!round) return false;

    await db.roundHistory.update(id, { isFavorite: !round.isFavorite });
    return !round.isFavorite;
  },

  async deleteRound(id: number): Promise<void> {
    await db.roundHistory.delete(id);
  },

  async getAggregateStats(rounds?: RoundHistory[]): Promise<AggregateStats> {
    const targetRounds = rounds ?? (await this.getAllRounds());

    if (targetRounds.length === 0) {
      return {
        bestScore: null,
        bestScoreTotalPar: null,
        worstScore: null,
        worstScoreTotalPar: null,
        avgScore: null,
        avgToPar: null,
        avgGirPercent: null,
        avgFairwayHitPercent: null,
        avgPuttsPerHole: null,
        totalRounds: 0,
      };
    }

    const scores = targetRounds.map((r) => r.totalScore);
    const bestScore = Math.min(...scores);
    const worstScore = Math.max(...scores);
    const bestRound = targetRounds.find((r) => r.totalScore === bestScore);
    const worstRound = targetRounds.find((r) => r.totalScore === worstScore);
    
    // デバッグログ
    console.log('getAggregateStats:', { bestScore, worstScore, bestRound, worstRound, targetRounds });
    
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const toPars = targetRounds.map((r) => r.totalScore - r.totalPar);
    const avgToPar = Number((toPars.reduce((a, b) => a + b, 0) / toPars.length).toFixed(1));

    const avgGirPercent = Math.round(
      targetRounds.reduce((sum, r) => sum + r.keyStats.girPercent, 0) / targetRounds.length
    );

    const avgFairwayHitPercent = Math.round(
      targetRounds.reduce((sum, r) => sum + r.keyStats.fairwayHitPercent, 0) / targetRounds.length
    );

    const avgPuttsPerHole = Number(
      (targetRounds.reduce((sum, r) => sum + r.keyStats.puttsPerHole, 0) / targetRounds.length).toFixed(2)
    );

    const result = {
      bestScore,
      bestScoreTotalPar: bestRound?.totalPar ?? null,
      worstScore,
      worstScoreTotalPar: worstRound?.totalPar ?? null,
      avgScore,
      avgToPar,
      avgGirPercent,
      avgFairwayHitPercent,
      avgPuttsPerHole,
      totalRounds: targetRounds.length,
    };
    
    console.log('getAggregateStats returning:', result);
    
    return result;
  },

  async getClubSuccessTrends(rounds?: RoundHistory[]): Promise<ClubSuccessTrend[]> {
    const targetRounds = rounds ?? (await this.getAllRounds());

    // クラブごとのデータを集計
    const clubDataMap = new Map<string, Map<string, { successRate: number; timesUsed: number }>>();
    const clubNameMap = new Map<string, string>();

    for (const round of targetRounds) {
      const roundDate = round.completedAt.split('T')[0]; // YYYY-MM-DD

      for (const stat of round.clubUsageStats) {
        if (stat.timesUsed < 5) continue; // 使用回数5回以上のクラブのみ

        clubNameMap.set(stat.clubId, stat.clubName);

        if (!clubDataMap.has(stat.clubId)) {
          clubDataMap.set(stat.clubId, new Map());
        }

        const dateMap = clubDataMap.get(stat.clubId)!;
        dateMap.set(roundDate, {
          successRate: stat.successRate,
          timesUsed: stat.timesUsed,
        });
      }
    }

    // トレンドデータを構築
    const trends: ClubSuccessTrend[] = [];
    for (const [clubId, dateMap] of clubDataMap) {
      const data = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([roundDate, stats]) => ({
          roundDate,
          successRate: stats.successRate,
          timesUsed: stats.timesUsed,
        }));

      if (data.length >= 2) {
        trends.push({
          clubId,
          clubName: clubNameMap.get(clubId) || clubId,
          data,
        });
      }
    }

    return trends.sort((a, b) => a.clubName.localeCompare(b.clubName));
  },

  async cleanupOldRounds(): Promise<void> {
    // お気に入り以外のラウンドを取得
    const nonFavoriteRounds = await db.roundHistory
      .where('isFavorite')
      .equals(0)
      .sortBy('completedAt');

    if (nonFavoriteRounds.length > MAX_ROUNDS) {
      const toDelete = nonFavoriteRounds.slice(0, nonFavoriteRounds.length - MAX_ROUNDS);
      const idsToDelete = toDelete.map((r) => r.id).filter((id): id is number => id !== undefined);

      if (idsToDelete.length > 0) {
        await db.roundHistory.bulkDelete(idsToDelete);
      }
    }
  },

  async getCourseNames(): Promise<string[]> {
    const rounds = await db.roundHistory.toArray();
    const names = new Set(rounds.map((r) => r.courseName));
    return Array.from(names).sort();
  },
};
