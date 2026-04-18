import ShotDispersionChart from './ShotDispersionChart';
import type { MonteCarloResult } from '../utils/landingPosition';
import type { ShotResult } from '../types/game';
import type { GroundHardness } from '../utils/rangeUtils';
import { qualityLabel } from '../utils/rangeUtils';
import { useMemo } from 'react';

type RangeSimulationResultsProps = {
  results: ShotResult[];
  summary: {
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
  } | null;
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
  seatType?: string;
};

const qualityStatusColor = (shotQuality: string) => {
  if (shotQuality === 'excellent') return 'text-blue-700';
  if (shotQuality === 'good') return 'text-green-700';
  if (shotQuality === 'average') return 'text-amber-600';
  if (shotQuality === 'misshot') return 'text-fuchsia-600';
  if (shotQuality === 'poor') return 'text-pink-600';
  return 'text-gray-700';
};

function formatGroundHardnessImpact(groundHardness: GroundHardness, roll: number | undefined): string {
  if (roll == null || !Number.isFinite(roll)) return '-';

  const hardnessValue = groundHardness === 'firm' ? 90 : groundHardness === 'soft' ? 60 : 75;
  const currentFactor = 0.8 + (hardnessValue / 100) * 0.4;
  const mediumFactor = 0.8 + (75 / 100) * 0.4;
  const baseline = roll * (mediumFactor / currentFactor);
  const delta = roll - baseline;
  const deltaLabel = delta === 0 ? '0.0yd' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}yd`;

  return `Roll ${deltaLabel}`;
}

function formatSlopeImpact(
  landing: ShotResult['landing'] | undefined,
  baselineLanding: ShotResult['landing'] | undefined,
): string {
  if (!landing || !baselineLanding) return '-';

  const carryDiff = (landing.carry ?? 0) - (baselineLanding.carry ?? 0);
  const rollDiff = (landing.roll ?? 0) - (baselineLanding.roll ?? 0);
  const finalXDiff = (landing.finalX ?? 0) - (baselineLanding.finalX ?? 0);
  const fmt = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}yd`;

  return `C ${fmt(carryDiff)} / R ${fmt(rollDiff)} / X ${fmt(finalXDiff)}`;
}

export function RangeSimulationResults({
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
  seatType,
}: RangeSimulationResultsProps) {
  // Memoize calculations to improve performance
  const memoizedResults = useMemo(() => {
    return results.map((r, i) => {
      const finalX = r.landing?.finalX ?? 0;
      const finalY = r.landing?.finalY ?? 0;
      const targetY = chartTarget.y;
      const distanceToTarget = targetY > 0
        ? Math.sqrt(finalX * finalX + Math.pow(finalY - targetY, 2))
        : null;
      
      return {
        ...r,
        distanceToTarget,
        groundImpact: summary ? formatGroundHardnessImpact(summary.appliedGroundHardness, r.landing?.roll) : '-',
        slopeImpact: formatSlopeImpact(r.landing, flatBaselineResults[i]?.landing)
      };
    });
  }, [results, chartTarget.y, summary?.appliedGroundHardness, flatBaselineResults]);

  return (
    <>
      {results.length > 0 && summary && (
        <div className="w-full bg-white rounded shadow p-4 mb-4">
          <div className="mb-2 flex items-center gap-4 text-sm">
            <span className="font-bold text-green-900 whitespace-nowrap">セッション結果:</span>
            <div className="flex flex-wrap items-center gap-2">
              <span>平均飛距離: {summary.avg.toFixed(1)} yd</span>
              <span>目標との差:<span className={summary.diff < 0 ? 'text-red-600' : 'text-blue-600'}> {summary.diff > 0 ? '+' : ''}{summary.diff.toFixed(1)} yd</span></span>
              <span>成功率: {(summary.success * 100).toFixed(1)}%</span>
              <span>目標までの平均距離: {(summary.avgToTargetDistance ?? 0).toFixed(1)} yd</span>
            </div>
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-1 py-0.5">#</th>
                  <th className="px-1 py-0.5">飛距離</th>
                  <th className="px-1 py-0.5">キャリー</th>
                  <th className="px-1 py-0.5">ラン</th>
                  <th className="px-1 py-0.5">左右偏差</th>
                  <th className="px-1 py-0.5">目標までの距離</th>
                  {seatType !== 'actual' && <th className="px-1 py-0.5">地面影響</th>}
                  {seatType !== 'actual' && <th className="px-1 py-0.5">傾斜影響</th>}
                  <th className="px-1 py-0.5">着地点 X</th>
                  <th className="px-1 py-0.5">着地点 Y</th>
                  <th className="px-1 py-0.5">ショット品質</th>
                </tr>
              </thead>
              <tbody>
                {memoizedResults.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="px-1 py-0.5 text-center">{(r.landing?.totalDistance ?? r.distanceHit).toFixed(1)}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.carry?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.roll?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.lateralDeviation?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">
                      {r.distanceToTarget?.toFixed(1) ?? '-'}
                    </td>
                    {seatType !== 'actual' && <td className="px-1 py-0.5 text-center">{r.groundImpact}</td>}
                    {seatType !== 'actual' && <td className="px-1 py-0.5 text-center">{r.slopeImpact}</td>}
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
