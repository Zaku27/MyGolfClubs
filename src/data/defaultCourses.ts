import type { Hole } from "../types/game";

export const COURSE_9HOLES: Hole[] = [
  { number: 1, par: 4, distanceFromTee: 380, hazards: ["water left", "bunker right"] },
  { number: 2, par: 3, distanceFromTee: 165, hazards: ["bunker front", "bunker left"] },
  { number: 3, par: 5, distanceFromTee: 530, hazards: ["OB right", "fairway bunker 220y left"] },
  { number: 4, par: 4, distanceFromTee: 420, hazards: ["water 220y right", "bunker front green"] },
  { number: 5, par: 3, distanceFromTee: 195, hazards: ["water front and right", "bunker back"] },
  { number: 6, par: 4, distanceFromTee: 355, hazards: ["trees left", "bunker right"] },
  { number: 7, par: 5, distanceFromTee: 510, hazards: ["fairway bunker 240y", "water around green"] },
  { number: 8, par: 4, distanceFromTee: 400, hazards: ["OB left", "bunker 150y front green"] },
  { number: 9, par: 4, distanceFromTee: 440, hazards: ["water left 210y–310y", "deep rough right"] },
];

export const COURSE_3HOLES: Hole[] = COURSE_9HOLES.slice(0, 3);

const BACK_NINE: Hole[] = [
  { number: 10, par: 4, distanceFromTee: 395, hazards: ["bunker left", "rough right"] },
  { number: 11, par: 3, distanceFromTee: 180, hazards: ["water front", "bunker back"] },
  { number: 12, par: 5, distanceFromTee: 545, hazards: ["water left", "bunker 260y right"] },
  { number: 13, par: 4, distanceFromTee: 410, hazards: ["OB right", "water around green"] },
  { number: 14, par: 3, distanceFromTee: 200, hazards: ["bunker front left", "slope back"] },
  { number: 15, par: 5, distanceFromTee: 520, hazards: ["dogleg left", "water 310y"] },
  { number: 16, par: 4, distanceFromTee: 360, hazards: ["trees right", "bunker front green"] },
  { number: 17, par: 3, distanceFromTee: 210, hazards: ["water left", "bunker right"] },
  { number: 18, par: 4, distanceFromTee: 455, hazards: ["OB left", "water front green"] },
];

export const COURSE_18HOLES: Hole[] = [...COURSE_9HOLES, ...BACK_NINE];
