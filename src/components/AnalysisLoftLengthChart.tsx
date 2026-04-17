import type { CSSProperties, RefObject } from 'react';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { isDistanceGapNarrow, isDistanceGapWide } from '../utils/analysisUtils';
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

const formatGapClubSummary = (club: LoftLengthChartClub): string => {
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
  const evaluatedGapClubs = loftLengthClubs.filter((club) => club.projectedDistanceGap != null);
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
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">距離ギャップ</span>
                  <span className="chart-tooltip-value">
                    {loftLengthTooltip.club.projectedDistanceGap == null
                      ? '対象外'
                      : `約${loftLengthTooltip.club.projectedDistanceGap} yd`}
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span className="chart-tooltip-label">比較対象</span>
                  <span className="chart-tooltip-value">
                    {loftLengthTooltip.club.projectedGapTargetClubType == null
                      ? 'なし'
                      : getClubTypeDisplay(
                          loftLengthTooltip.club.projectedGapTargetClubType,
                          loftLengthTooltip.club.projectedGapTargetNumber ?? '',
                        )}
                  </span>
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
