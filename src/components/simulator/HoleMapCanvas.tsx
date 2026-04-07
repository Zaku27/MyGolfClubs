import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Arrow, Text } from "react-konva";
import type { Hole, Hazard } from "../../types/game";
import type { LandingResult } from "../../utils/landingPosition";
import { buildAutoHazardName, buildHazardDisplayName } from "../../utils/shotOutcome";

interface HoleMapCanvasProps {
  hole: Hole;
  landingResults: Array<{ origin: Point2D; landing: LandingResult }>;
  transientLandingResult?: LandingResult | null;
  aimPoint?: { x: number; y: number } | null;
  shotOrigin?: { x: number; y: number } | null;
  highlightPoint?: { x: number; y: number } | null;
  showTrajectories?: boolean;
  className?: string;
  editable?: boolean;
  selectedHazardId?: string | null;
  currentHoleKey?: string | number;
  onSelectHazardId?: (hazardId: string | null) => void;
  onSelectHoleArea?: () => void;
  onHazardsChange?: (hazards: Hazard[]) => void;
}

type Size = {
  width: number;
  height: number;
};

type Point2D = {
  x: number;
  y: number;
};

type DragMode = "move" | "resize";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type DragState = {
  hazardId: string;
  mode: DragMode;
  handle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  initialHazard: Hazard;
};

type CanvasMetrics = {
  padding: { top: number; right: number; bottom: number; left: number };
  drawWidth: number;
  drawHeight: number;
  maxYardY: number;
  halfYardX: number;
};

type AbsoluteShot = {
  origin: Point2D;
  landing: Point2D;
  path: Point2D[];
  local: LandingResult;
};

const MIN_CANVAS_HEIGHT = 280;
const DEFAULT_GREEN_RADIUS = 12;
const MIN_HAZARD_WIDTH = 8;
const MIN_HAZARD_DEPTH = 6;

function chooseYardTickStep(range: number, targetTickCount = 8): number {
  if (range <= 0) {
    return 10;
  }

  const roughStep = range / Math.max(2, targetTickCount);
  const powers = [1, 2, 5, 10, 20, 25, 50, 100];

  for (const unit of powers) {
    if (roughStep <= unit) {
      return unit;
    }
  }

  return 100;
}

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

  if (type === "bareground") {
    return {
      fill: "rgba(168, 162, 158, 0.35)",
      stroke: "rgba(99, 92, 84, 0.95)",
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
  landingResults: Array<{ origin: Point2D; landing: LandingResult }>,
  targetDistance: number,
): AbsoluteShot[] {
  const pin: Point2D = { x: 0, y: targetDistance };
  const transformed: AbsoluteShot[] = [];

  for (const shot of landingResults) {
    const origin = shot.origin;
    const toPinX = pin.x - origin.x;
    const toPinY = pin.y - origin.y;
    const toPinDistance = Math.hypot(toPinX, toPinY);

    const forward: Point2D = toPinDistance > 1e-6
      ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
      : { x: 0, y: 1 };

    const right: Point2D = { x: forward.y, y: -forward.x };

    const toAbsolute = (localX: number, localY: number): Point2D => {
      return {
        x: origin.x + forward.x * localY + right.x * localX,
        y: origin.y + forward.y * localY + right.y * localX,
      };
    };

    const landing = toAbsolute(shot.landing.finalX, shot.landing.finalY);
    const pathFromTrajectory = shot.landing.trajectoryPoints?.map((point) => toAbsolute(point.x, point.y)) ?? [];
    const path = pathFromTrajectory.length > 0 ? pathFromTrajectory : [origin, landing];

    transformed.push({
      origin,
      landing,
      path,
      local: shot.landing,
    });
  }

  return transformed;
}

function buildAbsoluteShotFromOrigin(
  origin: Point2D,
  shot: LandingResult,
  targetDistance: number,
): AbsoluteShot {
  const toAbsolute = (localX: number, localY: number): Point2D => {
    const pin: Point2D = { x: 0, y: targetDistance };
    const toPinX = pin.x - origin.x;
    const toPinY = pin.y - origin.y;
    const toPinDistance = Math.hypot(toPinX, toPinY);

    const forward: Point2D = toPinDistance > 1e-6
      ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
      : { x: 0, y: 1 };

    const right: Point2D = { x: forward.y, y: -forward.x };

    return {
      x: origin.x + forward.x * localY + right.x * localX,
      y: origin.y + forward.y * localY + right.y * localX,
    };
  };

  const landing = toAbsolute(shot.finalX, shot.finalY);
  const pathFromTrajectory = shot.trajectoryPoints?.map((point) => toAbsolute(point.x, point.y)) ?? [];

  return {
    origin,
    landing,
    path: pathFromTrajectory.length > 0 ? pathFromTrajectory : [origin, landing],
    local: shot,
  };
}

function buildAbsolutePointFromOrigin(
  origin: Point2D,
  targetDistance: number,
  localX: number,
  localY: number,
): Point2D {
  const pin: Point2D = { x: 0, y: targetDistance };
  const toPinX = pin.x - origin.x;
  const toPinY = pin.y - origin.y;
  const toPinDistance = Math.hypot(toPinX, toPinY);

  const forward: Point2D = toPinDistance > 1e-6
    ? { x: toPinX / toPinDistance, y: toPinY / toPinDistance }
    : { x: 0, y: 1 };

  const right: Point2D = { x: forward.y, y: -forward.x };

  return {
    x: origin.x + forward.x * localY + right.x * localX,
    y: origin.y + forward.y * localY + right.y * localX,
  };
}

function drawShot(
  context: CanvasRenderingContext2D,
  shot: AbsoluteShot,
  yardToPxX: (yardX: number) => number,
  yardToPxY: (yardY: number) => number,
  showTrajectories: boolean,
  drawLandingPoint: boolean,
) {
  const landingX = yardToPxX(shot.landing.x);
  const landingY = yardToPxY(shot.landing.y);
  const originX = yardToPxX(shot.origin.x);
  const originY = yardToPxY(shot.origin.y);

  if (showTrajectories) {
    context.save();
    context.strokeStyle = "rgba(220, 38, 38, 0.55)";
    context.lineWidth = 2;

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

  if (!drawLandingPoint) {
    return;
  }

  context.fillStyle = "#dc2626";
  context.beginPath();
  context.arc(landingX, landingY, 4.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = 1.5;
  context.stroke();
}

function drawHighlightPoint(
  context: CanvasRenderingContext2D,
  point: Point2D,
  yardToPxX: (yardX: number) => number,
  yardToPxY: (yardY: number) => number,
) {
  const x = yardToPxX(point.x);
  const y = yardToPxY(point.y);

  context.save();
  context.fillStyle = "rgba(220, 38, 38, 0.95)";
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

export function HoleMapCanvas({
  hole,
  landingResults,
  transientLandingResult = null,
  aimPoint = null,
  shotOrigin = null,
  highlightPoint = null,
  showTrajectories = true,
  className,
  editable = false,
  selectedHazardId = null,
  currentHoleKey,
  onSelectHazardId,
  onSelectHoleArea,
  onHazardsChange,
}: HoleMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: MIN_CANVAS_HEIGHT });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const metricsRef = useRef<CanvasMetrics | null>(null);

  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_RADIUS;
  const hazards = useMemo(() => hole.hazards ?? [], [hole.hazards]);
  const absoluteShots = useMemo(
    () => buildAbsoluteShots(landingResults, targetDistance),
    [landingResults, targetDistance],
  );

  const selectedHazard = useMemo(
    () => hazards.find((hazard) => hazard.id === selectedHazardId) ?? null,
    [hazards, selectedHazardId],
  );

  const slopeCondition = selectedHazard?.groundCondition ?? hole.groundCondition ?? {
    hardness: "medium",
    slopeAngle: 0,
    slopeDirection: 0,
  };

  const metrics = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) {
      return null;
    }

    const padding = editable
      ? { top: 26, right: 22, bottom: 30, left: 56 }
      : { top: 20, right: 18, bottom: 18, left: 30 };
    const drawWidth = size.width - padding.left - padding.right;
    const drawHeight = size.height - padding.top - padding.bottom;
    const { maxYardY, halfYardX } = buildYardBounds(targetDistance, greenRadius, hazards, absoluteShots);

    return {
      padding,
      drawWidth,
      drawHeight,
      maxYardY,
      halfYardX,
    };
  }, [editable, greenRadius, hazards, size.height, size.width, targetDistance, absoluteShots]);
  const currentOrigin = shotOrigin ?? (absoluteShots.length > 0 ? absoluteShots[absoluteShots.length - 1].landing : { x: 0, y: 0 });
  const transientShot = useMemo(() => {
    if (!transientLandingResult) return null;
    return buildAbsoluteShotFromOrigin(currentOrigin, transientLandingResult, targetDistance);
  }, [currentOrigin, targetDistance, transientLandingResult]);
  const absoluteAimPoint = useMemo(() => {
    if (!aimPoint) return null;
    return buildAbsolutePointFromOrigin(currentOrigin, targetDistance, aimPoint.x, aimPoint.y);
  }, [aimPoint, currentOrigin, targetDistance]);

  const yardToPxX = (yardX: number) => {
    if (!metrics) return 0;
    const { padding, drawWidth, halfYardX } = metrics;
    return padding.left + drawWidth * ((yardX + halfYardX) / (halfYardX * 2));
  };

  const yardToPxY = (yardY: number) => {
    if (!metrics) return 0;
    const { padding, drawHeight, maxYardY } = metrics;
    return padding.top + drawHeight * (1 - yardY / maxYardY);
  };

  const slopeArrow = useMemo(() => {
    if (!metrics) return null;
    const centerYard = Math.max(0, targetDistance * 0.35);
    const startX = yardToPxX(0);
    const startY = yardToPxY(centerYard);
    const length = Math.max(40, Math.min(100, 40 + Math.abs(slopeCondition.slopeAngle) * 2.5));
    const rad = ((270 + slopeCondition.slopeDirection) % 360) * (Math.PI / 180);
    const endX = startX + Math.cos(rad) * length;
    const endY = startY + Math.sin(rad) * length;

    return {
      points: [startX, startY, endX, endY],
      angleLabel: slopeCondition.slopeAngle,
      directionLabel: slopeCondition.slopeDirection,
      textX: startX + Math.cos(rad) * 6 + 4,
      textY: startY + Math.sin(rad) * 6 - 18,
    };
  }, [metrics, targetDistance, slopeCondition]);

  useEffect(() => {
    if (currentHoleKey == null) {
      return;
    }
    setDragState(null);
  }, [currentHoleKey]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const width = Math.max(1, Math.round(wrapper.clientWidth));
      const height = Math.max(MIN_CANVAS_HEIGHT, Math.round(width * 1.75));
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
    if (!canvas || size.width <= 0 || size.height <= 0 || !metrics) return;

    metricsRef.current = metrics;

    const { padding, drawWidth, drawHeight, halfYardX, maxYardY } = metrics;
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

    const yardToPxX = (yardX: number) => padding.left + drawWidth * ((yardX + halfYardX) / (halfYardX * 2));
    const yardToPxY = (yardY: number) => padding.top + drawHeight * (1 - yardY / maxYardY);

    const teeX = yardToPxX(0);
    const teeY = yardToPxY(0);
    const pinX = yardToPxX(0);
    const pinY = yardToPxY(targetDistance);
    const greenRadiusPxX = Math.max(1, Math.abs(greenRadius * (drawWidth / (halfYardX * 2))));
    const greenRadiusPxY = Math.max(1, Math.abs(greenRadius * (drawHeight / maxYardY)));

    // 背景グラデーションを引いて、地形の奥行きを視覚化する。
    const bg = context.createLinearGradient(0, padding.top, 0, size.height - padding.bottom);
    bg.addColorStop(0, "#dcfce7");
    bg.addColorStop(1, "#86efac");
    context.fillStyle = bg;
    context.fillRect(padding.left, padding.top, drawWidth, drawHeight);

    context.save();
    context.lineWidth = 1;
    context.font = "11px sans-serif";
    context.fillStyle = "rgba(6, 95, 70, 0.85)";

    for (let y = 0; y <= maxYardY + 0.01; y += 50) {
      const py = yardToPxY(y);
      const isMajorGuide = y % 100 === 0;
      context.strokeStyle = y === 0
        ? "rgba(6, 95, 70, 0.5)"
        : isMajorGuide
          ? "rgba(21, 94, 117, 0.45)"
          : "rgba(6, 95, 70, 0.18)";
      context.lineWidth = isMajorGuide ? 1.8 : 1;
      context.beginPath();
      context.moveTo(padding.left, py);
      context.lineTo(padding.left + drawWidth, py);
      context.stroke();

      context.fillStyle = isMajorGuide
        ? "rgba(21, 94, 117, 0.92)"
        : "rgba(6, 95, 70, 0.85)";
      context.font = isMajorGuide ? "bold 11px sans-serif" : "11px sans-serif";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(`${Math.round(y)}`, padding.left - 2, py);
    }

    context.fillStyle = "rgba(6, 95, 70, 0.9)";
    context.font = "11px sans-serif";

    if (editable) {
      const xStep = chooseYardTickStep(halfYardX * 2, 10);

      for (let x = -Math.floor(halfYardX / xStep) * xStep; x <= halfYardX + 0.01; x += xStep) {
        const px = yardToPxX(x);
        context.strokeStyle = x === 0 ? "rgba(6, 95, 70, 0.5)" : "rgba(6, 95, 70, 0.16)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(px, padding.top);
        context.lineTo(px, padding.top + drawHeight);
        context.stroke();

        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(`${Math.round(x)}`, px, padding.top + drawHeight + 4);
      }

      context.textAlign = "right";
      context.fillText("X (yd)", padding.left + drawWidth, padding.top + drawHeight + 16);
    }

    context.restore();

    // ピン周囲にグリーン領域を楕円として描画し、X/Y スケールが異なる図面でも正しい範囲を視覚化する。
    context.fillStyle = "rgba(187, 247, 208, 0.72)";
    context.strokeStyle = "rgba(21, 128, 61, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(pinX, pinY, greenRadiusPxX, greenRadiusPxY, 0, 0, Math.PI * 2);
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

      if (widthPx >= 26 && heightPx >= 16) {
        const label = buildHazardDisplayName(hazard);
        context.save();
        context.font = "bold 10px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = 2;
        context.strokeStyle = "rgba(0, 0, 0, 0.6)";
        context.strokeText(label, leftPx + widthPx / 2, topPx + heightPx / 2);
        context.fillStyle = "#ffffff";
        context.fillText(label, leftPx + widthPx / 2, topPx + heightPx / 2);
        context.restore();
      }
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
      drawShot(context, shot, yardToPxX, yardToPxY, showTrajectories, true);
    }

    if (transientShot) {
      context.save();
      context.beginPath();
      context.rect(padding.left, padding.top, drawWidth, drawHeight);
      context.clip();
      drawShot(context, transientShot, yardToPxX, yardToPxY, showTrajectories, false);
      context.restore();
    }

    if (absoluteAimPoint) {
      const markerX = yardToPxX(absoluteAimPoint.x);
      const markerY = yardToPxY(absoluteAimPoint.y);
      context.save();
      context.strokeStyle = "rgba(14, 116, 144, 0.95)";
      context.lineWidth = 2.5;
      const sizePx = 8;
      context.beginPath();
      context.moveTo(markerX - sizePx, markerY - sizePx);
      context.lineTo(markerX + sizePx, markerY + sizePx);
      context.moveTo(markerX - sizePx, markerY + sizePx);
      context.lineTo(markerX + sizePx, markerY - sizePx);
      context.stroke();
      context.restore();
    }

    if (highlightPoint) {
      drawHighlightPoint(context, highlightPoint, yardToPxX, yardToPxY);
    }

    // 右上に縮尺の目安を表示。
    context.fillStyle = "rgba(6, 95, 70, 0.78)";
    context.font = "12px sans-serif";
    context.textAlign = "right";
    context.fillText(`Scale: 1px = ${(maxYardY / drawHeight).toFixed(2)} yd`, size.width - 12, 18);
  }, [absoluteAimPoint, absoluteShots, editable, greenRadius, hazards, showTrajectories, size.height, size.width, targetDistance, transientShot]);

  const metricToPx = (hazard: Hazard) => {
    const currentMetrics = metrics ?? metricsRef.current;
    if (!currentMetrics) {
      return null;
    }

    const { padding, drawHeight, drawWidth, halfYardX, maxYardY } = currentMetrics;
    const yardToPxX = (yardX: number) => padding.left + drawWidth * ((yardX + halfYardX) / (halfYardX * 2));
    const yardToPxY = (yardY: number) => padding.top + drawHeight * (1 - yardY / maxYardY);

    const leftYard = hazard.xCenter - hazard.width / 2;
    const rightYard = hazard.xCenter + hazard.width / 2;
    const topYard = hazard.yBack;
    const bottomYard = hazard.yFront;

    const left = yardToPxX(leftYard);
    const right = yardToPxX(rightYard);
    const top = yardToPxY(topYard);
    const bottom = yardToPxY(bottomYard);

    return {
      left,
      top,
      width: Math.max(2, right - left),
      height: Math.max(2, bottom - top),
    };
  };

  const updateHazardByDrag = (state: DragState, clientX: number, clientY: number) => {
    if (!onHazardsChange) {
      return;
    }

    const metrics = metricsRef.current;
    if (!metrics) {
      return;
    }

    const yardPerPxX = (metrics.halfYardX * 2) / metrics.drawWidth;
    const yardPerPxY = metrics.maxYardY / metrics.drawHeight;
    const deltaX = (clientX - state.startClientX) * yardPerPxX;
    const deltaY = -(clientY - state.startClientY) * yardPerPxY;

    const next = hazards.map((hazard) => {
      if (hazard.id !== state.hazardId) {
        return hazard;
      }

      const original = state.initialHazard;

      let left = original.xCenter - original.width / 2;
      let right = original.xCenter + original.width / 2;
      let front = original.yFront;
      let back = original.yBack;

      if (state.mode === "move") {
        left += deltaX;
        right += deltaX;
        front += deltaY;
        back += deltaY;
      } else if (state.handle) {
        if (state.handle === "nw" || state.handle === "sw") {
          left += deltaX;
        }
        if (state.handle === "ne" || state.handle === "se") {
          right += deltaX;
        }
        if (state.handle === "nw" || state.handle === "ne") {
          back += deltaY;
        }
        if (state.handle === "sw" || state.handle === "se") {
          front += deltaY;
        }
      }

      if (right - left < MIN_HAZARD_WIDTH) {
        const center = (left + right) / 2;
        left = center - MIN_HAZARD_WIDTH / 2;
        right = center + MIN_HAZARD_WIDTH / 2;
      }

      if (back - front < MIN_HAZARD_DEPTH) {
        const center = (front + back) / 2;
        front = center - MIN_HAZARD_DEPTH / 2;
        back = center + MIN_HAZARD_DEPTH / 2;
      }

      front = Math.max(0, front);
      back = Math.min(metrics.maxYardY, back);

      if (back - front < MIN_HAZARD_DEPTH) {
        if (front <= 0) {
          back = MIN_HAZARD_DEPTH;
        } else {
          front = Math.max(0, back - MIN_HAZARD_DEPTH);
        }
      }

      const maxEdge = metrics.halfYardX;
      const width = right - left;
      const centerX = (left + right) / 2;
      const minCenter = -maxEdge + width / 2;
      const maxCenter = maxEdge - width / 2;
      const clampedCenter = Math.max(minCenter, Math.min(maxCenter, centerX));

      return {
        ...hazard,
        xCenter: clampedCenter,
        width,
        yFront: front,
        yBack: back,
        name: buildAutoHazardName(hazard.type, clampedCenter, width),
      };
    });

    onHazardsChange(next);
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const move = (event: PointerEvent) => {
      updateHazardByDrag(dragState, event.clientX, event.clientY);
    };

    const up = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragState, hazards]);

  return (
    <div
      ref={wrapperRef}
      className={className ?? "relative w-full overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50/70"}
      onClick={() => onSelectHoleArea?.()}
    >
      <canvas ref={canvasRef} className="block w-full" aria-label="ホールマップ" />
      {metrics && slopeArrow && (
        <Stage
          width={size.width}
          height={size.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <Layer>
            <Arrow
              points={slopeArrow.points}
              pointerLength={12}
              pointerWidth={10}
              fill="#f97316"
              stroke="#ea580c"
              strokeWidth={4}
              tension={0}
            />
            <Text
              x={slopeArrow.textX}
              y={slopeArrow.textY}
              text={`Slope ${slopeArrow.angleLabel}°, ${slopeArrow.directionLabel}°`}
              fill="#065f46"
              fontSize={12}
              fontStyle="bold"
            />
          </Layer>
        </Stage>
      )}
      {editable && (
        <div className="pointer-events-none absolute inset-0">
          {hazards.map((hazard) => {
            const box = metricToPx(hazard);
            if (!box) {
              return null;
            }

            const isSelected = selectedHazardId === hazard.id;
            const baseClass = isSelected
              ? "border-emerald-900 bg-emerald-300/20"
              : "border-emerald-700/70 bg-emerald-300/10";

            const startDrag = (event: React.PointerEvent<HTMLElement>, mode: DragMode, handle?: ResizeHandle) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelectHazardId?.(hazard.id);
              setDragState({
                hazardId: hazard.id,
                mode,
                handle,
                startClientX: event.clientX,
                startClientY: event.clientY,
                initialHazard: { ...hazard },
              });
            };

            return (
              <div
                key={hazard.id}
                className={`pointer-events-auto absolute border-2 ${baseClass}`}
                style={{
                  left: `${box.left}px`,
                  top: `${box.top}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                }}
                onPointerDown={(event) => startDrag(event, "move")}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectHazardId?.(hazard.id);
                }}
              >
                <div className="pointer-events-none absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] rounded bg-emerald-950/75 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
                  {buildHazardDisplayName(hazard)}
                </div>
                {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => {
                  const styleByHandle: Record<ResizeHandle, string> = {
                    nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
                    ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
                    sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
                    se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
                  };

                  return (
                    <span
                      key={`${hazard.id}-${handle}`}
                      className={`absolute h-3 w-3 rounded-full border border-white bg-emerald-700 ${styleByHandle[handle]}`}
                      onPointerDown={(event) => startDrag(event, "resize", handle)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
