import type { Hole, Hazard, HazardType } from "../types/game";
import { TEXTURE_PATHS_SEAMLESS as TEXTURE_PATHS } from "./texturePaths";
import type { TextureKey } from "./texturePaths";

const SCALE = 1;                    // 1px = 1 yard（調整可能）
const COURSE_WIDTH_YARDS = 400;     // コースの横幅（ラフ含む最大幅）
const COURSE_LENGTH_YARDS = 500;    // ティーからグリーンまでの距離（グリーンまでの距離基準）

const VIEWBOX_WIDTH = COURSE_WIDTH_YARDS * SCALE;   // 例: 400
const VIEWBOX_HEIGHT = COURSE_LENGTH_YARDS * SCALE; // 例: 500

type DisplayTextureType = TextureKey;

const hazardTypeToTexture: Record<HazardType, DisplayTextureType> = {
  rough: "rough",
  semirough: "rough",
  bareground: "bareground",
  bunker: "bunker",
  water: "water",
  ob: "ob",
};

const clipPathRenderers = {
  rectangle: (hazard: Hazard) => {
    const left = hazard.xCenter - hazard.width / 2;
    const top = hazard.yBack;
    const width = hazard.width;
    const height = Math.max(0, hazard.yBack - hazard.yFront);
    return (
      <rect
        key={hazard.id}
        x={left}
        y={top}
        width={width}
        height={height}
      />
    );
  },
  polygon: (hazard: Hazard) => {
    if (!Array.isArray(hazard.points) || hazard.points.length === 0) {
      return null;
    }
    const points = hazard.points.map((p) => `${p.x},${p.y}`).join(" ");
    return <polygon key={hazard.id} points={points} />;
  },
};

const groupHazardsByTexture = (hazards: Hole["hazards"] = []) => {
  const groups: Record<DisplayTextureType, Hazard[]> = {
    fairway: [],
    rough: [],
    bareground: [],
    bunker: [],
    water: [],
    ob: [],
    green: [],
    teeground: [],
  };

  for (const hazard of hazards) {
    const texture = hazardTypeToTexture[hazard.type] ?? "rough";
    groups[texture].push(hazard);
  }

  return groups;
};

interface GolfCourseMapProps {
  hole: Hole;
  extraInfo?: string;
}

export const GolfCourseMap = ({ hole, extraInfo }: GolfCourseMapProps) => {
  const hazardGroups = groupHazardsByTexture(hole.hazards);
  const hasGreen = typeof hole.greenRadius === "number" && hole.greenRadius > 0;

  return (
    <div className="relative w-full max-w-[420px] mx-auto">
      <div
        className="relative overflow-hidden rounded-2xl border border-gray-300 shadow-lg"
        style={{ aspectRatio: `${VIEWBOX_WIDTH} / ${VIEWBOX_HEIGHT}` }}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="xMidYMin meet"   // グリーンを上部に寄せるために YMin
          className="w-full h-full block"
        >
          <defs>
            <clipPath id="fairway-clip" clipPathUnits="userSpaceOnUse">
              {/* フェアウェイのポリゴンを使うならここに置き換えます。デフォルトでは全体をカバーする矩形です。 */}
              <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} />
            </clipPath>

            {Object.entries(hazardGroups).map(([textureKey, hazards]) => {
              if (textureKey === "fairway" || textureKey === "green") {
                return null;
              }
              if (hazards.length === 0) {
                return null;
              }
              return (
                <clipPath id={`${textureKey}-clip`} key={textureKey} clipPathUnits="userSpaceOnUse">
                  {hazards.map((hazard) => clipPathRenderers[hazard.shape](hazard))}
                </clipPath>
              );
            })}

            {hasGreen && (
              <clipPath id="green-clip" clipPathUnits="userSpaceOnUse">
                <circle
                  cx={VIEWBOX_WIDTH / 2}
                  cy={VIEWBOX_HEIGHT - Math.min(hole.greenRadius ?? 0, VIEWBOX_HEIGHT / 4) - 40}
                  r={hole.greenRadius ?? 0}
                />
              </clipPath>
            )}
          </defs>

          {/* 1. OB/Woods background */}
          <image
            href={TEXTURE_PATHS.ob}
            x={0}
            y={0}
            width={VIEWBOX_WIDTH}
            height={VIEWBOX_HEIGHT}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.95}
          />

          {/* 2. Rough / off-fairway areas */}
          {hazardGroups.rough.length > 0 && (
            <image
              href={TEXTURE_PATHS.rough}
              x={0}
              y={0}
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              clipPath="url(#rough-clip)"
              preserveAspectRatio="xMidYMid slice"
              opacity={0.9}
            />
          )}

          {/* 3. Fairway base */}
          <image
            href={TEXTURE_PATHS.fairway}
            x={0}
            y={0}
            width={VIEWBOX_WIDTH}
            height={VIEWBOX_HEIGHT}
            clipPath="url(#fairway-clip)"
            preserveAspectRatio="xMidYMid slice"
            style={{ filter: "contrast(1.05) brightness(1.08)" }}
          />

          {/* 4. Hazards and green overlays */}
          {hazardGroups.bunker.length > 0 && (
            <image
              href={TEXTURE_PATHS.bunker}
              x={0}
              y={0}
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              clipPath="url(#bunker-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {hazardGroups.water.length > 0 && (
            <image
              href={TEXTURE_PATHS.water}
              x={0}
              y={0}
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              clipPath="url(#water-clip)"
              preserveAspectRatio="xMidYMid slice"
              opacity={0.85}
            />
          )}

          {hasGreen && (
            <image
              href={TEXTURE_PATHS.green}
              x={0}
              y={0}
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              clipPath="url(#green-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {hazardGroups.bareground.length > 0 && (
            <image
              href={TEXTURE_PATHS.bareground}
              x={0}
              y={0}
              width={VIEWBOX_WIDTH}
              height={VIEWBOX_HEIGHT}
              clipPath="url(#bareground-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* ここに必要なら既存の赤い境界線や白いダッシュライン、ピン位置を追加できます */}
        </svg>

        <div className="absolute top-4 left-4 bg-black/70 text-white text-sm px-3 py-1 rounded">
          {`HOLE ${hole.number} • PAR ${hole.par} • ${hole.distanceFromTee} YDS`}
          {extraInfo ? ` • ${extraInfo}` : ""}
        </div>
      </div>
    </div>
  );
};

export default GolfCourseMap;
