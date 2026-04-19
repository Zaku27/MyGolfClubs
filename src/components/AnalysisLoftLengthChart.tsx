import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import type { ClubCategory } from '../utils/analysisUtils';
import type { LoftLengthTooltipState } from './analysisTypes';
import { LoftLengthLegend } from './AnalysisLegends';
import { AnalysisChartWrapper } from './AnalysisChartWrapper';

type LoftLengthChartClub = LoftLengthTooltipState['club'];

type AnalysisLoftLengthChartProps = {
  hasAnyLoftLengthData: boolean;
  hasLoftLengthData: boolean;
  loftLengthChartContainerRef: RefObject<HTMLDivElement | null>;
  loftLengthChartSize: { width: number; height: number };
  loftLengthTrendLines: Array<{ category: ClubCategory; points: string }>;
  lengthTicks: number[];
  loftTicks: number[];
  mapLoftLengthX: (value: number) => number;
  mapLoftLengthY: (value: number) => number;
  loftLengthClubs: LoftLengthChartClub[];
  getCategoryColor: (category: ClubCategory) => string;
  setLoftLengthTooltip: (tooltip: LoftLengthTooltipState | null) => void;
  loftLengthTooltip: LoftLengthTooltipState | null;
  loftLengthTooltipRef: RefObject<HTMLDivElement | null>;
  loftLengthTooltipPos: { left?: number; top?: number } | null;
  LOFT_LENGTH_CHART_PADDING: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

const formatAdjustment = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;
const formatLabel = (clubType: string, number: string) => {
  if (clubType === 'Driver') return 'Driver';
  if (clubType === 'Wood') return `${number.replace(/W$/i, '')}W`;
  if (clubType === 'Hybrid') return `${number.replace(/H$/i, '')}H`;
  if (clubType === 'Iron') return `${number}I`;
  return number || clubType;
};


export const AnalysisLoftLengthChart: React.FC<AnalysisLoftLengthChartProps> = ({
  hasAnyLoftLengthData,
  hasLoftLengthData,
  loftLengthChartContainerRef,
  loftLengthChartSize,
  loftLengthTrendLines,
  lengthTicks,
  loftTicks,
  mapLoftLengthX,
  mapLoftLengthY,
  loftLengthClubs,
  getCategoryColor,
  setLoftLengthTooltip,
  loftLengthTooltip,
  loftLengthTooltipRef,
  loftLengthTooltipPos,
  LOFT_LENGTH_CHART_PADDING,
}) => {

  if (!hasAnyLoftLengthData) {
    return <div className="analysis-empty">クラブがまだ追加されていません</div>;
  }

  if (!hasLoftLengthData) {
    return <div className="analysis-empty">表示するクラブを選択してください</div>;
  }

  return (
    <div className="analysis-card chart-card loft-length-frame">
      <LoftLengthLegend />
      <AnalysisChartWrapper
        containerRef={loftLengthChartContainerRef}
        chartSize={loftLengthChartSize}
        onMouseLeave={() => setLoftLengthTooltip(null)}
        className="loft-length-analysis-chart"
        ariaLabel="ロフト角とクラブ長さの散布図"
        tooltip={
          loftLengthTooltip && (
            <div
              ref={loftLengthTooltipRef}
              className="chart-tooltip"
              style={{ left: loftLengthTooltipPos?.left, top: loftLengthTooltipPos?.top }}
            >
              <div className="chart-tooltip-title">{loftLengthTooltip.club.name}</div>
              <div className="chart-tooltip-list">
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">クラブ種別</span>
                  <span className="chart-tooltip-value">
                    {getClubTypeDisplay(loftLengthTooltip.club.clubType, loftLengthTooltip.club.number)}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">長さ</span>
                  <span className="chart-tooltip-value">{loftLengthTooltip.club.length.toFixed(2)} in</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">ロフト</span>
                  <span className="chart-tooltip-value">{loftLengthTooltip.club.loftAngle.toFixed(1)}°</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">基準ロフト</span>
                  <span className="chart-tooltip-value">{loftLengthTooltip.club.expectedLoft.toFixed(1)}°</span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">推奨調整</span>
                  <span className="chart-tooltip-value">{formatAdjustment(loftLengthTooltip.club.recommendedLoftAdjustment)}</span>
                </div>
              </div>
            </div>
          )
        }
      >
        <rect
          x={LOFT_LENGTH_CHART_PADDING.left}
          y={LOFT_LENGTH_CHART_PADDING.top}
          width={loftLengthChartSize.width - LOFT_LENGTH_CHART_PADDING.left - LOFT_LENGTH_CHART_PADDING.right}
          height={loftLengthChartSize.height - LOFT_LENGTH_CHART_PADDING.top - LOFT_LENGTH_CHART_PADDING.bottom}
          fill="#ffffff"
          rx="18"
        />

        {loftTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={LOFT_LENGTH_CHART_PADDING.left}
              x2={loftLengthChartSize.width - LOFT_LENGTH_CHART_PADDING.right}
              y1={mapLoftLengthY(tick)}
              y2={mapLoftLengthY(tick)}
              className="chart-grid chart-grid-animated"
            />
            <text
              x={LOFT_LENGTH_CHART_PADDING.left - 12}
              y={mapLoftLengthY(tick) + 4}
              textAnchor="end"
              className="chart-axis-label"
            >
              {tick}°
            </text>
          </g>
        ))}

        {lengthTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={mapLoftLengthX(tick)}
              x2={mapLoftLengthX(tick)}
              y1={LOFT_LENGTH_CHART_PADDING.top}
              y2={loftLengthChartSize.height - LOFT_LENGTH_CHART_PADDING.bottom}
              className="chart-grid chart-grid-animated"
            />
            <text
              x={mapLoftLengthX(tick)}
              y={loftLengthChartSize.height - 24}
              textAnchor="middle"
              className="chart-axis-label"
            >
              {tick}
            </text>
          </g>
        ))}

        {loftLengthTrendLines.map((line) => (
          <polyline
            key={line.category}
            points={line.points}
            fill="none"
            stroke={getCategoryColor(line.category)}
            strokeWidth="2.5"
            className="chart-standard-line"
          />
        ))}

        {loftLengthClubs.map((club, index) => (
          <g key={getAnalysisClubKey(club)} style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}>
            <circle
              cx={mapLoftLengthX(club.length)}
              cy={mapLoftLengthY(club.loftAngle)}
              r="8"
              fill="#ffffff"
              stroke={getCategoryColor(club.category)}
              strokeWidth="3"
              className="chart-point-circle"
              onMouseEnter={() => {
                setLoftLengthTooltip({
                  x: mapLoftLengthX(club.length),
                  y: mapLoftLengthY(club.loftAngle),
                  club,
                });
              }}
              onClick={() => {
                setLoftLengthTooltip({
                  x: mapLoftLengthX(club.length),
                  y: mapLoftLengthY(club.loftAngle),
                  club,
                });
              }}
            />
            <text
              x={mapLoftLengthX(club.length) + 9}
              y={mapLoftLengthY(club.loftAngle) - 10}
              className="chart-point-label"
            >
              {formatLabel(club.clubType, club.number)}
            </text>
          </g>
        ))}

        <text
          x={loftLengthChartSize.width / 2}
          y={loftLengthChartSize.height - 2}
          textAnchor="middle"
          className="chart-title-label"
        >
          クラブ長（inch）
        </text>
        <text
          x="10"
          y={loftLengthChartSize.height / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${loftLengthChartSize.height / 2})`}
          className="chart-title-label"
        >
          静的ロフト角（°）
        </text>
      </AnalysisChartWrapper>

    </div>
  );
};
