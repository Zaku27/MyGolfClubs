import { useEffect, useMemo, useRef, useState } from "react";
import type { Hole, Hazard } from "../../types/game";
import type { LandingResult } from "../../utils/landingPosition";

interface HoleMapCanvasProps {
  hole: Pick<Hole, "targetDistance" | "distanceFromTee" | "greenRadius" | "hazards">;
  landingResults: LandingResult[];
  showTrajectories?: boolean;
  className?: string;
}

type Size = {
  width: number;
  height: number;
};

type Point2D = {
  x: number;
  y: number;
};

type AbsoluteShot = {
  origin: Point2D;
  landing: Point2D;
  path: Point2D[];
  local: LandingResult;
};

const MIN_CANVAS_HEIGHT = 280;
const DEFAULT_GREEN_RADIUS = 12;

/**
 * ハザード種別に応じて描画色を返す。
 * 要件で指定された bunker / water は固定色にし、
 * その他は識別しやすい補助色を設定している。
 */
function getHazardStyle(type: Hazard["type"]): { fill: string; stroke: string } {
  if (type === "bunker") {
    return {
      fill: "rgba(250, 204, 21, 0.45)",
      stroke: "rgba(161, 98, 7, 0.95)",
    };
  }

  if (type === "water") {
    return {
      fill: "rgba(59, 130, 246, 0.38)",
      stroke: "rgba(30, 64, 175, 0.95)",
    };
  }

  if (type === "ob") {
    return {
      fill: "rgba(248, 113, 113, 0.24)",
      stroke: "rgba(185, 28, 28, 0.9)",
    };
  }

  return {
    fill: "rgba(74, 222, 128, 0.22)",
    stroke: "rgba(22, 101, 52, 0.85)",
  };
}

/**
 * ホール全体を収めるための距離レンジを算出する。
 * - Y軸(奥行き): ティー(0y)からピンまでを基本に、ハザードと着地点の最大距離まで拡張
 * - X軸(左右): ハザード幅・着地左右ブレの最大値に余白を加えて決定
 */
function buildYardBounds(
  targetDistance: number,
  greenRadius: number,
  hazards: Hazard[],
  absoluteShots: AbsoluteShot[],
): {
  maxYardY: number;
  halfYardX: number;
} {
  const maxHazardY = hazards.reduce((max, hazard) => Math.max(max, hazard.yBack), 0);
  const maxLandingY = absoluteShots.reduce((max, shot) => {
    const pathMaxY = shot.path.reduce((innerMax, point) => Math.max(innerMax, point.y), shot.landing.y);

    return Math.max(max, shot.landing.y, pathMaxY);
  }, 0);

  const baseMaxY = Math.max(targetDistance + greenRadius, maxHazardY, maxLandingY, 1);
  const maxYardY = baseMaxY * 1.1;

  const maxHazardX = hazards.reduce((max, hazard) => {
    const half = hazard.width / 2;
    return Math.max(max, Math.abs(hazard.xCenter - half), Math.abs(hazard.xCenter + half));
  }, 0);

  const maxLandingX = absoluteShots.reduce((max, shot) => {
    const pathMaxX = shot.path.reduce((innerMax, point) => Math.max(innerMax, Math.abs(point.x)), Math.abs(shot.landing.x));

    return Math.max(max, Math.abs(shot.landing.x), pathMaxX, Math.abs(shot.origin.x));
  }, 0);

  const halfYardX = Math.max(maxHazardX, maxLandingX, greenRadius, 22) * 1.25;

  return { maxYardY, halfYardX };
}

/**
 * ローカル座標(各ショット時点の「ピン方向基準」)を、
 * ホール全体の絶対座標(ティー基準)へ逐次変換する。
 *
 * これにより2打目以降は
 * 「前ショット着弾点から現在のピン方向へ打つ」
 * 通常ゴルフに近い見え方で描画できる。
 */
function buildAbsoluteShots(
  landingResults: LandingResult[],
  targetDistance: number,
): AbsoluteShot[] {
  const pin: Point2D = { x: 0, y: targetDistance };
  let current: Point2D = { x: 0, y: 0 };

  const transformed: AbsoluteShot[] = [];

  for (const shot of landingResults) {
    const toPinX = pin.x - current.x;
    const toPinY = pin.y - current.y;
    const toPinDistance = Math.hypot(toPinX, toPinY);

    // ピン方向の単位ベクトル。近距離で不安定な場合は真上方向を採用する。
    const forward: Point2D = toPinDistance > 1e-6
      ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
      : { x: 0, y: 1 };

    // forward から見て右方向の単位ベクトル。
    const right: Point2D = { x: forward.y, y: -forward.x };

    const toAbsolute = (localX: number, localY: number): Point2D => {
      return {
        x: current.x + forward.x * localY + right.x * localX,
        y: current.y + forward.y * localY + right.y * localX,
      };
    };

    const landing = toAbsolute(shot.finalX, shot.finalY);
    const pathFromTrajectory = shot.trajectoryPoints?.map((point) => toAbsolute(point.x, point.y)) ?? [];
    const path = pathFromTrajectory.length > 0 ? pathFromTrajectory : [current, landing];

    transformed.push({
      origin: current,
      landing,
      path,
      local: shot,
    });

    current = landing;
  }

  return transformed;
}

export function HoleMapCanvas({
  hole,
  landingResults,
  showTrajectories = true,
  className,
}: HoleMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: MIN_CANVAS_HEIGHT });

  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_RADIUS;
  const hazards = useMemo(() => hole.hazards ?? [], [hole.hazards]);
  const absoluteShots = useMemo(
    () => buildAbsoluteShots(landingResults, targetDistance),
    [landingResults, targetDistance],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const width = Math.max(1, Math.round(wrapper.clientWidth));
      const height = Math.max(MIN_CANVAS_HEIGHT, Math.round(width * 0.62));
      setSize((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(wrapper);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 再描画時は必ずクリアして、ゴースト描画が残らないようにする。
    context.clearRect(0, 0, size.width, size.height);

    const padding = { top: 20, right: 18, bottom: 18, left: 18 };
    const drawWidth = size.width - padding.left - padding.right;
    const drawHeight = size.height - padding.top - padding.bottom;

    const { maxYardY, halfYardX } = buildYardBounds(targetDistance, greenRadius, hazards, absoluteShots);

    const yardToPxX = (yardX: number) => padding.left + drawWidth * ((yardX + halfYardX) / (halfYardX * 2));
    const yardToPxY = (yardY: number) => padding.top + drawHeight * (1 - yardY / maxYardY);

    const teeX = yardToPxX(0);
    const teeY = yardToPxY(0);
    const pinX = yardToPxX(0);
    const pinY = yardToPxY(targetDistance);
    const greenRadiusPx = Math.max(10, (greenRadius / maxYardY) * drawHeight);

    // 背景グラデーションを引いて、地形の奥行きを視覚化する。
    const bg = context.createLinearGradient(0, padding.top, 0, size.height - padding.bottom);
    bg.addColorStop(0, "#dcfce7");
    bg.addColorStop(1, "#86efac");
    context.fillStyle = bg;
    context.fillRect(padding.left, padding.top, drawWidth, drawHeight);

    // ピン周囲にグリーン領域を円として描画し、オン判定の範囲を視覚化する。
    context.fillStyle = "rgba(187, 247, 208, 0.72)";
    context.strokeStyle = "rgba(21, 128, 61, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(pinX, pinY, greenRadiusPx, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // センターライン(ティー→ピン)を点線で描き、基準軸をわかりやすくする。
    context.save();
    context.setLineDash([6, 6]);
    context.strokeStyle = "rgba(22, 101, 52, 0.55)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(teeX, teeY);
    context.lineTo(pinX, pinY);
    context.stroke();
    context.restore();

    // ハザードを矩形で描画。種別に応じて色を変える。
    for (const hazard of hazards) {
      const style = getHazardStyle(hazard.type);
      const leftYard = hazard.xCenter - hazard.width / 2;
      const rightYard = hazard.xCenter + hazard.width / 2;
      const topYard = hazard.yBack;
      const bottomYard = hazard.yFront;

      const leftPx = yardToPxX(leftYard);
      const rightPx = yardToPxX(rightYard);
      const topPx = yardToPxY(topYard);
      const bottomPx = yardToPxY(bottomYard);

      const widthPx = Math.max(2, rightPx - leftPx);
      const heightPx = Math.max(2, bottomPx - topPx);

      context.fillStyle = style.fill;
      context.strokeStyle = style.stroke;
      context.lineWidth = 1.5;
      context.fillRect(leftPx, topPx, widthPx, heightPx);
      context.strokeRect(leftPx, topPx, widthPx, heightPx);
    }

    // ティー位置を描画。
    context.fillStyle = "#065f46";
    context.beginPath();
    context.arc(teeX, teeY, 6, 0, Math.PI * 2);
    context.fill();

    // ピン位置を旗で描画。
    context.strokeStyle = "#166534";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(pinX, pinY + 8);
    context.lineTo(pinX, pinY - 12);
    context.stroke();

    context.fillStyle = "#ef4444";
    context.beginPath();
    context.moveTo(pinX, pinY - 12);
    context.lineTo(pinX + 12, pinY - 8);
    context.lineTo(pinX, pinY - 4);
    context.closePath();
    context.fill();

    // 複数球の着地点を描画。必要に応じて簡易軌跡も表示する。
    for (const shot of absoluteShots) {
      const landingX = yardToPxX(shot.landing.x);
      const landingY = yardToPxY(shot.landing.y);
      const originX = yardToPxX(shot.origin.x);
      const originY = yardToPxY(shot.origin.y);

      if (showTrajectories) {
        context.save();
        context.strokeStyle = "rgba(220, 38, 38, 0.55)";
        context.lineWidth = 2;

        // trajectoryPoints がある場合は lineTo で線をつなぎ、
        // ない場合は簡易2次ベジェで左右の曲がりを可視化する。
        if (shot.path.length > 1) {
          context.beginPath();
          context.moveTo(originX, originY);
          for (const point of shot.path) {
            context.lineTo(yardToPxX(point.x), yardToPxY(point.y));
          }
          context.stroke();
        } else {
          const controlX = yardToPxX((shot.origin.x + shot.landing.x) * 0.5 + shot.local.lateralDeviation * 0.15);
          const controlY = yardToPxY(Math.max((shot.origin.y + shot.landing.y) * 0.52, 1));
          context.beginPath();
          context.moveTo(originX, originY);
          context.quadraticCurveTo(controlX, controlY, landingX, landingY);
          context.stroke();
        }

        context.restore();
      }

      context.fillStyle = "#dc2626";
      context.beginPath();
      context.arc(landingX, landingY, 4.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.9)";
      context.lineWidth = 1.5;
      context.stroke();
    }

    // 右上に縮尺の目安を表示。
    context.fillStyle = "rgba(6, 95, 70, 0.78)";
    context.font = "12px sans-serif";
    context.textAlign = "right";
    context.fillText(`Scale: 1px = ${(maxYardY / drawHeight).toFixed(2)} yd`, size.width - 12, 18);
  }, [absoluteShots, greenRadius, hazards, showTrajectories, size.height, size.width, targetDistance]);

  return (
    <div
      ref={wrapperRef}
      className={className ?? "w-full overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50/70"}
    >
      <canvas ref={canvasRef} className="block w-full" aria-label="ホールマップ" />
    </div>
  );
}
