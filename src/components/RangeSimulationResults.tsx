import ShotDispersionChart from './ShotDispersionChart';
import type { MonteCarloResult } from '../utils/landingPosition';
import type { ShotResult } from '../types/game';
import type { GroundHardness } from '../utils/rangeUtils';
import { qualityLabel } from '../utils/rangeUtils';

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
  const deltaLabel = delta === 0 ? '0.0y' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}y`;

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
  const fmt = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}y`;

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
}: RangeSimulationResultsProps) {
  return (
    <>
      {results.length > 0 && summary && (
        <div className="w-full bg-white rounded shadow p-4 mb-4">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-green-900">Session Results:</span>
            <span>Average: {summary.avg.toFixed(1)} y</span>
            <span>Success Rate: {(summary.success * 100).toFixed(1)}%</span>
            <span>Avg Distance to Target: {(summary.avgToTargetDistance ?? 0).toFixed(1)} y</span>
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
              <span className="font-semibold">Comparison with Estimated Distance:</span>
              <span>Estimated: {summary.estimatedDist} y / Actual Average: {summary.avg.toFixed(1)} y</span>
              <span className={summary.diff > 0 ? 'text-red-600 font-bold' : summary.diff < 0 ? 'text-blue-600 font-bold' : ''}>
                {summary.diff > 0 ? ` (+${summary.diff}y)` : summary.diff < 0 ? ` (${summary.diff}y)` : ' (Match)'}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-1 py-0.5">#</th>
                  <th className="px-1 py-0.5">Distance</th>
                  <th className="px-1 py-0.5">Carry</th>
                  <th className="px-1 py-0.5">Roll</th>
                  <th className="px-1 py-0.5">Lateral</th>
                  <th className="px-1 py-0.5">Distance to Target</th>
                  <th className="px-1 py-0.5">Ground Impact</th>
                  <th className="px-1 py-0.5">Slope Impact</th>
                  <th className="px-1 py-0.5">Landing X</th>
                  <th className="px-1 py-0.5">Landing Y</th>
                  <th className="px-1 py-0.5">Shot Quality</th>
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
                    <td className="px-1 py-0.5 text-center">
                      {(() => {
                        const finalX = r.landing?.finalX ?? 0;
                        const finalY = r.landing?.finalY ?? 0;
                        const targetY = chartTarget.y;
                        return targetY > 0
                          ? Math.sqrt(finalX * finalX + Math.pow(finalY - targetY, 2)).toFixed(1)
                          : '-';
                      })()}
                    </td>
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
