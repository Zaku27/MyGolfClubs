import { useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  applyWindDirectionSnap,
  calculateWindDirectionFromPoint,
  formatWindDirectionLabel,
  normalizeWindDirection,
  normalizeWindSpeedMps,
} from '../utils/windDirection';
import './WindDirectionDial.css';

type WindDirectionDialProps = {
  windDirection: number;
  windSpeed: number;
  onDirectionChange: (newDirection: number) => void;
  onSpeedChange: (newSpeed: number) => void;
};

// ダイアル中心座標と半径を定数化し、
// 描画計算とドラッグ計算の両方で同じ値を使えるようにする。
const VIEW_BOX_SIZE = 180;
const CENTER = VIEW_BOX_SIZE / 2;
const OUTER_RADIUS = 72;

export default function WindDirectionDial({
  windDirection,
  windSpeed,
  onDirectionChange,
  onSpeedChange,
}: WindDirectionDialProps) {
  // 現在ドラッグ中かどうかを保持する。
  const [isDragging, setIsDragging] = useState(false);

  // 複数ポインタが同時に触れても処理が混ざらないよう、
  // 操作を開始した pointerId を保持する。
  const activePointerIdRef = useRef<number | null>(null);

  // SVG 要素への参照を保持し、画面座標→中心座標の計算に利用する。
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 必要に応じて 45 度スナップを有効化するフラグ。
  // true: スナップ ON / false: スナップ OFF
  const ENABLE_45_DEGREE_SNAP = true;

  // 外部から渡された値が不正でも UI が崩れないように正規化する。
  const safeDirection = normalizeWindDirection(windDirection);
  const safeSpeed = normalizeWindSpeedMps(windSpeed);

  // 表示ラベル（例: 225° 南西）をメモ化し、無駄な再計算を避ける。
  const directionLabel = useMemo(() => formatWindDirectionLabel(safeDirection), [safeDirection]);

  // マウス/タッチ位置から角度を計算し、必要ならスナップした値で通知する。
  const updateDirectionByPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;

    // SVG の実寸位置を取得し、中心座標を求める。
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 画面座標から角度を求め、スナップ設定を適用する。
    const rawDirection = calculateWindDirectionFromPoint(clientX, clientY, centerX, centerY);
    const nextDirection = applyWindDirectionSnap(rawDirection, ENABLE_45_DEGREE_SNAP);

    // 親へ変更を通知して状態を一元管理する。
    onDirectionChange(nextDirection);
  };

  // ドラッグ開始時の処理。
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    // 既定のタッチ挙動を抑止して、ダイアル操作を優先する。
    event.preventDefault();

    // この pointer をアクティブとして記録する。
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);

    // ポインタキャプチャを使って、要素外に出ても move/up を受け取る。
    event.currentTarget.setPointerCapture(event.pointerId);

    // 押した瞬間にも角度を更新する。
    updateDirectionByPointer(event.clientX, event.clientY);
  };

  // ドラッグ中の移動処理。
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    // アクティブでないポインタ入力は無視する。
    if (!isDragging || activePointerIdRef.current !== event.pointerId) return;
    updateDirectionByPointer(event.clientX, event.clientY);
  };

  // ドラッグ終了時の後始末。
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    setIsDragging(false);
    activePointerIdRef.current = null;

    // 取得していたポインタキャプチャを解放する。
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // ダイアル目盛りを 15 度ごとに描画するためのデータを生成する。
  const ticks = useMemo(() => {
    const items: Array<{ angle: number; inner: number; outer: number; major: boolean }> = [];
    for (let angle = 0; angle < 360; angle += 15) {
      const isMajor = angle % 45 === 0;
      items.push({
        angle,
        inner: isMajor ? OUTER_RADIUS - 14 : OUTER_RADIUS - 8,
        outer: OUTER_RADIUS,
        major: isMajor,
      });
    }
    return items;
  }, []);

  return (
    <section className="wind-dial-card" aria-label="風向風速設定">
      {/*
        SVG コンパス本体。
        pointer events を受け取り、マウス/タッチ/ペンを共通実装で扱う。
      */}
      <div className="wind-dial-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
          className="wind-dial-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-label="風向ダイアル"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={safeDirection}
        >
          <defs>
            <radialGradient id="dialBg" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d8efff" />
            </radialGradient>
            <linearGradient id="dialRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6dd6b8" />
              <stop offset="100%" stopColor="#4aa8de" />
            </linearGradient>
            <linearGradient id="needle" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#0d7c68" />
              <stop offset="100%" stopColor="#1a9dd4" />
            </linearGradient>
          </defs>

          {/* 外枠リング */}
          <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS + 8} fill="url(#dialRing)" opacity="0.22" />

          {/* ダイアル背景 */}
          <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="url(#dialBg)" stroke="#6cb8a5" strokeWidth="2" />

          {/* 方位目盛り */}
          {ticks.map((tick) => {
            const rad = ((tick.angle - 90) * Math.PI) / 180;
            const x1 = CENTER + Math.cos(rad) * tick.inner;
            const y1 = CENTER + Math.sin(rad) * tick.inner;
            const x2 = CENTER + Math.cos(rad) * tick.outer;
            const y2 = CENTER + Math.sin(rad) * tick.outer;
            return (
              <line
                key={tick.angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tick.major ? '#2b7d6b' : '#7aa9bd'}
                strokeWidth={tick.major ? 2.2 : 1.1}
                strokeLinecap="round"
              />
            );
          })}

          {/* コンパスローズ（N/E/S/W） */}
          <text x={CENTER} y={CENTER - 54} textAnchor="middle" fill="#0b5f4f" fontSize="13" fontWeight="700">N</text>
          <text x={CENTER + 54} y={CENTER + 5} textAnchor="middle" fill="#1b668f" fontSize="13" fontWeight="700">E</text>
          <text x={CENTER} y={CENTER + 58} textAnchor="middle" fill="#0b5f4f" fontSize="13" fontWeight="700">S</text>
          <text x={CENTER - 54} y={CENTER + 5} textAnchor="middle" fill="#1b668f" fontSize="13" fontWeight="700">W</text>

          {/*
            針は「上向き(北)」の形状をベースに作り、
            中心を基準に回転させて風向を表現する。
          */}
          <g transform={`rotate(${safeDirection} ${CENTER} ${CENTER})`}>
            <path
              d={`M ${CENTER} ${CENTER - 53} L ${CENTER - 7} ${CENTER - 5} L ${CENTER} ${CENTER - 12} L ${CENTER + 7} ${CENTER - 5} Z`}
              fill="url(#needle)"
              stroke="#0e5f4f"
              strokeWidth="1.2"
            />
            <line
              x1={CENTER}
              y1={CENTER - 8}
              x2={CENTER}
              y2={CENTER + 35}
              stroke="#0f6f5d"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          {/* 中心ノブ */}
          <circle cx={CENTER} cy={CENTER} r={8} fill="#ffffff" stroke="#18816c" strokeWidth="2.4" />
          <circle cx={CENTER} cy={CENTER} r={3.5} fill={isDragging ? '#27a88a' : '#1d8f78'} />
        </svg>
      </div>

      {/* 現在値の表示 */}
      <div className="wind-dial-readout">
        <span className="wind-dial-angle">{directionLabel}</span>
        <span className="wind-dial-speed">風速 {safeSpeed.toFixed(1)} m/s</span>
      </div>

      {/* 風速スライダー */}
      <div className="wind-dial-speed-control">
        <input
          type="range"
          min={0}
          max={15}
          step={0.1}
          value={safeSpeed}
          onChange={(event) => {
            // スライダー入力を正規化して親へ渡す。
            onSpeedChange(normalizeWindSpeedMps(Number(event.target.value)));
          }}
          aria-label="風速"
        />
        <span className="wind-dial-speed-mark">0 - 15 m/s</span>
      </div>
    </section>
  );
}
