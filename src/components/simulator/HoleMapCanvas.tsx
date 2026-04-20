import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Hole, Hazard, HazardType } from "../../types/game";
import type { LandingResult } from "../../utils/landingPosition";
import { buildAutoHazardName } from "../../utils/shotOutcome";
import { getHazardStyle } from "./hazardStyle";
import { drawPolygon } from "./drawPolygon";
import { drawRectangle } from "./drawRectangle";
import { drawObBoundaryMarkers } from "./drawObBoundaryMarkers";
import { TEXTURE_PATHS_TOPDOWN as TEXTURE_PATHS } from "../texturePaths";
import type { TextureKey } from "../texturePaths";

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
  useExtendedYAxis?: boolean;
  allowDynamicScale?: boolean;
  selectedHazardId?: string | null;
  currentHoleKey?: string | number;
  holeComplete?: boolean;
  onSelectHazardId?: (hazardId: string | null) => void;
  onSelectHoleArea?: () => void;
  onHazardsChange?: (hazards: Hazard[]) => void;
  onGreenPolygonChange?: (greenPolygon: Point2D[]) => void;
  onCanvasClick?: (point: Point2D) => void;
  onCanvasDoubleClick?: (point: Point2D) => void;
  showViewportResetButton?: boolean;
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
  mode: DragMode | "vertex";
  handle?: ResizeHandle;
  vertexIndex?: number;
  startClientX: number;
  startClientY: number;
  initialHazard: Hazard;
  initialGreenPolygonPoints?: Point2D[];
};

type CanvasMetrics = {
  padding: { top: number; right: number; bottom: number; left: number };
  drawWidth: number;
  drawHeight: number;
  maxYardY: number;
  minYardY: number;
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

const HAZARD_TEXTURE_ORDER: TextureKey[] = [
  "rough",
  "bareground",
  "ob",
  "bunker",
  "water",
];

const TEE_GROUND_WIDTH = 20;
const TEE_GROUND_HEIGHT = 30;
const TEE_GROUND_CORNER_RADIUS = 2;
const MIN_CANVAS_HEIGHT = 280;
const COURSE_WIDTH_YARDS = 400;
const DEFAULT_GREEN_RADIUS = 12;
const GREEN_SELECTION_ID = "__green__";
const GREEN_POLYGON_SIDES = 20;

const HAZARD_TYPE_LABEL: Record<HazardType, string> = {
  bunker: "バンカー",
  water: "ウォーター",
  ob: "OB",
  rough: "ラフ",
  semirough: "セミラフ",
  bareground: "ベアグラウンド",
};
const MIN_HAZARD_WIDTH = 8;
const MIN_HAZARD_DEPTH = 6;
const EDITABLE_Y_AXIS_OFFSET_YARDS = 25;
const EDITABLE_HAZARD_MAX_X = 200;

function buildRegularPolygonPoints(centerX: number, centerY: number, radius: number, sides: number, irregularity: number = 0) {
  const points: Point2D[] = [];
  const amount = Math.max(0, Math.min(irregularity, 0.3));
  for (let index = 0; index < sides; index += 1) {
    const angle = (2 * Math.PI * index) / sides - Math.PI / 2;
    const randomRatio = 1 + (Math.random() * 2 - 1) * amount;
    points.push({
      x: centerX + radius * randomRatio * Math.cos(angle),
      y: centerY + radius * randomRatio * Math.sin(angle),
    });
  }
  return points;
}

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


/**
 * ホール全体を収めるための距離レンジを算出する。
 * - Y軸(奥行き): ティー(0y)からピンまでを基本に、ハザードと着地点の最大距離まで拡張
 *   (ショット結果を空にすると、コースプレビューと同じ Y 軸に揃えられる)
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

  const baseMaxY = Math.max(targetDistance, maxHazardY, maxLandingY, 1);
  const maxYardY = baseMaxY * 1.06;

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
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
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

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(landingX, landingY, 4.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#000000";
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

function drawRoundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const topBump = Math.min(6, width * 0.03, height * 0.05);
  const bottomBump = topBump * 0.8;
  const sideBump = Math.min(4, width * 0.02, height * 0.04);
  const centerY = y + height / 2;
  const rightX = x + width;
  const bottomMidX = x + width * 0.5;

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width * 0.55, y);
  context.quadraticCurveTo(bottomMidX, y - topBump, x + width - r, y);
  context.quadraticCurveTo(rightX, y, rightX, y + r);
  context.lineTo(rightX, centerY - 8);
  context.quadraticCurveTo(rightX + sideBump, centerY, rightX, centerY + 8);
  context.lineTo(rightX, y + height - r);
  context.quadraticCurveTo(rightX, y + height, x + width - r, y + height);
  context.lineTo(x + width * 0.45, y + height);
  context.quadraticCurveTo(bottomMidX, y + height + bottomBump, x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, centerY + 8);
  context.quadraticCurveTo(x - sideBump, centerY, x, centerY - 8);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fill();
  if (context.lineWidth > 0 && context.strokeStyle !== "transparent") {
    context.stroke();
  }
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
  useExtendedYAxis = false,
  selectedHazardId = null,
  allowDynamicScale = true,
  currentHoleKey,
  holeComplete = false,
  onSelectHazardId,
  onSelectHoleArea,
  onHazardsChange,
  onGreenPolygonChange,
  onCanvasClick,
  onCanvasDoubleClick,
  showViewportResetButton = true,
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
  const [greenPolygon, setGreenPolygon] = useState<Point2D[]>(() => {
    const initialPoints = hole.greenPolygon;
    if (Array.isArray(initialPoints) && initialPoints.length >= 3) {
      return initialPoints.map((point) => ({ x: point.x, y: point.y }));
    }
    return buildRegularPolygonPoints(0, hole.targetDistance ?? hole.distanceFromTee, hole.greenRadius ?? DEFAULT_GREEN_RADIUS, GREEN_POLYGON_SIDES, 0.1);
  });
  const panStartRef = useRef<Point2D | null>(null);
  const initialOffsetRef = useRef<Point2D>({ x: 0, y: 0 });
  const [textures, setTextures] = useState<Record<TextureKey, HTMLImageElement | null>>(() => ({
    fairway: null,
    rough: null,
    bareground: null,
    bunker: null,
    green: null,
    teeground: null,
    water: null,
    ob: null,
  }));

  const targetDistance = hole.targetDistance ?? hole.distanceFromTee;
  const greenRadius = hole.greenRadius ?? DEFAULT_GREEN_RADIUS;
  const hazards = useMemo(() => hole.hazards ?? [], [hole.hazards]);
  const absoluteShots = useMemo(
    () => buildAbsoluteShots(landingResults, targetDistance),
    [landingResults, targetDistance],
  );
  const yardBounds = useMemo(
    () => buildYardBounds(targetDistance, greenRadius, hazards, absoluteShots),
    [targetDistance, greenRadius, hazards, absoluteShots],
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
    const { maxYardY, halfYardX } = buildYardBounds(
      targetDistance,
      greenRadius,
      hazards,
      useExtendedYAxis ? [] : absoluteShots,
    );
    const minYardY = (editable || useExtendedYAxis) ? -EDITABLE_Y_AXIS_OFFSET_YARDS : -TEE_GROUND_HEIGHT / 2;
    const effectiveMaxYardY = useExtendedYAxis ? Math.min(maxYardY, targetDistance + 80) : maxYardY;
    const yardRange = effectiveMaxYardY - minYardY;
    const yardScale = Math.min(drawWidth / (halfYardX * 2), drawHeight / yardRange);
    const offsetX = padding.left + (drawWidth - halfYardX * 2 * yardScale) / 2;
    const offsetY = padding.top + (drawHeight - yardRange * yardScale);

    return {
      padding,
      drawWidth,
      drawHeight,
      maxYardY: effectiveMaxYardY,
      minYardY,
      halfYardX,
      yardScale,
      offsetX,
      offsetY,
    };
  }, [allowDynamicScale, editable, greenRadius, hazards, size.height, size.width, targetDistance, absoluteShots]);
  const currentOrigin = shotOrigin ?? (absoluteShots.length > 0 ? absoluteShots[absoluteShots.length - 1].landing : { x: 0, y: 0 });
  const transientShot = useMemo(() => {
    if (!transientLandingResult) return null;
    return buildAbsoluteShotFromOrigin(currentOrigin, transientLandingResult, targetDistance);
  }, [currentOrigin, targetDistance, transientLandingResult]);

  const shouldUseTextures = !editable;

  useEffect(() => {
    const initialPoints = hole.greenPolygon;
    if (Array.isArray(initialPoints) && initialPoints.length >= 3) {
      setGreenPolygon(initialPoints.map((point) => ({ x: point.x, y: point.y })));
      return;
    }

    setGreenPolygon(buildRegularPolygonPoints(0, targetDistance, greenRadius, GREEN_POLYGON_SIDES, 0.1));
  }, [targetDistance, greenRadius, hole.number, hole.greenPolygon]);

  useEffect(() => {
    if (!shouldUseTextures) {
      return;
    }

    let active = true;
    const nextTextures: Record<TextureKey, HTMLImageElement | null> = {
      fairway: null,
      rough: null,
      bareground: null,
      bunker: null,
      green: null,
      teeground: null,
      water: null,
      ob: null,
    };
    let remaining = Object.keys(TEXTURE_PATHS).length;

    const checkFinish = () => {
      remaining -= 1;
      if (remaining <= 0 && active) {
        setTextures(nextTextures);
      }
    };

    for (const key of Object.keys(TEXTURE_PATHS) as TextureKey[]) {
      const image = new Image();
      image.src = TEXTURE_PATHS[key];
      image.onload = () => {
        if (!active) return;
        nextTextures[key] = image;
        checkFinish();
      };
      image.onerror = () => {
        if (!active) return;
        nextTextures[key] = null;
        checkFinish();
      };
    }

    return () => {
      active = false;
    };
  }, [shouldUseTextures]);
  const absoluteAimPoint = useMemo(() => {
    if (!aimPoint) return null;
    return buildAbsolutePointFromOrigin(currentOrigin, targetDistance, aimPoint.x, aimPoint.y);
  }, [aimPoint, currentOrigin, targetDistance]);

  const screenToWorld = (screenX: number, screenY: number, overrideViewport: Viewport = viewport): Point2D => ({
    x: (screenX - overrideViewport.offsetX) / overrideViewport.scale,
    y: (screenY - overrideViewport.offsetY) / overrideViewport.scale,
  });

  const resolveHazardTextureType = (type: string): TextureKey => {
    if (type === "semirough" || type === "rough") return "rough";
    if (type === "bareground") return "bareground";
    if (type === "bunker") return "bunker";
    if (type === "water") return "water";
    if (type === "ob") return "ob";
    return "rough";
  };

  const createTexturePattern = (context: CanvasRenderingContext2D, key: TextureKey | null) => {
    if (!shouldUseTextures || !key) return null;
    const image = textures[key];
    if (!image) return null;
    return context.createPattern(image, "repeat");
  };

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
    if (currentHoleKey == null || editable) {
      return;
    }
    setDragState(null);
    resetViewport();
  }, [currentHoleKey, resetViewport, editable]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const aspectRatio = Math.max(
      0.7,
      Math.min(2.5, yardBounds.maxYardY / COURSE_WIDTH_YARDS),
    );

    const updateSize = () => {
      const width = Math.max(1, Math.round(wrapper.clientWidth));
      const height = Math.max(MIN_CANVAS_HEIGHT, Math.round(width * aspectRatio));
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
  }, [yardBounds]);

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

    // 背景にフェアウェイテクスチャを敷き、読み込みできない場合はグラデーションを使う。
    if (shouldUseTextures) {
      const fairwayPattern = createTexturePattern(context, "fairway");
      if (fairwayPattern) {
        context.save();
        context.fillStyle = fairwayPattern;
        context.globalAlpha = 0.96;
        context.fillRect(padding.left, padding.top, drawWidth, drawHeight);
        context.restore();
      } else {
        const bg = context.createLinearGradient(0, padding.top, 0, size.height - padding.bottom);
        bg.addColorStop(0, "#dcfce7");
        bg.addColorStop(1, "#86efac");
        context.fillStyle = bg;
        context.fillRect(padding.left, padding.top, drawWidth, drawHeight);
      }
    } else {
      const bg = context.createLinearGradient(0, padding.top, 0, size.height - padding.bottom);
      bg.addColorStop(0, "#dcfce7");
      bg.addColorStop(1, "#86efac");
      context.fillStyle = bg;
      context.fillRect(padding.left, padding.top, drawWidth, drawHeight);
    }

    const teeGroundLeft = yardToPxX(-TEE_GROUND_WIDTH / 2);
    const teeGroundRight = yardToPxX(TEE_GROUND_WIDTH / 2);
    const teeGroundTop = yardToPxY(TEE_GROUND_HEIGHT / 2);
    const teeGroundBottom = yardToPxY(-TEE_GROUND_HEIGHT / 2);
    const teeGroundWidthPx = teeGroundRight - teeGroundLeft;
    const teeGroundHeightPx = teeGroundBottom - teeGroundTop;
    const teeGroundPattern = shouldUseTextures ? createTexturePattern(context, "teeground") : null;

    context.save();
    if (teeGroundPattern) {
      context.fillStyle = teeGroundPattern;
      context.globalAlpha = 0.92;
    } else {
      context.fillStyle = "rgba(187, 247, 208, 0.72)";
    }
    if (editable) {
      context.strokeStyle = "rgba(16, 185, 129, 0.85)";
      context.lineWidth = 1.2;
    } else {
      context.strokeStyle = "transparent";
      context.lineWidth = 0;
    }
    drawRoundedRectangle(
      context,
      teeGroundLeft,
      teeGroundTop,
      teeGroundWidthPx,
      teeGroundHeightPx,
      Math.min(TEE_GROUND_CORNER_RADIUS * yardScale, teeGroundWidthPx / 2, teeGroundHeightPx / 2),
    );
    context.restore();

    context.save();
    context.lineWidth = 1;
    context.font = "11px sans-serif";
    context.fillStyle = "rgba(6, 95, 70, 0.85)";

    const firstY = Math.min(0, Math.floor(metrics.minYardY / 50) * 50);
    for (let y = firstY; y <= maxYardY + 0.01; y += 50) {
      const py = yardToPxY(y);
      const isMajorGuide = y >= 0 && Math.abs(y) % 100 === 0;
      const isZeroGuide = y === 0;
      const isHighlightedZero = editable && isZeroGuide;

      context.strokeStyle = isHighlightedZero
        ? "rgba(16, 185, 129, 0.85)"
        : isZeroGuide
          ? "rgba(6, 95, 70, 0.5)"
          : isMajorGuide
            ? "rgba(21, 94, 117, 0.45)"
            : "rgba(6, 95, 70, 0.18)";
      context.lineWidth = isHighlightedZero ? 2 : (isMajorGuide ? 1.8 : 1);
      context.setLineDash(isHighlightedZero ? [6, 4] : []);
      context.beginPath();
      context.moveTo(padding.left, py);
      context.lineTo(padding.left + drawWidth, py);
      context.stroke();
      context.setLineDash([]);

      if (y >= 0) {
        context.fillStyle = isHighlightedZero
          ? "rgba(16, 185, 129, 0.92)"
          : isMajorGuide
            ? "rgba(21, 94, 117, 0.92)"
            : "rgba(6, 95, 70, 0.85)";
        context.font = isHighlightedZero || isMajorGuide ? "bold 11px sans-serif" : "11px sans-serif";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText(`${Math.round(y)}`, padding.left - 2, py);
      }
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

    // ハザード描画: rough / bareground / ob / bunker を先に描画し、water は最後に描く。
    const sortedHazards = [...hazards].sort((a, b) => {
      const orderA = HAZARD_TEXTURE_ORDER.indexOf(resolveHazardTextureType(a.type));
      const orderB = HAZARD_TEXTURE_ORDER.indexOf(resolveHazardTextureType(b.type));
      return orderA - orderB;
    });

    // ポリゴンの重なりによる色の二重適用を防ぐため、タイプごとにグループ化して描画
    // OBは他のタイプと重なった場合、色が二重にならないように最後に不透明で描画
    const hazardsByType = new Map<string, typeof sortedHazards>();
    const obHazards: typeof sortedHazards = [];
    for (const hazard of sortedHazards) {
      if (hazard.type === "water") continue;
      if (hazard.type === "ob") {
        obHazards.push(hazard);
        continue;
      }
      const type = hazard.type;
      if (!hazardsByType.has(type)) {
        hazardsByType.set(type, []);
      }
      hazardsByType.get(type)!.push(hazard);
    }

    for (const [type, typeHazards] of hazardsByType) {
      const style = getHazardStyle(type as Hazard["type"]);
      const textureKey = resolveHazardTextureType(type);
      const pattern = shouldUseTextures ? createTexturePattern(context, textureKey) : null;

      // オフスクリーンキャンバスを作成して、同じタイプのハザードをまとめて描画
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      if (!offscreenCtx) continue;

      offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offscreenCtx.translate(viewport.offsetX, viewport.offsetY);
      offscreenCtx.scale(viewport.scale, viewport.scale);

      // RGBA色から不透明色を抽出（アルファを1.0に設定）
      const opaqueFill = style.fill.replace(/[\d.]+\)$/, '1)');

      for (const hazard of typeHazards) {
        const isPolygon = hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3;
        const shouldHidePolygonStroke = isPolygon && !editable;

        offscreenCtx.save();
        if (pattern) {
          offscreenCtx.fillStyle = pattern;
          offscreenCtx.globalAlpha = 1;
        } else {
          offscreenCtx.fillStyle = opaqueFill;
        }
        offscreenCtx.strokeStyle = shouldHidePolygonStroke ? "transparent" : style.stroke;
        offscreenCtx.lineWidth = shouldHidePolygonStroke ? 0 : 1.5;

        if (isPolygon) {
          drawPolygon(offscreenCtx, hazard, yardToPxX, yardToPxY);
        } else {
          drawRectangle(offscreenCtx, hazard, yardToPxX, yardToPxY);
        }
        offscreenCtx.restore();
      }

      // オフスクリーンキャンバスをメインキャンバスに合成
      context.save();
      if (pattern) {
        context.globalAlpha = 0.94;
      } else {
        // 元の色のアルファ値を抽出して適用
        const alphaMatch = style.fill.match(/[\d.]+\)$/);
        const alpha = alphaMatch ? parseFloat(alphaMatch[0]) : 0.5;
        context.globalAlpha = alpha;
      }
      context.drawImage(offscreenCanvas, 0, 0);
      context.restore();

      // 境界線マーカーを描画
      for (const hazard of typeHazards) {
        drawObBoundaryMarkers(context, hazard, yardToPxX, yardToPxY);
      }
    }

    // OBハザードを最後に不透明で描画（他のハザードと重なっても色が二重にならないように）
    if (obHazards.length > 0) {
      const obStyle = getHazardStyle("ob");
      const obOffscreenCanvas = document.createElement('canvas');
      obOffscreenCanvas.width = canvas.width;
      obOffscreenCanvas.height = canvas.height;
      const obOffscreenCtx = obOffscreenCanvas.getContext('2d');
      if (obOffscreenCtx) {
        obOffscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        obOffscreenCtx.translate(viewport.offsetX, viewport.offsetY);
        obOffscreenCtx.scale(viewport.scale, viewport.scale);

        for (const hazard of obHazards) {
          const isPolygon = hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3;
          const shouldHidePolygonStroke = isPolygon && !editable;

          obOffscreenCtx.save();
          obOffscreenCtx.fillStyle = obStyle.fill.replace(/[\d.]+\)$/, '1)');
          obOffscreenCtx.strokeStyle = shouldHidePolygonStroke ? "transparent" : obStyle.stroke;
          obOffscreenCtx.lineWidth = shouldHidePolygonStroke ? 0 : 1.5;

          if (isPolygon) {
            drawPolygon(obOffscreenCtx, hazard, yardToPxX, yardToPxY);
          } else {
            drawRectangle(obOffscreenCtx, hazard, yardToPxX, yardToPxY);
          }
          obOffscreenCtx.restore();
        }

        // OBは不透明で描画
        context.save();
        context.globalAlpha = 1;
        context.drawImage(obOffscreenCanvas, 0, 0);
        context.restore();
      }
    }

    // ピン周囲のグリーン領域を 30 辺のポリゴンで描画。
    const greenPattern = shouldUseTextures ? createTexturePattern(context, "green") : null;
    context.save();
    context.beginPath();
    greenPolygon.forEach((point, index) => {
      const x = yardToPxX(point.x);
      const y = yardToPxY(point.y);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.closePath();
    if (greenPattern) {
      context.fillStyle = greenPattern;
      context.globalAlpha = 0.94;
      context.fill();
    } else {
      context.fillStyle = "rgba(34, 197, 94, 0.85)";
      context.fill();
    }
    if (editable) {
      context.strokeStyle = "rgba(16, 185, 129, 0.98)";
      context.lineWidth = 2;
      context.lineJoin = "round";
      context.stroke();
    }
    context.restore();

    // water を最後に描画し、緑地やバンカー上に重ねる。
    for (const hazard of sortedHazards) {
      if (hazard.type !== "water") continue;
      const style = getHazardStyle(hazard.type);
      const textureKey = resolveHazardTextureType(hazard.type);
      const pattern = shouldUseTextures ? createTexturePattern(context, textureKey) : null;
      const isPolygon = hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3;
      const shouldHidePolygonStroke = isPolygon && !editable;

      context.save();
      if (pattern) {
        context.fillStyle = pattern;
        context.globalAlpha = 0.94;
      } else {
        context.fillStyle = style.fill;
      }
      context.strokeStyle = shouldHidePolygonStroke ? "transparent" : style.stroke;
      context.lineWidth = shouldHidePolygonStroke ? 0 : 1.5;

      if (isPolygon) {
        drawPolygon(context, hazard, yardToPxX, yardToPxY);
      } else {
        drawRectangle(context, hazard, yardToPxX, yardToPxY);
      }
      context.restore();
      drawObBoundaryMarkers(context, hazard, yardToPxX, yardToPxY);
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

    if (hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3) {
      const xs = hazard.points.map((p) => p.x);
      const ys = hazard.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const left = yardToPxX(minX);
      const right = yardToPxX(maxX);
      const top = yardToPxY(maxY);
      const bottom = yardToPxY(minY);
      return {
        left,
        top,
        width: Math.max(2, right - left),
        height: Math.max(2, bottom - top),
      };
    } else {
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
    }
  };

  const metricPointsToPx = (points: Point2D[]) => {
    const currentMetrics = metrics ?? metricsRef.current;
    if (!currentMetrics || points.length === 0) {
      return null;
    }

    const { offsetX, offsetY, yardScale, maxYardY } = currentMetrics;
    const yardToPxX = (yardX: number) => offsetX + (yardX + currentMetrics.halfYardX) * yardScale;
    const yardToPxY = (yardY: number) => offsetY + (maxYardY - yardY) * yardScale;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      left: yardToPxX(minX),
      top: yardToPxY(maxY),
      width: Math.max(2, yardToPxX(maxX) - yardToPxX(minX)),
      height: Math.max(2, yardToPxY(minY) - yardToPxY(maxY)),
    };
  };

  const updateHazardByDrag = (state: DragState, clientX: number, clientY: number) => {
    const metrics = metricsRef.current;
    if (!metrics) return;
    const yardPerPx = 1 / metrics.yardScale;
    const deltaX = (clientX - state.startClientX) * yardPerPx;
    const deltaY = -(clientY - state.startClientY) * yardPerPx;

    if (state.hazardId === GREEN_SELECTION_ID) {
        if (!state.initialGreenPolygonPoints) return;

        if (state.mode === "move") {
          const minX = -metrics.halfYardX;
          const maxX = metrics.halfYardX;
          const minY = metrics.minYardY;
          const maxY = metrics.maxYardY;

          const newPoints = state.initialGreenPolygonPoints.map((pt) => ({
            x: Math.max(minX, Math.min(maxX, pt.x + deltaX)),
            y: Math.max(minY, Math.min(maxY, pt.y + deltaY)),
          }));

          setGreenPolygon(newPoints);
          onGreenPolygonChange?.(newPoints);
          return;
        }

        if (state.mode === "vertex" && typeof state.vertexIndex === "number") {
          const idx = state.vertexIndex;
          const currentPoints = state.initialGreenPolygonPoints;
          if (idx < 0 || idx >= currentPoints.length) return;

          const minX = -metrics.halfYardX;
          const maxX = metrics.halfYardX;
          const minY = metrics.minYardY;
          const maxY = metrics.maxYardY;

          const newPoints = currentPoints.map((pt, i) => {
            if (i !== idx) return pt;
            return {
              x: Math.max(minX, Math.min(maxX, pt.x + deltaX)),
              y: Math.max(minY, Math.min(maxY, pt.y + deltaY)),
            };
          });

          setGreenPolygon(newPoints);
          onGreenPolygonChange?.(newPoints);
        }

        return;
      }
    if (!onHazardsChange) return;
    const next = hazards.map((hazard) => {
      if (hazard.id !== state.hazardId) return hazard;
      const original = state.initialHazard;

      // 頂点ドラッグ（自由変形: その頂点だけ動かす）
      if (state.mode === "vertex" && typeof state.vertexIndex === "number" && Array.isArray(hazard.points) && Array.isArray(state.initialHazard.points)) {
        const idx = state.vertexIndex;
        const initialPoints = state.initialHazard.points;
        if (initialPoints.length < 3) return hazard;

        const minX = editable ? -EDITABLE_HAZARD_MAX_X : -metrics.halfYardX;
        const maxX = editable ? EDITABLE_HAZARD_MAX_X : metrics.halfYardX;
        const minY = metrics.minYardY;
        const maxY = editable ? targetDistance + 200 : metrics.maxYardY;

        const newPoints = initialPoints.map((pt, i) => {
          if (i !== idx) return pt;
          return {
            x: Math.max(minX, Math.min(maxX, pt.x + deltaX)),
            y: Math.max(minY, Math.min(maxY, pt.y + deltaY)),
          };
        });

        const xs = newPoints.map((p) => p.x);
        const ys = newPoints.map((p) => p.y);
        return {
          ...hazard,
          points: newPoints,
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          xCenter: (Math.max(...xs) + Math.min(...xs)) / 2,
          yFront: Math.min(...ys),
          yBack: Math.max(...ys),
        };
      }

      // polygon全体move
      if (state.mode === "move" && hazard.shape === "polygon" && Array.isArray(hazard.points) && Array.isArray(state.initialHazard.points)) {
        const rawPoints = state.initialHazard.points.map((pt) => ({ x: pt.x + deltaX, y: pt.y + deltaY }));
        const xs = rawPoints.map((p) => p.x);
        const ys = rawPoints.map((p) => p.y);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);

        const boundaryX = editable ? EDITABLE_HAZARD_MAX_X : metrics.halfYardX;
        const maxY = editable ? targetDistance + 200 : metrics.maxYardY;
        const shiftX = left < -boundaryX
          ? -boundaryX - left
          : right > boundaryX
            ? boundaryX - right
            : 0;
        const shiftY = top < metrics.minYardY
          ? metrics.minYardY - top
          : bottom > maxY
            ? maxY - bottom
            : 0;

        const newPoints = rawPoints.map((pt) => ({ x: pt.x + shiftX, y: pt.y + shiftY }));
        const clampedXs = newPoints.map((p) => p.x);
        const clampedYs = newPoints.map((p) => p.y);

        return {
          ...hazard,
          points: newPoints,
          x: Math.min(...clampedXs),
          y: Math.min(...clampedYs),
          width: Math.max(...clampedXs) - Math.min(...clampedXs),
          height: Math.max(...clampedYs) - Math.min(...clampedYs),
          xCenter: (Math.max(...clampedXs) + Math.min(...clampedXs)) / 2,
          yFront: Math.min(...clampedYs),
          yBack: Math.max(...clampedYs),
        };
      }

      // 矩形 move/resize
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

      const minY = metrics.minYardY;
      const maxY = editable ? targetDistance + 200 : metrics.maxYardY;
      front = Math.max(minY, front);
      back = Math.min(maxY, back);

      if (back - front < MIN_HAZARD_DEPTH) {
        if (front <= minY) {
          back = Math.min(maxY, front + MIN_HAZARD_DEPTH);
        } else {
          front = Math.max(minY, back - MIN_HAZARD_DEPTH);
        }
      }

      const maxEdge = editable ? EDITABLE_HAZARD_MAX_X : metrics.halfYardX;
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

  // --- ポリゴン作成用canvasクリックイベント ---
  const convertScreenPointToYardPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!metrics) {
      return { x: 0, y: 0 };
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left - viewport.offsetX) / viewport.scale;
    const canvasY = (event.clientY - rect.top - viewport.offsetY) / viewport.scale;
    const worldX = (canvasX - metrics.offsetX) / metrics.yardScale - metrics.halfYardX;
    const worldY = metrics.maxYardY - (canvasY - metrics.offsetY) / metrics.yardScale;

    return { x: worldX, y: worldY };
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCanvasClick) return;
    onCanvasClick(convertScreenPointToYardPoint(event));
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCanvasDoubleClick) return;
    onCanvasDoubleClick(convertScreenPointToYardPoint(event));
  };

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
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-2 p-3">
        {!editable && !isViewportDefault && showViewportResetButton && (
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
          {[...hazards].sort((a, b) => {
            // Unlocked hazards should appear on top (rendered last)
            if (a.locked && !b.locked) return -1;
            if (!a.locked && b.locked) return 1;
            return 0;
          }).map((hazard) => {
            const box = metricToPx(hazard);
            if (!box) {
              return null;
            }

            const isSelected = selectedHazardId === hazard.id;
            const isLocked = hazard.locked ?? false;
            const baseClass = isSelected
              ? "border-emerald-900 bg-emerald-300/20"
              : isLocked
                ? "border-slate-500 bg-slate-300/20"
                : "border-transparent bg-transparent";

            const startDrag = (event: React.PointerEvent<HTMLElement>, mode: DragMode | "vertex", handleOrIndex?: ResizeHandle | number) => {
              if (isLocked) return;
              if (dragState) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelectHazardId?.(hazard.id);
              setDragState({
                hazardId: hazard.id,
                mode,
                handle: typeof handleOrIndex === "string" ? handleOrIndex : undefined,
                vertexIndex: typeof handleOrIndex === "number" ? handleOrIndex : undefined,
                startClientX: event.clientX,
                startClientY: event.clientY,
                initialHazard: { ...hazard },
              });
            };

            return (
              <div
                key={hazard.id}
                className={`absolute border-2 pointer-events-auto ${baseClass}`}
                style={{
                  left: `${box.left}px`,
                  top: `${box.top}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                  zIndex: isLocked ? 0 : 10,
                }}
                onPointerDown={(event) => startDrag(event, "move")}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectHazardId?.(hazard.id);
                }}
              >
                {(isSelected || isLocked) && (
                  <div className="pointer-events-none absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] rounded bg-emerald-950/75 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
                    {isLocked ? '🔒 ' : ''}{HAZARD_TYPE_LABEL[hazard.type]}
                  </div>
                )}
                {isSelected && !isLocked && (
                  <>
                    {hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3 ? (
                      hazard.points.map((pt, idx) => {
                        const px = yardToPxX(pt.x);
                        const py = yardToPxY(pt.y);
                        return (
                          <span
                            key={`${hazard.id}-pt-${idx}`}
                            className="absolute h-3 w-3 rounded-full border border-white bg-emerald-700 cursor-pointer"
                            style={{
                              left: `${px - box.left - 6}px`,
                              top: `${py - box.top - 6}px`,
                            }}
                            onPointerDown={(event) => startDrag(event, "vertex", idx)}
                          />
                        );
                      })
                    ) : (
                      (["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => {
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
                      })
                    )}
                  </>
                )}
              </div>
            );
          })}
          {(() => {
            const box = metricPointsToPx(greenPolygon);
            if (!box) return null;

            const isSelected = selectedHazardId === GREEN_SELECTION_ID;
            const baseClass = isSelected
              ? "border-emerald-900 bg-emerald-300/20"
              : "border-transparent bg-transparent";

            const pointPaths = greenPolygon
              .map((pt) => {
                const px = yardToPxX(pt.x);
                const py = yardToPxY(pt.y);
                return `${px - box.left},${py - box.top}`;
              })
              .join(" ");

            return (
              <div
                key={GREEN_SELECTION_ID}
                className={`pointer-events-auto absolute border-2 ${baseClass}`}
                style={{
                  left: `${box.left}px`,
                  top: `${box.top}px`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectHazardId?.(GREEN_SELECTION_ID);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectHazardId?.(GREEN_SELECTION_ID);
                }}
              >
                <svg
                  className="pointer-events-none absolute inset-0"
                  viewBox={`0 0 ${box.width} ${box.height}`}
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={pointPaths}
                    fill="none"
                    stroke="rgba(34, 197, 94, 0.85)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
                {isSelected && (
                  <>
                    <div className="pointer-events-none absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] rounded bg-emerald-950/75 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
                      GREEN
                    </div>
                    {greenPolygon.map((pt, idx) => {
                      const px = yardToPxX(pt.x);
                      const py = yardToPxY(pt.y);
                      return (
                        <span
                          key={`${GREEN_SELECTION_ID}-pt-${idx}`}
                          className="absolute h-3 w-3 rounded-full border border-white bg-emerald-700 cursor-pointer"
                          style={{
                            left: `${px - box.left - 6}px`,
                            top: `${py - box.top - 6}px`,
                          }}
                          onPointerDown={(event) => {
                            if (dragState) {
                              event.preventDefault();
                              event.stopPropagation();
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            onSelectHazardId?.(GREEN_SELECTION_ID);
                            setDragState({
                              hazardId: GREEN_SELECTION_ID,
                              mode: "vertex",
                              vertexIndex: idx,
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              initialHazard: {
                                id: GREEN_SELECTION_ID,
                                type: "rough",
                                shape: "polygon",
                                yFront: targetDistance - greenRadius,
                                yBack: targetDistance + greenRadius,
                                xCenter: 0,
                                width: greenRadius * 2,
                                penaltyStrokes: 0,
                              },
                              initialGreenPolygonPoints: greenPolygon,
                            });
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
