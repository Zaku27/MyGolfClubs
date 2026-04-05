import type { Hole } from "../types/game";

export const COURSE_9HOLES: Hole[] = [
  {
    number: 1,
    par: 4,
    distanceFromTee: 380,
    greenRadius: 12,
    hazards: [
      {
        id: "h1-1",
        type: "bunker",
        shape: "rectangle",
        yFront: 250,
        yBack: 290,
        xCenter: 0,
        width: 90,
        penaltyStrokes: 1,
        name: "グリーン手前バンカー",
      },
      {
        id: "h1-2",
        type: "water",
        shape: "rectangle",
        yFront: 150,
        yBack: 175,
        xCenter: -40,
        width: 35,
        penaltyStrokes: 1,
        name: "左サイド池",
      },
      {
        id: "h1-3",
        type: "ob",
        shape: "rectangle",
        yFront: 0,
        yBack: 380,
        xCenter: -72,
        width: 24,
        penaltyStrokes: 2,
        name: "左OB",
      },
      {
        id: "h1-4",
        type: "ob",
        shape: "rectangle",
        yFront: 0,
        yBack: 380,
        xCenter: 72,
        width: 24,
        penaltyStrokes: 2,
        name: "右OB",
      },
    ],
  },
  { number: 2, par: 3, distanceFromTee: 165, greenRadius: 12, hazards: [] },
  { number: 3, par: 5, distanceFromTee: 530, greenRadius: 12, hazards: [] },
  { number: 4, par: 4, distanceFromTee: 420, greenRadius: 12, hazards: [] },
  { number: 5, par: 3, distanceFromTee: 195, greenRadius: 12, hazards: [] },
  { number: 6, par: 4, distanceFromTee: 355, greenRadius: 12, hazards: [] },
  { number: 7, par: 5, distanceFromTee: 510, greenRadius: 12, hazards: [] },
  { number: 8, par: 4, distanceFromTee: 400, greenRadius: 12, hazards: [] },
  { number: 9, par: 4, distanceFromTee: 440, greenRadius: 12, hazards: [] },
];

export const COURSE_1HOLE: Hole[] = COURSE_9HOLES.slice(0, 1);
export const COURSE_3HOLES: Hole[] = COURSE_9HOLES.slice(0, 3);

const BACK_NINE: Hole[] = [
  { number: 10, par: 4, distanceFromTee: 395, greenRadius: 12, hazards: [] },
  { number: 11, par: 3, distanceFromTee: 180, greenRadius: 12, hazards: [] },
  { number: 12, par: 5, distanceFromTee: 545, greenRadius: 12, hazards: [] },
  { number: 13, par: 4, distanceFromTee: 410, greenRadius: 12, hazards: [] },
  { number: 14, par: 3, distanceFromTee: 200, greenRadius: 12, hazards: [] },
  { number: 15, par: 5, distanceFromTee: 520, greenRadius: 12, hazards: [] },
  { number: 16, par: 4, distanceFromTee: 360, greenRadius: 12, hazards: [] },
  { number: 17, par: 3, distanceFromTee: 210, greenRadius: 12, hazards: [] },
  { number: 18, par: 4, distanceFromTee: 455, greenRadius: 12, hazards: [] },
];

export const COURSE_18HOLES: Hole[] = [...COURSE_9HOLES, ...BACK_NINE];
