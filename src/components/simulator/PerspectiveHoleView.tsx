import { useMemo } from "react";
import type { Hole, ShotContext, LieType, HazardType } from "../../types/game";

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
  strokeLabel?: string;
  className?: string;
}

// ハザード位置の型定義
interface RectangleHazardPosition {
  type: HazardType;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  shape: "rectangle";
  pathData?: undefined;
  bbox?: undefined;
}

interface PolygonHazardPosition {
  type: HazardType;
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  scale: number;
  shape: "polygon";
  x?: undefined;
  y?: undefined;
  width?: undefined;
  height?: undefined;
}

type HazardPosition = RectangleHazardPosition | PolygonHazardPosition;

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
  ob: "#22c55e",
  green: "#34d399",
};

export function PerspectiveHoleView({
  hole,
  shotContext,
  aimXOffset,
  lastShotResult,
  strokeLabel,
  className = "",
}: Props) {
  const { remainingDistance, lie, originX, originY, targetDistance } = shotContext;

  // パースペクティブ投影パラメータ
  const perspective = useMemo(() => {
    const horizonY = 40; // 水平線のY位置（%）- 空と地面の境界
    const vanishingPointY = 16; // 消失点のY位置（%）
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

  // フェアウェイの描画パス生成（横幅広げた版）
  const fairwayPath = useMemo(() => {
    const startY = perspective.distanceToY(0);
    const endY = perspective.distanceToY(targetDistance);
    const startWidth = 100; // 広げた（80→100）
    const endWidth = 40;    // 広げた（30→40）

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

  // ハザードの位置計算（長方形とポリゴンの両方に対応）
  const hazardPositions = useMemo<HazardPosition[]>(() => {
    if (!hole.hazards) return [];

    return hole.hazards.map<HazardPosition | null>((hazard) => {
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
          shape: "rectangle" as const,
        };
      } else if (hazard.shape === "polygon" && hazard.points && hazard.points.length >= 3) {
        // ポリゴンのパースペクティブ変換（地平線でクリップ）
        const horizonY = perspective.horizonY;
        
        // 各ポイントを変換
        const rawPoints = hazard.points.map((point) => ({
          x: perspective.xToScreenX(point.x, point.y),
          y: perspective.distanceToY(point.y),
        }));
        
        // 全ての点が地平線より上なら描画しない
        const allAboveHorizon = rawPoints.every(p => p.y < horizonY);
        if (allAboveHorizon) return null;
        
        // 地平線でポリゴンをクリップ
        const clippedPoints: Array<{x: number, y: number}> = [];
        for (let i = 0; i < rawPoints.length; i++) {
          const curr = rawPoints[i];
          const prev = rawPoints[(i - 1 + rawPoints.length) % rawPoints.length];
          
          const currAbove = curr.y < horizonY;
          const prevAbove = prev.y < horizonY;
          
          if (currAbove !== prevAbove) {
            // 地平線との交差点を計算
            const t = (horizonY - prev.y) / (curr.y - prev.y);
            const intersectX = prev.x + t * (curr.x - prev.x);
            clippedPoints.push({ x: intersectX, y: horizonY });
          }
          
          if (!currAbove) {
            // 地平線以下の点を追加
            clippedPoints.push(curr);
          }
        }
        
        // クリップ後のポイントが不足していれば描画しない
        if (clippedPoints.length < 3) return null;

        // SVG path 文字列を生成
        const pathData = clippedPoints
          .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
          .join(" ") + " Z";

        // バウンディングボックスを計算
        const xs = clippedPoints.map((p) => p.x);
        const ys = clippedPoints.map((p) => p.y);
        
        const bbox = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };

        return {
          type: hazard.type,
          pathData,
          bbox,
          scale,
          shape: "polygon" as const,
        };
      } else {
        // フォールバック：バウンディングボックス表示
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
          shape: "rectangle" as const,
        };
      }
    }).filter((h): h is HazardPosition => h !== null);
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
        return "#22c55e";
      default:
        return "#9ca3af";
    }
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-sky-100 to-emerald-50 ${className}`}>
      <svg
        viewBox="-20 0 140 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ minHeight: "200px" }}
      >
        {/* 背景：空と地面 */}
        <defs>
          {/* 空のグラデーション - 時間帯に応じて変化 */}
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" /> {/* 空の青 */}
            <stop offset="50%" stopColor="#bae6fd" /> {/* 明るい青 */}
            <stop offset="100%" stopColor="#f0f9ff" /> {/* 地平線近くの明るさ */}
          </linearGradient>
          {/* 地平線の霞み */}
          <linearGradient id="horizonHaze" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
          </linearGradient>
          {/* フェアウェイの質感向上グラデーション */}
          <linearGradient id="fairwayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" /> {/* 近い方は濃い緑 */}
            <stop offset="30%" stopColor="#86efac" /> {/* 中間 */}
            <stop offset="70%" stopColor="#22c55e" /> {/* 遠景は暗め */}
            <stop offset="100%" stopColor="#16a34a" /> {/* 最遠は濃緑 */}
          </linearGradient>
          {/* フェアウェイ草テクスチャパターン */}
          <pattern id="grassPattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="#22c55e" opacity="0.3"/>
            <circle cx="3" cy="2" r="0.3" fill="#16a34a" opacity="0.2"/>
            <circle cx="2" cy="3" r="0.4" fill="#4ade80" opacity="0.2"/>
          </pattern>
          {/* バンカーの砂テクスチャ */}
          <pattern id="sandPattern" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.3" fill="#d97706" opacity="0.2"/>
            <circle cx="1.5" cy="1.5" r="0.3" fill="#b45309" opacity="0.15"/>
          </pattern>
          {/* ウォーターの波紋パターン */}
          <pattern id="waterPattern" x="0" y="0" width="6" height="4" patternUnits="userSpaceOnUse">
            <path d="M0 2 Q1.5 1, 3 2 Q4.5 3, 6 2" stroke="#60a5fa" strokeWidth="0.3" fill="none" opacity="0.4"/>
          </pattern>
          {/* より深みのあるシャドウ */}
          <filter id="shadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.4" />
          </filter>
          <filter id="deepShadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity="0.5" />
          </filter>
          {/* 奥行きブラー効果 */}
          <filter id="distanceBlur" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>

        {/* 背景 - viewBox全体をカバー */}
        <rect x="-20" width="140" height="100" fill="url(#skyGradient)" />

        {/* フェアウェイ - 草のテクスチャを重ねる */}
        <path d={fairwayPath} fill="url(#fairwayGradient)" opacity="0.9" />
        <path d={fairwayPath} fill="url(#grassPattern)" opacity="0.4" />

        {/* ラフエリア（フェアウェイの外側） - フェアウェイと同じグラデーション・テクスチャ */}
        <path
          d={`
            M -20 ${perspective.distanceToY(0)}
            L 0 ${perspective.distanceToY(0)}
            L 30 ${perspective.distanceToY(targetDistance)}
            L -20 ${perspective.distanceToY(targetDistance)}
            Z
            M 120 ${perspective.distanceToY(0)}
            L 100 ${perspective.distanceToY(0)}
            L 70 ${perspective.distanceToY(targetDistance)}
            L 120 ${perspective.distanceToY(targetDistance)}
            Z
          `}
          fill="url(#fairwayGradient)"
          opacity="0.8"
        />
        <path
          d={`
            M -20 ${perspective.distanceToY(0)}
            L 0 ${perspective.distanceToY(0)}
            L 30 ${perspective.distanceToY(targetDistance)}
            L -20 ${perspective.distanceToY(targetDistance)}
            Z
            M 120 ${perspective.distanceToY(0)}
            L 100 ${perspective.distanceToY(0)}
            L 70 ${perspective.distanceToY(targetDistance)}
            L 120 ${perspective.distanceToY(targetDistance)}
            Z
          `}
          fill="url(#grassPattern)"
          opacity="0.5"
        />

        {/* ポリゴンハザード - タイプごとにグループ化して透明度を統一 */}
        {/* ラフ/セミラフを先に描画 */}
        {["rough", "semirough"].map((type) => {
          const typeHazards = hazardPositions.filter(
            (h) => h.type === type && h.shape === "polygon" && h.pathData
          );
          if (typeHazards.length === 0) return null;
          
          return (
            <g key={type} opacity="0.75">
              {typeHazards.map((hazard, idx) => (
                <path key={idx} d={hazard.pathData} fill={hazardColor(hazard.type)} />
              ))}
            </g>
          );
        })}
        {/* ウォーターとバンカーを中間で描画 */}
        {["water", "bunker"].map((type) => {
          const typeHazards = hazardPositions.filter(
            (h) => h.type === type && h.shape === "polygon" && h.pathData
          );
          if (typeHazards.length === 0) return null;
          
          return (
            <g key={type} opacity={type === "water" ? 0.85 : 0.75}>
              {typeHazards.map((hazard, idx) => (
                <path
                  key={idx}
                  d={hazard.pathData}
                  fill={hazardColor(hazard.type)}
                  filter={hazard.type === "bunker" ? "url(#shadow)" : undefined}
                />
              ))}
              {/* ウォーターの波紋パターン */}
              {type === "water" && typeHazards.map((hazard, idx) => (
                <path key={`water-${idx}`} d={hazard.pathData} fill="url(#waterPattern)" opacity="0.5" />
              ))}
              {/* バンカーの砂テクスチャ */}
              {type === "bunker" && typeHazards.map((hazard, idx) => (
                <path key={`bunker-${idx}`} d={hazard.pathData} fill="url(#sandPattern)" opacity="0.6" />
              ))}
            </g>
          );
        })}
        {/* OBを最後に描画して最前面に表示 */}
        {(() => {
          const obHazards = hazardPositions.filter(
            (h) => h.type === "ob" && h.shape === "polygon" && h.pathData
          );
          if (obHazards.length === 0) return null;
          
          return (
            <g key="ob" opacity="1">
              {obHazards.map((hazard, idx) => (
                <path key={idx} d={hazard.pathData} fill={hazardColor(hazard.type)} />
              ))}
            </g>
          );
        })()}

        {/* 長方形ハザード */}
        {hazardPositions.map((hazard, index) => (
          <g key={index}>
            {hazard.shape === "rectangle" && typeof hazard.x === "number" ? (
              <>
                {/* 長方形ハザードの縁（立体的効果） */}
                <rect
                  x={hazard.x + 0.3}
                  y={hazard.y + 0.3}
                  width={hazard.width}
                  height={hazard.height}
                  fill="rgba(0,0,0,0.3)"
                />
                {/* 長方形ハザード本体 */}
                <rect
                  x={hazard.x}
                  y={hazard.y}
                  width={hazard.width}
                  height={hazard.height}
                  fill={hazardColor(hazard.type)}
                  opacity={hazard.type === "water" ? 0.85 : 0.75}
                  filter={hazard.type === "bunker" ? "url(#shadow)" : undefined}
                />
                {/* ウォーターの波紋パターン */}
                {hazard.type === "water" && (
                  <rect
                    x={hazard.x}
                    y={hazard.y}
                    width={hazard.width}
                    height={hazard.height}
                    fill="url(#waterPattern)"
                    opacity="0.5"
                  />
                )}
                {/* バンカーの砂テクスチャ */}
                {hazard.type === "bunker" && (
                  <rect
                    x={hazard.x}
                    y={hazard.y}
                    width={hazard.width}
                    height={hazard.height}
                    fill="url(#sandPattern)"
                    opacity="0.6"
                  />
                )}
                {/* 長方形のハイライト縁 */}
                <rect
                  x={hazard.x}
                  y={hazard.y}
                  width={hazard.width}
                  height={hazard.height}
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="0.2"
                />
              </>
            ) : null}
          </g>
        ))}

        {/* ピンのみ表示（グリーン本体は非表示） */}
        <g>
          {/* 旗竿 */}
          <line
            x1={50}
            y1={greenRect.y + greenRect.height / 2}
            x2={50}
            y2={greenRect.y + greenRect.height / 2 - greenRect.height * 0.8}
            stroke="#ffffff"
            strokeWidth="0.3"
            filter="url(#shadow)"
          />
          {/* 旗 */}
          <path
            d={`M 50 ${greenRect.y + greenRect.height / 2 - greenRect.height * 0.8}
               L ${50 + greenRect.width * 0.3} ${greenRect.y + greenRect.height / 2 - greenRect.height * 0.6}
               L 50 ${greenRect.y + greenRect.height / 2 - greenRect.height * 0.4}
               Z`}
            fill="#ef4444"
            filter="url(#shadow)"
          />
        </g>

        {/* ピン - よりリアルな表現 */}
        <g transform={`translate(${pinPosition.x}, ${pinPosition.y})`}>
          {/* ピンスティック */}
          <line x1="0" y1="0" x2="0" y2="-5" stroke="#1f2937" strokeWidth="0.4" strokeLinecap="round" />
          {/* ピンのハイライト */}
          <line x1="-0.1" y1="-0.5" x2="-0.1" y2="-4.5" stroke="#4b5563" strokeWidth="0.15" />
          {/* フラッグ */}
          <g filter="url(#shadow)">
            {/* フラッグのポール部分 */}
            <circle cx="0" cy="-5" r="0.3" fill="#1f2937" />
            {/* フラッグ布 - 布の揺れを表現 */}
            <path
              d="M 0 -4.8 Q 2 -4.5, 3 -4 Q 2 -3.5, 0 -3.2 Z"
              fill="#ef4444"
            />
            {/* フラッグのハイライト */}
            <path
              d="M 0.3 -4.6 Q 1.5 -4.3, 2.2 -4 Q 1.5 -3.7, 0.3 -3.4"
              stroke="#f87171"
              strokeWidth="0.2"
              fill="none"
            />
          </g>
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

        {/* ボール - よりリアルな表現 */}
        <g transform={`translate(${ballPosition.x}, ${ballPosition.y})`}>
          {/* ボールの影（奥行きを出す） */}
          <ellipse
            cx="0.8"
            cy="0.8"
            rx={1.8 * ballPosition.scale}
            ry={1 * ballPosition.scale}
            fill="rgba(0,0,0,0.25)"
            filter="url(#distanceBlur)"
          />
          {/* ボール本体 */}
          <circle
            r={1.3 * ballPosition.scale}
            fill="white"
            stroke="#374151"
            strokeWidth="0.15"
            filter="url(#deepShadow)"
          />
          {/* ボールのディンプル（テクスチャ） */}
          <circle
            r={1.1 * ballPosition.scale}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="0.1"
            strokeDasharray="0.3,0.2"
          />
          {/* ボールのハイライト（立体感） */}
          <ellipse
            cx={-0.4 * ballPosition.scale}
            cy={-0.4 * ballPosition.scale}
            rx={0.5 * ballPosition.scale}
            ry={0.3 * ballPosition.scale}
            fill="rgba(255,255,255,0.8)"
          />
          {/* ライの色インジケーター（半透明リング） */}
          <circle
            r={1 * ballPosition.scale}
            fill="none"
            stroke={LIE_COLORS[lie]}
            strokeWidth={0.4 * ballPosition.scale}
            opacity="0.9"
          />
          <circle
            r={0.6 * ballPosition.scale}
            fill={LIE_COLORS[lie]}
            opacity="0.3"
          />
        </g>

        {/* 狙い点マーカー - より洗練されたデザイン */}
        <g transform={`translate(${aimPosition.x}, ${aimPosition.y})`}>
          {/* 外側リング（影） */}
          <circle
            r={3.2 * aimPosition.scale}
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.4"
          />
          {/* 外側リング */}
          <circle
            r={3 * aimPosition.scale}
            fill="none"
            stroke="#ef4444"
            strokeWidth="0.3"
            opacity="0.7"
          />
          {/* 十字マーカー */}
          <line
            x1={-2.5 * aimPosition.scale}
            y1="0"
            x2={2.5 * aimPosition.scale}
            y2="0"
            stroke="#ef4444"
            strokeWidth={0.4 * aimPosition.scale}
            opacity="0.9"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1={-2.5 * aimPosition.scale}
            x2="0"
            y2={2.5 * aimPosition.scale}
            stroke="#ef4444"
            strokeWidth={0.4 * aimPosition.scale}
            opacity="0.9"
            strokeLinecap="round"
          />
          {/* 中心ドット */}
          <circle
            r={0.6 * aimPosition.scale}
            fill="#ef4444"
            opacity="0.9"
          />
          {/* インナーリング */}
          <circle
            r={1.8 * aimPosition.scale}
            fill="none"
            stroke="#f87171"
            strokeWidth="0.2"
            strokeDasharray="0.8,0.4"
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

        {/* 距離表示パネル */}
        <g>
          {/* パネル背景 */}
          <rect x="2" y="2" width="40" height="18" rx="4" fill="rgba(255,255,255,0.95)" filter="url(#shadow)" />
          {/* パネルの装飾ライン */}
          <rect x="2" y="2" width="40" height="18" rx="4" fill="none" stroke="rgba(6,95,70,0.2)" strokeWidth="0.3" />
          {/* タイトル */}
          <text x="5" y="6.5" fontSize="3" fill="#065f46" fontWeight="bold" opacity="0.8">ピンまで</text>
          {/* 距離値 */}
          <text x="38" y="12" textAnchor="end" fontSize="8" fill="#065f46" fontWeight="bold">
            {remainingDistance}Y
          </text>
          {/* 打数情報（あれば） */}
          {strokeLabel && (
            <text x="38" y="16.5" textAnchor="end" fontSize="4" fill="#065f46" fontWeight="bold">
              {strokeLabel}
            </text>
          )}
        </g>

        {/* ライ表示パネル（別個） */}
        <g>
          {/* パネル背景 */}
          <rect x="76" y="2" width="22" height="9" rx="2" fill={LIE_COLORS[lie]} opacity="0.85" filter="url(#shadow)" />
          {/* ライラベル */}
          <text x="87" y="9" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">
            {lie.toUpperCase()}
          </text>
        </g>

        {/* ピンまでの距離マーカー（フェアウェイ上） */}
        {[50, 100, 150].map((markerDist) => {
          if (markerDist > targetDistance) return null;
          const markerY = perspective.distanceToY(targetDistance - markerDist);
          return (
            <g key={markerDist}>
              {/* 距離ライン */}
              <line x1="25" y1={markerY} x2="75" y2={markerY} stroke="rgba(255,255,255,0.5)" strokeWidth="0.3" strokeDasharray="2,2" />
              {/* 距離ラベル */}
              <text x="50" y={markerY - 1} textAnchor="middle" fontSize="2.5" fill="rgba(255,255,255,0.7)" fontWeight="bold">{markerDist}yd</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
