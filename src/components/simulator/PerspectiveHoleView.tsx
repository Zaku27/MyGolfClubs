import { useMemo } from "react";
import type { Hole, ShotContext, LieType } from "../../types/game";

interface Props {
  hole: Hole;
  shotContext: ShotContext;
  aimXOffset: number;
  lastShotResult?: {
    finalOutcome?: "fairway" | "rough" | "bunker" | "water" | "ob" | "green";
    landing?: {
      finalX: number;
      finalY: number;
    };
  } | null;
  className?: string;
}

const LIE_COLORS: Record<LieType, string> = {
  tee: "#10b981",      // emerald-500
  fairway: "#22c55e",  // green-500
  semirough: "#84cc16", // lime-500
  rough: "#65a30d",    // lime-600
  bareground: "#a8a29e", // stone-400
  bunker: "#fbbf24",   // amber-400
  green: "#34d399",    // emerald-400
};

const OUTCOME_COLORS: Record<string, string> = {
  fairway: "#22c55e",
  rough: "#65a30d",
  bunker: "#fbbf24",
  water: "#3b82f6",
  ob: "#ef4444",
  green: "#34d399",
};

export function PerspectiveHoleView({
  hole,
  shotContext,
  aimXOffset,
  lastShotResult,
  className = "",
}: Props) {
  const { remainingDistance, lie, originX, originY, targetDistance } = shotContext;

  // パースペクティブ投影パラメータ
  const perspective = useMemo(() => {
    const horizonY = 60; // 水平線のY位置（%）
    const vanishingPointY = 40; // 消失点のY位置（%）
    const scaleFactor = 0.6; // 遠景の縮小率
    const maxVisibleDistance = targetDistance * 1.2;

    // 距離をY座標に変換（近いほど下、遠いほど上）
    const distanceToY = (distance: number): number => {
      const normalized = Math.max(0, Math.min(1, 1 - distance / maxVisibleDistance));
      // 非線形変換でパースペクティブ感を出す
      const perspectiveNormalized = Math.pow(normalized, 0.7);
      return vanishingPointY + (100 - vanishingPointY) * perspectiveNormalized;
    };

    // 距離に応じたスケール
    const distanceToScale = (distance: number): number => {
      const normalized = Math.max(0, Math.min(1, 1 - distance / maxVisibleDistance));
      return scaleFactor + (1 - scaleFactor) * Math.pow(normalized, 0.5);
    };

    // 横位置の変換（パースペクティブ効果込み）
    const xToScreenX = (x: number, distance: number): number => {
      const scale = distanceToScale(distance);
      // 中心からのオフセットをスケールに適用
      return 50 + (x * scale * 0.8);
    };

    return {
      horizonY,
      vanishingPointY,
      maxVisibleDistance,
      distanceToY,
      distanceToScale,
      xToScreenX,
    };
  }, [targetDistance]);

  // ボール位置の計算
  const ballPosition = useMemo(() => {
    const y = perspective.distanceToY(originY);
    const x = perspective.xToScreenX(originX, originY);
    const scale = perspective.distanceToScale(originY);
    return { x, y, scale };
  }, [originX, originY, perspective]);

  // ピン位置の計算
  const pinPosition = useMemo(() => {
    const y = perspective.distanceToY(targetDistance);
    const x = 50; // ピンは常に中央
    const scale = perspective.distanceToScale(targetDistance);
    return { x, y, scale };
  }, [targetDistance, perspective]);

  // 狙い点の計算（aimXOffsetを適用）
  const aimPosition = useMemo(() => {
    const aimDistance = Math.max(0, targetDistance - remainingDistance);
    const y = perspective.distanceToY(aimDistance);
    // aimXOffsetは実距離なので、スケール変換を適用
    const scale = perspective.distanceToScale(aimDistance);
    const x = perspective.xToScreenX(aimXOffset, aimDistance);
    return { x, y, scale };
  }, [aimXOffset, remainingDistance, targetDistance, perspective]);

  // 前回ショットの着地点（あれば）
  const lastLandingPosition = useMemo(() => {
    if (!lastShotResult?.landing) return null;
    const { finalX, finalY } = lastShotResult.landing;
    const y = perspective.distanceToY(finalY);
    const x = perspective.xToScreenX(finalX, finalY);
    const scale = perspective.distanceToScale(finalY);
    return { x, y, scale, outcome: lastShotResult.finalOutcome };
  }, [lastShotResult, perspective]);

  // フェアウェイの描画パス生成
  const fairwayPath = useMemo(() => {
    const startY = perspective.distanceToY(0);
    const endY = perspective.distanceToY(targetDistance);
    const startWidth = 80;
    const endWidth = 30;

    // 台形のフェアウェイ
    return `
      M ${50 - startWidth / 2} ${startY}
      L ${50 + startWidth / 2} ${startY}
      L ${50 + endWidth / 2} ${endY}
      L ${50 - endWidth / 2} ${endY}
      Z
    `;
  }, [targetDistance, perspective]);

  // グリーンの描画
  const greenRect = useMemo(() => {
    const greenY = perspective.distanceToY(targetDistance);
    const greenScale = perspective.distanceToScale(targetDistance);
    const greenWidth = 15 * greenScale;
    const greenHeight = 8 * greenScale;
    return {
      x: 50 - greenWidth / 2,
      y: greenY - greenHeight / 2,
      width: greenWidth,
      height: greenHeight,
    };
  }, [targetDistance, perspective]);

  // ハザードの位置計算
  const hazardPositions = useMemo(() => {
    if (!hole.hazards) return [];

    return hole.hazards.map((hazard) => {
      const frontY = perspective.distanceToY(hazard.yFront);
      const backY = perspective.distanceToY(hazard.yBack);
      const midDistance = (hazard.yFront + hazard.yBack) / 2;
      const scale = perspective.distanceToScale(midDistance);

      if (hazard.shape === "rectangle") {
        const x = perspective.xToScreenX(hazard.xCenter - hazard.width / 2, midDistance);
        const width = hazard.width * scale * 0.8;
        const height = Math.abs(backY - frontY);
        return {
          type: hazard.type,
          x,
          y: frontY,
          width,
          height,
          scale,
        };
      } else {
        // ポリゴンの簡易表示（バウンディングボックス風）
        const x = perspective.xToScreenX(hazard.xCenter - hazard.width / 2, midDistance);
        const width = hazard.width * scale * 0.8;
        const height = Math.abs(backY - frontY);
        return {
          type: hazard.type,
          x,
          y: frontY,
          width,
          height,
          scale,
          isPolygon: true,
        };
      }
    });
  }, [hole.hazards, perspective]);

  const hazardColor = (type: string): string => {
    switch (type) {
      case "water":
        return "#3b82f6";
      case "bunker":
        return "#fbbf24";
      case "rough":
      case "semirough":
        return "#65a30d";
      case "ob":
        return "#ef4444";
      default:
        return "#9ca3af";
    }
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-sky-100 to-emerald-50 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ minHeight: "200px" }}
      >
        {/* 背景：空と地面 */}
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#f0fdf4" />
          </linearGradient>
          <linearGradient id="fairwayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* 背景 */}
        <rect width="100" height="100" fill="url(#skyGradient)" />

        {/* フェアウェイ */}
        <path d={fairwayPath} fill="url(#fairwayGradient)" opacity="0.8" />

        {/* ハザード */}
        {hazardPositions.map((hazard, index) => (
          <g key={index}>
            <rect
              x={hazard.x}
              y={hazard.y}
              width={hazard.width}
              height={hazard.height}
              fill={hazardColor(hazard.type)}
              opacity={0.6}
              rx={hazard.isPolygon ? 2 : 0}
            />
            {/* ハザードラベル */}
            <text
              x={hazard.x + hazard.width / 2}
              y={hazard.y + hazard.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="3"
              fill="white"
              fontWeight="bold"
              style={{ textShadow: "0.3px 0.3px 0.5px rgba(0,0,0,0.5)" }}
            >
              {hazard.type === "water" ? "W" : hazard.type === "bunker" ? "B" : "R"}
            </text>
          </g>
        ))}

        {/* グリーン */}
        <ellipse
          cx={50}
          cy={greenRect.y + greenRect.height / 2}
          rx={greenRect.width / 2}
          ry={greenRect.height / 2}
          fill="url(#greenGradient)"
          filter="url(#shadow)"
        />

        {/* ピン */}
        <g transform={`translate(${pinPosition.x}, ${pinPosition.y})`}>
          {/* ピンフラッグ */}
          <line x1="0" y1="0" x2="0" y2="-4" stroke="#1f2937" strokeWidth="0.3" />
          <polygon
            points="0,-4 3,-3 0,-2"
            fill="#ef4444"
            filter="url(#shadow)"
          />
          {/* ホール */}
          <circle cx="0" cy="0" r="0.8" fill="#1f2937" />
        </g>

        {/* 前回ショットの着地点マーカー */}
        {lastLandingPosition && (
          <g transform={`translate(${lastLandingPosition.x}, ${lastLandingPosition.y})`}>
            <circle
              r={2 * lastLandingPosition.scale}
              fill={OUTCOME_COLORS[lastLandingPosition.outcome || "fairway"]}
              opacity="0.5"
            />
            <circle
              r={1 * lastLandingPosition.scale}
              fill={OUTCOME_COLORS[lastLandingPosition.outcome || "fairway"]}
            />
          </g>
        )}

        {/* ボール */}
        <g transform={`translate(${ballPosition.x}, ${ballPosition.y})`}>
          {/* ボールの影 */}
          <ellipse
            cx="0.5"
            cy="0.5"
            rx={1.5 * ballPosition.scale}
            ry={0.8 * ballPosition.scale}
            fill="rgba(0,0,0,0.2)"
          />
          {/* ボール本体 */}
          <circle
            r={1.2 * ballPosition.scale}
            fill="white"
            stroke="#1f2937"
            strokeWidth="0.2"
            filter="url(#shadow)"
          />
          {/* ライの色インジケーター */}
          <circle
            r={0.8 * ballPosition.scale}
            fill={LIE_COLORS[lie]}
            opacity="0.8"
          />
        </g>

        {/* 狙い点マーカー */}
        <g transform={`translate(${aimPosition.x}, ${aimPosition.y})`}>
          {/* 十字マーカー */}
          <line
            x1={-2 * aimPosition.scale}
            y1="0"
            x2={2 * aimPosition.scale}
            y2="0"
            stroke="#ef4444"
            strokeWidth="0.4"
            opacity="0.8"
          />
          <line
            x1="0"
            y1={-2 * aimPosition.scale}
            x2="0"
            y2={2 * aimPosition.scale}
            stroke="#ef4444"
            strokeWidth="0.4"
            opacity="0.8"
          />
          {/* 狙い点リング */}
          <circle
            r={2.5 * aimPosition.scale}
            fill="none"
            stroke="#ef4444"
            strokeWidth="0.3"
            strokeDasharray="1,0.5"
            opacity="0.6"
          />
        </g>

        {/* 補助線：ボールから狙い点へ */}
        <line
          x1={ballPosition.x}
          y1={ballPosition.y}
          x2={aimPosition.x}
          y2={aimPosition.y}
          stroke="#ef4444"
          strokeWidth="0.2"
          strokeDasharray="1,1"
          opacity="0.5"
        />

        {/* 距離表示 */}
        <text
          x="5"
          y="8"
          fontSize="4"
          fill="#065f46"
          fontWeight="bold"
        >
          {remainingDistance}yd
        </text>

        {/* ライ表示 */}
        <text
          x="95"
          y="8"
          textAnchor="end"
          fontSize="3"
          fill="#065f46"
          fontWeight="bold"
        >
          {lie.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
