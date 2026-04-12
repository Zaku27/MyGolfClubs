import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GolfBagPanel } from '../components/GolfBagPanel';

const EMPTY_ACTUAL_SHOT_ROWS: Array<Record<string, string>> = [];

// ショット品質の英語ラベル関数
function qualityLabel(q: string) {
  switch (q) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "average": return "Average";
    case "poor": return "Poor";
    case "mishit": return "Mishit";
    default: return q;
  }
}
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  selectSortedClubsForDisplay,
  useClubStore,
} from '../store/clubStore';
import { useBagIdUrlSync } from '../hooks/useBagIdUrlSync';
import { formatGolfClubDisplayName, formatSimClubLabel } from '../utils/simClubLabel';
import {
  simulateShot,
  estimateBaseDistance,
} from '../utils/shotSimulation';
import { getSkillLabel } from '../utils/playerSkill';
import {
  calculateDisplayClubSuccessRate,
  getAnalysisAdjustedBaseSuccessRate,
  isWeakClubByAnalysisAdjustedRate,
} from '../utils/clubSuccessDisplay';
import {
  buildLieAngleAnalysis,
  buildSwingWeightAnalysis,
  buildWeightLengthAnalysis,
} from '../utils/analysisBuilders';
import { classifyWeightDeviation } from '../utils/analysisRules';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { readStoredJson, readStoredNumber } from '../utils/storage';
import { resolvePersonalDataForSimClub } from '../utils/personalData';
import { toSimClub } from '../utils/clubSimAdapter';
import {
  loadRangePlayerSettings,
  saveRangePlayerSettings,
  type RangeSeatType,
} from '../utils/rangePlayerSettings';
import ShotDispersionChart from '../components/ShotDispersionChart';
import { ShotControlPanel } from '../components/ShotControlPanel';
import WindDirectionDial from '../components/WindDirectionDial';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';
import type { LieType, ShotQuality, ShotResult, SimClub } from '../types/game';
import type { GolfClub, ClubPersonalData } from '../types/golf';
import {
  convertMpsToMph,
  formatWindDirectionLabel,
  normalizeWindDirection,
  normalizeWindSpeedMps,
} from '../utils/windDirection';

const LIE_OPTIONS = [
  'ティー',
  'フェアウェイ',
  'セミラフ',
  'ラフ',
  'ベアグラウンド',
  'バンカー',
];

function getLiePenaltyInfo(lie: string, clubType: string): string {
  switch (lie) {
    case 'ティー':
      return '標準的なライです。飛距離の影響はほとんどありません。';
    case 'フェアウェイ':
      return 'ほぼ通常のライです。飛距離はほとんど落ちません。';
    case 'セミラフ':
      return '飛距離は約10%減少し、方向の安定性もやや低下します。';
    case 'ラフ':
      return '飛距離は約18%減少し、ショットが不安定になります。';
    case 'ベアグラウンド':
      return '飛距離は約40%減少し、非常に打ちにくいライです。';
    case 'バンカー':
      return clubType === 'Wedge'
        ? 'ウェッジでは飛距離約30%減、その他番手では約50%減。砂では方向も乱れやすいです。'
        : '飛距離は約50%減。砂地では方向も不安定になります。';
    case 'グリーン':
      return 'パター用のライです。飛距離補正はパット動作によります。';
    default:
      return '選択したライのペナルティ情報はありません。';
  }
}

const SHOT_COUNTS = [5, 10, 20, 40];

function clampAimXOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-50, Math.min(50, Math.round(value)));
}

const RANGE_CONDITION_SETTINGS_KEY = 'rangeConditionSettings';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;

type GroundHardness = "soft" | "medium" | "firm";

function formatGroundHardnessLabel(groundHardness: GroundHardness): string {
  return groundHardness === 'soft' ? '柔らかい' : groundHardness === 'firm' ? '硬い' : '普通';
}

type RangeConditionSettings = {
  lie: string;
  windDirection: number;
  windSpeed: number;
  groundHardness: GroundHardness;
  slopeAngle: number;
  slopeDirection: number;
};

type AnalysisPenalty = {
  points: number;
  reasons: string[];
};

function toCanonicalSlopeSettings(slopeAngle: number, slopeDirection: number): { slopeAngle: number; slopeDirection: number } {
  const safeAngle = Number.isFinite(slopeAngle) ? slopeAngle : 0;
  const clampedAngle = Math.min(45, Math.abs(safeAngle));
  const normalizedDirection = Number.isFinite(slopeDirection)
    ? normalizeWindDirection(slopeDirection)
    : 0;

  if (safeAngle < 0) {
    return {
      slopeAngle: clampedAngle,
      slopeDirection: normalizeWindDirection(normalizedDirection + 180),
    };
  }

  return {
    slopeAngle: clampedAngle,
    slopeDirection: normalizedDirection,
  };
}

function loadRangeConditionSettings(): RangeConditionSettings {
  if (typeof window === 'undefined') {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }

  try {
    const raw = localStorage.getItem(RANGE_CONDITION_SETTINGS_KEY);
    if (!raw) {
      return {
        lie: 'ティー',
        windDirection: 180,
        windSpeed: 0,
        groundHardness: 'medium',
        slopeAngle: 0,
        slopeDirection: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RangeConditionSettings>;
    const safeLie = LIE_OPTIONS.includes(String(parsed.lie)) ? String(parsed.lie) : 'ティー';

    const safeGroundHardness = parsed.groundHardness === 'soft' || parsed.groundHardness === 'firm' || parsed.groundHardness === 'medium'
      ? parsed.groundHardness
      : 'medium';
    const canonicalSlope = toCanonicalSlopeSettings(
      Number(parsed.slopeAngle) || 0,
      Number(parsed.slopeDirection),
    );

    return {
      lie: safeLie,
      windDirection: normalizeWindDirection(Number(parsed.windDirection)),
      windSpeed: normalizeWindSpeedMps(Number(parsed.windSpeed)),
      groundHardness: safeGroundHardness,
      slopeAngle: canonicalSlope.slopeAngle,
      slopeDirection: canonicalSlope.slopeDirection,
    };
  } catch {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
      groundHardness: 'medium',
      slopeAngle: 0,
      slopeDirection: 0,
    };
  }
}

function saveRangeConditionSettings(settings: RangeConditionSettings) {
  if (typeof window === 'undefined') return;
  const canonicalSlope = toCanonicalSlopeSettings(settings.slopeAngle, settings.slopeDirection);
  localStorage.setItem(
    RANGE_CONDITION_SETTINGS_KEY,
    JSON.stringify({
      lie: settings.lie,
      windDirection: normalizeWindDirection(settings.windDirection),
      windSpeed: normalizeWindSpeedMps(settings.windSpeed),
      groundHardness: settings.groundHardness,
      slopeAngle: canonicalSlope.slopeAngle,
      slopeDirection: canonicalSlope.slopeDirection,
    }),
  );
}

function parseUserLieAngleStandards(value: unknown): UserLieAngleStandards {
  if (!value || typeof value !== 'object') {
    return DEFAULT_USER_LIE_ANGLE_STANDARDS;
  }

  const parsed = value as Partial<UserLieAngleStandards>;
  return {
    byClubType: parsed.byClubType ?? {},
    byClubName: parsed.byClubName ?? {},
  };
}

const qualityStatusColor = (shotQuality: string) => {
  if (shotQuality === 'excellent') return 'text-blue-700';
  if (shotQuality === 'good') return 'text-green-700';
  if (shotQuality === 'average') return 'text-amber-600';
  if (shotQuality === 'poor') return 'text-pink-600';
  if (shotQuality === 'mishit') return 'text-red-600';
  return 'text-gray-700';
};

type RangeSummary = {
  avg: number;
  std: number;
  success: number;
  estimatedDist: number;
  diff: number;
  avgToTargetDistance: number;
  meanRoll: number;
  meanLateral: number;
  groundRollContribution: string;
  groundLateralContribution: string;
  appliedGroundHardness: GroundHardness;
};

function formatGroundHardnessImpact(groundHardness: GroundHardness, roll: number | undefined): string {
  if (roll == null || !Number.isFinite(roll)) return '-';

  const hardnessValue = groundHardness === 'firm' ? 90 : groundHardness === 'soft' ? 60 : 75;
  const currentFactor = 0.8 + (hardnessValue / 100) * 0.4;
  const mediumFactor = 0.8 + (75 / 100) * 0.4;
  const baseline = roll * (mediumFactor / currentFactor);
  const delta = roll - baseline;
  const deltaLabel = delta === 0 ? '0.0y' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}y`;

  return `ラン ${deltaLabel}`;
}

function extractClubNumberFromString(numberText: string | undefined): number | null {
  if (!numberText) return null;
  const match = numberText.trim().toUpperCase().match(/^(\d{1,2})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getExpectedRollRate(
  clubType: string,
  clubNumber: string | undefined,
  loftAngle?: number,
): number {
  const normalizedClubType = clubType.trim();
  const clubNumberValue = extractClubNumberFromString(clubNumber);

  if (normalizedClubType === 'Driver') return 0.09;

  if (normalizedClubType === 'Wood') {
    if (clubNumberValue !== null) {
      if (clubNumberValue <= 3) return 0.085;
      if (clubNumberValue <= 5) return 0.075;
      if (clubNumberValue <= 7) return 0.065;
      return 0.055;
    }
    return (loftAngle ?? 15) <= 16 ? 0.08 : 0.065;
  }

  if (normalizedClubType === 'Hybrid') {
    if (clubNumberValue !== null) {
      if (clubNumberValue <= 3) return 0.075;
      if (clubNumberValue <= 4) return 0.068;
      if (clubNumberValue <= 5) return 0.06;
      return 0.052;
    }
    return (loftAngle ?? 22) <= 21 ? 0.07 : 0.058;
  }

  if (normalizedClubType === 'Iron') {
    if (clubNumberValue !== null) {
      if (clubNumberValue <= 4) return 0.06;
      if (clubNumberValue <= 6) return 0.052;
      if (clubNumberValue <= 8) return 0.042;
      return 0.032;
    }
    return (loftAngle ?? 30) <= 28 ? 0.052 : 0.038;
  }

  if (normalizedClubType === 'Wedge') {
    const token = (clubNumber ?? '').trim().toUpperCase();
    if (token.includes('LW')) return 0.012;
    if (token.includes('SW')) return 0.016;
    if (token.includes('GW') || token.includes('AW')) return 0.02;
    if (token.includes('PW')) return 0.024;
    return (loftAngle ?? 50) >= 56 ? 0.014 : 0.022;
  }

  return 0.01;
}

function estimateExpectedRoll(
  expectedCarry: number,
  clubType: string,
  clubNumber: string | undefined,
  loftAngle: number | undefined,
  groundHardness: GroundHardness,
): number {
  const baseRollRate = getExpectedRollRate(clubType, clubNumber, loftAngle);
  const hardness01 = groundHardness === 'soft' ? 0.6 : groundHardness === 'firm' ? 0.9 : 0.75;
  const groundFactor = 0.8 + hardness01 * 0.4;
  const typicalQualityFactor = 0.98;
  return Math.max(0, expectedCarry * baseRollRate * groundFactor * typicalQualityFactor);
}

function normalizeSlopeForDisplay(slopeAngle: number, slopeDirection: number): { slopeAngle: number; slopeDirection: number } {
  return toCanonicalSlopeSettings(slopeAngle, slopeDirection);
}

function formatSlopeDirectionLabel(direction: number): string {
  if (direction === 0) return 'ピン方向上り';
  if (direction === 90) return '右側上り';
  if (direction === 180) return 'ピン反対方向上り';
  if (direction === 270) return '左側上り';
  if (direction > 0 && direction < 90) return '右前上り';
  if (direction > 90 && direction < 180) return '右後上り';
  if (direction > 180 && direction < 270) return '左後上り';
  return '左前上り';
}

function formatSlopeEffectGuide(slopeAngle: number, slopeDirection: number): string {
  const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
  if (normalizedSlope.slopeAngle === 0) {
    return 'フラット: キャリー・ラン・横ブレの傾斜補正は入りません。';
  }

  const direction = normalizedSlope.slopeDirection;
  const directionLabel = formatSlopeDirectionLabel(direction);
  let effect = '前後と左右の補正が混在します。';

  if (direction === 0) effect = 'ピン方向が上りになり、キャリーとランは減りやすくなります。';
  else if (direction === 180) effect = 'ピン方向が下りになり、キャリーとランは伸びやすくなります。';
  else if (direction === 90) effect = '右側が上りになり、左へ流れやすくなります。';
  else if (direction === 270) effect = '左側が上りになり、右へ流れやすくなります。';
  else if (direction > 0 && direction < 90) effect = '右前上りで、キャリーとランが減りつつ左へ流れやすくなります。';
  else if (direction > 90 && direction < 180) effect = '右後上りで、キャリーとランが伸びつつ左へ流れやすくなります。';
  else if (direction > 180 && direction < 270) effect = '左後上りで、キャリーとランが伸びつつ右へ流れやすくなります。';
  else if (direction > 270 && direction < 360) effect = '左前上りで、キャリーとランが減りつつ右へ流れやすくなります。';

  return `${normalizedSlope.slopeAngle}° / ${directionLabel}: ${effect}`;
}

function formatSlopeImpact(
  landing: ShotResult['landing'] | undefined,
  baselineLanding: ShotResult['landing'] | undefined,
): string {
  if (!landing || !baselineLanding) return '-';

  const carryDiff = (landing.carry ?? 0) - (baselineLanding.carry ?? 0);
  const rollDiff = (landing.roll ?? 0) - (baselineLanding.roll ?? 0);
  const finalXDiff = (landing.finalX ?? 0) - (baselineLanding.finalX ?? 0);
  const fmt = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}y`;

  return `C ${fmt(carryDiff)} / R ${fmt(rollDiff)} / X ${fmt(finalXDiff)}`;
}

function mapLieUiToGameLie(lie: string): LieType {
  switch (lie) {
    case 'ティー': return 'tee';
    case 'フェアウェイ': return 'fairway';
    case 'セミラフ': return 'semirough';
    case 'ラフ': return 'rough';
    case 'ベアグラウンド': return 'bareground';
    case 'バンカー': return 'bunker';
    case 'グリーン': return 'green';
    default: return 'tee';
  }
}

function toLandingResult(raw: ShotResult): LandingResult | null {
  const landing = raw?.landing;
  if (!landing) return null;

  const finalX = Number(landing.finalX);
  const finalY = Number(landing.finalY);
  if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) return null;

  const carry = Number(landing.carry);
  const roll = Number(landing.roll);
  const totalDistance = Number(landing.totalDistance);
  const lateralDeviation = Number(landing.lateralDeviation);

  return {
    carry: Number.isFinite(carry) ? carry : finalY,
    roll: Number.isFinite(roll) ? roll : 0,
    totalDistance: Number.isFinite(totalDistance) ? totalDistance : finalY,
    lateralDeviation: Number.isFinite(lateralDeviation) ? lateralDeviation : finalX,
    finalX,
    finalY,
    shotQuality: raw.shotQuality,
    qualityMetrics: landing.qualityMetrics,
    apexHeight: landing.apexHeight,
    trajectoryPoints: landing.trajectoryPoints,
  };
}

function buildMonteCarloResult(rawResults: ShotResult[]): MonteCarloResult {
  const shots = rawResults
    .map((r) => toLandingResult(r))
    .filter((shot): shot is LandingResult => shot !== null);

  if (shots.length === 0) {
    return {
      shots: [],
      stats: {
        meanX: 0,
        meanY: 0,
        stdDevX: 0,
        stdDevY: 0,
        correlation: 0,
      },
    };
  }

  const meanX = shots.reduce((sum, shot) => sum + shot.finalX, 0) / shots.length;
  const meanY = shots.reduce((sum, shot) => sum + shot.finalY, 0) / shots.length;
  const varianceX = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) ** 2, 0) / shots.length;
  const varianceY = shots.reduce((sum, shot) => sum + (shot.finalY - meanY) ** 2, 0) / shots.length;
  const covariance = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) * (shot.finalY - meanY), 0) / shots.length;
  const stdDevX = Math.sqrt(varianceX);
  const stdDevY = Math.sqrt(varianceY);

  // X/Y のばらつきの連動を相関係数として保持しておくと、
  // 可視化側で軸平行ではない回転楕円を描ける。
  const correlation = stdDevX > 0 && stdDevY > 0 ? covariance / (stdDevX * stdDevY) : 0;

  return {
    shots,
    stats: {
      meanX,
      meanY,
      stdDevX,
      stdDevY,
      correlation,
    },
  };
}

function getSelectableRangeClubs(
  clubs: GolfClub[],
  seatType: RangeSeatType,
): GolfClub[] {
  const filtered = clubs.filter((club) => seatType !== 'personal' || club.clubType !== 'Putter');

  return [...filtered].sort((a, b) => {
    if (seatType !== 'personal') {
      const aIsPutter = a.clubType === 'Putter';
      const bIsPutter = b.clubType === 'Putter';
      if (aIsPutter && !bIsPutter) return 1;
      if (!aIsPutter && bIsPutter) return -1;
    }

    return (a.loftAngle ?? 999) - (b.loftAngle ?? 999);
  });
}

type RangeClubSelectionPanelProps = {
  clubs: GolfClub[];
  selectableClubs: GolfClub[];
  selectedClubId: string;
  onSelectedClubIdChange: (value: string) => void;
  selectedClub?: GolfClub | null;
  simClub?: SimClub;
  estimatedClubDistance: number;
  seatType: RangeSeatType;
  clubPersonal?: ClubPersonalData | undefined;
  effectiveSuccess: number | null;
};

function RangeClubSelectionPanel({
  clubs,
  selectableClubs,
  selectedClubId,
  onSelectedClubIdChange,
  selectedClub,
  simClub,
  estimatedClubDistance,
  seatType,
  clubPersonal,
  effectiveSuccess,
}: RangeClubSelectionPanelProps) {
  return (
    <div className="w-full bg-white rounded shadow p-4">
      <label className="block font-semibold mb-2">クラブ選択</label>
      {clubs.length === 0 ? (
        <div className="text-red-600 font-bold py-2">
          クラブが登録されていません。<br />クラブ管理画面でクラブを追加してください。
        </div>
      ) : (
        <>
          <select
            className="w-full border rounded p-2 mb-2"
            value={selectedClubId}
            onChange={(e) => onSelectedClubIdChange(e.target.value)}
          >
            <option value="">-- クラブを選択 --</option>
            {selectableClubs.map((club) => (
              <option key={club.id} value={club.id}>
                {formatGolfClubDisplayName(club)}
              </option>
            ))}
          </select>
          {selectedClub && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-green-900 text-sm">
              <span className="font-bold">{selectedClub.name}</span>
              <span>
                {seatType === 'personal'
                  ? `実測飛距離: ${selectedClub?.distance ?? '-'} y`
                  : `推定飛距離: ${simClub ? estimatedClubDistance : '-'} y`}
              </span>
              {seatType !== 'actual' && (
                <div className="relative inline-flex items-center gap-2 whitespace-nowrap">
                  <span>
                    クラブ成功率: {
                      simClub ? (
                        seatType === 'robot'
                          ? '100% (ロボット固定)'
                          : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? effectiveSuccess.toFixed(1) : '--') + '%'
                      ) : '--'
                    }
                  </span>
                  {seatType === 'robot' && (
                    <button
                      type="button"
                      aria-label="ロボット打席のクラブ成功率ヒント"
                      className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-xs font-bold text-blue-700"
                    >
                      ?
                      <span className="help-tooltip-text whitespace-normal">
                        ロボット打席はクラブの個体差や個人データの影響を受けないため、クラブ成功率は常に100%で固定されます。
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RangeSimulationResultsProps = {
  results: ShotResult[];
  summary: RangeSummary | null;
  flatBaselineResults: ShotResult[];
  chartTarget: { x: number; y: number };
  chartAim?: { x: number; y: number };
  monteCarloResult: MonteCarloResult;
  clubName: string;
  skillLevelName: string;
  numShots: number;
  groundHardness: GroundHardness;
  slopeAngle: number;
  slopeDirection: number;
};

function RangeSimulationResults({
  results,
  summary,
  flatBaselineResults,
  chartTarget,
  chartAim,
  monteCarloResult,
  clubName,
  skillLevelName,
  numShots,
  groundHardness,
  slopeAngle,
  slopeDirection,
}: RangeSimulationResultsProps) {
  return (
    <>
      {results.length > 0 && summary && (
        <div className="w-full bg-white rounded shadow p-4 mb-4">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-green-900">セッション結果：</span>
            <span>平均: {summary.avg.toFixed(1)} y</span>
            <span>成功率: {(summary.success * 100).toFixed(1)}%</span>
            <span>目標まで平均距離: {(summary.avgToTargetDistance ?? 0).toFixed(1)} y</span>
          </div>
          <div className="mb-4 rounded border border-green-200 bg-green-50/40 p-2">
            <ShotDispersionChart
              monteCarloResult={monteCarloResult}
              target={chartTarget}
              aim={chartAim}
              clubName={clubName}
              skillLevelName={skillLevelName}
              numShots={numShots}
              groundHardness={groundHardness}
              slopeAngle={slopeAngle}
              slopeDirection={slopeDirection}
            />
          </div>
          {summary.estimatedDist && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <span className="font-semibold">目安との比較：</span>
              <span>目安: {summary.estimatedDist} y / 実績平均: {summary.avg.toFixed(1)} y</span>
              <span className={summary.diff > 0 ? 'text-red-600 font-bold' : summary.diff < 0 ? 'text-blue-600 font-bold' : ''}>
                {summary.diff > 0 ? ` (+${summary.diff}y)` : summary.diff < 0 ? ` (${summary.diff}y)` : ' (一致)'}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-1 py-0.5">#</th>
                  <th className="px-1 py-0.5">飛距離</th>
                  <th className="px-1 py-0.5">キャリー</th>
                  <th className="px-1 py-0.5">ラン</th>
                  <th className="px-1 py-0.5">横ブレ</th>
                  <th className="px-1 py-0.5">地面影響</th>
                  <th className="px-1 py-0.5">傾斜影響</th>
                  <th className="px-1 py-0.5">着地X</th>
                  <th className="px-1 py-0.5">着地Y</th>
                  <th className="px-1 py-0.5">ショット品質</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="px-1 py-0.5 text-center">{(r.landing?.totalDistance ?? r.distanceHit).toFixed(1)}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.carry?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.roll?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.lateralDeviation?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{formatGroundHardnessImpact(summary.appliedGroundHardness, r.landing?.roll)}</td>
                    <td className="px-1 py-0.5 text-center">{formatSlopeImpact(r.landing, flatBaselineResults[i]?.landing)}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.finalX?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.finalY?.toFixed(1) ?? '-'}</td>
                    <td className={`px-1 py-0.5 text-center font-bold ${qualityStatusColor(r.shotQuality)}`}>{qualityLabel(r.shotQuality)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function RangeScreen() {
  const allClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const personalData = useClubStore((state) => state.personalData);
  const actualShotRows = useClubStore((state) => {
    const bagId = state.activeBagId;
    return bagId != null ? state.actualShotRows[String(bagId)] ?? EMPTY_ACTUAL_SHOT_ROWS : EMPTY_ACTUAL_SHOT_ROWS;
  });
  const initializeDefaults = useClubStore((state) => state.initializeDefaults);
  const loadClubs = useClubStore((state) => state.loadClubs);
  const loadBags = useClubStore((state) => state.loadBags);
  const loadPersonalData = useClubStore((state) => state.loadPersonalData);
  const loadPlayerSkillLevel = useClubStore((state) => state.loadPlayerSkillLevel);
  const loadActualShotRows = useClubStore((state) => state.loadActualShotRows);
  const storedPlayerSkillLevel = useClubStore((state) => state.playerSkillLevel);
  const setActiveBag = useClubStore((state) => state.setActiveBag);
  const initialRangePlayerSettings = loadRangePlayerSettings();
  const initialRangeConditionSettings = loadRangeConditionSettings();
  // const { playerSkillLevel } = useGameStore();
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  // プレイヤー: "robot" or "personal"
  const [seatType, setSeatType] = useState<RangeSeatType>(initialRangePlayerSettings.seatType);
  // ロボット用: ヘッドスピードとスキルレベル
  const [robotHeadSpeed, setRobotHeadSpeed] = useState<number>(initialRangePlayerSettings.robotHeadSpeed);
  const [robotSkillLevel, setRobotSkillLevel] = useState<number>(initialRangePlayerSettings.robotSkillLevel);
  const [lie, setLie] = useState<string>(initialRangeConditionSettings.lie);
  // 風向は 0〜359 度（0°=北、時計回り）で保持する。
  const [windDirection, setWindDirection] = useState<number>(initialRangeConditionSettings.windDirection);
  // 風速は UI 仕様どおり m/s で保持する。
  const [windSpeed, setWindSpeed] = useState<number>(initialRangeConditionSettings.windSpeed);
  const [groundHardness, setGroundHardness] = useState<GroundHardness>(initialRangeConditionSettings.groundHardness);
  const [slopeAngle, setSlopeAngle] = useState<number>(initialRangeConditionSettings.slopeAngle);
  const [slopeDirection, setSlopeDirection] = useState<number>(initialRangeConditionSettings.slopeDirection);
  // 風ダイアルは通常閉じ、必要な時だけ開いて調整できるようにする。
  const [isWindControlOpen, setIsWindControlOpen] = useState<boolean>(false);
  const [isCourseConditionOpen, setIsCourseConditionOpen] = useState<boolean>(false);
  const [numShots, setNumShots] = useState<number>(10);
  const [aimXOffset, setAimXOffset] = useState<number>(0);
  const [shotPowerPercent, setShotPowerPercent] = useState<number>(100);
  const [results, setResults] = useState<ShotResult[]>([]);
  const [flatBaselineResults, setFlatBaselineResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [reuseLastSeed, setReuseLastSeed] = useState(initialRangePlayerSettings.reuseLastSeed);
  const [lastSimulationSeedNonce, setLastSimulationSeedNonce] = useState<string | null>(null);
  const monteCarloResult = buildMonteCarloResult(results);
  const personalSkillLevel = storedPlayerSkillLevel;
  const personalSkillLevelLabel = getSkillLabel(personalSkillLevel);
  const displayedSkillLevel = seatType === 'robot' ? robotSkillLevel : personalSkillLevel;
  const displayedSkillLabel = getSkillLabel(displayedSkillLevel);
  const skillLevelName = `適用スキルレベル ${(displayedSkillLevel * 100).toFixed(0)}% (${displayedSkillLabel})`;
  const displayedSkillLevelName = seatType === 'actual' ? '' : skillLevelName;
  const clubs = seatType === 'robot' ? allClubs : activeBagClubs;
  const selectableClubs = getSelectableRangeClubs(clubs, seatType);

  const swingWeightTarget = readStoredNumber(
    SWING_TARGET_STORAGE_KEY,
    DEFAULT_SWING_TARGET,
    { decimals: 1 },
  );
  const swingGoodTolerance = readStoredNumber(
    SWING_GOOD_TOLERANCE_STORAGE_KEY,
    DEFAULT_SWING_GOOD_TOLERANCE,
    { decimals: 1 },
  );
  const swingAdjustThreshold = readStoredNumber(
    SWING_ADJUST_THRESHOLD_STORAGE_KEY,
    DEFAULT_SWING_ADJUST_THRESHOLD,
    { decimals: 1 },
  );
  const userLieAngleStandards = readStoredJson(
    LIE_STANDARDS_STORAGE_KEY,
    DEFAULT_USER_LIE_ANGLE_STANDARDS,
    parseUserLieAngleStandards,
  );

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });
  const gameLie = mapLieUiToGameLie(lie);
  // 既存シミュレーションは mph 前提なので、UI(m/s)から変換して渡す。
  const windSpeedMph = convertMpsToMph(windSpeed);
  // 閉じた状態でも現在値が分かるよう、角度+方位ラベルを作って表示する。
  const windDirectionSummary = formatWindDirectionLabel(windDirection);

  // 風向・風速を初期状態へ戻す。
  const handleResetWind = () => {
    setWindDirection(0);
    setWindSpeed(0);
  };

  useEffect(() => {
    const initializeScreen = async () => {
      await initializeDefaults();
      await Promise.all([
        loadClubs(),
        loadBags(),
        loadPersonalData(),
        loadPlayerSkillLevel(),
        loadActualShotRows(),
      ]);
    };

    void initializeScreen();
  }, [initializeDefaults, loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel, loadActualShotRows]);

  useEffect(() => {
    if (clubs.length === 0) {
      if (selectedClubId !== '') {
        setSelectedClubId('');
      }
      return;
    }

    const hasSelectedClub = selectableClubs.some((club) => String(club.id) === String(selectedClubId));
    if (hasSelectedClub) {
      return;
    }

    const firstPlayableClub = selectableClubs[0] ?? null;
    setSelectedClubId(firstPlayableClub?.id != null ? String(firstPlayableClub.id) : '');
  }, [selectableClubs, selectedClubId]);

  useEffect(() => {
    saveRangePlayerSettings({
      seatType,
      robotHeadSpeed,
      robotSkillLevel,
      reuseLastSeed,
    });
  }, [seatType, robotHeadSpeed, robotSkillLevel, reuseLastSeed]);

  useEffect(() => {
    saveRangeConditionSettings({
      lie,
      windDirection,
      windSpeed,
      groundHardness,
      slopeAngle,
      slopeDirection,
    });
  }, [lie, windDirection, windSpeed, groundHardness, slopeAngle, slopeDirection]);


  // avgDistanceが無い場合はdistanceをavgDistanceとして使う
  let selectedClub = clubs.find((c) => String(c.id) === String(selectedClubId));
  const simClub = selectedClub ? toSimClub(selectedClub) : undefined;
  const estimatedClubDistance = simClub
    ? estimateBaseDistance(
        simClub,
        seatType === 'robot' ? robotHeadSpeed : undefined,
        undefined,
        true,
      )
    : 0;
  const actualModeResults = useMemo(() => {
    if (seatType !== 'actual' || !selectedClub) {
      return [] as ShotResult[];
    }

    const clubLabel = formatSimClubLabel(toSimClub(selectedClub));
    const parseNumber = (value?: string): number | null => {
      if (!value) return null;
      const raw = value.replace(/,/g, '').replace(/ /g, ' ').trim();
      const normalized = raw.replace(/左/g, 'L').replace(/右/g, 'R');
      const directionMatch = normalized.match(/^\s*([LR])\s*([+-]?\d+(?:\.\d+)?)\s*$/i)
        || normalized.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*([LR])\s*$/i);
      if (directionMatch) {
        const magnitude = Number(directionMatch[1] ?? directionMatch[2]);
        const direction = directionMatch[1] && /[LR]/i.test(directionMatch[1])
          ? directionMatch[1]
          : directionMatch[2];
        return Number.isFinite(magnitude)
          ? direction.toUpperCase() === 'L'
            ? -Math.abs(magnitude)
            : Math.abs(magnitude)
          : null;
      }
      const numeric = Number(raw.replace(/[^0-9+\-.]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    };

    const getBaseDispersionByClubType = (clubType: GolfClub['clubType']) => {
      if (clubType === 'Driver') return { carrySigma: 13, lateralSigma: 22 };
      if (clubType === 'Wood') return { carrySigma: 11, lateralSigma: 19 };
      if (clubType === 'Hybrid') return { carrySigma: 9.5, lateralSigma: 17 };
      if (clubType === 'Iron') return { carrySigma: 8, lateralSigma: 13 };
      if (clubType === 'Wedge') return { carrySigma: 6, lateralSigma: 8 };
      return { carrySigma: 5, lateralSigma: 6 };
    };

    const classifyQuality = (
      carry: number,
      expectedCarry: number,
      lateralDeviation: number,
      clubType: GolfClub['clubType'],
      wasMishit: boolean,
    ): ShotQuality => {
      if (wasMishit) {
        return 'mishit';
      }
      const profile = getBaseDispersionByClubType(clubType);
      const carryDelta = carry - expectedCarry;
      const carryZ = clubType === 'Driver' && carryDelta > 0 ? 0 : Math.abs(carryDelta) / Math.max(1, profile.carrySigma);
      const lateralZ = Math.abs(lateralDeviation) / Math.max(1, profile.lateralSigma);
      const weightedCarry = carryZ * 1.1;
      const weightedLateral = lateralZ * 0.75;
      const score = Math.max(weightedCarry, weightedLateral);
      if (score < 0.65) return 'excellent';
      if (score < 1.0) return 'good';
      if (score < 1.6) return 'average';
      return 'poor';
    };

    return actualShotRows
      .filter((row) => row.club === clubLabel)
      .map((row) => {
        const carry = parseNumber(row['Carry (yds)']);
        const totalDistance = parseNumber(row['Total (yds)']);
        const roll = parseNumber(row['Roll (yds)']);
        const lateral = parseNumber(row['Lateral (yds)']);
        const shotType = row['Shot Type']?.toLowerCase() ?? '';
        const wasMishit = shotType.includes('mishit') || row.Shot?.toLowerCase().includes('mishit');

        const carryValue = Number.isFinite(carry) ? carry : null;
        const rollValue = Number.isFinite(roll) ? roll : null;
        const totalDistanceFromComponents =
          carryValue !== null && rollValue !== null
            ? carryValue + rollValue
            : null;
        const actualTotalDistance = totalDistanceFromComponents ?? totalDistance ?? 0;
        const actualCarry = carryValue !== null
          ? carryValue
          : rollValue !== null
            ? actualTotalDistance - rollValue
            : actualTotalDistance;

        const expectedCarry = selectedClub?.distance ?? simClub?.avgDistance ?? actualCarry;
        const shotQuality = classifyQuality(actualCarry, expectedCarry, lateral ?? 0, selectedClub.clubType, wasMishit);

        return {
          newRemainingDistance: 0,
          outcomeMessage: '',
          strokesAdded: 1,
          lie: 'fairway' as LieType,
          penalty: false,
          distanceHit: actualTotalDistance,
          shotQuality,
          wasSuccessful: shotQuality !== 'mishit',
          effectiveSuccessRate: 100,
          landing: {
            carry: actualCarry,
            roll: roll ?? 0,
            totalDistance: actualTotalDistance,
            lateralDeviation: lateral ?? 0,
            finalX: lateral ?? 0,
            finalY: actualTotalDistance,
          },
          finalOutcome: 'fairway' as const,
          penaltyStrokes: 0,
        };
      });
  }, [actualShotRows, seatType, selectedClub]);

  const actualModeSummary = useMemo<RangeSummary | null>(() => {
    if (seatType !== 'actual' || actualModeResults.length === 0) {
      return null;
    }

    const distances = actualModeResults.map((result) => result.landing?.totalDistance ?? result.distanceHit);
    const avg = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const std = Math.sqrt(distances.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / distances.length);
    const success = actualModeResults.filter((result) => result.wasSuccessful).length / Math.max(1, actualModeResults.length);
    const meanRoll = actualModeResults.reduce((sum, result) => sum + (result.landing?.roll ?? 0), 0) / Math.max(1, actualModeResults.length);
    const meanLateral = actualModeResults.reduce((sum, result) => sum + Math.abs(result.landing?.lateralDeviation ?? 0), 0) / Math.max(1, actualModeResults.length);
    const hardnessFactor = groundHardness === 'firm' ? 1.35 : groundHardness === 'soft' ? 0.65 : 1;
    const rollBaseline = meanRoll / hardnessFactor;
    const rollContribution = meanRoll - rollBaseline;
    const rollContributionLabel = groundHardness === 'medium'
      ? '地面硬さは標準です。'
      : `${rollContribution >= 0 ? '+' : ''}${rollContribution.toFixed(1)}yd（${formatGroundHardnessLabel(groundHardness)}の影響）`;
    const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
    const meanSlopeXShift = actualModeResults.reduce((sum, result) => {
      const slopeX = result.landing?.finalX ?? 0;
      return sum + slopeX;
    }, 0) / Math.max(1, actualModeResults.length);
    const slopeEffectLabel = normalizedSlope.slopeAngle === 0
      ? 'フラットなので横ブレ影響は標準です。'
      : `傾斜 ${normalizedSlope.slopeAngle}° (${formatSlopeDirectionLabel(normalizedSlope.slopeDirection)}) により、横方向シフトは ${meanSlopeXShift >= 0 ? '+' : ''}${meanSlopeXShift.toFixed(1)}y です。`;
    const expectedCarry = selectedClub?.distance ?? simClub?.avgDistance ?? 0;
    const expectedRoll = selectedClub
      ? estimateExpectedRoll(expectedCarry, selectedClub.clubType, selectedClub.number, selectedClub.loftAngle, groundHardness)
      : simClub
        ? estimateExpectedRoll(expectedCarry, simClub.type, simClub.number, simClub.loftAngle, groundHardness)
        : 0;
    const estimatedDist = Math.round(expectedCarry + expectedRoll);
    const diff = Math.round(avg - estimatedDist);
    const avgToTargetDistance = actualModeResults.reduce((sum, result) => {
      const finalX = result.landing?.finalX ?? 0;
      const finalY = result.landing?.finalY ?? 0;
      const dx = finalX;
      const dy = finalY - estimatedDist;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / Math.max(1, actualModeResults.length);

    return {
      avg,
      std,
      success,
      estimatedDist,
      diff,
      avgToTargetDistance,
      meanRoll,
      meanLateral,
      groundRollContribution: rollContributionLabel,
      groundLateralContribution: slopeEffectLabel,
      appliedGroundHardness: groundHardness,
    };
  }, [actualModeResults, selectedClub, groundHardness, slopeAngle, slopeDirection]);

  const selectedResults = seatType === 'actual' ? actualModeResults : results;
  const selectedSummary = seatType === 'actual' ? actualModeSummary : summary;
  const selectedMonteCarlo = seatType === 'actual'
    ? buildMonteCarloResult(actualModeResults)
    : monteCarloResult;

  const targetDistance = summary?.estimatedDist ?? (seatType === 'robot'
    ? estimatedClubDistance
    : selectedClub?.distance ?? 0);
  const chartTarget = { x: 0, y: targetDistance };
  const chartAim = seatType === 'actual'
    ? undefined
    : { x: aimXOffset, y: Math.round(targetDistance * shotPowerPercent / 100) };
  const showRangeAimControls = !selectedClub?.clubType || selectedClub.clubType !== 'Putter';
  const analysisPenaltyByClubId = (() => {
    const penaltyMap: Record<string, AnalysisPenalty> = {};

    const addPenalty = (clubId: string, points: number, reason: string) => {
      const existing = penaltyMap[clubId] ?? { points: 0, reasons: [] };
      const nextReasons = existing.reasons.includes(reason)
        ? existing.reasons
        : [...existing.reasons, reason];
      penaltyMap[clubId] = {
        points: Math.min(20, existing.points + points),
        reasons: nextReasons,
      };
    };

    const alwaysVisible = () => true;

    const { tableClubs: swingTable } = buildSwingWeightAnalysis(
      clubs,
      swingWeightTarget,
      swingGoodTolerance,
      swingAdjustThreshold,
      alwaysVisible,
    );
    for (const club of swingTable) {
      const clubId = toSimClub(club).id;
      if (club.swingStatus === '調整推奨') {
        addPenalty(clubId, 8, 'スイングウェイト: 調整推奨');
      } else if (club.swingStatus !== '良好') {
        addPenalty(clubId, 4, `スイングウェイト: ${club.swingStatus}`);
      }
    }

    const { tableClubs: weightTable } = buildWeightLengthAnalysis(clubs, alwaysVisible);
    for (const club of weightTable) {
      const clubId = toSimClub(club).id;
      const weightClass = classifyWeightDeviation(club.deviation);
      if (weightClass === 'heavyOutlier' || weightClass === 'lightOutlier') {
        addPenalty(clubId, 6, '重量偏差: 外れ値');
      } else if (weightClass === 'outOfBand') {
        addPenalty(clubId, 3, '重量偏差: トレンド外');
      }
    }

    const { tableClubs: lieTable } = buildLieAngleAnalysis(
      clubs,
      userLieAngleStandards,
      alwaysVisible,
    );
    for (const club of lieTable) {
      const clubId = toSimClub(club).id;
      if (club.lieStatus === 'Adjust Recommended') {
        addPenalty(clubId, 6, 'ライ角: 調整推奨');
      } else if (club.lieStatus === 'Slightly Off') {
        addPenalty(clubId, 3, 'ライ角: ややズレ');
      }
    }

    return penaltyMap;
  })();

  const clubPersonal: import('../types/golf').ClubPersonalData | undefined =
    simClub ? resolvePersonalDataForSimClub(simClub, personalData) : undefined;
  const effectiveSuccess =
    simClub && seatType === 'personal'
      ? calculateDisplayClubSuccessRate(
          simClub,
          clubPersonal,
          personalSkillLevel,
          analysisPenaltyByClubId[simClub.id]?.points ?? 0,
        )
      : null;

  const handleSimulate = async () => {
    if (!simClub) return;
    setIsSimulating(true);
    const shotResults: ShotResult[] = [];
    const baselineResults: ShotResult[] = [];
    const simulationSeedNonce = reuseLastSeed && lastSimulationSeedNonce
      ? lastSimulationSeedNonce
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setLastSimulationSeedNonce(simulationSeedNonce);
    for (let i = 0; i < numShots; i++) {
      const context = {
        lie: gameLie,
        windDirectionDegrees: windDirection,
        // Range 画面の入力は m/s だが、内部計算は互換のため mph を利用する。
        windStrength: windSpeedMph,
        remainingDistance: simClub.avgDistance,
        targetDistance: simClub.avgDistance,
        originX: 0,
        originY: 0,
        hazards: [],
        groundHardness: groundHardness === 'soft' ? 60 : groundHardness === 'firm' ? 90 : 75,
        groundSlopeAngle: slopeAngle,
        groundSlopeDirection: slopeDirection,
      };

      let clubForSim = simClub;
      let options: any;
      if (seatType === 'robot') {
        clubForSim = { ...simClub, successRate: 100 };
        options = {
          personalData: undefined, // 個人データは使わない
          playerSkillLevel: robotSkillLevel,
          headSpeed: robotHeadSpeed,
          aimXOffset,
          shotPowerPercent,
          shotIndex: i,
          seedNonce: simulationSeedNonce,
        };
      } else {
        const analysisPenaltyPoints = analysisPenaltyByClubId[simClub.id]?.points ?? 0;
        const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(
          simClub,
          analysisPenaltyPoints,
        );
        const treatedAsWeakClub = isWeakClubByAnalysisAdjustedRate(
          simClub,
          analysisPenaltyPoints,
        );
        clubForSim = {
          ...simClub,
          successRate: adjustedBaseSuccessRate,
          isWeakClub: treatedAsWeakClub,
        };
        options = {
          personalData: clubPersonal ?? undefined,
          playerSkillLevel: personalSkillLevel,
          useStoredDistance: true,
          aimXOffset,
          shotPowerPercent,
          shotIndex: i,
          seedNonce: simulationSeedNonce,
        };
      }
      const shotResult = simulateShot(clubForSim, context, options);
      const baselineResult = simulateShot(
        clubForSim,
        {
          ...context,
          groundSlopeAngle: 0,
          groundSlopeDirection: 0,
        },
        options,
      );
      shotResults.push(shotResult);
      baselineResults.push(baselineResult);
    }
    setResults(shotResults);
    setFlatBaselineResults(baselineResults);
    // 統計情報を集計する
    const distances = shotResults.map((r) => r.landing?.totalDistance ?? r.distanceHit);
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const std = Math.sqrt(
      distances.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / distances.length
    );
    const success = shotResults.filter((r) => r.wasSuccessful).length / numShots;

    const meanRoll = shotResults.reduce((sum, r) => sum + (r.landing?.roll ?? 0), 0) / Math.max(1, shotResults.length);
    const meanLateral = shotResults.reduce((sum, r) => sum + Math.abs(r.landing?.lateralDeviation ?? 0), 0) / Math.max(1, shotResults.length);
    const meanSlopeXShift = shotResults.reduce((sum, r, index) => {
      const slopeX = r.landing?.finalX ?? 0;
      const flatX = baselineResults[index]?.landing?.finalX ?? 0;
      return sum + (slopeX - flatX);
    }, 0) / Math.max(1, shotResults.length);

    const hardnessFactor = groundHardness === 'firm' ? 1.35 : groundHardness === 'soft' ? 0.65 : 1;
    const rollBaseline = meanRoll / hardnessFactor;
    const rollContribution = meanRoll - rollBaseline;
    const rollContributionLabel = groundHardness === 'medium'
      ? '地面硬さは標準です。'
      : `${rollContribution >= 0 ? '+' : ''}${rollContribution.toFixed(1)}yd（${formatGroundHardnessLabel(groundHardness)}の影響）`;

    const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);
    const slopeDirectionLabel = formatSlopeDirectionLabel(normalizedSlope.slopeDirection);

    const slopeLabel = normalizedSlope.slopeAngle === 0
      ? 'フラット'
      : `${normalizedSlope.slopeAngle}° (${slopeDirectionLabel})`;
    const slopeEffectLabel = normalizedSlope.slopeAngle === 0
      ? 'フラットなので横ブレ影響は標準です。'
      : `傾斜 ${slopeLabel} により、フラット比の横方向シフトは ${meanSlopeXShift >= 0 ? '+' : ''}${meanSlopeXShift.toFixed(1)}y（${meanSlopeXShift >= 0 ? '右' : '左'}）です。`;

    // 目安値との差分を計算
    // プレイヤーがpersonalの場合は実測飛距離を目安値とする
    const estimatedDist = seatType === 'personal'
      ? (selectedClub?.distance ?? 0)
      : estimatedClubDistance;
    const diff = Math.round(avg - estimatedDist);
    const avgToTargetDistance =
      shotResults.reduce((sum, result) => {
        const finalX = result.landing?.finalX ?? 0;
        const finalY = result.landing?.finalY ?? (result.landing?.totalDistance ?? result.distanceHit ?? 0);
        const dx = finalX;
        const dy = finalY - estimatedDist;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / Math.max(1, shotResults.length);

    setSummary({
      avg,
      std,
      success,
      estimatedDist,
      diff,
      avgToTargetDistance,
      meanRoll,
      meanLateral,
      groundRollContribution: rollContributionLabel,
      groundLateralContribution: slopeEffectLabel,
      appliedGroundHardness: groundHardness,
    });
    setCalibrated(false);
    setIsSimulating(false);
  };


  // ...existing code...

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center py-4 px-2">
      {/* Header */}
      <div className="w-full max-w-7xl flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-green-900">レンジシミュレーター</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/personal-data"
            className="inline-flex items-center justify-center rounded bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 shadow hover:bg-emerald-200"
          >
            パーソナルデータへ
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded bg-white px-3 py-2 text-sm font-semibold text-green-900 shadow border border-green-200 hover:bg-green-50"
          >
            ホームに戻る
          </Link>
        </div>
      </div>

      <div className="w-full max-w-7xl flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="w-full lg:flex-1 flex flex-col gap-4">
          <RangeClubSelectionPanel
            clubs={clubs}
            selectableClubs={selectableClubs}
            selectedClubId={selectedClubId}
            onSelectedClubIdChange={setSelectedClubId}
            selectedClub={selectedClub}
            simClub={simClub}
            estimatedClubDistance={estimatedClubDistance}
            seatType={seatType}
            clubPersonal={clubPersonal}
            effectiveSuccess={effectiveSuccess}
          />

          {seatType !== 'actual' && (
            <ShotControlPanel
              aimXOffset={aimXOffset}
              onAimXOffsetChange={(value) => setAimXOffset(clampAimXOffset(value))}
              shotPowerPercent={shotPowerPercent}
              onShotPowerPercentChange={setShotPowerPercent}
              onShot={handleSimulate}
              shotButtonLabel={isSimulating ? `シミュレーション中...` : `ショット実行（${numShots}回）`}
              buttonDisabled={!selectedClub || isSimulating}
              inputsDisabled={!selectedClub || isSimulating}
              showAim={showRangeAimControls}
              showPower={showRangeAimControls}
            />
          )}

          <RangeSimulationResults
            results={selectedResults}
            summary={selectedSummary}
            flatBaselineResults={flatBaselineResults}
            chartTarget={chartTarget}
            chartAim={chartAim}
            monteCarloResult={selectedMonteCarlo}
            clubName={selectedClub?.name ?? 'Club'}
            skillLevelName={displayedSkillLevelName}
            numShots={seatType === 'actual' ? selectedResults.length : numShots}
            groundHardness={groundHardness}
            slopeAngle={slopeAngle}
            slopeDirection={slopeDirection}
          />
        </main>

        <aside className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-4">
          <div className="w-full bg-white rounded shadow p-4">
            <label className="block font-semibold mb-2">プレイヤー選択</label>
            <select
              className="w-full border rounded p-2 mb-2"
              value={seatType}
              onChange={e => setSeatType(e.target.value as RangeSeatType)}
            >
              <option value="personal">ユーザー</option>
              <option value="robot">ロボット</option>
              <option value="actual">実測データ</option>
            </select>

            {seatType === 'robot' && (
              <div className="flex flex-col gap-2 mt-2 bg-blue-50 rounded p-3 border border-blue-300">
                <div>
                  <label className="block font-semibold mb-1">ヘッドスピード (m/s)</label>
                  <input
                    type="number"
                    min={20}
                    max={60}
                    step={0.1}
                    value={robotHeadSpeed}
                    onChange={e => setRobotHeadSpeed(Number(e.target.value))}
                    className="w-32 border rounded p-1 mr-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">スキルレベル</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={robotSkillLevel}
                    onChange={e => setRobotSkillLevel(Number(e.target.value))}
                    className="w-40 accent-green-700"
                  />
                  <span className="ml-2">{(robotSkillLevel * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {seatType === 'personal' && (
              <div className="flex flex-col gap-2 mt-2 bg-green-50 rounded p-3 border border-green-200 text-sm text-green-900">
                <span className="text-xs text-green-700">
                  レンジではパーソナルデータ画面で保存したスキルレベルが適用されます。
                </span>
                <div className="rounded border border-green-200 bg-white/80 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      <span className="font-semibold">適用スキルレベル:</span>{' '}
                      {(personalSkillLevel * 100).toFixed(0)}% ({personalSkillLevelLabel})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

            {seatType !== 'robot' && (
            <div className="w-full bg-white rounded shadow p-4 range-use-bag-panel">
              <GolfBagPanel
                bags={bags}
                activeBagId={activeBag?.id ?? null}
                activeBagClubCount={activeBag?.clubIds.length ?? 0}
                onSelectBag={(bagId) => void setActiveBag(bagId)}
                showManagement={false}
                showImage={false}
                compact
                title="使用するバッグ"
                description="個人データと実測データではアクティブバッグに登録されたクラブを使用します。ロボットでは全クラブを使用します。"
              />
            </div>
          )}

          {seatType !== 'actual' && (
            <div className="w-full bg-white rounded shadow p-4">
              <label className="block font-semibold mb-2">試行設定</label>
              <div className="space-y-4">
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <label className="block font-semibold mb-1">試行回数</label>
                  <div className="flex gap-2 flex-wrap">
                    {SHOT_COUNTS.map((n) => (
                      <button
                        key={n}
                        className={`px-3 py-1 rounded border ${numShots === n ? 'bg-green-200 border-green-600' : 'bg-white border-green-200'} font-semibold`}
                        onClick={() => setNumShots(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label htmlFor="reuse-last-seed" className="block font-semibold text-green-900">
                        再実行時の乱数
                      </label>
                      <button
                        type="button"
                        className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700"
                        aria-label="再実行時の乱数の説明"
                      >
                        i
                        <span className="help-tooltip-text whitespace-normal">
                          {reuseLastSeed
                            ? '前回と同じ乱数で再実行します。条件が同じなら結果も再現されます。'
                            : '毎回新しい乱数で再実行します。'}
                        </span>
                      </button>
                    </div>
                    <label htmlFor="reuse-last-seed" className="inline-flex cursor-pointer items-center gap-2">
                      <span className={`text-sm font-medium ${reuseLastSeed ? 'text-green-900' : 'text-gray-500'}`}>
                        同じ乱数
                      </span>
                      <span className="relative inline-flex items-center">
                        <input
                          id="reuse-last-seed"
                          type="checkbox"
                          className="peer sr-only"
                          checked={reuseLastSeed}
                          onChange={(e) => setReuseLastSeed(e.target.checked)}
                        />
                        <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-green-600" />
                        <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                      </span>
                      <span className={`text-sm font-medium ${reuseLastSeed ? 'text-gray-500' : 'text-green-900'}`}>
                        新しい乱数
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full bg-white rounded shadow p-4 flex flex-col gap-3">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <label className="text-lg font-semibold">コースコンディション</label>
                <button
                  type="button"
                  className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700"
                  aria-label="コースコンディションの説明"
                >
                  i
                  <span className="help-tooltip-text whitespace-normal">
                    上級者向けの設定です。通常は閉じておき、必要なときに詳細を開いてください。
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center whitespace-nowrap rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
                onClick={() => setIsCourseConditionOpen((prev) => !prev)}
                aria-expanded={isCourseConditionOpen}
              >
                {isCourseConditionOpen ? '閉じる' : '設定'}
              </button>
            </div>
            {!isCourseConditionOpen && (
              <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold">ライ</p>
                    <p>{lie}</p>
                  </div>
                  <div>
                    <p className="font-semibold">風</p>
                    <p>{windDirectionSummary} / {windSpeed.toFixed(1)} m/s</p>
                  </div>
                  <div>
                    <p className="font-semibold">地面硬さ</p>
                    <p>{groundHardness === 'soft' ? '柔らかい' : groundHardness === 'firm' ? '硬い' : '普通'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">傾斜</p>
                    <p>{slopeAngle === 0 ? 'フラット' : `傾斜 ${slopeAngle}° (${normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection}°)`}</p>
                  </div>
                </div>
              </div>
            )}
            {isCourseConditionOpen && (
              <>
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <label className="block font-semibold mb-1 text-green-900">ライ</label>
                  <select
                    className="w-full border rounded p-2"
                    value={lie}
                    onChange={(e) => setLie(e.target.value)}
                  >
                {LIE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-green-900">
                ライペナルティ: {getLiePenaltyInfo(lie, simClub?.type ?? 'Iron')}
              </p>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="font-semibold">風向・風速</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    onClick={handleResetWind}
                  >
                    風をリセット
                  </button>
                  <button
                    type="button"
                    className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
                    onClick={() => setIsWindControlOpen((prev) => !prev)}
                    aria-expanded={isWindControlOpen}
                    aria-controls="wind-direction-dial-panel"
                  >
                    {isWindControlOpen ? '設定を閉じる' : '設定を開く'}
                  </button>
                </div>
              </div>
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                <span className="mr-3 font-semibold">風向: {windDirectionSummary}</span>
                <span className="font-semibold">風速: {windSpeed.toFixed(1)} m/s</span>
              </div>
              {isWindControlOpen && (
                <div id="wind-direction-dial-panel" className="mt-2">
                  <WindDirectionDial
                    windDirection={windDirection}
                    windSpeed={windSpeed}
                    onDirectionChange={(newDirection) => setWindDirection(normalizeWindDirection(newDirection))}
                    onSpeedChange={(newSpeed) => setWindSpeed(normalizeWindSpeedMps(newSpeed))}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 rounded border border-green-200 bg-green-50 p-3">
              <div className="mb-2">
                <label className="font-semibold">地面条件</label>
              </div>
              <div className="grid gap-3">
                <div className="rounded border border-emerald-200 bg-white p-3">
                  <p className="text-xs font-semibold text-emerald-900 mb-2">地面硬さ</p>
                  <label className="space-y-1 text-xs text-emerald-800">
                    <select
                      value={groundHardness}
                      onChange={(event) => setGroundHardness(event.target.value as GroundHardness)}
                      className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                    >
                      <option value="soft">柔らかい</option>
                      <option value="medium">普通</option>
                      <option value="firm">硬い</option>
                    </select>
                  </label>
                </div>
                <div className="rounded border border-emerald-200 bg-white p-3">
                  <p className="text-xs font-semibold text-emerald-900 mb-2">傾斜</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-emerald-800">
                      上り方向
                      <div className="grid grid-cols-3 gap-1 text-center place-items-center">
                        <div />
                        <button
                          type="button"
                          onClick={() => setSlopeDirection(normalizeWindDirection(0))}
                          className={[
                            'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                            normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection === 0
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          前
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => setSlopeDirection(normalizeWindDirection(270))}
                          className={[
                            'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                            normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection === 270
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          左
                        </button>
                        <div className="h-10 w-10" />
                        <button
                          type="button"
                          onClick={() => setSlopeDirection(normalizeWindDirection(90))}
                          className={[
                            'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                            normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection === 90
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          右
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => setSlopeDirection(normalizeWindDirection(180))}
                          className={[
                            'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                            normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection === 180
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                          ].join(' ')}
                        >
                          後
                        </button>
                        <div />
                      </div>
                      <div className="text-right text-[11px] text-emerald-700">
                        {normalizeSlopeForDisplay(slopeAngle, slopeDirection).slopeDirection}°
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={359}
                        step={1}
                        value={slopeDirection}
                        onChange={(event) => setSlopeDirection(normalizeWindDirection(Number(event.target.value)))}
                        className="w-full cursor-pointer"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-emerald-800">
                      傾斜角度
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={slopeAngle}
                        onChange={(event) => setSlopeAngle(Math.max(0, Number(event.target.value)))}
                        className="w-full cursor-pointer"
                      />
                      <div className="text-right text-[11px] text-emerald-700">
                        {slopeAngle === 0 ? 'フラット' : `傾斜量 ${slopeAngle}°`}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-emerald-800">
                {formatSlopeEffectGuide(slopeAngle, slopeDirection)}
              </p>
            </div>
          </>
        )}
          </div>
        </aside>
      </div>
      {/* オートキャリブレーション（個人データ更新）削除済み */}
    </div>
  );
}

// --- Route Integration ---
// Add to your router:
// import RangeScreen from './pages/RangeScreen';
// <Route path="/range" element={<RangeScreen />} />
