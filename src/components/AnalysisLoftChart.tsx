import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { isDistanceGapNarrow, isDistanceGapWide } from '../utils/analysisUtils';
import { LoftLegend } from './AnalysisLegends';
import { AnalysisChartWrapper } from './AnalysisChartWrapper';
import type { LoftTooltipState } from './analysisTypes';
import type { ClubCategory } from '../utils/analysisUtils';

type LoftChartClub = LoftTooltipState['club'];

type AnalysisLoftChartProps = {
  hasLoftData: boolean;
  loftChartContainerRef: RefObject<HTMLDivElement | null>;
  loftChartSize: { width: number; height: number };
  distanceTicks: number[];
  loftTicks: number[];
  actualLinePoints: string | null;
  chartClubs: LoftChartClub[];
  mapLoftX: (value: number) => number;
  mapLoftY: (value: number) => number;
  loftTooltip: LoftTooltipState | null;
  loftTooltipRef: RefObject<HTMLDivElement | null>;
  loftTooltipPos: { left?: number; top?: number } | null;
  setLoftTooltip: (tooltip: LoftTooltipState | null) => void;
  getCategoryColor: (category: ClubCategory) => string;
  LOFT_CHART_PADDING: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  CHART_WIDTH: number;
  headSpeed: number;
  onHeadSpeedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const formatGapClubSummary = (club: LoftChartClub): string => {
  const clubLabel = club.clubType === 'Wedge'
    ? `Wedge ${club.number}`
    : getClubTypeDisplay(club.clubType, club.number);
  const targetLabel = club.projectedGapTargetClubType
    ? club.projectedGapTargetClubType === 'Wedge'
      ? `Wedge ${club.projectedGapTargetNumber ?? ''}`.trim()
      : getClubTypeDisplay(club.projectedGapTargetClubType, club.projectedGapTargetNumber ?? '')
    : '比較対象なし';
  const gapLabel = club.projectedDistanceGap == null ? '対象外' : `${club.projectedDistanceGap}yd`;
  return `${clubLabel} → ${targetLabel} (${gapLabel})`;
};

export const AnalysisLoftChart: React.FC<AnalysisLoftChartProps> = ({
  hasLoftData,
  loftChartContainerRef,
  loftChartSize,
  distanceTicks,
  loftTicks,
  actualLinePoints,
  chartClubs,
  mapLoftX,
  mapLoftY,
  loftTooltip,
  loftTooltipRef,
  loftTooltipPos,
  setLoftTooltip,
  getCategoryColor,
  LOFT_CHART_PADDING,
  CHART_WIDTH,
  headSpeed,
  onHeadSpeedChange,
}) => {
  const evaluatedGapClubs = chartClubs.filter((club) => club.projectedDistanceGap != null);
  const narrowGapClubs = evaluatedGapClubs.filter((club) => isDistanceGapNarrow(club.projectedDistanceGap));
  const wideGapClubs = evaluatedGapClubs.filter((club) => isDistanceGapWide(club.projectedDistanceGap));
  const narrowGapSummary = narrowGapClubs.map(formatGapClubSummary).join(' / ');
  const wideGapSummary = wideGapClubs.map(formatGapClubSummary).join(' / ');

  const gappingAlert =
    evaluatedGapClubs.length === 0
      ? '距離ギャップ評価対象クラブがありません（ドライバーのみ、または比較対象なし）。'
      : narrowGapClubs.length > 0 && wideGapClubs.length > 0
        ? '距離ギャップに注意が必要な組み合わせがあります。クラブ選択またはロフト設定の見直しを推奨します。'
      : narrowGapClubs.length > 0
        ? '距離ギャップが狭い可能性のある組み合わせがあります（8yd未満）。クラブ選択またはロフト設定の見直しを推奨します。'
        : wideGapClubs.length > 0
          ? '距離ギャップが広い可能性のある組み合わせがあります（18yd超）。クラブ選択またはロフト設定の見直しを推奨します。'
          : '距離ギャップは全体として適正範囲内です（8〜18yd）。';
  const gappingClass = narrowGapClubs.length > 0 || wideGapClubs.length > 0 ? 'alert' : 'ok';

  if (!hasLoftData) {
    return <div className="analysis-empty">表示するクラブを選択してください</div>;
  }

  return (
    <div className="analysis-card chart-card">
      <div className="chart-card-header">
        <LoftLegend />
        <label className="headspeed-control">
          <span>ヘッドスピード</span>
          <div className="headspeed-input-wrap">
            <input
              type="number"
              min="30"
              max="60"
              step="0.1"
              value={headSpeed}
              onChange={onHeadSpeedChange}
              className="analysis-input headspeed-input"
            />
            <em>m/s</em>
          </div>
          <span className="headspeed-note">※推定飛距離の算出用パラメータ</span>
        </label>
      </div>
      <AnalysisChartWrapper
        containerRef={loftChartContainerRef}
        chartSize={loftChartSize}
        onMouseLeave={() => setLoftTooltip(null)}
        className="loft-analysis-chart"
        ariaLabel="ロフトと飛距離の散布図"
        tooltip={
          loftTooltip && (
            <div
              ref={loftTooltipRef}
              className="chart-tooltip"
              style={{
                left: loftTooltipPos?.left,
                top: loftTooltipPos?.top,
              }}
            >
              <div className="chart-tooltip-title">{loftTooltip.club.name}</div>
              <div className="chart-tooltip-list">
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">クラブ種別</span>
                  <span className="chart-tooltip-value">
                    {getClubTypeDisplay(loftTooltip.club.clubType, loftTooltip.club.number)}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">ロフト</span>
                  <span className="chart-tooltip-value">{loftTooltip.club.loftAngle.toFixed(1)}°</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">推定</span>
                  <span className="chart-tooltip-value">{loftTooltip.club.estimatedDistance.toFixed(1)} y</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">実測</span>
                  <span className="chart-tooltip-value">
                    {loftTooltip.club.actualDistance > 0 ? `${loftTooltip.club.actualDistance.toFixed(1)} y` : '-'}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">選択点</span>
                  <span className="chart-tooltip-value">
                    {loftTooltip.pointType === 'estimated' ? '推定ポイント' : '実測ポイント'}
                  </span>
                </div>
              </div>
            </div>
          )
        }
      >
        <rect
          x={LOFT_CHART_PADDING.left}
          y={LOFT_CHART_PADDING.top}
          width={loftChartSize.width - LOFT_CHART_PADDING.left - LOFT_CHART_PADDING.right}
          height={loftChartSize.height - LOFT_CHART_PADDING.top - LOFT_CHART_PADDING.bottom}
          fill="#ffffff"
          rx="18"
        />

        {distanceTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={LOFT_CHART_PADDING.left}
              x2={CHART_WIDTH - LOFT_CHART_PADDING.right}
              y1={mapLoftY(tick)}
              y2={mapLoftY(tick)}
              className="chart-grid chart-grid-animated"
            />
            <text x={LOFT_CHART_PADDING.left - 12} y={mapLoftY(tick) + 4} textAnchor="end" className="chart-axis-label">
              {tick}
            </text>
          </g>
        ))}

        {loftTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={mapLoftX(tick)}
              x2={mapLoftX(tick)}
              y1={LOFT_CHART_PADDING.top}
              y2={loftChartSize.height - LOFT_CHART_PADDING.bottom}
              className="chart-grid chart-grid-animated"
            />
            <text x={mapLoftX(tick)} y={loftChartSize.height - 24} textAnchor="middle" className="chart-axis-label">
              {tick}°
            </text>
          </g>
        ))}

        {actualLinePoints && (
          <polyline
            points={actualLinePoints}
            fill="none"
            stroke="#ff8f00"
            strokeWidth="2.5"
            className="chart-line-animated"
          />
        )}

        {chartClubs.map((club, index) => (
          <g
            key={getAnalysisClubKey(club)}
            style={{ '--point-delay': `${index * 50}ms` } as CSSProperties}
          >
            <circle
              cx={mapLoftX(club.loftAngle)}
              cy={mapLoftY(club.estimatedDistance)}
              r="8.5"
              fill="#ffffff"
              stroke={getCategoryColor(club.category)}
              strokeWidth="3"
              className="chart-point-circle"
              onMouseEnter={() =>
                setLoftTooltip({
                  x: mapLoftX(club.loftAngle),
                  y: mapLoftY(club.estimatedDistance),
                  club,
                  pointType: 'estimated',
                })
              }
              onClick={() =>
                setLoftTooltip({
                  x: mapLoftX(club.loftAngle),
                  y: mapLoftY(club.estimatedDistance),
                  club,
                  pointType: 'estimated',
                })
              }
            >
              <title>{`${club.name} | ロフト ${club.loftAngle}° | 推定 ${club.estimatedDistance.toFixed(1)}y`}</title>
            </circle>
            {club.actualDistance > 0 && (
              <circle
                cx={mapLoftX(club.loftAngle)}
                cy={mapLoftY(club.actualDistance)}
                r="8.5"
                fill={getCategoryColor(club.category)}
                stroke="#ffffff"
                strokeWidth="2"
                className="chart-point-circle"
                onMouseEnter={() =>
                  setLoftTooltip({
                    x: mapLoftX(club.loftAngle),
                    y: mapLoftY(club.actualDistance),
                    club,
                    pointType: 'actual',
                  })
                }
                onClick={() =>
                  setLoftTooltip({
                    x: mapLoftX(club.loftAngle),
                    y: mapLoftY(club.actualDistance),
                    club,
                    pointType: 'actual',
                  })
                }
              >
                <title>{`${club.name} | ロフト ${club.loftAngle}° | 実測 ${club.actualDistance.toFixed(0)}y`}</title>
              </circle>
            )}
            <text
              x={mapLoftX(club.loftAngle) + 10}
              y={mapLoftY(club.estimatedDistance) - 10}
              className="chart-point-label"
            >
              {club.name}
            </text>
          </g>
        ))}

        <text
          x={loftChartSize.width / 2}
          y={loftChartSize.height - 2}
          textAnchor="middle"
          className="chart-title-label"
        >
          ロフト角（度）
        </text>
        <text
          x="10"
          y={loftChartSize.height / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${loftChartSize.height / 2})`}
          className="chart-title-label"
        >
          飛距離（ヤード）
        </text>
      </AnalysisChartWrapper>

      <div className="loft-adjust-panel">
        <div className={`gapping-alert ${gappingClass}`}>
          <div className="gapping-alert-title">
            {gappingAlert}
            <span className="gapping-alert-tooltip" aria-label="距離ギャップの説明">
              i
              <span className="gapping-alert-tooltip-text">
                距離ギャップはロフト差に基づく飛距離差の目安です。目安を確認し、クラブ選択やロフト設定を見直してください。
              </span>
            </span>
          </div>
          {narrowGapClubs.length > 0 && (
            <div className="gapping-alert-detail">狭い候補（該当組み合わせ {narrowGapClubs.length}件）: {narrowGapSummary}</div>
          )}
          {wideGapClubs.length > 0 && (
            <div className="gapping-alert-detail">広い候補（該当組み合わせ {wideGapClubs.length}件）: {wideGapSummary}</div>
          )}
        </div>
      </div>
    </div>
  );
};
