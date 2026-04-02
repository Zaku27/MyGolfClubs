import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScatterDataPoint,
  type TooltipItem,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Scatter } from 'react-chartjs-2';
import type { MonteCarloResult } from '../utils/landingPosition';
import { calculateConfidenceEllipse } from '../utils/confidenceEllipse';

ChartJS.register(LinearScale, PointElement, LineElement, ScatterController, Title, Tooltip, Legend, annotationPlugin);

type ShotDispersionChartProps = {
  monteCarloResult: MonteCarloResult;
  target: { x: number; y: number };
  clubName: string;
  skillLevelName: string;
  numShots: number;
  showMeanPoint?: boolean;
};

type DispersionPoint = ScatterDataPoint & {
  shotNumber?: number;
  carry?: number;
  roll?: number;
  totalDistance?: number;
};

type ConfidenceLevelOption = {
  value: 0.68 | 0.95 | 0.99;
  label: string;
};

const DEFAULT_CHART_HEIGHT = 360;
const DEFAULT_CONFIDENCE_LEVEL: ConfidenceLevelOption['value'] = 0.95;
const CONFIDENCE_LEVEL_OPTIONS: ConfidenceLevelOption[] = [
  { value: 0.68, label: '68%' },
  { value: 0.95, label: '95%' },
  { value: 0.99, label: '99%' },
];

// 軸レンジの計算を1箇所に集約して、将来「ハザード領域の外接矩形」を足しやすくする。
function calculateAxisRange(values: number[], fallbackMin: number, fallbackMax: number): { min: number; max: number } {
  if (values.length === 0) {
    return { min: fallbackMin, max: fallbackMax };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // 値がほぼ同一点のケースでも見やすいように、最小幅を持たせる。
  const span = Math.max(1, rawMax - rawMin);
  const padding = Math.max(6, span * 0.12);

  return {
    min: Math.floor(rawMin - padding),
    max: Math.ceil(rawMax + padding),
  };
}

// Tooltipで raw を安全に読むためのヘルパー。
function getRawPoint(context: TooltipItem<'scatter'>): DispersionPoint {
  return (context.raw ?? {}) as DispersionPoint;
}

export function ShotDispersionChart({
  monteCarloResult,
  target,
  clubName,
  skillLevelName,
  numShots,
  showMeanPoint = true,
}: ShotDispersionChartProps) {
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevelOption['value']>(DEFAULT_CONFIDENCE_LEVEL);

  const shotPoints = useMemo<DispersionPoint[]>(() => {
    // ツールチップで各試行を追えるように shotNumber を持たせておく。
    return monteCarloResult.shots.map((shot, index) => ({
      x: shot.finalX,
      y: shot.finalY,
      shotNumber: index + 1,
      carry: shot.carry,
      roll: shot.roll,
      totalDistance: shot.totalDistance,
    }));
  }, [monteCarloResult.shots]);

  const meanPoint = useMemo<DispersionPoint>(
    () => ({
      x: monteCarloResult.stats.meanX,
      y: monteCarloResult.stats.meanY,
    }),
    [monteCarloResult.stats.meanX, monteCarloResult.stats.meanY],
  );

  const confidenceEllipse = useMemo(() => {
    // 選択中の信頼水準に応じて楕円サイズを切り替える。
    return calculateConfidenceEllipse(monteCarloResult.stats, confidenceLevel);
  }, [confidenceLevel, monteCarloResult.stats]);

  const confidenceLabel = useMemo(() => {
    return `${Math.round(confidenceLevel * 100)}% 信頼範囲`;
  }, [confidenceLevel]);

  const axisRange = useMemo(() => {
    // 将来ハザードを追加するときは、この配列にハザード境界のX/Yを結合すると
    // 「プロット+ハザードを同時に収めるレンジ」に簡単に拡張できる。
    // 信頼楕円もここでレンジへ含めておくと、後から矩形ハザードを足しても
    // 「可視要素を一括で収める」責務をこの計算へ集約できる。
    const ellipseHalfWidth = confidenceEllipse.width / 2;
    const ellipseHalfHeight = confidenceEllipse.height / 2;
    const xValues = shotPoints
      .map((p) => Number(p.x))
      .filter((v) => Number.isFinite(v))
      .concat(target.x, Number(meanPoint.x), confidenceEllipse.x - ellipseHalfWidth, confidenceEllipse.x + ellipseHalfWidth);
    const yValues = shotPoints
      .map((p) => Number(p.y))
      .filter((v) => Number.isFinite(v))
      .concat(target.y, Number(meanPoint.y), confidenceEllipse.y - ellipseHalfHeight, confidenceEllipse.y + ellipseHalfHeight);

    return {
      x: calculateAxisRange(xValues, -20, 20),
      y: calculateAxisRange(yValues, -20, 240),
    };
  }, [confidenceEllipse.height, confidenceEllipse.width, confidenceEllipse.x, confidenceEllipse.y, meanPoint.x, meanPoint.y, shotPoints, target.x, target.y]);

  const confidenceEllipseAnnotation = useMemo(() => {
    // chartjs-plugin-annotation v3 では label.enabled ではなく label.display を使う。
    // 将来 covariance を入れる場合は、rotation に主成分方向を渡せば回転楕円へ拡張できる。
    return {
      type: 'ellipse' as const,
      xMin: confidenceEllipse.x - confidenceEllipse.width / 2,
      xMax: confidenceEllipse.x + confidenceEllipse.width / 2,
      yMin: confidenceEllipse.y - confidenceEllipse.height / 2,
      yMax: confidenceEllipse.y + confidenceEllipse.height / 2,
      rotation: confidenceEllipse.rotation ?? 0,
      backgroundColor: 'rgba(75, 192, 192, 0.15)',
      borderColor: 'rgba(75, 192, 192, 0.8)',
      borderWidth: 2,
      label: {
        display: true,
        content: confidenceLabel,
        // 目標位置ラベルと重なりやすいため、楕円の外側左上へ逃がして表示する。
        position: { x: 'start', y: 'start' } as const,
        xAdjust: -18,
        yAdjust: -18,
        rotation: 0,
        color: 'rgba(13, 79, 79, 0.95)',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        padding: 6,
      },
    };
  }, [confidenceEllipse.height, confidenceEllipse.rotation, confidenceEllipse.width, confidenceEllipse.x, confidenceEllipse.y, confidenceLabel]);

  const data = useMemo<ChartData<'scatter', DispersionPoint[]>>(
    () => ({
      datasets: [
        {
          // Monte Carlo の着弾点群。後でクラスタ色分けをする場合もこの dataset を起点にできる。
          label: '着弾点',
          data: shotPoints,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          // 目標位置は赤いクロスで固定表示し、着弾群とのズレを視覚的に比較しやすくする。
          label: '目標位置',
          data: [{ x: target.x, y: target.y }],
          backgroundColor: 'red',
          pointBackgroundColor: 'red',
          pointBorderColor: '#7f1d1d',
          pointBorderWidth: 1.5,
          pointRadius: 8,
          pointHoverRadius: 10,
          pointStyle: 'crossRot',
          clip: false,
        },
        ...(showMeanPoint
          ? [
              {
                label: '平均位置',
                data: [meanPoint],
                backgroundColor: 'rgba(46, 125, 50, 0.95)',
                pointRadius: 7,
                pointHoverRadius: 9,
                pointStyle: 'rectRot' as const,
              },
            ]
          : []),
      ],
    }),
    [meanPoint, shotPoints, showMeanPoint, target.x, target.y],
  );

  const options = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // annotation に楕円や将来のハザード矩形を集約すると、可視オーバーレイの責務が明確になる。
        annotation: {
          annotations: {
            confidenceEllipse: confidenceEllipseAnnotation,
          },
        },
        title: {
          display: true,
          text: `${skillLevelName} - ${clubName} (${numShots} shots)`,
          font: {
            size: 15,
            weight: 'bold',
          },
          padding: {
            top: 8,
            bottom: 12,
          },
        },
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            // 着弾点データは shotNumber と各距離内訳を見せる。
            // 目標点や平均点は補助情報なので、座標中心の簡潔な表示にとどめる。
            title: (items) => {
              const raw = items[0] ? getRawPoint(items[0]) : undefined;
              if (typeof raw?.shotNumber === 'number') {
                return `着弾点 #${raw.shotNumber}`;
              }

              return items[0]?.dataset.label ?? 'ショット情報';
            },
            label: (context) => {
              const raw = getRawPoint(context);
              const parsedX = Number(context.parsed.x ?? 0);
              const parsedY = Number(context.parsed.y ?? 0);
              const lines: string[] = [
                `左右偏差: ${parsedX.toFixed(1)} y`,
                `ピン方向距離: ${parsedY.toFixed(1)} y`,
              ];

              if (typeof raw.carry === 'number') {
                lines.push(`キャリー: ${raw.carry.toFixed(1)} y`);
              }
              if (typeof raw.roll === 'number') {
                lines.push(`ラン: ${raw.roll.toFixed(1)} y`);
              }
              if (typeof raw.totalDistance === 'number') {
                lines.push(`トータル: ${raw.totalDistance.toFixed(1)} y`);
              }

              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: '左右偏差 (yards)',
          },
          min: axisRange.x.min,
          max: axisRange.x.max,
          grid: {
            color: 'rgba(0, 0, 0, 0.08)',
          },
        },
        y: {
          type: 'linear',
          title: {
            display: true,
            text: 'ピン方向距離 (yards)',
          },
          // Y軸は通常の向きのまま扱う。
          // 「ティー側を上にする」などの見せ方を変える場合は、ここだけで調整できる。
          reversed: false,
          min: axisRange.y.min,
          max: axisRange.y.max,
          grid: {
            color: 'rgba(0, 0, 0, 0.08)',
          },
        },
      },
    }),
    [
      axisRange.x.max,
      axisRange.x.min,
      axisRange.y.max,
      axisRange.y.min,
      clubName,
      confidenceEllipseAnnotation,
      numShots,
      skillLevelName,
    ],
  );

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#255b52' }}>信頼範囲表示</div>
        <div
          style={{
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: 4,
            borderRadius: 999,
            background: 'rgba(75, 192, 192, 0.10)',
          }}
        >
          {CONFIDENCE_LEVEL_OPTIONS.map((option) => {
            const isActive = option.value === confidenceLevel;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setConfidenceLevel(option.value)}
                style={{
                  border: isActive ? '1px solid rgba(75, 192, 192, 0.85)' : '1px solid rgba(75, 192, 192, 0.25)',
                  background: isActive ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                  color: isActive ? '#134e4a' : '#406b67',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ width: '100%', height: DEFAULT_CHART_HEIGHT }}>
      <Scatter data={data} options={options} />
      </div>
    </div>
  );
}

export default ShotDispersionChart;