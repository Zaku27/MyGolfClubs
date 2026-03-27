import type { ChangeEvent } from 'react';
import type { GolfClub } from '../types/golf';
import './AnalysisScreen.css';

type AnalysisScreenProps = {
  clubs: GolfClub[];
  onBack: () => void;
  onUpdateActualDistance: (clubId: number, distance: number) => void;
  headSpeed: number;
  onHeadSpeedChange: (value: number) => void;
};

type ClubCategory = 'wood' | 'iron' | 'wedge' | 'putter';

const CHART_WIDTH = 920;
const CHART_HEIGHT = 360;
const PADDING = { top: 24, right: 28, bottom: 40, left: 48 };
const MIN_LOFT = 5;
const MAX_LOFT = 60;
const MIN_DISTANCE = 0;
const MAX_DISTANCE = 340;

// TrackMan-like loft-only approximation.
// Quadratic fit anchored around typical carry windows:
// Driver 10.5° ≈ 230y, 7I 31° ≈ 160y, PW 44° ≈ 120y.
const getEstimatedDistance = (loftAngle: number, headSpeed: number) => {
  const baseline = 269.13 - 3.832 * loftAngle + 0.0101 * loftAngle * loftAngle;
  const speedRatio = Math.max(0.7, Math.min(1.35, headSpeed / 42));
  const speedFactor = Math.pow(speedRatio, 1.12);
  const estimated = baseline * speedFactor;
  return Math.max(0, Math.min(280, estimated));
};

const getClubCategory = (club: GolfClub): ClubCategory => {
  if (club.clubType === 'P') return 'putter';
  if (club.clubType.endsWith('W') || club.clubType === 'D') return 'wood';
  if (club.clubType.endsWith('I') || club.clubType === 'PW') return 'iron';
  return 'wedge';
};

const getCategoryColor = (category: ClubCategory) => {
  switch (category) {
    case 'wood':
      return '#1976d2';
    case 'iron':
      return '#2e7d32';
    case 'wedge':
      return '#d32f2f';
    case 'putter':
      return '#757575';
  }
};

const mapX = (loftAngle: number) => {
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + ((loftAngle - MIN_LOFT) / (MAX_LOFT - MIN_LOFT)) * plotWidth;
};

const mapY = (distance: number) => {
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  return CHART_HEIGHT - PADDING.bottom - ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * plotHeight;
};

export const AnalysisScreen = ({ clubs, onBack, onUpdateActualDistance, headSpeed, onHeadSpeedChange }: AnalysisScreenProps) => {
  const chartClubs = clubs
    .filter((club) => club.loftAngle >= MIN_LOFT && club.loftAngle <= MAX_LOFT)
    .sort((left, right) => left.loftAngle - right.loftAngle)
    .map((club) => ({
      ...club,
      estimatedDistance: getEstimatedDistance(club.loftAngle ?? 0, headSpeed),
      actualDistance: club.distance ?? 0,
      category: getClubCategory(club),
    }));

  const actualLinePoints = chartClubs
    .filter((club) => club.actualDistance > 0)
    .map((club) => `${mapX(club.loftAngle)},${mapY(club.actualDistance)}`)
    .join(' ');

  const loftTicks = [10, 20, 30, 40, 50, 60];
  const distanceTicks = [0, 50, 100, 150, 200, 250, 300];

  const handleActualDistanceChange = (clubId: number | undefined, event: ChangeEvent<HTMLInputElement>) => {
    if (clubId == null) return;
    const nextValue = Number(event.target.value);
    onUpdateActualDistance(clubId, Number.isFinite(nextValue) ? nextValue : 0);
  };

  const handleHeadSpeedChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) {
      onHeadSpeedChange(42);
      return;
    }
    onHeadSpeedChange(Math.max(30, Math.min(60, nextValue)));
  };

  return (
    <div className="analysis-screen">
      <div className="analysis-header">
        <div>
          <p className="analysis-eyebrow">Performance View</p>
          <h1>Loft vs Distance</h1>
          <p className="analysis-subtitle">
            推定飛距離は 42 m/s を基準に、ヘッドスピード連動の TrackMan 風近似で計算しています。
          </p>
        </div>
        <div className="analysis-controls">
          <label className="headspeed-control">
            <span>ヘッドスピード</span>
            <div className="headspeed-input-wrap">
              <input
                type="number"
                min="30"
                max="60"
                step="0.1"
                value={headSpeed}
                onChange={handleHeadSpeedChange}
                className="analysis-input headspeed-input"
              />
              <em>m/s</em>
            </div>
          </label>
          <button className="btn-secondary" onClick={onBack}>
            クラブ一覧に戻る
          </button>
        </div>
      </div>

      <div className="analysis-card chart-card">
        <div className="analysis-legend">
          <span><i style={{ backgroundColor: '#1976d2' }} />Woods</span>
          <span><i style={{ backgroundColor: '#2e7d32' }} />Irons</span>
          <span><i style={{ backgroundColor: '#d32f2f' }} />Wedges</span>
          <span><i style={{ backgroundColor: '#757575' }} />Putter</span>
          <span><i className="legend-estimated" />Estimated</span>
          <span><i className="legend-actual" />Actual</span>
          <span><i className="legend-actual-line" />Actual Line</span>
        </div>

        <div className="chart-scroll">
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="analysis-chart" role="img" aria-label="Loft versus distance scatter chart">
            <rect x={PADDING.left} y={PADDING.top} width={CHART_WIDTH - PADDING.left - PADDING.right} height={CHART_HEIGHT - PADDING.top - PADDING.bottom} fill="#ffffff" rx="18" />

            {distanceTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={mapY(tick)}
                  y2={mapY(tick)}
                  className="chart-grid"
                />
                <text x={PADDING.left - 12} y={mapY(tick) + 4} textAnchor="end" className="chart-axis-label">
                  {tick}
                </text>
              </g>
            ))}

            {loftTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line
                  x1={mapX(tick)}
                  x2={mapX(tick)}
                  y1={PADDING.top}
                  y2={CHART_HEIGHT - PADDING.bottom}
                  className="chart-grid"
                />
                <text x={mapX(tick)} y={CHART_HEIGHT - 10} textAnchor="middle" className="chart-axis-label">
                  {tick}°
                </text>
              </g>
            ))}

            {actualLinePoints && (
              <polyline points={actualLinePoints} fill="none" stroke="#44574d" strokeWidth="2.5" />
            )}

            {chartClubs.map((club) => (
              <g key={club.id ?? club.name}>
                {club.actualDistance > 0 && (
                  <circle
                    cx={mapX(club.loftAngle)}
                    cy={mapY(club.actualDistance)}
                    r="8.5"
                    fill="#ffffff"
                    stroke={getCategoryColor(club.category)}
                    strokeWidth="3"
                  >
                    <title>{`${club.name} | Loft ${club.loftAngle}° | Actual ${club.actualDistance.toFixed(0)}y`}</title>
                  </circle>
                )}
                <circle
                  cx={mapX(club.loftAngle)}
                  cy={mapY(club.estimatedDistance)}
                  r="7"
                  fill={getCategoryColor(club.category)}
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  <title>{`${club.name} | Loft ${club.loftAngle}° | Est ${club.estimatedDistance.toFixed(0)}y`}</title>
                </circle>
                <text
                  x={mapX(club.loftAngle) + 10}
                  y={mapY(club.estimatedDistance) - 10}
                  className="chart-point-label"
                >
                  {club.name}
                </text>
              </g>
            ))}

            <text
              x={CHART_WIDTH / 2}
              y={CHART_HEIGHT - 2}
              textAnchor="middle"
              className="chart-title-label"
            >
              Loft Angle (degrees)
            </text>
            <text
              x="18"
              y={CHART_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 18 ${CHART_HEIGHT / 2})`}
              className="chart-title-label"
            >
              Distance (yards)
            </text>
          </svg>
        </div>
      </div>

      <div className="analysis-card table-card">
        <div className="analysis-table-header">
          <h2>Club Data</h2>
          <p>実測飛距離は一覧データに直接反映されます。</p>
        </div>
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Loft</th>
                <th>Estimated</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {chartClubs.map((club) => (
                <tr key={`row-${club.id ?? club.name}`}>
                  <td>{club.name}</td>
                  <td>{club.loftAngle.toFixed(1)}°</td>
                  <td>{club.estimatedDistance.toFixed(0)} y</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={club.actualDistance || ''}
                      onChange={(event) => handleActualDistanceChange(club.id, event)}
                      className="analysis-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
