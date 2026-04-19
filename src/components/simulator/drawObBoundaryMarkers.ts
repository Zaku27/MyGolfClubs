import type { Hazard } from "../../types/game";

export function drawObBoundaryMarkers(
  _context: CanvasRenderingContext2D,
  _hazard: Hazard,
  _yardToPxX: (yardX: number) => number,
  _yardToPxY: (yardY: number) => number,
) {
  // OBの白杭はすべて撤去
  return;
}
