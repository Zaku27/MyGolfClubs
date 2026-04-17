import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import type { SwingLengthTooltipState } from './analysisTypes';
import type { ClubCategory } from '../utils/analysisUtils';
import {
  evaluateSwingLengthSlope,
  getSwingLengthSlopeMessage,
  numericToSwingWeightLabel,
} from '../utils/analysisUtils';

type SwingLengthChartClub = SwingLengthTooltipState['club'];

type AnalysisSwingLengthChartProps = {
  hasAnySwingLengthData: boolean;
  hasSwingLengthData: boolean;
  swingLengthChartContainerRef: RefObject<HTMLDivElement | null>;
  swingLengthChartSize: { width: number; height: number };
  swingLengthTrendBandPoints: string | null;
  swingWeightTicks: number[];
  mapSwingLengthY: (value: number) => number;
  lengthTicks: number[];
  mapSwingLengthX: (value: number) => number;
  swingLengthTrendLinePoints: string | null;
  swingLengthClubs: SwingLengthChartClub[];
  getSwingLengthPointStyle: (club: SwingLengthChartClub, deviation: number) => {
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  setSwingLengthTooltip: (tooltip: SwingLengthTooltipState | null) => void;
  swingLengthTooltip: SwingLengthTooltipState | null;
  swingLengthTooltipRef: RefObject<HTMLDivElement | null>;
  swingLengthTooltipPos: { left?: number; top?: number } | null;
  getCategoryLabel: (category: ClubCategory) => string;
  getSwingLengthDeviationLabel: (deviation: number) => string;
  formatSignedSwingWeight: (value: number) => string;
  SWING_LENGTH_CHART_PADDING: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  regressionSlope: number;
};

export const AnalysisSwingLengthChart: React.FC<AnalysisSwingLengthChartProps> = ({
  hasAnySwingLengthData,
  hasSwingLengthData,
  swingLengthChartContainerRef,
  swingLengthChartSize,
  swingLengthTrendBandPoints,
  swingWeightTicks,
  mapSwingLengthY,
  lengthTicks,
  mapSwingLengthX,
  swingLengthTrendLinePoints,
  swingLengthClubs,
  getSwingLengthPointStyle,
  setSwingLengthTooltip,
  swingLengthTooltip,
  swingLengthTooltipRef,
  swingLengthTooltipPos,
  getCategoryLabel,
  getSwingLengthDeviationLabel,
  formatSignedSwingWeight,
  SWING_LENGTH_CHART_PADDING,
  regressionSlope,
}) => {
  const slopeEvaluation = evaluateSwingLengthSlope(regressionSlope);
  const slopeMessage = getSwingLengthSlopeMessage(regressionSlope);
  const slopeColor = slopeEvaluation === 'ideal' ? '#2e7d32' : slopeEvaluation === 'tooSteep' ? '#c62828' : '#ef6c00';

  return (
    <div className="analysis-card chart-card swing-length-frame">
      {hasAnySwingLengthData ? (
        <>
          <div className="chart-section-heading swing-length-heading">
            <div className="slope-indicator" style={{ color: slopeColor }}>
              <span className="slope-label">傾斜:</span>
              <span className="slope-value">{regressionSlope.toFixed(2)}</span>
              <span className="slope-unit">ポイント/inch</span>
              <span className="slope-status">({slopeMessage})</span>
            </div>
          </div>
          {hasSwingLengthData ? (
            <div
              className="chart-scroll interactive-chart-scroll"
              ref={swingLengthChartContainerRef}
              onMouseLeave={() => setSwingLengthTooltip(null)}
            >
              <svg
                viewBox={`0 0 ${swingLengthChartSize.width} ${swingLengthChartSize.height}`}
                className="analysis-chart swing-length-analysis-chart"
                role="img"
                aria-label="スイングウェイトと長さの散布図"
              >
                <rect
                  x={SWING_LENGTH_CHART_PADDING.left}
                  y={SWING_LENGTH_CHART_PADDING.top}
                  width={
                    swingLengthChartSize.width - SWING_LENGTH_CHART_PADDING.left - SWING_LENGTH_CHART_PADDING.right
                  }
                  height={
                    swingLengthChartSize.height - SWING_LENGTH_CHART_PADDING.top - SWING_LENGTH_CHART_PADDING.bottom
                  }
                  fill="#ffffff"
                  rx="18"
                />

                {swingLengthTrendBandPoints && (
                  <polygon points={swingLengthTrendBandPoints} className="swing-length-trend-band" />
                )}

                {swingWeightTicks.map((tick) => (
                  <g key={`sw-y-${tick}`}>
                    <line
                      x1={SWING_LENGTH_CHART_PADDING.left}
                      x2={swingLengthChartSize.width - SWING_LENGTH_CHART_PADDING.right}
                      y1={mapSwingLengthY(tick)}
                      y2={mapSwingLengthY(tick)}
                      className="chart-grid chart-grid-animated"
                    />
                    <text
                      x={SWING_LENGTH_CHART_PADDING.left - 12}
                      y={mapSwingLengthY(tick) + 4}
                      textAnchor="end"
                      className="chart-axis-label"
                    >
                      {numericToSwingWeightLabel(tick)}
                    </text>
                  </g>
                ))}

                {lengthTicks.map((tick) => (
                  <g key={`l-x-${tick}`}>
                    <line
                      x1={mapSwingLengthX(tick)}
                      x2={mapSwingLengthX(tick)}
                      y1={SWING_LENGTH_CHART_PADDING.top}
                      y2={swingLengthChartSize.height - SWING_LENGTH_CHART_PADDING.bottom}
                      className="chart-grid chart-grid-animated"
                    />
                    <text
                      x={mapSwingLengthX(tick)}
                      y={swingLengthChartSize.height - 24}
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {tick}
                    </text>
                  </g>
                ))}

                {swingLengthTrendLinePoints && (
                  <polyline
                    points={swingLengthTrendLinePoints}
                    fill="none"
                    stroke="#7a7a7a"
                    strokeWidth="2"
                    className="chart-standard-line"
                  />
                )}

                {swingLengthClubs.map((club, index) => {
                  const style = getSwingLengthPointStyle(club, club.deviationFromTrend);
                  return (
                    <g
                      key={`sl-${getAnalysisClubKey(club)}`}
                      className="swing-length-point-group"
                      style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                    >
                      <circle
                        cx={mapSwingLengthX(club.length)}
                        cy={mapSwingLengthY(club.swingWeightNumeric)}
                        r={style.radius}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        className="chart-point-circle"
                        onMouseEnter={() =>
                          setSwingLengthTooltip({
                            x: mapSwingLengthX(club.length),
                            y: mapSwingLengthY(club.swingWeightNumeric),
                            club,
                          })
                        }
                        onClick={() =>
                          setSwingLengthTooltip({
                            x: mapSwingLengthX(club.length),
                            y: mapSwingLengthY(club.swingWeightNumeric),
                            club,
                          })
                        }
                      >
                        <title>{`${club.name} | 種類 ${getCategoryLabel(
                          club.category
                        )} | 長さ ${club.length.toFixed(2)} in | SW ${numericToSwingWeightLabel(
                          club.swingWeightNumeric
                        )} | 期待 ${numericToSwingWeightLabel(
                          club.expectedSwingWeight
                        )} | 偏差 ${formatSignedSwingWeight(club.deviationFromTrend)}`}</title>
                      </circle>
                    </g>
                  );
                })}

                <text
                  x={swingLengthChartSize.width / 2}
                  y={swingLengthChartSize.height - 2}
                  textAnchor="middle"
                  className="chart-title-label"
                >
                  クラブ長（インチ）
                </text>
                <text
                  x="10"
                  y={swingLengthChartSize.height / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 10 ${swingLengthChartSize.height / 2})`}
                  className="chart-title-label"
                >
                  スイングウェイト
                </text>
              </svg>
              {swingLengthTooltip && (
                <div
                  ref={swingLengthTooltipRef}
                  className="chart-tooltip"
                  style={{
                    left: swingLengthTooltipPos?.left,
                    top: swingLengthTooltipPos?.top,
                  }}
                >
                  <div className="chart-tooltip-title">{swingLengthTooltip.club.name}</div>
                  <div className="chart-tooltip-list">
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">クラブ種別</span>
                      <span className="chart-tooltip-value">
                        {getClubTypeDisplay(swingLengthTooltip.club.clubType, swingLengthTooltip.club.number)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">長さ</span>
                      <span className="chart-tooltip-value">
                        {swingLengthTooltip.club.length.toFixed(2)} in
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">スイングウェイト</span>
                      <span className="chart-tooltip-value">
                        {numericToSwingWeightLabel(swingLengthTooltip.club.swingWeightNumeric)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">期待値</span>
                      <span className="chart-tooltip-value">
                        {numericToSwingWeightLabel(swingLengthTooltip.club.expectedSwingWeight)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">偏差</span>
                      <span className="chart-tooltip-value">
                        {getSwingLengthDeviationLabel(swingLengthTooltip.club.deviationFromTrend)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">状態</span>
                      <span className="chart-tooltip-value">{swingLengthTooltip.club.trendStatus}</span>
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
        <div className="analysis-empty">スイングウェイトデータがまだ追加されていません</div>
      )}
    </div>
  );
};
