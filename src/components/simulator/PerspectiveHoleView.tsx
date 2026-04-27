import { useMemo } from "react";
import type { Hole, ShotContext } from "../../types/game";

// 決定論的な乱数生成（シード値から）
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// シード値から乱数を生成
function seededRandomRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

// HoleMapCanvasと同じ正多角形生成関数
function buildRegularPolygonPoints(centerX: number, centerY: number, radius: number, sides: number, irregularity: number = 0): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
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
import {
  calculatePerspectiveParams,
  calculateBallPosition,
  calculatePinPosition,
  calculateAimPosition,
  calculateLastLandingPosition,
  calculateFairwayPath,
  calculateGreenRect,
  calculateGreenPolygon,
  calculateHazardPositions,
  getHazardColor,
  LIE_COLORS,
  OUTCOME_COLORS,
  type PerspectiveParams,
  type Position3D,
  type HazardPosition,
  type GreenRect,
} from "./utils/perspectiveGeometry";

interface Props {
  hole: Hole;
  shotContext: ShotContext;
  aimXOffset: number;
  selectedClub?: {
    avgDistance: number;
    type: string;
  };
  lastShotResult?: {
    finalOutcome?: "fairway" | "rough" | "bunker" | "water" | "ob" | "green";
    landing?: {
      finalX: number;
      finalY: number;
    };
  } | null;
  strokeLabel?: string;
  scoreLabel?: string;
  className?: string;
}

export function PerspectiveHoleView({
  hole,
  shotContext,
  aimXOffset,
  selectedClub,
  lastShotResult,
  strokeLabel,
  scoreLabel,
  className = "",
}: Props) {
  const { remainingDistance, lie, originX, originY, targetDistance } = shotContext;

  // パースペクティブ投影パラメータ
  const perspective = useMemo(() => calculatePerspectiveParams(targetDistance), [targetDistance]);

  // ボール位置の計算
  const ballPosition = useMemo(
    () => calculateBallPosition(originX, originY, perspective),
    [originX, originY, perspective]
  );

  // ピン位置の計算
  const pinPosition = useMemo(
    () => calculatePinPosition(targetDistance, perspective),
    [targetDistance, perspective]
  );

  // 狙い点の計算（選択クラブの飛距離に基づく）
  const aimPosition = useMemo(
    () =>
      calculateAimPosition(
        aimXOffset,
        remainingDistance,
        targetDistance,
        perspective,
        selectedClub?.avgDistance,
        originX,
        originY
      ),
    [aimXOffset, remainingDistance, targetDistance, perspective, selectedClub, originX, originY]
  );

  // 前回ショットの着地点（あれば）
  const lastLandingPosition = useMemo(
    () =>
      lastShotResult?.landing
        ? calculateLastLandingPosition(
            lastShotResult.landing.finalX,
            lastShotResult.landing.finalY,
            lastShotResult.finalOutcome,
            perspective
          )
        : null,
    [lastShotResult, perspective]
  );

  // フェアウェイの描画パス生成（横幅広げた版）
  const maxPolygonY = useMemo(() => {
    let maxY = targetDistance;
    // グリーンのポリゴンから最大Yを取得
    if (hole.greenPolygon && hole.greenPolygon.length > 0) {
      maxY = Math.max(maxY, ...hole.greenPolygon.map(p => p.y));
    }
    // ハザードのポリゴンから最大Yを取得
    if (hole.hazards) {
      hole.hazards.forEach(hazard => {
        if (hazard.shape === "polygon" && hazard.points && hazard.points.length > 0) {
          maxY = Math.max(maxY, ...hazard.points.map(p => p.y));
        } else {
          // 長方形ハザードの場合
          maxY = Math.max(maxY, hazard.yBack);
        }
      });
    }
    return maxY;
  }, [hole.greenPolygon, hole.hazards, targetDistance]);

  const fairwayPath = useMemo(
    () => calculateFairwayPath(targetDistance, perspective, maxPolygonY),
    [targetDistance, perspective, maxPolygonY]
  );

  // グリーンの描画
  const greenRect = useMemo(
    () => calculateGreenRect(targetDistance, perspective),
    [targetDistance, perspective]
  );

  // グリーンのポリゴン描画
  const greenPolygon = useMemo(() => {
    const polygon = hole.greenPolygon;
    // グリーンのポリゴンがない場合はデフォルトの正20角形を作成
    const greenRadius = hole.greenRadius ?? 13;
    const targetDistance = shotContext.targetDistance;
    const GREEN_POLYGON_SIDES = 20;

    if (!polygon || polygon.length < 3) {
      // HoleMapCanvasと同じロジックでデフォルトポリゴンを作成
      const defaultPolygon = buildRegularPolygonPoints(0, targetDistance, greenRadius, GREEN_POLYGON_SIDES, 0.1);
      return calculateGreenPolygon(defaultPolygon, perspective);
    }
    return calculateGreenPolygon(polygon, perspective);
  }, [hole.greenPolygon, hole.greenRadius, shotContext.targetDistance, perspective]);

  // ホールごとのランダムな雲を生成
  const clouds = useMemo(() => {
    const seed = hole.number;
    const cloudCount = Math.floor(seededRandomRange(seed, 3, 6));
    const clouds = [];

    for (let i = 0; i < cloudCount; i++) {
      const cloudSeed = seed * 100 + i;
      const x = seededRandomRange(cloudSeed, -80, 180);
      const y = seededRandomRange(cloudSeed + 1, 8, 30);
      const scale = seededRandomRange(cloudSeed + 2, 0.7, 1.2);
      const opacity = seededRandomRange(cloudSeed + 3, 0.3, 0.5);
      const ellipseCount = Math.floor(seededRandomRange(cloudSeed + 4, 3, 5));

      const ellipses = [];
      for (let j = 0; j < ellipseCount; j++) {
        const ellipseSeed = cloudSeed * 10 + j;
        const ex = seededRandomRange(ellipseSeed, -5, 5);
        const ey = seededRandomRange(ellipseSeed + 1, -3, 3);
        const rx = seededRandomRange(ellipseSeed + 2, 6, 12) * scale;
        const ry = seededRandomRange(ellipseSeed + 3, 3, 6) * scale;
        ellipses.push({ ex, ey, rx, ry });
      }

      clouds.push({ x, y, opacity, ellipses });
    }

    return clouds;
  }, [hole.number]);

  // ハザードの位置計算（長方形とポリゴンの両方に対応）
  const hazardPositions = useMemo<HazardPosition[]>(
    () => calculateHazardPositions(hole, perspective),
    [hole, perspective]
  );


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
        <rect x="-100" width="300" height="100" fill="url(#skyGradient)" />

        {/* 雲 */}
        <g opacity="0.8">
          {clouds.map((cloud, idx) => (
            <g key={idx} transform={`translate(${cloud.x}, ${cloud.y})`} opacity={cloud.opacity}>
              {cloud.ellipses.map((ellipse, eIdx) => (
                <ellipse
                  key={eIdx}
                  cx={ellipse.ex}
                  cy={ellipse.ey}
                  rx={ellipse.rx}
                  ry={ellipse.ry}
                  fill="white"
                />
              ))}
            </g>
          ))}
        </g>

        {/* フェアウェイ - 草のテクスチャを重ねる */}
        <path d={fairwayPath} fill="url(#fairwayGradient)" opacity="0.9" />
        <path d={fairwayPath} fill="url(#grassPattern)" opacity="0.4" />

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
                <path key={idx} d={hazard.pathData} fill={getHazardColor(hazard.type)} />
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
                  fill={getHazardColor(hazard.type)}
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
                <path key={idx} d={hazard.pathData} fill={getHazardColor(hazard.type)} />
              ))}
            </g>
          );
        })()}

        {/* グリーンのポリゴン描画 */}
        {greenPolygon && (
          <g>
            <path
              d={greenPolygon.pathData}
              fill="#34d399"
              opacity="0.85"
            />
            {/* グリーンの縁 */}
            <path
              d={greenPolygon.pathData}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.2"
            />
          </g>
        )}

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
            fill="#ca8a04"
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
              fill="#eab308"
            />
            {/* フラッグのハイライト */}
            <path
              d="M 0.3 -4.6 Q 1.5 -4.3, 2.2 -4 Q 1.5 -3.7, 0.3 -3.4"
              stroke="#ca8a04"
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

        {/* 狙い点マーカー - 濃い青十字デザイン */}
        <g transform={`translate(${aimPosition.x}, ${aimPosition.y})`}>
          {/* 十字マーカー */}
          <line
            x1={-2.5 * aimPosition.scale}
            y1="0"
            x2={2.5 * aimPosition.scale}
            y2="0"
            stroke="#1e3a8a"
            strokeWidth={0.5 * aimPosition.scale}
            opacity={0.9}
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1={-2.5 * aimPosition.scale}
            x2="0"
            y2={2.5 * aimPosition.scale}
            stroke="#1e3a8a"
            strokeWidth={0.5 * aimPosition.scale}
            opacity={0.9}
            strokeLinecap="round"
          />
          {/* 中心ドット */}
          <circle
            r={0.6 * aimPosition.scale}
            fill="#1e3a8a"
            opacity={0.9}
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

        {/* ホール情報パネル */}
        <g>
          {/* パネル背景 */}
          <rect x="-38" y="2" width="26" height="9" rx="3" fill="rgba(200, 238, 61, 0.95)" filter="url(#shadow)" />
          {/* パネルの装飾ライン */}
          <rect x="-38" y="2" width="26" height="9" rx="3" fill="none" stroke="rgba(6,95,70,0.2)" strokeWidth="0.3" />
          {/* ホール番号 */}
          <text x="-35" y="8" fontSize="4" fill="#065f46" fontWeight="bold" opacity="0.8">{hole.number}H</text>
          {/* パー数 */}
          <text x="-25" y="8" fontSize="4" fill="#065f46" fontWeight="bold">PAR {hole.par}</text>
        </g>

        {/* 距離表示パネル */}
        <g>
          {/* パネル背景 */}
          <rect x="-10" y="2" width="40" height="10" rx="3" fill="rgba(229, 250, 216, 0.95)" filter="url(#shadow)" />
          {/* パネルの装飾ライン */}
          <rect x="-10" y="2" width="40" height="10" rx="3" fill="none" stroke="rgba(6,95,70,0.2)" strokeWidth="0.3" />
          {/* タイトル */}
          <text x="-7" y="6" fontSize="3" fill="#065f46" fontWeight="bold" opacity="0.8">ピンまで</text>
          {/* 距離値 */}
          <text x="25" y="10" textAnchor="end" fontSize="7" fill="#065f46" fontWeight="bold">
            {Math.round(remainingDistance)}Y
          </text>
        </g>

        {/* ライ表示パネル（別個） */}
        <g>
          {/* パネル背景 */}
          <rect x="71" y="2" width="30" height="9" rx="2" fill={LIE_COLORS[lie]} opacity="0.85" filter="url(#shadow)" />
          {/* ライラベル */}
          <text x="86" y="7" textAnchor="middle" dominantBaseline="middle" fontSize="3" fill="white" fontWeight="bold">
            {lie === "tee" ? "ティーグラウンド" : lie === "fairway" ? "フェアウェイ" : lie === "rough" ? "ラフ" : lie === "green" ? "グリーン" : lie === "bunker" ? "バンカー" : lie === "semirough" ? "セミラフ" : lie === "bareground" ? "ベアグランド" : lie}
          </text>
        </g>

        {/* 打数表示パネル（独立） */}
        {strokeLabel && (
          <g>
            {/* パネル背景 */}
            <rect x="103" y="2" width="18" height="9" rx="2" fill="rgba(106, 128, 196, 0.85)" filter="url(#shadow)" />
            {/* 打数ラベル */}
            <text x="112" y="7" textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fill="white" fontWeight="bold">
              {strokeLabel}
            </text>
          </g>
        )}

        {/* スコア表示パネル */}
        {scoreLabel && (
          <g>
            {/* パネル背景 */}
            <rect x="123" y="2" width="18" height="9" rx="2" fill="rgba(251, 191, 36, 0.85)" filter="url(#shadow)" />
            {/* スコアラベル */}
            <text x="132" y="7" textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fill="white" fontWeight="bold">
              {scoreLabel}
            </text>
          </g>
        )}

        {/* ピンまでの距離マーカー（フェアウェイ上） */}
        {[50, 100, 150].map((markerDist) => {
          if (markerDist > targetDistance) return null;
          const markerY = perspective.distanceToY(targetDistance - markerDist);
          return (
            <g key={markerDist}>
              {/* 距離ライン */}
              <line x1="25" y1={markerY} x2="75" y2={markerY} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" strokeDasharray="2,2" />
              {/* 距離ラベル */}
              <text x="50" y={markerY - 1} textAnchor="middle" fontSize="3.5" fill="rgba(255,255,255,0.7)" fontWeight="bold">{markerDist}yd</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
