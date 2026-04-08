import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
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
  holeComplete?: boolean;
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

type Viewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_VIEWPORT: Viewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
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
  yardScale: number;
  offsetX: number;
  offsetY: number;
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
      stroke: "rgba(161, 98, 7, 0.65)",
    };
  }

  if (type === "water") {
    return {
      fill: "rgba(59, 130, 246, 0.38)",
      stroke: "rgba(220, 38, 38, 0.95)",
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

function drawObBoundaryMarkers(
  context: CanvasRenderingContext2D,
  hazard: Hazard,
  yardToPxX: (yardX: number) => number,
  yardToPxY: (yardY: number) => number,
) {
  if (hazard.type !== "ob") {
    return;
  }

  const leftYard = hazard.xCenter - hazard.width / 2;
  const rightYard = hazard.xCenter + hazard.width / 2;
  const innerBoundaryYard = Math.abs(leftYard) < Math.abs(rightYard) ? leftYard : rightYard;
  const markerSize = 5;
  const markerXBoundary = yardToPxX(innerBoundaryYard);
  const markerInset = 1;
  const markerLeftPx = hazard.xCenter < 0
    ? markerXBoundary - markerSize - markerInset
    : markerXBoundary + markerInset;
  const startYard = Math.ceil(hazard.yFront / 50) * 50;
  const endYard = hazard.yBack;

  if (startYard > endYard) {
    return;
  }

  context.save();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.lineWidth = 1;

  for (let yard = startYard; yard <= endYard + 1e-6; yard += 50) {
    const markerY = yardToPxY(yard);
    context.fillRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
    context.strokeRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
  }

  context.restore();
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  holeComplete = false,
  onSelectHazardId,
  onSelectHoleArea,
  onHazardsChange,
}: HoleMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: MIN_CANVAS_HEIGHT });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const metricsRef = useRef<CanvasMetrics | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const animationFrameRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point2D | null>(null);
  const initialOffsetRef = useRef<Point2D>({ x: 0, y: 0 });

  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_RADIUS;
  const hazards = useMemo(() => hole.hazards ?? [], [hole.hazards]);
  const absoluteShots = useMemo(
    () => buildAbsoluteShots(landingResults, targetDistance),
    [landingResults, targetDistance],
  );

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
    const yardScale = Math.min(drawWidth / (halfYardX * 2), drawHeight / maxYardY);
    const offsetX = padding.left + (drawWidth - halfYardX * 2 * yardScale) / 2;
    const offsetY = padding.top + (drawHeight - maxYardY * yardScale);

    return {
      padding,
      drawWidth,
      drawHeight,
      maxYardY,
      halfYardX,
      yardScale,
      offsetX,
      offsetY,
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

  const pinPoint = useMemo<Point2D>(() => ({ x: 0, y: targetDistance }), [targetDistance]);

  const distanceToPin = useMemo(() => Math.hypot(currentOrigin.x - pinPoint.x, currentOrigin.y - pinPoint.y), [currentOrigin, pinPoint]);

  const screenToWorld = (screenX: number, screenY: number, overrideViewport: Viewport = viewport): Point2D => ({
    x: (screenX - overrideViewport.offsetX) / overrideViewport.scale,
    y: (screenY - overrideViewport.offsetY) / overrideViewport.scale,
  });

  const animateViewportTo = useCallback((target: Viewport, duration = 450) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const start = viewportRef.current;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = easeInOut(elapsed);
      const nextViewport = {
        scale: start.scale + (target.scale - start.scale) * eased,
        offsetX: start.offsetX + (target.offsetX - start.offsetX) * eased,
        offsetY: start.offsetY + (target.offsetY - start.offsetY) * eased,
      };

      viewportRef.current = nextViewport;
      setViewport(nextViewport);

      if (elapsed < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, []);

  const resetViewport = () => {
    animateViewportTo(DEFAULT_VIEWPORT);
  };

  const buildCenteredViewport = (scale: number, centerPoint: Point2D): Viewport => {
    const centerScreen = {
      x: yardToPxX(centerPoint.x),
      y: yardToPxY(centerPoint.y),
    };

    return {
      scale,
      offsetX: size.width / 2 - scale * centerScreen.x,
      offsetY: size.height / 2 - scale * centerScreen.y,
    };
  };

  const getAutoZoomScale = (distance: number) => {
    const clampedDistance = clamp(distance, 0, 100);
    return 2.5 + (100 - clampedDistance) / 100 * 1.5;
  };

  const handleCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (editable || !metrics) return;
    event.preventDefault();

    const delta = -event.deltaY * 0.0015;
    const nextScale = clamp(viewport.scale * (1 + delta), 0.8, 5);
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldAtCursor = screenToWorld(cursorX, cursorY);

    const nextViewport = {
      scale: nextScale,
      offsetX: cursorX - worldAtCursor.x * nextScale,
      offsetY: cursorY - worldAtCursor.y * nextScale,
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (editable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    panStartRef.current = { x: event.clientX, y: event.clientY };
    initialOffsetRef.current = { x: viewport.offsetX, y: viewport.offsetY };
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const deltaX = event.clientX - panStartRef.current.x;
    const deltaY = event.clientY - panStartRef.current.y;
    const nextViewport = {
      ...viewport,
      offsetX: initialOffsetRef.current.x + deltaX,
      offsetY: initialOffsetRef.current.y + deltaY,
    };

    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  };

  const handleCanvasPointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  };

  const isViewportDefault = viewport.scale === 1 && viewport.offsetX === 0 && viewport.offsetY === 0;

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!metrics || holeComplete || editable) return;
    if (distanceToPin <= 100) {
      const targetScale = getAutoZoomScale(distanceToPin);
      const targetViewport = buildCenteredViewport(targetScale, pinPoint);
      animateViewportTo(targetViewport);
    }
  }, [distanceToPin, metrics, size.width, size.height, targetDistance, pinPoint, animateViewportTo, holeComplete, editable]);

  useEffect(() => {
    if (holeComplete) {
      resetViewport();
    }
  }, [holeComplete, resetViewport]);

  const yardToPxX = (yardX: number) => {
    if (!metrics) return 0;
    const { halfYardX, yardScale, offsetX } = metrics;
    return offsetX + (yardX + halfYardX) * yardScale;
  };

  const yardToPxY = (yardY: number) => {
    if (!metrics) return 0;
    const { maxYardY, yardScale, offsetY } = metrics;
    return offsetY + (maxYardY - yardY) * yardScale;
  };

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

    const { padding, drawWidth, drawHeight, halfYardX, maxYardY, yardScale, offsetX, offsetY } = metrics;
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

    context.save();
    context.translate(viewport.offsetX, viewport.offsetY);
    context.scale(viewport.scale, viewport.scale);

    const yardToPxX = (yardX: number) => offsetX + (yardX + halfYardX) * yardScale;
    const yardToPxY = (yardY: number) => offsetY + (maxYardY - yardY) * yardScale;

    const teeX = yardToPxX(0);
    const teeY = yardToPxY(0);
    const pinX = yardToPxX(0);
    const pinY = yardToPxY(targetDistance);
    const greenRadiusPx = Math.max(1, Math.abs(greenRadius * yardScale));

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

    // ピン周囲にグリーン領域を円として描画し、同一スケールで正しい範囲を視覚化する。
    context.fillStyle = "rgba(187, 247, 208, 0.72)";
    context.strokeStyle = "rgba(21, 128, 61, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(pinX, pinY, greenRadiusPx, greenRadiusPx, 0, 0, Math.PI * 2);
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

      if (hazard.type === "water") {
        context.save();
        context.setLineDash([6, 4]);
        context.strokeRect(leftPx, topPx, widthPx, heightPx);
        context.restore();
      } else {
        context.setLineDash([]);
        context.strokeRect(leftPx, topPx, widthPx, heightPx);
      }

      drawObBoundaryMarkers(context, hazard, yardToPxX, yardToPxY);

      const label = buildHazardDisplayName(hazard);
      context.save();
      context.font = "bold 10px sans-serif";
      context.textAlign = "center";
      context.lineWidth = 2;
      context.strokeStyle = "rgba(0, 0, 0, 0.6)";
      context.fillStyle = "#ffffff";

      if (widthPx >= 26 && heightPx >= 16) {
        const labelX = leftPx + widthPx / 2;
        const labelY = topPx + heightPx / 2;
        context.textBaseline = "middle";
        context.strokeText(label, labelX, labelY);
        context.fillText(label, labelX, labelY);
      } else if (widthPx >= 14 && heightPx >= 10) {
        const labelX = leftPx + widthPx / 2;
        const labelY = topPx - 4;
        context.textBaseline = "bottom";
        context.strokeText(label, labelX, labelY);
        context.fillText(label, labelX, labelY);
      }

      context.restore();
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

    context.restore();
  }, [absoluteAimPoint, absoluteShots, editable, greenRadius, hazards, metrics, showTrajectories, size.height, size.width, targetDistance, transientShot, viewport]);

  const metricToPx = (hazard: Hazard) => {
    const currentMetrics = metrics ?? metricsRef.current;
    if (!currentMetrics) {
      return null;
    }

    const { offsetX, offsetY, yardScale, maxYardY } = currentMetrics;
    const yardToPxX = (yardX: number) => offsetX + (yardX + currentMetrics.halfYardX) * yardScale;
    const yardToPxY = (yardY: number) => offsetY + (maxYardY - yardY) * yardScale;

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

    const yardPerPx = 1 / metrics.yardScale;
    const deltaX = (clientX - state.startClientX) * yardPerPx;
    const deltaY = -(clientY - state.startClientY) * yardPerPx;

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
      <canvas
        ref={canvasRef}
        className="block w-full"
        aria-label="ホールマップ"
        onWheel={handleCanvasWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
      />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-2 p-3">
        {!editable && !isViewportDefault && (
          <button
            type="button"
            onClick={resetViewport}
            className="pointer-events-auto rounded-full bg-emerald-900/90 px-3 py-1 text-xs font-semibold text-white shadow-lg transition hover:bg-emerald-700"
          >
            全体表示に戻す
          </button>
        )}
      </div>
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
              : "border-transparent bg-transparent";

            const startDrag = (event: React.PointerEvent<HTMLElement>, mode: DragMode, handle?: ResizeHandle) => {
              if (dragState) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }

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
                {isSelected && (
                  <>
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
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
