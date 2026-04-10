import type { Hazard } from "../../types/game";

export function getHazardBoundingBox(hazard: Hazard) {
  if (hazard.shape === "polygon" && Array.isArray(hazard.points) && hazard.points.length >= 3) {
    const xs = hazard.points.map((p) => p.x);
    const ys = hazard.points.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  } else {
    const minX = hazard.xCenter - hazard.width / 2;
    const maxX = hazard.xCenter + hazard.width / 2;
    const minY = hazard.yFront;
    const maxY = hazard.yBack;
    return { minX, maxX, minY, maxY };
  }
}
