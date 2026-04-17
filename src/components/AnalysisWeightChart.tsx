import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { WeightLegend } from './AnalysisLegends';
import type { WeightTooltipState } from './analysisTypes';
import type { ClubCategory } from '../utils/analysisUtils';

type WeightChartClub = WeightTooltipState['club'];

type AnalysisWeightChartProps = {
  hasAnyWeightLengthData: boolean;
  hasWeightLengthData: boolean;
  weightChartContainerRef: RefObject<HTMLDivElement | null>;
  weightChartSize: { width: number; height: number };
  weightTrendBandPoints: string | null;
  weightTicks: number[];
  mapWeightLengthY: (value: number) => number;
  lengthTicks: number[];
  mapWeightLengthX: (value: number) => number;
  weightTrendLinePoints: string | null;
  weightLengthClubs: WeightChartClub[];
  getWeightPointStyle: (club: WeightChartClub, deviation: number) => {
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  setWeightTooltip: (tooltip: WeightTooltipState | null) => void;
  weightTooltip: WeightTooltipState | null;
  weightTooltipRef: RefObject<HTMLDivElement | null>;
  weightTooltipPos: { left?: number; top?: number } | null;
  getCategoryLabel: (category: ClubCategory) => string;
  getWeightDeviationLabel: (deviation: number) => string;
  formatSignedGrams: (grams: number) => string;
  WEIGHT_CHART_PADDING: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

const formatGapClubSummary = (club: WeightChartClub): string => {
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

export const AnalysisWeightChart: React.FC<AnalysisWeightChartProps> = ({
  hasAnyWeightLengthData,
  hasWeightLengthData,
  weightChartContainerRef,
  weightChartSize,
  weightTrendBandPoints,
  weightTicks,
  mapWeightLengthY,
  lengthTicks,
  mapWeightLengthX,
  weightTrendLinePoints,
  weightLengthClubs,
  getWeightPointStyle,
  setWeightTooltip,
  weightTooltip,
  weightTooltipRef,
  weightTooltipPos,
  getCategoryLabel,
  getWeightDeviationLabel,
  formatSignedGrams,
  WEIGHT_CHART_PADDING,
}) => {
  const evaluatedGapClubs = weightLengthClubs.filter((club) => club.projectedDistanceGap != null);
  const narrowGapClubs = evaluatedGapClubs.filter((club) => (club.projectedDistanceGap ?? 0) < 8);
  const wideGapClubs = evaluatedGapClubs.filter((club) => (club.projectedDistanceGap ?? 0) > 18);
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

  return (
    <div className="analysis-card chart-card weight-length-frame">
      {hasAnyWeightLengthData ? (
        <>
          <div className="chart-section-heading"></div>
          <WeightLegend />
          {hasWeightLengthData ? (
            <div
              className="chart-scroll interactive-chart-scroll"
              ref={weightChartContainerRef}
              onMouseLeave={() => setWeightTooltip(null)}
            >
              <svg
                viewBox={`0 0 ${weightChartSize.width} ${weightChartSize.height}`}
                className="analysis-chart weight-analysis-chart"
                role="img"
                aria-label="重量と長さの散布図"
              >
                <rect
                  x={WEIGHT_CHART_PADDING.left}
                  y={WEIGHT_CHART_PADDING.top}
                  width={
                    weightChartSize.width - WEIGHT_CHART_PADDING.left - WEIGHT_CHART_PADDING.right
                  }
                  height={
                    weightChartSize.height - WEIGHT_CHART_PADDING.top - WEIGHT_CHART_PADDING.bottom
                  }
                  fill="#ffffff"
                  rx="18"
                />

                {weightTrendBandPoints && (
                  <polygon points={weightTrendBandPoints} className="weight-trend-band" />
                )}

                {weightTicks.map((tick) => (
                  <g key={`w-y-${tick}`}>
                    <line
                      x1={WEIGHT_CHART_PADDING.left}
                      x2={weightChartSize.width - WEIGHT_CHART_PADDING.right}
                      y1={mapWeightLengthY(tick)}
                      y2={mapWeightLengthY(tick)}
                      className="chart-grid chart-grid-animated"
                    />
                    <text
                      x={WEIGHT_CHART_PADDING.left - 12}
                      y={mapWeightLengthY(tick) + 4}
                      textAnchor="end"
                      className="chart-axis-label"
                    >
                      {tick}
                    </text>
                  </g>
                ))}

                {lengthTicks.map((tick) => (
                  <g key={`l-x-${tick}`}>
                    <line
                      x1={mapWeightLengthX(tick)}
                      x2={mapWeightLengthX(tick)}
                      y1={WEIGHT_CHART_PADDING.top}
                      y2={weightChartSize.height - WEIGHT_CHART_PADDING.bottom}
                      className="chart-grid chart-grid-animated"
                    />
                    <text
                      x={mapWeightLengthX(tick)}
                      y={weightChartSize.height - 24}
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {tick}
                    </text>
                  </g>
                ))}

                {weightTrendLinePoints && (
                  <polyline
                    points={weightTrendLinePoints}
                    fill="none"
                    stroke="#7a7a7a"
                    strokeWidth="2"
                    className="chart-standard-line"
                  />
                )}

                {weightLengthClubs.map((club, index) => {
                  const style = getWeightPointStyle(club, club.deviation);
                  return (
                    <g
                      key={`wl-${getAnalysisClubKey(club)}`}
                      className="weight-point-group"
                      style={{ '--point-delay': `${index * 45}ms` } as CSSProperties}
                    >
                      <circle
                        cx={mapWeightLengthX(club.length)}
                        cy={mapWeightLengthY(club.weight)}
                        r={style.radius}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        className="chart-point-circle"
                        onMouseEnter={() =>
                          setWeightTooltip({
                            x: mapWeightLengthX(club.length),
                            y: mapWeightLengthY(club.weight),
                            club,
                          })
                        }
                        onClick={() =>
                          setWeightTooltip({
                            x: mapWeightLengthX(club.length),
                            y: mapWeightLengthY(club.weight),
                            club,
                          })
                        }
                      >
                        <title>{`${club.name} | 種類 ${getCategoryLabel(
                          club.category
                        )} | 長さ ${club.length.toFixed(2)} in | 重量 ${club.weight.toFixed(
                          1
                        )} g | 期待 ${club.expectedWeight.toFixed(1)} g | 偏差 ${formatSignedGrams(
                          club.deviation
                        )}`}</title>
                      </circle>
                    </g>
                  );
                })}

                <text
                  x={weightChartSize.width / 2}
                  y={weightChartSize.height - 2}
                  textAnchor="middle"
                  className="chart-title-label"
                >
                  クラブ長（インチ）
                </text>
                <text
                  x="10"
                  y={weightChartSize.height / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 10 ${weightChartSize.height / 2})`}
                  className="chart-title-label"
                >
                  クラブ重量（グラム）
                </text>
              </svg>
              {weightTooltip && (
                <div
                  ref={weightTooltipRef}
                  className="chart-tooltip"
                  style={{
                    left: weightTooltipPos?.left,
                    top: weightTooltipPos?.top,
                  }}
                >
                  <div className="chart-tooltip-title">{weightTooltip.club.name}</div>
                  <div className="chart-tooltip-list">
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">クラブ種別</span>
                      <span className="chart-tooltip-value">
                        {getClubTypeDisplay(weightTooltip.club.clubType, weightTooltip.club.number)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">長さ</span>
                      <span className="chart-tooltip-value">
                        {weightTooltip.club.length.toFixed(2)} in
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">重量</span>
                      <span className="chart-tooltip-value">{weightTooltip.club.weight.toFixed(1)} g</span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">期待値</span>
                      <span className="chart-tooltip-value">
                        {weightTooltip.club.expectedWeight.toFixed(1)} g
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">偏差</span>
                      <span className="chart-tooltip-value">
                        {getWeightDeviationLabel(weightTooltip.club.deviation)}
                      </span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-label">示唆</span>
                      <span className="chart-tooltip-value">
                        {weightTooltip.club.weightTrendMessage}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="analysis-empty">表示するクラブを選択してください</div>
          )}
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
        </>
      ) : (
        <div className="analysis-empty">クラブがまだ追加されていません</div>
      )}
    </div>
  );
};
