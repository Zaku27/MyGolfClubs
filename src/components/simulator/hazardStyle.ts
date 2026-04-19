import type { Hazard } from "../../types/game";

export function getHazardStyle(type: Hazard["type"]): { fill: string; stroke: string } {
  if (type === "bunker") {
    return {
      fill: "rgba(250, 204, 21, 0.45)",
      stroke: "rgba(161, 98, 7, 0.65)",
    };
  }
  if (type === "water") {
    return {
      fill: "rgba(59, 130, 246, 0.38)",
      stroke: "rgba(220, 38, 38, 0.95)",
    };
  }
  if (type === "ob") {
    return {
      fill: "rgba(34, 197, 94, 0.25)",
      stroke: "rgba(22, 101, 52, 0.85)",
    };
  }
  if (type === "bareground") {
    return {
      fill: "rgba(168, 162, 158, 0.35)",
      stroke: "rgba(99, 92, 84, 0.95)",
    };
  }
  return {
    fill: "rgba(74, 222, 128, 0.35)",
    stroke: "rgba(22, 101, 52, 0.85)",
  };
}
