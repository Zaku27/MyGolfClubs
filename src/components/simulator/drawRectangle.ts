import type { Hazard } from "../../types/game";

export function drawRectangle(context: CanvasRenderingContext2D, hazard: Hazard, yardToPxX: (x: number) => number, yardToPxY: (y: number) => number) {
  const leftYard = hazard.xCenter - hazard.width / 2;
  const rightYard = hazard.xCenter + hazard.width / 2;
  const topYard = hazard.yBack;
  const bottomYard = hazard.yFront;
  const leftPx = yardToPxX(leftYard);
  const rightPx = yardToPxX(rightYard);
  const topPx = yardToPxY(topYard);
  const bottomPx = yardToPxY(bottomYard);
  const widthPx = Math.max(2, rightPx - leftPx);
  const heightPx = Math.max(2, bottomPx - topPx);
  context.fillRect(leftPx, topPx, widthPx, heightPx);
  if (context.lineWidth > 0) {
    context.strokeRect(leftPx, topPx, widthPx, heightPx);
  }
}
