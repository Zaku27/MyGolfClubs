import type { Hazard } from "../../types/game";

export function getPolygonLabelPosition(hazard: Hazard) {
  if (!Array.isArray(hazard.points) || hazard.points.length < 3) return { x: 0, y: 0 };
  // 重心計算
  let x = 0, y = 0;
  for (const pt of hazard.points) {
    x += pt.x;
    y += pt.y;
  }
  return {
    x: x / hazard.points.length,
    y: y / hazard.points.length,
  };
}
