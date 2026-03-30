import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { getLieBarColor } from '../utils/analysisUtils';
import { lieStatusLabelJa } from '../types/lieStandards';
import {
  LIE_GOOD_TOLERANCE,
  LIE_MAX,
  LIE_MIN,
  LIE_PADDING,
  LIE_STANDARD_LINE_COLOR,
  LIE_TICKS,
} from './analysisConfig';
import type { LieTooltipState } from './analysisTypes';
import { LieLegend } from './AnalysisLegends';

type LieChartClub = LieTooltipState['club'];

type AnalysisLieChartProps = {
  hasAnyLieAngleData: boolean;
  lieAngleClubs: LieChartClub[];
  lieChartContainerRef: RefObject<HTMLDivElement | null>;
  lieChartSize: { width: number; height: number };
  mapLieX: (index: number) => number;
  mapLieY: (value: number) => number;
  lieBarWidth: number;
  goodRangePolygonPoints: string | null;
  standardLieLinePoints: string | null;
  lieTooltip: LieTooltipState | null;
  lieTooltipRef: RefObject<HTMLDivElement | null>;
  lieTooltipPos: { left: number; top: number } | null;
  setLieTooltip: (tooltip: LieTooltipState | null) => void;
};

export const AnalysisLieChart = ({
  hasAnyLieAngleData,
  lieAngleClubs,
  lieChartContainerRef,
  lieChartSize,
  mapLieX,
  mapLieY,
  lieBarWidth,
  goodRangePolygonPoints,
  standardLieLinePoints,
  lieTooltip,
  lieTooltipRef,
  lieTooltipPos,
  setLieTooltip,
}: AnalysisLieChartProps) => (
  <div className="analysis-card chart-card lie-angle-frame">
    {hasAnyLieAngleData ? (
      <>
        <LieLegend lieGoodTolerance={LIE_GOOD_TOLERANCE} />
        {lieAngleClubs.length > 0 ? (
          <div
            className="chart-scroll interactive-chart-scroll"
            ref={lieChartContainerRef}
            onMouseLeave={() => setLieTooltip(null)}
          >
            <svg
              viewBox={`0 0 ${lieChartSize.width} ${lieChartSize.height}`}
              className="analysis-chart lie-analysis-chart"
              role="img"
              aria-label="ライ角分布の棒グラフ"
            >
            <rect
              x={LIE_PADDING.left}
              y={LIE_PADDING.top}
              width={lieChartSize.width - LIE_PADDING.left - LIE_PADDING.right}
              height={lieChartSize.height - LIE_PADDING.top - LIE_PADDING.bottom}
              fill="#ffffff"
              rx="18"
            />
            {LIE_TICKS.map((tick) => (
              <g key={`lie-y-${tick}`}>
                <line
                  x1={LIE_PADDING.left}
                  x2={lieChartSize.width - LIE_PADDING.right}
                  y1={mapLieY(tick)}
                  y2={mapLieY(tick)}
                  className="chart-grid chart-grid-animated"
                />
                <text
                  x={LIE_PADDING.left - 8}
                  y={mapLieY(tick) + 4}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {tick}°
                </text>
              </g>
            ))}
            {goodRangePolygonPoints && (
              <polygon
                points={goodRangePolygonPoints}
                fill="#2e7d32"
                fillOpacity="0.16"
              />
            )}
            {standardLieLinePoints && (
              <polyline
                points={standardLieLinePoints}
                fill="none"
                stroke={LIE_STANDARD_LINE_COLOR}
                strokeWidth="3"
                className="chart-standard-line"
              />
            )}
            {lieAngleClubs.map((club, index) => {
              const cx = mapLieX(index);
              const bw = lieBarWidth;
              const barBottom = mapLieY(LIE_MIN);
              const lieVal = club.lieAngle;
              const barTop = mapLieY(Math.min(Math.max(lieVal, LIE_MIN), LIE_MAX));
              const barHeight = Math.max(0, barBottom - barTop);
              const standardY = mapLieY(club.standardLieAngle);
              const status = club.lieStatus;
              const outOfRange = status === 'Adjust Recommended';
              const barColor = outOfRange ? '#c62828' : getLieBarColor(club.category);
              const deviation = club.deviationFromStandard;
              return (
                <g key={`lie-bar-${getAnalysisClubKey(club)}`}>
                  <circle
                    cx={cx}
                    cy={standardY}
                    r="4"
                    fill={LIE_STANDARD_LINE_COLOR}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="chart-standard-point"
                  >
                    <title>{`${club.name} | 基準ライ角 ${club.standardLieAngle.toFixed(1)}°`}</title>
                  </circle>
                  <rect
                    x={cx - bw / 2}
                    y={mapLieY(LIE_MAX)}
                    width={bw}
                    height={mapLieY(LIE_MIN) - mapLieY(LIE_MAX)}
                    fill="#e6efe8"
                    rx="4"
                  />
                  <rect
                    x={cx - bw / 2}
                    y={barTop}
                    width={bw}
                    height={barHeight}
                    fill={barColor}
                    rx="4"
                    stroke={status === 'Slightly Off' ? '#ef6c00' : outOfRange ? '#8e0000' : 'none'}
                    strokeWidth={status === 'Slightly Off' || outOfRange ? 2 : 0}
                    className="lie-angle-bar"
                    style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                    onMouseEnter={() => setLieTooltip({ x: cx, y: barTop, club })}
                    onClick={() => setLieTooltip({ x: cx, y: barTop, club })}
                  >
                    <title>{`${club.name} | ライ角 ${lieVal.toFixed(1)}° | 基準 ${club.standardLieAngle.toFixed(1)}° | 偏差 ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}°`}</title>
                  </rect>
                  <g transform={`translate(${cx}, ${lieChartSize.height - LIE_PADDING.bottom + 20})`}>
                    <text
                      textAnchor="end"
                      transform="rotate(-40)"
                      className="chart-axis-label"
                    >
                      {getClubTypeDisplay(club.clubType, club.number)}
                    </text>
                  </g>
                </g>
              );
            })}
            <text
              x={lieChartSize.width / 2}
              y={lieChartSize.height - 2}
              textAnchor="middle"
              className="chart-title-label"
            >
              クラブ
            </text>
            <text
              x="20"
              y={lieChartSize.height / 2}
              textAnchor="middle"
              transform={`rotate(-90 20 ${lieChartSize.height / 2})`}
              className="chart-title-label"
            >
              ライ角（度）
            </text>
            </svg>
            {lieTooltip && (
              <div
                ref={lieTooltipRef}
                className="chart-tooltip"
                style={{
                  left: lieTooltipPos?.left,
                  top: lieTooltipPos?.top,
                }}
              >
                <div className="chart-tooltip-title">{lieTooltip.club.name}</div>
                <div className="chart-tooltip-list">
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">クラブ種別</span>
                    <span className="chart-tooltip-value">{getClubTypeDisplay(lieTooltip.club.clubType, lieTooltip.club.number)}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">ライ角</span>
                    <span className="chart-tooltip-value">{lieTooltip.club.lieAngle.toFixed(1)}°</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">基準値</span>
                    <span className="chart-tooltip-value">{lieTooltip.club.standardLieAngle.toFixed(1)}°</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">偏差</span>
                    <span className="chart-tooltip-value">
                      {lieTooltip.club.deviationFromStandard >= 0 ? '+' : ''}
                      {lieTooltip.club.deviationFromStandard.toFixed(1)}°
                    </span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-label">状態</span>
                    <span className="chart-tooltip-value">{lieStatusLabelJa(lieTooltip.club.lieStatus)}</span>
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