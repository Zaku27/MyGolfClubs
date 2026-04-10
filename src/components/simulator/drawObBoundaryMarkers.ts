import type { Hazard } from "../../types/game";

export function drawObBoundaryMarkers(
  context: CanvasRenderingContext2D,
  hazard: Hazard,
  yardToPxX: (yardX: number) => number,
  yardToPxY: (yardY: number) => number,
) {
  if (hazard.type !== "ob") {
    return;
  }
  const leftYard = hazard.xCenter - hazard.width / 2;
  const rightYard = hazard.xCenter + hazard.width / 2;
  const innerBoundaryYard = Math.abs(leftYard) < Math.abs(rightYard) ? leftYard : rightYard;
  const markerSize = 5;
  const markerXBoundary = yardToPxX(innerBoundaryYard);
  const markerInset = 1;
  const markerLeftPx = hazard.xCenter < 0
    ? markerXBoundary - markerSize - markerInset
    : markerXBoundary + markerInset;
  const startYard = Math.ceil(hazard.yFront / 50) * 50;
  const endYard = hazard.yBack;
  if (startYard > endYard) {
    return;
  }
  context.save();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.lineWidth = 1;
  for (let yard = startYard; yard <= endYard + 1e-6; yard += 50) {
    const markerY = yardToPxY(yard);
    context.fillRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
    context.strokeRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
  }
  context.restore();
}
