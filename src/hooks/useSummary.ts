import { useMemo } from 'react';
import { useClubStore } from '../store/clubStore';
import type { SummaryData, Recommendation, Adjustment, ProposedSpec } from '../types/summary';
import type { GolfClub } from '../types/golf';
import { buildSwingLengthAnalysis } from '../utils/analysisBuilders';
import { readStoredNumber } from '../utils/storage';
import { computeGapsAndRecommendations, evaluateSwingLengthSlope, getSwingLengthSlopeMessage, swingWeightToNumeric, estimateHeadSpeedFromClubs, checkFlexCompatibility, getEstimatedDistance, getClubCategory } from '../utils/analysisUtils';
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

// Distance gap ideal ranges (from analysisConstants)
const GAP_RANGES = {
  driverToWood: { ideal: { min: 20, max: 30 }, tooWide: 50, tooNarrow: 15 },
  woodToHybrid: { ideal: { min: 15, max: 25 }, tooWide: 35, tooNarrow: 10 },
  hybridToIron: { ideal: { min: 10, max: 20 }, tooWide: 30, tooNarrow: 8 },
  ironToIron: { ideal: { min: 10, max: 15 }, tooWide: 25, tooNarrow: 8 },
  ironToWedge: { ideal: { min: 10, max: 20 }, tooWide: 30, tooNarrow: 8 },
  wedgeToWedge: { ideal: { min: 4, max: 6 }, tooWide: 12, tooNarrow: 3 },
};

// Gap analysis result type
interface GapAnalysis {
  currentClub: GolfClub;
  nextClub: GolfClub;
  gap: number;
  isTooWide: boolean;
  isTooNarrow: boolean;
  categoryTransition: string;
  idealMin: number;
  idealMax: number;
}

interface UseSummaryOptions {
  bagId?: number | null;
}

// Generate club name from category and proposed spec
const generateClubNameFromSpec = (
  category: Recommendation['category'],
  spec: ProposedSpec
): string => {
  const categoryLabel: Record<Recommendation['category'], string> = {
    Driver: 'ドライバー',
    Fairway: 'フェアウェイウッド',
    Hybrid: 'ハイブリッド',
    Iron: 'アイアン',
    Wedge: 'ウェッジ',
    Putter: 'パター',
  };
  
  const specParts: string[] = [];
  if (spec.loftAngle && spec.loftAngle > 0) specParts.push(`ロフト${spec.loftAngle.toFixed(1)}°`);
  if (spec.length && spec.length > 0) specParts.push(`長さ${spec.length.toFixed(1)}in`);
  if (spec.swingWeight && spec.swingWeight.length > 0) specParts.push(`SW ${spec.swingWeight}`);
  if (spec.lieAngle && spec.lieAngle > 0) specParts.push(`ライ${spec.lieAngle.toFixed(1)}°`);
  
  const baseName = categoryLabel[category];
  const specInfo = specParts.length > 0 ? `（${specParts.join('、')}）` : '';
  
  return `${baseName}${specInfo}`;
};

// Calculate category from loft and distance range
const inferCategoryFromLoftAndDistance = (
  loftAngle: number,
  distance: number
): Recommendation['category'] => {
  if (distance >= 220) return 'Driver';
  if (distance >= 180) return 'Fairway';
  if (distance >= 150) return 'Hybrid';
  if (loftAngle >= 40) return 'Wedge';
  return 'Iron';
};

// Estimate loft angle from distance (inverse of getEstimatedDistance)
const estimateLoftFromDistance = (
  distance: number,
  category: Recommendation['category'],
  headSpeed: number
): number => {
  // Simplified estimation based on category and head speed
  const speedFactor = headSpeed / 44.5; // Adjust based on head speed relative to standard
  
  switch (category) {
    case 'Driver': 
      // 距離ベースの計算: 9°≈250yd, 12°≈200yd として線形補間
      const baseLoftDriver = 9 + (250 - distance) * 0.06; // (12-9)/(250-200) = 0.06°/yd
      const speedAdjustmentDriver = Math.max(0, (1 - speedFactor) * 0.5);
      return Math.max(9, Math.min(12, baseLoftDriver + speedAdjustmentDriver));
    case 'Fairway': 
      // 距離ベースの計算: 13°≈230yd, 18°≈180yd として線形補間
      const baseLoftFairway = 13 + (230 - distance) * 0.1; // (18-13)/(230-180) = 0.1°/yd
      const speedAdjustmentFairway = Math.max(0, (1 - speedFactor) * 1);
      return Math.max(13, Math.min(18, baseLoftFairway + speedAdjustmentFairway));
    case 'Hybrid': 
      // 距離ベースの計算: 17°≈170yd, 24°≈130yd として線形補間
      // 距離が短いほどロフトが大きくなる
      const baseLoftHybrid = 17 + (170 - distance) * 0.175; // (24-17)/(170-130) = 0.175°/yd
      const speedAdjustmentHybrid = Math.max(0, (1 - speedFactor) * 1.5);
      return Math.max(17, Math.min(26, baseLoftHybrid + speedAdjustmentHybrid));
    case 'Iron': 
      // 距離ベースの計算: 5Iron(27°)≈160yd, PW(44°)≈85yd として線形補間
      // 距離が短いほどロフトが大きくなる
      const baseLoftIron = 27 + (160 - distance) * 0.178; // (44-27)/(160-85) = 0.227°/yd、より緩やかに設定
      const speedAdjustmentIron = Math.max(0, (1 - speedFactor) * 1);
      return Math.max(20, Math.min(48, baseLoftIron + speedAdjustmentIron));
    case 'Wedge': 
      // 実測データに基づく補正: PW(44°)=84.8yd, 56°=57.3yd
      // 距離が短いほどロフトが大きくなる線形補間
      // 傾き: (56-44)/(57.3-84.8) = -0.44°/yd
      const baseLoft = 44 + (84.8 - distance) * 0.44;
      // ヘッドスピード補正: 標準より遅い場合は最大1°多めのロフトを提案
      const speedAdjustment = Math.max(0, (1 - speedFactor) * 1);
      return Math.max(44, Math.min(60, baseLoft + speedAdjustment));
    case 'Putter': return 3;
  }
};

// Get regression-based ideal swing weight for a given length
const getIdealSwingWeightFromRegression = (
  length: number,
  clubs: GolfClub[]
): string | null => {
  const validClubs = clubs.filter(
    (c) => c.length > 0 && c.swingWeight && swingWeightToNumeric(c.swingWeight) !== 0
  );
  
  if (validClubs.length < 2) return null;
  
  // Calculate linear regression
  const meanLength = validClubs.reduce((sum, c) => sum + c.length, 0) / validClubs.length;
  const meanSW = validClubs.reduce((sum, c) => sum + swingWeightToNumeric(c.swingWeight), 0) / validClubs.length;
  
  let numerator = 0;
  let denominator = 0;
  for (const club of validClubs) {
    const dx = club.length - meanLength;
    const sw = swingWeightToNumeric(club.swingWeight);
    numerator += dx * (sw - meanSW);
    denominator += dx * dx;
  }
  
  if (Math.abs(denominator) < 0.0001) return null;
  
  const slope = numerator / denominator;
  const intercept = meanSW - slope * meanLength;
  const idealSW = slope * length + intercept;
  
  // Convert numeric to label (e.g., 35 -> D5, 35.5 -> D5.5, 40 -> E0)
  // swingWeightToNumeric returns: letterIndex * 10 + point
  // So we need to reverse this: 35 -> letterIndex=3 (D), point=5
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const letterIndex = Math.floor(idealSW / 10);
  const letter = letters[letterIndex] || 'C';
  const point = idealSW - letterIndex * 10;
  const modifier = letter + point.toFixed(1);
  
  return modifier;
};

// Get ideal lie angle for irons based on length
const getIdealLieAngleForIron = (
  length: number,
  irons: GolfClub[]
): number => {
  if (irons.length === 0) return 61; // Default for irons
  
  const ironsWithLie = irons.filter((c) => c.lieAngle > 0 && c.length > 0);
  if (ironsWithLie.length === 0) return 61;
  
  // Simple linear regression for lie angle vs length
  const meanLength = ironsWithLie.reduce((sum, c) => sum + c.length, 0) / ironsWithLie.length;
  const meanLie = ironsWithLie.reduce((sum, c) => sum + c.lieAngle, 0) / ironsWithLie.length;
  
  let numerator = 0;
  let denominator = 0;
  for (const club of ironsWithLie) {
    const dx = club.length - meanLength;
    numerator += dx * (club.lieAngle - meanLie);
    denominator += dx * dx;
  }
  
  const slope = Math.abs(denominator) < 0.0001 ? -1.4 : numerator / denominator;
  const intercept = meanLie - slope * meanLength;
  
  return slope * length + intercept;
};

// Analyze gaps and return detailed gap info
const analyzeDistanceGaps = (
  clubs: GolfClub[],
  headSpeed: number | null
): GapAnalysis[] => {
  const estimatedHeadSpeed = headSpeed ?? 44.5;
  
  // Get effective distance for each club
  const clubsWithDistance = clubs
    .filter((c) => c.clubType !== 'Putter')
    .map((c) => ({
      club: c,
      distance: c.distance > 0 ? c.distance : getEstimatedDistance(c, estimatedHeadSpeed),
    }))
    .filter((c) => c.distance > 0);
  
  if (clubsWithDistance.length < 2) return [];
  
  // Sort by distance descending
  const sorted = [...clubsWithDistance].sort((a, b) => b.distance - a.distance);
  const gaps: GapAnalysis[] = [];
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = current.distance - next.distance;
    
    const currentCategory = getClubCategory(current.club);
    const nextCategory = getClubCategory(next.club);
    
    // Determine which gap range applies
    let range = GAP_RANGES.ironToIron;
    let transition = 'iron-iron';
    
    if (currentCategory === 'driver' && nextCategory === 'wood') {
      range = GAP_RANGES.driverToWood;
      transition = 'driver-wood';
    } else if (currentCategory === 'wood' && nextCategory === 'hybrid') {
      range = GAP_RANGES.woodToHybrid;
      transition = 'wood-hybrid';
    } else if (currentCategory === 'hybrid' && nextCategory === 'iron') {
      range = GAP_RANGES.hybridToIron;
      transition = 'hybrid-iron';
    } else if (currentCategory === 'iron' && nextCategory === 'iron') {
      range = GAP_RANGES.ironToIron;
      transition = 'iron-iron';
    } else if (currentCategory === 'iron' && nextCategory === 'wedge') {
      range = GAP_RANGES.ironToWedge;
      transition = 'iron-wedge';
    } else if (currentCategory === 'wedge' && nextCategory === 'wedge') {
      range = GAP_RANGES.wedgeToWedge;
      transition = 'wedge-wedge';
    }
    
    gaps.push({
      currentClub: current.club,
      nextClub: next.club,
      gap,
      isTooWide: gap > range.tooWide || gap > range.ideal.max * 1.5,
      isTooNarrow: gap < range.tooNarrow || gap < range.ideal.min * 0.7,
      categoryTransition: transition,
      idealMin: range.ideal.min,
      idealMax: range.ideal.max,
    });
  }
  
  return gaps;
};

// Generate recommendations for narrow gaps (replace clubs)
const generateNarrowGapRecommendations = (
  clubs: GolfClub[],
  headSpeed: number | null,
  maxRecommendations: number = 3
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const estimatedHeadSpeed = headSpeed ?? 44.5;

  // Analyze gaps
  const gaps = analyzeDistanceGaps(clubs, estimatedHeadSpeed);

  // Find gaps that are too narrow
  const narrowGaps = gaps.filter((g) => g.isTooNarrow).sort((a, b) => a.gap - b.gap);

  // Handle narrow gaps (replace clubs)
  for (const gap of narrowGaps.slice(0, maxRecommendations)) {
    if (recommendations.length >= maxRecommendations) break;

    // Determine which club to replace (the one with less useful distance)
    const clubToReplace = gap.currentClub.distance > gap.nextClub.distance * 1.3
      ? gap.nextClub
      : gap.currentClub;

    // Find the clubs before and after the club to replace (excluding the club being replaced)
    const allSortedClubs = clubs
      .filter(c => c.distance > 0)
      .sort((a, b) => b.distance - a.distance);

    const replaceIndex = allSortedClubs.findIndex(c =>
      c.clubType === clubToReplace.clubType && c.number === clubToReplace.number
    );

    let prevClub: GolfClub | undefined;
    let nextClub: GolfClub | undefined;

    if (replaceIndex > 0) {
      prevClub = allSortedClubs[replaceIndex - 1];
    }
    if (replaceIndex < allSortedClubs.length - 1) {
      nextClub = allSortedClubs[replaceIndex + 1];
    }

    // Calculate ideal distance as midpoint between previous and next clubs
    let idealDistance: number;
    if (prevClub && nextClub) {
      idealDistance = (prevClub.distance + nextClub.distance) / 2;
    } else if (prevClub) {
      idealDistance = prevClub.distance - gap.idealMin;
    } else if (nextClub) {
      idealDistance = nextClub.distance + gap.idealMax;
    } else {
      // Fallback: use original logic
      idealDistance = getEstimatedDistance(clubToReplace, estimatedHeadSpeed);
    }

    const category = mapClubTypeToCategory(clubToReplace.clubType) || 'Iron';
    const estimatedLoft = estimateLoftFromDistance(idealDistance, category, estimatedHeadSpeed);
    const estimatedLength = category === 'Iron'
      ? 38.5 - (estimatedLoft - 30) * 0.1
      : category === 'Wedge'
        ? 35 - (estimatedLoft - 48) * 0.05
        : 45 - (estimatedLoft - 10) * 0.2;

    const idealSW = getIdealSwingWeightFromRegression(estimatedLength, clubs);
    const idealLie = category === 'Iron'
      ? getIdealLieAngleForIron(estimatedLength, clubs.filter((c) => c.clubType === 'Iron'))
      : undefined;

    const spec: ProposedSpec = {
      loftAngle: estimatedLoft,
      length: estimatedLength,
      swingWeight: idealSW ?? undefined,
      lieAngle: idealLie,
    };

    const clubName = generateClubNameFromSpec(category, spec);

    recommendations.push({
      category,
      clubName,
      reason: [
        `${getClubTypeDisplay(gap.currentClub.clubType, gap.currentClub.number || '')}と${getClubTypeDisplay(gap.nextClub.clubType, gap.nextClub.number || '')}の距離差が${gap.gap.toFixed(1)}ydと狭く、距離が被っています`,
        `より適切な${Math.round(idealDistance)}ydのクラブに入れ替えます`,
        `ギャップを${gap.idealMin}-${gap.idealMax}ydに最適化します`,
      ],
      expectedDistanceGain: Math.round((gap.idealMax - gap.gap) * 0.5),
      actionType: 'replace',
      replaceTarget: getClubTypeDisplay(clubToReplace.clubType, clubToReplace.number || ''),
      proposedSpec: spec,
    });
  }

  return recommendations;
};

// Generate recommendations for less than 14 clubs
const generateRecommendationsForLessThan14Clubs = (
  clubs: GolfClub[],
  headSpeed: number | null
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const estimatedHeadSpeed = headSpeed ?? 44.5;

  // Analyze gaps
  const gaps = analyzeDistanceGaps(clubs, estimatedHeadSpeed);

  // Find gaps that are too wide (priority) - narrow gaps are handled separately for >=14 clubs
  const wideGaps = gaps.filter((g) => g.isTooWide).sort((a, b) => b.gap - a.gap);

  // Handle wide gaps (add clubs)
  for (const gap of wideGaps.slice(0, 3)) {
    const idealMidDistance = gap.currentClub.distance > 0
      ? (gap.currentClub.distance + gap.nextClub.distance) / 2
      : getEstimatedDistance(gap.currentClub, estimatedHeadSpeed) - gap.gap / 2;

    const category = inferCategoryFromLoftAndDistance(
      (gap.currentClub.loftAngle + gap.nextClub.loftAngle) / 2,
      idealMidDistance
    );

    const estimatedLoft = estimateLoftFromDistance(idealMidDistance, category, estimatedHeadSpeed);
    const estimatedLength = category === 'Iron'
      ? 38.5 - (estimatedLoft - 30) * 0.1
      : category === 'Wedge'
        ? 35 - (estimatedLoft - 48) * 0.05
        : 45 - (estimatedLoft - 10) * 0.2;

    const idealSW = getIdealSwingWeightFromRegression(estimatedLength, clubs);

    const spec: ProposedSpec = {
      loftAngle: estimatedLoft,
      length: estimatedLength,
      swingWeight: idealSW ?? undefined,
    };

    const clubName = generateClubNameFromSpec(category, spec);

    recommendations.push({
      category,
      clubName,
      reason: [
        `${getClubTypeDisplay(gap.currentClub.clubType, gap.currentClub.number || '')}と${getClubTypeDisplay(gap.nextClub.clubType, gap.nextClub.number || '')}の距離ギャップが${gap.gap.toFixed(1)}ydあります`,
        `中間的な${Math.round(idealMidDistance)}ydのクラブでギャップを埋めます`,
        `トレンドに沿ったスペックで統一感を出します`,
      ],
      expectedDistanceGain: Math.round(gap.gap * 0.3),
      actionType: 'add',
      proposedSpec: spec,
    });
  }

  return recommendations.slice(0, 3);
};

// Generate recommendations for exactly 14 clubs
const generateRecommendationsFor14Clubs = (
  clubs: GolfClub[],
  adjustments: Adjustment[],
  swingLengthTable: ReturnType<typeof buildSwingLengthAnalysis>['tableClubs'],
  headSpeed: number | null
): Recommendation[] => {
  const recommendations: Recommendation[] = [];

  // First, check for narrow gaps - this takes priority over other recommendations
  const narrowGapRecommendations = generateNarrowGapRecommendations(clubs, headSpeed, 3);
  recommendations.push(...narrowGapRecommendations);

  // If we already have 3 recommendations from narrow gaps, return early
  if (recommendations.length >= 3) {
    return recommendations.slice(0, 3);
  }

  // Get high priority adjustments
  const highPriorityAdjustments = adjustments.filter((a) => a.priority === 'high');

  for (const adjustment of highPriorityAdjustments.slice(0, 3)) {
    if (recommendations.length >= 3) break;
    
    const title = adjustment.title;
    
    // Swing weight trend adjustment
    if (title.includes('スイングウェイトのトレンド調整')) {
      // Find clubs that deviate from trend
      const outliers = swingLengthTable.filter((c) => c.trendStatus === '調整推奨');
      if (outliers.length === 0) continue;
      
      for (const outlier of outliers.slice(0, 2)) {
        if (recommendations.length >= 3) break;
        
        const idealSW = outlier.expectedSwingWeight.toFixed(1);
        const spec: ProposedSpec = {
          loftAngle: outlier.loftAngle,
          length: outlier.length,
          swingWeight: `D${idealSW}`,
        };
        
        const category = mapClubTypeToCategory(outlier.clubType) || 'Iron';
        const clubName = generateClubNameFromSpec(category, spec);
        
        recommendations.push({
          category,
          clubName,
          reason: [
            `トレンドから${outlier.deviationFromTrend.toFixed(1)}ポイント外れています`,
            `トレンドに合わせることでスイングフィールが統一されます`,
            `方向性と一貫性が向上します`,
          ],
          expectedDistanceGain: 0,
          expectedAccuracyGain: 15,
          actionType: 'replace',
          replaceTarget: getClubTypeDisplay(outlier.clubType, outlier.number || ''),
          proposedSpec: spec,
        });
      }
    }
    
    // Lie angle optimization for irons
    else if (title.includes('アイアンのライ角最適化')) {
      const irons = clubs.filter((c) => c.clubType === 'Iron' && c.lieAngle > 0 && c.length > 0);
      if (irons.length < 2) continue;
      
      const lieAngles = irons.map((c) => c.lieAngle);
      const minLie = Math.min(...lieAngles);
      const maxLie = Math.max(...lieAngles);
      
      // Find clubs that deviate most from the average
      const avgLie = lieAngles.reduce((a, b) => a + b, 0) / lieAngles.length;
      const outlierIrons = irons
        .map((c) => ({ club: c, deviation: Math.abs(c.lieAngle - avgLie) }))
        .sort((a, b) => b.deviation - a.deviation)
        .filter((c) => c.deviation > 1.5);
      
      if (outlierIrons.length === 0) continue;
      
      for (const { club } of outlierIrons.slice(0, 2)) {
        if (recommendations.length >= 3) break;
        
        const idealLie = getIdealLieAngleForIron(club.length, irons);
        const idealSW = getIdealSwingWeightFromRegression(club.length, clubs);
        
        const spec: ProposedSpec = {
          loftAngle: club.loftAngle,
          length: club.length,
          swingWeight: idealSW ?? undefined,
          lieAngle: idealLie,
        };
        
        const clubName = generateClubNameFromSpec('Iron', spec);
        
        recommendations.push({
          category: 'Iron',
          clubName,
          reason: [
            `セット内のライ角バラつきが${(maxLie - minLie).toFixed(1)}°あります`,
            `理想のライ角${idealLie.toFixed(1)}°に調整することで方向精度が向上します`,
            `アイアンセット全体の一貫性が向上します`,
          ],
          expectedDistanceGain: 0,
          expectedAccuracyGain: 20,
          actionType: 'replace',
          replaceTarget: getClubTypeDisplay(club.clubType, club.number || ''),
          proposedSpec: spec,
        });
      }
    }
    
    // Condition unification
    else if (title.includes('の調子統一')) {
      const match = title.match(/^(.*?)の調子統一/);
      if (!match) continue;
      
      const categoryLabel = match[1];
      const categoryMap: Record<string, GolfClub['clubType']> = {
        'ドライバー': 'Driver',
        'ウッド': 'Wood',
        'ハイブリッド': 'Hybrid',
        'アイアン': 'Iron',
        'ウェッジ': 'Wedge',
      };
      
      const targetType = categoryMap[categoryLabel];
      if (!targetType) continue;
      
      const targetClubs = clubs.filter(
        (c) => c.clubType === targetType && c.condition && c.condition.length > 0
      );
      
      if (targetClubs.length === 0) continue;
      
      // Find most common condition
      const conditionCounts = new Map<string, number>();
      for (const club of targetClubs) {
        const count = conditionCounts.get(club.condition!) ?? 0;
        conditionCounts.set(club.condition!, count + 1);
      }
      
      const unifiedCondition = [...conditionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!unifiedCondition) continue;
      
      // Find clubs with different conditions
      const differentClubs = targetClubs.filter((c) => c.condition !== unifiedCondition);
      
      for (const club of differentClubs.slice(0, 2)) {
        if (recommendations.length >= 3) break;
        
        const idealSW = getIdealSwingWeightFromRegression(club.length, clubs);
        const idealLie = club.clubType === 'Iron' 
          ? getIdealLieAngleForIron(club.length, clubs.filter((c) => c.clubType === 'Iron'))
          : undefined;
        
        const spec: ProposedSpec = {
          loftAngle: club.loftAngle,
          length: club.length,
          swingWeight: idealSW ?? undefined,
          lieAngle: idealLie,
          condition: unifiedCondition,
        };
        
        const category = mapClubTypeToCategory(club.clubType) || 'Iron';
        const clubName = generateClubNameFromSpec(category, spec);
        
        recommendations.push({
          category,
          clubName,
          reason: [
            `${categoryLabel}内で調子が統一されていません`,
            `${unifiedCondition}に統一することでスイングフィールが一貫します`,
            `方向性と打感の安定性が向上します`,
          ],
          expectedDistanceGain: 5,
          expectedAccuracyGain: 10,
          actionType: 'replace',
          replaceTarget: getClubTypeDisplay(club.clubType, club.number || ''),
          proposedSpec: spec,
        });
      }
    }
  }
  
  return recommendations;
};

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

    // Generate recommendations based on club count
    // For less than 14 clubs: analyze distance gaps and suggest clubs to add/replace
    // For exactly 14 clubs: suggest clubs based on high-priority adjustment items
    let recommendations: Recommendation[];
    
    if (clubCount < 14) {
      recommendations = generateRecommendationsForLessThan14Clubs(
        bagClubs,
        estimateHeadSpeedFromClubs(bagClubs)
      );
    } else {
      // For 14 clubs, recommendations will be generated after adjustments are computed
      // This is handled separately since we need adjustments data
      recommendations = [];
    }

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
      });
    }

    // Check for swing weight inconsistencies by club type
    const clubsWithSwingWeight = bagClubs.filter(
      (c) => !!c.swingWeight && c.swingWeight.length > 0
    );

    // Group by club type and find types with multiple swing weight variations
    const clubTypeSwingWeights = new Map<string, number[]>();
    for (const club of clubsWithSwingWeight) {
      const numericSwingWeight = swingWeightToNumeric(club.swingWeight ?? '');
      if (Number.isFinite(numericSwingWeight)) {
        const clubType = club.clubType ?? 'Unknown';
        if (!clubTypeSwingWeights.has(clubType)) {
          clubTypeSwingWeights.set(clubType, []);
        }
        clubTypeSwingWeights.get(clubType)!.push(numericSwingWeight);
      }
    }

    // Find club types with multiple swing weights that differ by more than 0.3
    const inconsistentClubTypes: string[] = [];
    for (const [clubType, swingWeights] of clubTypeSwingWeights.entries()) {
      if (swingWeights.length < 2) continue;
      
      let deviationCount = 0;
      for (let i = 0; i < swingWeights.length; i++) {
        for (let j = i + 1; j < swingWeights.length; j++) {
          if (Math.abs(swingWeights[i] - swingWeights[j]) > 0.3) {
            deviationCount++;
          }
        }
      }
      
      if (deviationCount >= 2) {
        inconsistentClubTypes.push(clubType);
      }
    }

    if (inconsistentClubTypes.length > 0 && swingOutliers.length === 0) {
      adjustments.push({
        priority: 'low',
        title: 'スイングウェイトの確認',
        description: `${inconsistentClubTypes.join('、')}でスイングウェイトにわずかなバラつきがあります。スイングフィールに違和感がないか確認してみてください。`,
        estimatedEffect: 'フィールの確認',
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
          });
        }
      }
    }

    // Check for gaps in distance coverage using actual distance data
    const gapRecommendations = computeGapsAndRecommendations(bagClubs);
    adjustments.push(...gapRecommendations);

    // Check shaft flex compatibility based on estimated head speed
    const estimatedHeadSpeed = estimateHeadSpeedFromClubs(bagClubs);
    const flexAdjustments = checkFlexCompatibility(bagClubs, estimatedHeadSpeed);
    adjustments.push(...flexAdjustments);

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
          });
          break;
        }
      }
    }

    // Condition (調子) analysis
    const clubsWithCondition = bagClubs.filter((c) => c.condition && c.condition.length > 0);

    // 互換性のない組み合わせを定義
    const INCOMPATIBLE_CONDITION_PAIRS: Array<[string, string]> = [
      ['先調子', '元調子'],
      ['先中調子', '中元調子'],
      ['先調子', '中元調子'],
      ['元調子', '先中調子'],
    ];

    // カテゴリ内のバラつき検出（優先度高）
    const categoryConditions = new Map<GolfClub['clubType'], Set<string>>();
    const categoryLabelMap: Record<GolfClub['clubType'], string> = {
      Driver: 'ドライバー',
      Wood: 'ウッド',
      Hybrid: 'ハイブリッド',
      Iron: 'アイアン',
      Wedge: 'ウェッジ',
      Putter: 'パター',
    };

    for (const club of clubsWithCondition) {
      const clubType = club.clubType;
      if (!categoryConditions.has(clubType)) {
        categoryConditions.set(clubType, new Set());
      }
      categoryConditions.get(clubType)!.add(club.condition!);
    }

    // カテゴリ内で2種類以上の調子がある場合、警告を追加
    for (const [clubType, conditions] of categoryConditions.entries()) {
      if (conditions.size >= 2) {
        const conditionList = Array.from(conditions).join('、');
        adjustments.push({
          priority: 'high',
          title: `${categoryLabelMap[clubType]}の調子統一`,
          description: `${categoryLabelMap[clubType]}内で調子にバラつきがあります（${conditionList}）。同じ調子に統一することでスイングフィールが一貫します。`,
          estimatedEffect: 'スイングフィールの統一、方向性向上',
        });
      }
    }

    // 互換性のない組み合わせ検出（優先度中）
    const driverWoodConditions = clubsWithCondition
      .filter((c) => c.clubType === 'Driver' || c.clubType === 'Wood')
      .map((c) => c.condition!)
      .filter((cond) => cond);
    
    const ironWedgeConditions = clubsWithCondition
      .filter((c) => c.clubType === 'Iron' || c.clubType === 'Wedge')
      .map((c) => c.condition!)
      .filter((cond) => cond);

    if (driverWoodConditions.length > 0 && ironWedgeConditions.length > 0) {
      const uniqueDriverWood = [...new Set(driverWoodConditions)];
      const uniqueIronWedge = [...new Set(ironWedgeConditions)];

      for (const dwCond of uniqueDriverWood) {
        for (const iwCond of uniqueIronWedge) {
          if (INCOMPATIBLE_CONDITION_PAIRS.some(([a, b]) => 
            (a === dwCond && b === iwCond) || (a === iwCond && b === dwCond)
          )) {
            adjustments.push({
              priority: 'medium',
              title: '調子の互換性確認',
              description: `ドライバー/ウッドの${dwCond}とアイアン/ウェッジの${iwCond}は相性が悪い組み合わせです。いずれかのグループの調子変更を検討してください。`,
              estimatedEffect: 'スイングリズムの統一',
            });
            break;
          }
        }
      }
    }

    // Sort adjustments by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    adjustments.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    // Generate recommendations for 14 clubs after adjustments are sorted
    if (clubCount >= 14) {
      recommendations = generateRecommendationsFor14Clubs(
        bagClubs,
        adjustments,
        swingLengthTable,
        estimateHeadSpeedFromClubs(bagClubs)
      );
    }
    
    // Limit to top 3 recommendations
    const limitedRecommendations = recommendations.slice(0, 3);

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
