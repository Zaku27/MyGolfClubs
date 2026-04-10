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
  const markerTopLimit = yardToPxY(hazard.yBack) + markerSize / 2;
  const markerBottomLimit = yardToPxY(hazard.yFront) - markerSize / 2;

  const markerYards = new Set<number>();
  markerYards.add(hazard.yFront);
  markerYards.add(hazard.yBack);

  const firstTickYard = Math.ceil(hazard.yFront / 50) * 50;
  for (let yard = firstTickYard; yard <= hazard.yBack + 1e-6; yard += 50) {
    markerYards.add(yard);
  }

  const sortedMarkerYards = Array.from(markerYards).sort((a, b) => a - b);
  if (sortedMarkerYards.length === 0) {
    return;
  }

  context.save();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.lineWidth = 1;
  for (const yard of sortedMarkerYards) {
    let markerY = yardToPxY(yard);
    markerY = Math.max(markerY, markerTopLimit);
    markerY = Math.min(markerY, markerBottomLimit);
    context.fillRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
    context.strokeRect(markerLeftPx, markerY - markerSize / 2, markerSize, markerSize);
  }
  context.restore();
}
