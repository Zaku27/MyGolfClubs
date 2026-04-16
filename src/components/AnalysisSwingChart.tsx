import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { getSwingBarColor, getSwingClubLabel, numericToSwingWeightLabel } from '../utils/analysisUtils';
import { SWING_PADDING } from './analysisConfig';
import type { SwingTooltipState } from './analysisTypes';
import { SwingLegend } from './AnalysisLegends';

type SwingChartClub = SwingTooltipState['club'];

type AnalysisSwingChartProps = {
  hasAnySwingWeightData: boolean;
  hasSwingWeightData: boolean;
  swingGoodTolerance?: number;
  swingWeightTarget?: number;
  swingChartContainerRef: RefObject<HTMLDivElement | null>;
  swingChartSize: { width: number; height: number };
  swingTicks: number[];
  mapSwingY: (value: number) => number;
  mapSwingX: (index: number) => number;
  swingBarWidth: number;
  swingChartMin: number;
  swingWeightClubs: SwingChartClub[];
  swingAdjustThreshold?: number;
  swingTooltip: SwingTooltipState | null;
  swingTooltipRef: RefObject<HTMLDivElement | null>;
  swingTooltipPos: { left: number; top: number } | null;
  setSwingTooltip: (tooltip: SwingTooltipState | null) => void;
};

export const AnalysisSwingChart = ({
  hasAnySwingWeightData,
  hasSwingWeightData,
  swingGoodTolerance,
  swingWeightTarget,
  swingChartContainerRef,
  swingChartSize,
  swingTicks,
  mapSwingY,
  mapSwingX,
  swingBarWidth,
  swingChartMin,
  swingWeightClubs,
  swingAdjustThreshold,
  swingTooltip,
  swingTooltipRef,
  swingTooltipPos,
  setSwingTooltip,
}: AnalysisSwingChartProps) => (
  <div className="analysis-card chart-card swing-weight-frame">
    {hasAnySwingWeightData ? (
      <>
        <SwingLegend swingGoodTolerance={swingGoodTolerance ?? 2} />
        <div className="swing-chart-toolbar">
          <span className="swing-target-badge">
            <i className="legend-standard-line" />
            {`目安ターゲット: ${numericToSwingWeightLabel(swingWeightTarget ?? 20)}`}
          </span>
        </div>
        {hasSwingWeightData ? (
          <div
            className="chart-scroll interactive-chart-scroll"
            ref={swingChartContainerRef}
            onMouseLeave={() => setSwingTooltip(null)}
          >
            <svg
              viewBox={`0 0 ${swingChartSize.width} ${swingChartSize.height}`}
              className="analysis-chart swing-analysis-chart"
              role="img"
              aria-label="スイングウェイト分布の棒グラフ"
            >
            <rect
              x={SWING_PADDING.left}
              y={SWING_PADDING.top}
              width={swingChartSize.width - SWING_PADDING.left - SWING_PADDING.right}
              height={swingChartSize.height - SWING_PADDING.top - SWING_PADDING.bottom}
              fill="#ffffff"
              rx="18"
            />

            {swingTicks.map((tick) => (
              <g key={`sw-y-${tick}`}>
                <line
                  x1={SWING_PADDING.left}
                  x2={swingChartSize.width - SWING_PADDING.right}
                  y1={mapSwingY(tick)}
                  y2={mapSwingY(tick)}
                  className="chart-grid chart-grid-animated"
                />
                <text
                  x={SWING_PADDING.left - 8}
                  y={mapSwingY(tick) + 4}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {numericToSwingWeightLabel(tick)}
                </text>
              </g>
            ))}

            <line
              x1={SWING_PADDING.left}
              x2={swingChartSize.width - SWING_PADDING.right}
              y1={mapSwingY(swingWeightTarget ?? 20)}
              y2={mapSwingY(swingWeightTarget ?? 20)}
              stroke="#2e7d32"
              strokeWidth="2"
              strokeDasharray="8 4"
              className="chart-standard-line"
            />

            {swingWeightClubs.map((club, index) => {
              const cx = mapSwingX(index);
              const bw = swingBarWidth;
              const barBottom = mapSwingY(swingChartMin);
              const barTop = mapSwingY(club.swingWeightNumeric);
              const barHeight = Math.max(0, barBottom - barTop);
              const color = getSwingBarColor(
                club.category,
                club.swingDeviation,
                swingGoodTolerance ?? 2,
                swingAdjustThreshold ?? 5,
              );
              const clubLabel = getSwingClubLabel(club);

              return (
                <g key={`swing-bar-${getAnalysisClubKey(club)}`}>
                  <rect
                    x={cx - bw / 2}
                    y={barTop}
                    width={bw}
                    height={barHeight}
                    fill={color.fill}
                    stroke={color.stroke}
                    strokeWidth={color.strokeWidth}
                    rx="5"
                    className="swing-weight-bar"
                    style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                    onMouseEnter={() => setSwingTooltip({ x: cx, y: barTop, club })}
                    onClick={() => setSwingTooltip({ x: cx, y: barTop, club })}
                  >
                    <title>{`${clubLabel} | ${club.swingWeight || '-'} | 目安偏差 ${(club.swingDeviation >= 0 ? '+' : '') + club.swingDeviation.toFixed(1)}`}</title>
                  </rect>
                  <g transform={`translate(${cx}, ${swingChartSize.height - SWING_PADDING.bottom + 20})`}>
                    <text textAnchor="end" transform="rotate(-40)" className="chart-axis-label">
                      {clubLabel}
                    </text>
                  </g>
                </g>
              );
            })}

            <text
              x={swingChartSize.width / 2}
              y={swingChartSize.height - 2}
              textAnchor="middle"
              className="chart-title-label"
            >
              クラブ
            </text>
            <text
              x="20"
              y={swingChartSize.height / 2}
              textAnchor="middle"
              transform={`rotate(-90 20 ${swingChartSize.height / 2})`}
              className="chart-title-label"
            >
              スイングウェイト数値
            </text>
            </svg>
            {swingTooltip && (
              <div
                ref={swingTooltipRef}
                className="chart-tooltip"
                style={{
                  left: swingTooltipPos?.left,
                  top: swingTooltipPos?.top,
                }}
              >
                <div className="chart-tooltip-title">{swingTooltip.club.name || getSwingClubLabel(swingTooltip.club)}</div>
                <div className="chart-tooltip-list">
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">クラブ種別</span>
                    <span className="chart-tooltip-value">{getClubTypeDisplay(swingTooltip.club.clubType, swingTooltip.club.number)}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">スイングウェイト</span>
                    <span className="chart-tooltip-value">{swingTooltip.club.swingWeight || '-'}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">目安偏差</span>
                    <span className="chart-tooltip-value">
                      {(swingTooltip.club.swingDeviation >= 0 ? '+' : '') + swingTooltip.club.swingDeviation.toFixed(1)}
                    </span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">状態</span>
                    <span className="chart-tooltip-value">{swingTooltip.club.swingStatus}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="analysis-empty">表示するクラブを選択してください</div>
        )}
      </>
    ) : (
      <div className="analysis-empty">クラブがまだ追加されていません</div>
    )}
  </div>
);
