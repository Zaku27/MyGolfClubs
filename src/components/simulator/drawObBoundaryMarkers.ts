import type { Hazard } from "../../types/game";

export function drawObBoundaryMarkers(
  context: CanvasRenderingContext2D,
  hazard: Hazard,
  yardToPxX: (yardX: number) => number,
  yardToPxY: (yardY: number) => number,
) {
  // OBの白杭はすべて撤去
  return;
}
