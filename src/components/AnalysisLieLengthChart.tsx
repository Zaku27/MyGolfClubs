import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import type { ClubCategory } from '../utils/analysisUtils';
import type { LieLengthTooltipState } from './analysisTypes';
import { LieLengthLegend } from './AnalysisLegends';

type LieLengthChartClub = LieLengthTooltipState['club'];

type AnalysisLieLengthChartProps = {
  hasAnyLieLengthData: boolean;
  hasLieLengthData: boolean;
  lieLengthChartContainerRef: RefObject<HTMLDivElement | null>;
  lieLengthChartSize: { width: number; height: number };
  lieLengthTrendBandPoints: string | null;
  lieAngleTicks: number[];
  mapLieLengthY: (value: number) => number;
  lengthTicks: number[];
  mapLieLengthX: (value: number) => number;
  lieLengthTrendLinePoints: string | null;
  lieLengthClubs: LieLengthChartClub[];
  getLieLengthPointStyle: (club: LieLengthChartClub, deviation: number) => {
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  setLieLengthTooltip: (tooltip: LieLengthTooltipState | null) => void;
  lieLengthTooltip: LieLengthTooltipState | null;
  lieLengthTooltipRef: RefObject<HTMLDivElement | null>;
  lieLengthTooltipPos: { left?: number; top?: number } | null;
  getCategoryLabel: (category: ClubCategory) => string;
  getLieLengthDeviationLabel: (deviation: number) => string;
  formatSignedDegrees: (deg: number) => string;
  LIE_LENGTH_CHART_PADDING: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  trendBandTolerance: number;
};

export const AnalysisLieLengthChart = ({
  hasAnyLieLengthData,
  hasLieLengthData,
  lieLengthChartContainerRef,
  lieLengthChartSize,
  lieLengthTrendBandPoints,
  lieAngleTicks,
  mapLieLengthY,
  lengthTicks,
  mapLieLengthX,
  lieLengthTrendLinePoints,
  lieLengthClubs,
  getLieLengthPointStyle,
  setLieLengthTooltip,
  lieLengthTooltip,
  lieLengthTooltipRef,
  lieLengthTooltipPos,
  getCategoryLabel,
  getLieLengthDeviationLabel,
  formatSignedDegrees,
  LIE_LENGTH_CHART_PADDING,
  trendBandTolerance,
}: AnalysisLieLengthChartProps) => {
  return hasAnyLieLengthData ? (
    <>
      <LieLengthLegend tolerance={trendBandTolerance} />
      {hasLieLengthData ? (
        <div
          className="chart-scroll interactive-chart-scroll"
          ref={lieLengthChartContainerRef}
          onMouseLeave={() => setLieLengthTooltip(null)}
        >
          <svg
            viewBox={`0 0 ${lieLengthChartSize.width} ${lieLengthChartSize.height}`}
            className="analysis-chart lie-length-analysis-chart"
            role="img"
            aria-label="ライ角と長さの散布図"
          >
            <rect
              x={LIE_LENGTH_CHART_PADDING.left}
              y={LIE_LENGTH_CHART_PADDING.top}
              width={
                lieLengthChartSize.width -
                LIE_LENGTH_CHART_PADDING.left -
                LIE_LENGTH_CHART_PADDING.right
              }
              height={
                lieLengthChartSize.height -
                LIE_LENGTH_CHART_PADDING.top -
                LIE_LENGTH_CHART_PADDING.bottom
              }
              fill="#ffffff"
              rx="18"
            />

            {lieLengthTrendBandPoints && (
              <polygon points={lieLengthTrendBandPoints} className="lie-length-trend-band" />
            )}

            {lieAngleTicks.map((tick) => (
              <g key={`lie-length-y-${tick}`}>
                <line
                  x1={LIE_LENGTH_CHART_PADDING.left}
                  x2={lieLengthChartSize.width - LIE_LENGTH_CHART_PADDING.right}
                  y1={mapLieLengthY(tick)}
                  y2={mapLieLengthY(tick)}
                  className="chart-grid chart-grid-animated"
                />
                <text
                  x={LIE_LENGTH_CHART_PADDING.left - 12}
                  y={mapLieLengthY(tick) + 4}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {tick.toFixed(1)}°
                </text>
              </g>
            ))}

            {lengthTicks.map((tick) => (
              <g key={`lie-length-x-${tick}`}>
                <line
                  x1={mapLieLengthX(tick)}
                  x2={mapLieLengthX(tick)}
                  y1={LIE_LENGTH_CHART_PADDING.top}
                  y2={lieLengthChartSize.height - LIE_LENGTH_CHART_PADDING.bottom}
                  className="chart-grid chart-grid-animated"
                />
                <text
                  x={mapLieLengthX(tick)}
                  y={lieLengthChartSize.height - 24}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {tick}
                </text>
              </g>
            ))}

            {lieLengthTrendLinePoints && (
              <polyline
                points={lieLengthTrendLinePoints}
                fill="none"
                stroke="#1565c0"
                strokeWidth="2"
                className="chart-standard-line"
              />
            )}

            {lieLengthClubs.map((club, index) => {
              const style = getLieLengthPointStyle(club, club.deviationFromTrend);
              return (
                <g
                  key={`lie-length-${getAnalysisClubKey(club)}`}
                  className="weight-point-group"
                  style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                >
                  <circle
                    cx={mapLieLengthX(club.length)}
                    cy={mapLieLengthY(club.lieAngle)}
                    r={style.radius}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    className="chart-point-circle"
                    onMouseEnter={() =>
                      setLieLengthTooltip({
                        x: mapLieLengthX(club.length),
                        y: mapLieLengthY(club.lieAngle),
                        club,
                      })
                    }
                    onClick={() =>
                      setLieLengthTooltip({
                        x: mapLieLengthX(club.length),
                        y: mapLieLengthY(club.lieAngle),
                        club,
                      })
                    }
                  >
                    <title>{`${club.name} | 種類 ${getCategoryLabel(
                      club.category,
                    )} | 長さ ${club.length.toFixed(2)} in | ライ角 ${club.lieAngle.toFixed(
                      1,
                    )}° | 期待 ${club.expectedLieAngle.toFixed(1)}° | 偏差 ${formatSignedDegrees(
                      club.deviationFromTrend,
                    )}`}</title>
                  </circle>
                </g>
              );
            })}

            <text
              x={lieLengthChartSize.width / 2}
              y={lieLengthChartSize.height - 2}
              textAnchor="middle"
              className="chart-title-label"
            >
              クラブ長（インチ）
            </text>
            <text
              x="10"
              y={lieLengthChartSize.height / 2}
              textAnchor="middle"
              transform={`rotate(-90 10 ${lieLengthChartSize.height / 2})`}
              className="chart-title-label"
            >
              ライ角（度）
            </text>
          </svg>

          {lieLengthTooltip && (
            <div
              ref={lieLengthTooltipRef}
              className="chart-tooltip"
              style={{
                left: lieLengthTooltipPos?.left,
                top: lieLengthTooltipPos?.top,
              }}
            >
              <div className="chart-tooltip-title">{lieLengthTooltip.club.name}</div>
              <div className="chart-tooltip-list">
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">クラブ種別</span>
                  <span className="chart-tooltip-value">
                    {getClubTypeDisplay(
                      lieLengthTooltip.club.clubType,
                      lieLengthTooltip.club.number,
                    )}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">長さ</span>
                  <span className="chart-tooltip-value">
                    {lieLengthTooltip.club.length.toFixed(2)} in
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">ライ角</span>
                  <span className="chart-tooltip-value">
                    {lieLengthTooltip.club.lieAngle.toFixed(1)}°
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">期待値</span>
                  <span className="chart-tooltip-value">
                    {lieLengthTooltip.club.expectedLieAngle.toFixed(1)}°
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">偏差</span>
                  <span className="chart-tooltip-value">
                    {getLieLengthDeviationLabel(lieLengthTooltip.club.deviationFromTrend)}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">示唆</span>
                  <span className="chart-tooltip-value">
                    {lieLengthTooltip.club.lieTrendMessage}
                  </span>
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
  );
};
