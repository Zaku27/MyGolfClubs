import type { Hazard } from "../../types/game";

export function drawPolygon(context: CanvasRenderingContext2D, hazard: Hazard, yardToPxX: (x: number) => number, yardToPxY: (y: number) => number) {
  if (!Array.isArray(hazard.points) || hazard.points.length < 3) return;
  context.beginPath();
  const first = hazard.points[0];
  context.moveTo(yardToPxX(first.x), yardToPxY(first.y));
  for (let i = 1; i < hazard.points.length; i++) {
    const pt = hazard.points[i];
    context.lineTo(yardToPxX(pt.x), yardToPxY(pt.y));
  }
  context.closePath();
  context.fill();
  context.stroke();
}
