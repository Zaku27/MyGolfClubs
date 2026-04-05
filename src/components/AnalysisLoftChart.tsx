import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
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
}) => {
  if (!hasLoftData) {
    return <div className="analysis-empty">表示するクラブを選択してください</div>;
  }

  return (
    <div className="analysis-card chart-card">
      <LoftLegend />
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
                  <span className="chart-tooltip-value">{loftTooltip.club.estimatedDistance.toFixed(0)} y</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">実測</span>
                  <span className="chart-tooltip-value">
                    {loftTooltip.club.actualDistance > 0 ? `${loftTooltip.club.actualDistance.toFixed(0)} y` : '-'}
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
              <title>{`${club.name} | ロフト ${club.loftAngle}° | 推定 ${club.estimatedDistance.toFixed(0)}y`}</title>
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
    </div>
  );
};
