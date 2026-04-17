import { useMemo } from 'react';
import { useClubStore } from '../store/clubStore';
import type { SummaryData, Recommendation, Adjustment } from '../types/summary';
import type { GolfClub } from '../types/golf';
import { buildSwingLengthAnalysis, buildLoftLengthComparisonAnalysis } from '../utils/analysisBuilders';
import { readStoredNumber } from '../utils/storage';
import { evaluateSwingLengthSlope, getSwingLengthSlopeMessage } from '../utils/analysisUtils';
import { getClubTypeDisplay } from '../utils/clubUtils';

// Map internal club types to summary category types
const mapClubTypeToCategory = (clubType: GolfClub['clubType']): Recommendation['category'] | null => {
  switch (clubType) {
    case 'Driver':
      return 'Driver';
    case 'Wood':
      return 'Fairway';
    case 'Hybrid':
      return 'Hybrid';
    case 'Iron':
      return 'Iron';
    case 'Wedge':
      return 'Wedge';
    case 'Putter':
      return 'Putter';
    default:
      return null;
  }
};

// Expected distance benchmarks by category (yards) - for rule-based recommendations
const CATEGORY_DISTANCE_BENCHMARKS: Record<Recommendation['category'], number> = {
  Driver: 230,
  Fairway: 210,
  Hybrid: 180,
  Iron: 150, // 7-iron baseline
  Wedge: 100,
  Putter: 0,
};

// Sample club recommendations database (simplified)
type RecommendationBase = Omit<Recommendation, 'expectedDistanceGain' | 'category'>;
const SAMPLE_RECOMMENDATIONS: Partial<Record<Recommendation['category'], RecommendationBase[]>> = {
  Driver: [
    {
      clubName: 'Stealth 2 HD',
      brand: 'TaylorMade',
      reason: ['高MOI設計でミスヒット許容', '軽量シャフトでヘッドスピード向上', 'ドロー志向の重心設計'],
      priceRange: '¥65,000〜¥85,000',
    },
    {
      clubName: 'G430 Max 10K',
      brand: 'PING',
      reason: ['業界最高MOI値', '極限の直進性', '弾道安定性の向上'],
      priceRange: '¥75,000〜¥95,000',
    },
  ],
  Fairway: [
    {
      clubName: 'STEALTH 2 FW',
      brand: 'TaylorMade',
      reason: ['深重心で高弾道', 'やさしいミスヒット性能', 'バランスの取れた設計'],
      priceRange: '¥45,000〜¥60,000',
    },
  ],
  Hybrid: [
    {
      clubName: 'APEX UW',
      brand: 'Callaway',
      reason: ['ユーティリティとウッドの中間', '高い弾道でグリーンを狙える', '多用途な使用シーン'],
      priceRange: '¥38,000〜¥48,000',
    },
  ],
  Iron: [
    {
      clubName: 'T350',
      brand: 'Titleist',
      reason: ['中空構造で距離と許容性を両立', 'タイトリストらしい打感', 'セット全体の距離ギャップ最適化'],
      priceRange: '¥120,000〜¥150,000（6本）',
    },
  ],
  Wedge: [
    {
      clubName: 'RTX 6 ZipCore',
      brand: 'Cleveland',
      reason: ['高いスピン性能', '様々なライに対応', 'バンカー脱出力の向上'],
      priceRange: '¥22,000〜¥28,000',
    },
  ],
  Putter: [
    {
      clubName: 'Phantom X 5.5',
      brand: 'Scotty Cameron',
      reason: ['小ぶりなマレット型', '視認性の高いアライメント', '距離コントロール性能'],
      priceRange: '¥55,000〜¥65,000',
    },
  ],
};

interface UseSummaryOptions {
  bagId?: number | null;
}

export function useSummary(options: UseSummaryOptions = {}): SummaryData {
  const { bagId } = options;

  // Get clubs from store
  const clubs = useClubStore((state) => state.clubs);
  const bags = useClubStore((state) => state.bags);
  const activeBagId = useClubStore((state) => state.activeBagId);

  const targetBagId = bagId ?? activeBagId;

  return useMemo(() => {
    // Get clubs in the target bag
    const targetBag = bags.find((bag) => bag.id === targetBagId);
    const bagClubIds = targetBag?.clubIds ?? [];
    const bagClubs = bagClubIds.length > 0
      ? clubs.filter((club) => club.id !== undefined && bagClubIds.includes(club.id))
      : clubs; // Fallback to all clubs if no bag specified

    // Calculate basic metrics
    const clubCount = bagClubs.length;

    // Driver distances
    const drivers = bagClubs.filter((c) => c.clubType === 'Driver');
    const avgDriverDistance = drivers.length > 0
      ? Math.round(drivers.reduce((sum, c) => sum + (c.distance || 0), 0) / drivers.length)
      : 0;

    // 7-iron distances (includes '7' number irons and similar loft irons)
    const sevenIrons = bagClubs.filter((c) =>
      c.clubType === 'Iron' && (c.number === '7' || (c.loftAngle >= 30 && c.loftAngle <= 35))
    );
    const avg7IronDistance = sevenIrons.length > 0
      ? Math.round(sevenIrons.reduce((sum, c) => sum + (c.distance || 0), 0) / sevenIrons.length)
      : 0;

    // Calculate average distance by category for gap analysis
    const categoryDistances: Partial<Record<Recommendation['category'], number[]>> = {};
    bagClubs.forEach((club) => {
      const category = mapClubTypeToCategory(club.clubType);
      if (category && club.distance) {
        if (!categoryDistances[category]) {
          categoryDistances[category] = [];
        }
        categoryDistances[category]!.push(club.distance);
      }
    });

    const categoryAverages: Partial<Record<Recommendation['category'], number>> = {};
    (Object.keys(categoryDistances) as Recommendation['category'][]).forEach((cat) => {
      const distances = categoryDistances[cat];
      if (distances && distances.length > 0) {
        categoryAverages[cat] = distances.reduce((a, b) => a + b, 0) / distances.length;
      }
    });

    // Calculate potential gain based on gaps from benchmarks
    let potentialGain = 0;
    (Object.keys(CATEGORY_DISTANCE_BENCHMARKS) as Recommendation['category'][]).forEach((cat) => {
      if (cat === 'Putter') return;
      const avg = categoryAverages[cat];
      const benchmark = CATEGORY_DISTANCE_BENCHMARKS[cat];
      if (avg && avg < benchmark) {
        potentialGain += Math.round((benchmark - avg) * 0.3); // 30% of gap is recoverable
      }
    });

    // Generate recommendations for categories with lower than benchmark distances
    const recommendations: Recommendation[] = [];
    (Object.keys(CATEGORY_DISTANCE_BENCHMARKS) as Recommendation['category'][]).forEach((cat) => {
      if (cat === 'Putter') return;

      const avg = categoryAverages[cat];
      const benchmark = CATEGORY_DISTANCE_BENCHMARKS[cat];
      const sampleRecs = SAMPLE_RECOMMENDATIONS[cat];

      // Recommend if average is 15+ yards below benchmark or no clubs in category
      const hasGap = !avg || (avg < benchmark - 15);
      const hasNoClubs = !categoryDistances[cat] || categoryDistances[cat]!.length === 0;

      if ((hasGap || hasNoClubs) && sampleRecs && sampleRecs.length > 0) {
        const sample = sampleRecs[0];
        const distanceGap = avg ? Math.round(benchmark - avg) : 20;

        recommendations.push({
          category: cat,
          clubName: sample.clubName,
          brand: sample.brand,
          reason: sample.reason.slice(0, 3),
          expectedDistanceGain: Math.max(5, Math.min(distanceGap, 25)), // Cap between 5-25 yards
          priceRange: sample.priceRange,
        });
      }
    });

    // Limit to top 3 recommendations, prioritize by distance gap
    recommendations.sort((a, b) => b.expectedDistanceGain - a.expectedDistanceGain);
    const limitedRecommendations = recommendations.slice(0, 3);

    // Generate adjustments based on club specs
    const adjustments: Adjustment[] = [];

    // Swing weight and length analysis using buildSwingLengthAnalysis
    const swingGoodTolerance = readStoredNumber('golfbag-swing-good-tolerance', 1.0, { decimals: 1 });
    const swingAdjustThreshold = readStoredNumber('golfbag-swing-adjust-threshold', 1.5, { decimals: 1 });
    const { tableClubs: swingLengthTable, regression } = buildSwingLengthAnalysis(
      bagClubs,
      () => true,
      swingGoodTolerance,
      swingAdjustThreshold,
    );

    // Check for clubs that deviate significantly from the swing weight trend
    const swingOutliers = swingLengthTable.filter(
      (club) => club.trendStatus === '調整推奨'
    );

    if (swingOutliers.length > 0) {
      const outlierNames = swingOutliers
        .map((c) => getClubTypeDisplay(c.clubType, c.number || ''))
        .slice(0, 3)
        .join(', ');
      const additionalCount = swingOutliers.length > 3 ? `他${swingOutliers.length - 3}本` : '';

      adjustments.push({
        priority: 'high',
        title: 'スイングウェイトのトレンド調整',
        description: `長さに対するSWのトレンドから大きく外れるクラブがあります（${outlierNames}${additionalCount ? ' ' + additionalCount : ''}）。他のクラブのトレンドに合わせてSW調整を検討してください。`,
        estimatedEffect: 'スイングフィールの統一、方向性向上',
        estimatedCost: '¥8,000〜¥15,000/本',
      });
    }

    // Evaluate the slope of the swing weight vs length regression
    const slopeEvaluation = evaluateSwingLengthSlope(regression.slope);
    if (slopeEvaluation !== 'ideal') {
      const slopeMessage = getSwingLengthSlopeMessage(regression.slope);
      adjustments.push({
        priority: 'medium',
        title: 'SW-長さの傾斜最適化',
        description: `現在のSW-長さの傾斜は「${slopeMessage}」です。理想的な傾斜（-0.8〜-1.2）に近づけることで、長いクラブと短いクラブの間で一貫したスイングフィールが得られます。`,
        estimatedEffect: '長短クラブのフィール適正化',
        estimatedCost: '¥5,000〜¥10,000/本',
      });
    }

    // Check for swing weight inconsistencies (fallback if no length data)
    const swingWeights = bagClubs
      .map((c) => c.swingWeight)
      .filter((sw): sw is string => !!sw && sw.length > 0);
    const uniqueSwingWeights = [...new Set(swingWeights)];

    if (uniqueSwingWeights.length > 3 && swingOutliers.length === 0) {
      adjustments.push({
        priority: 'low',
        title: 'スイングウェイトの確認',
        description: `現在${uniqueSwingWeights.length}種類のスイングウェイト（${uniqueSwingWeights.slice(0, 3).join(', ')}${uniqueSwingWeights.length > 3 ? '...' : ''}）が混在しています。スイングフィールに違和感がないか確認してみてください。`,
        estimatedEffect: 'フィールの確認',
        estimatedCost: '¥8,000〜¥15,000/本',
      });
    }

    // Check for lie angle spread (especially in irons)
    const irons = bagClubs.filter((c) => c.clubType === 'Iron');
    if (irons.length >= 4) {
      const lieAngles = irons.map((c) => c.lieAngle).filter((l) => l > 0);
      if (lieAngles.length >= 4) {
        const minLie = Math.min(...lieAngles);
        const maxLie = Math.max(...lieAngles);
        const lieSpread = maxLie - minLie;

        if (lieSpread > 6) {
          adjustments.push({
            priority: 'high',
            title: 'アイアンのライ角最適化',
            description: `アイアンのライ角バラつきが${lieSpread.toFixed(1)}°あります。セット全体で一貫性のあるライ角に調整することで、方向性が向上します。`,
            estimatedEffect: '方向精度 +20% 見込み',
            estimatedCost: '¥3,000〜¥5,000/本',
          });
        }
      }
    }

    // Check for gaps in distance coverage using loft-based projected gaps
    const { tableClubs: loftLengthTable } = buildLoftLengthComparisonAnalysis(
      bagClubs,
      () => true,
    );

    // Find clubs with large projected distance gaps (same threshold as loft-distance analysis: > 18yd)
    const largeGapClubs = loftLengthTable
      .filter((club) => club.projectedDistanceGap !== null && club.projectedDistanceGap > 18)
      .sort((a, b) => (b.projectedDistanceGap || 0) - (a.projectedDistanceGap || 0));

    // Add adjustments for all large gaps (up to 2)
    largeGapClubs.slice(0, 2).forEach((club) => {
      const gap = club.projectedDistanceGap;
      const clubName = getClubTypeDisplay(club.clubType, club.number || '');
      const targetClub = club.projectedGapTargetClubType && club.projectedGapTargetNumber
        ? getClubTypeDisplay(club.projectedGapTargetClubType, club.projectedGapTargetNumber)
        : '';

      adjustments.push({
        priority: 'high',
        title: `距離ギャップ解消（${clubName}と${targetClub}の間）`,
        description: `ロフト差に基づく予測距離ギャップが${gap}ydあります。中間的なクラブを検討してください。`,
        estimatedEffect: `アプローチ成功率 +25% 見込み`,
      });
    });

    // Loft/spin optimization for wedges
    const wedges = bagClubs.filter((c) => c.clubType === 'Wedge');
    if (wedges.length >= 2) {
      const lofts = wedges.map((c) => c.loftAngle).filter((l) => l > 0).sort((a, b) => a - b);
      if (lofts.length >= 2) {
        const loftGaps: number[] = [];
        for (let i = 0; i < lofts.length - 1; i++) {
          loftGaps.push(lofts[i + 1] - lofts[i]);
        }
        const maxGap = Math.max(...loftGaps);
        if (maxGap > 8) {
          adjustments.push({
            priority: 'medium',
            title: 'ウェッジのロフト間隔最適化',
            description: `ウェッジ間の最大ロフト差が${Math.round(maxGap)}°あります。4-6°間隔が理想的です。`,
            estimatedEffect: '100yd以内の精度向上',
            estimatedCost: '¥20,000〜¥30,000',
          });
        }
      }
    }

    // Length consistency check
    const woodLengths = bagClubs
      .filter((c) => c.clubType === 'Driver' || c.clubType === 'Wood')
      .map((c) => c.length)
      .filter((l) => l > 0);

    if (woodLengths.length >= 2) {
      const lengths = [...woodLengths].sort((a, b) => b - a);
      for (let i = 0; i < lengths.length - 1; i++) {
        const lengthGap = lengths[i] - lengths[i + 1];
        if (lengthGap < 0.5) {
          adjustments.push({
            priority: 'low',
            title: 'フェアウェイウッドの長さ間隔',
            description: 'ウッド間の長さ差が0.5インチ未満の組み合わせがあります。距離差が出にくい場合は長さ調整を検討してください。',
            estimatedEffect: '距離ギャップ適正化',
            estimatedCost: '¥5,000〜¥8,000',
          });
          break;
        }
      }
    }

    // Sort adjustments by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    adjustments.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      currentSet: {
        clubCount,
        avgDriverDistance,
        avg7IronDistance,
        potentialGain,
      },
      recommendations: limitedRecommendations,
      adjustments,
    };
  }, [clubs, bags, targetBagId]);
}
