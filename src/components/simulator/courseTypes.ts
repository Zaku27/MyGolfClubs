import type { Hole } from "../../types/game";

export interface CustomCoursePreset {
  id: string;
  name: string;
  holeCount: 1 | 3 | 9 | 18;
  course: Hole[];
}

export interface CustomCourseStorage {
  selectedCourseId: string;
  courses: CustomCoursePreset[];
}
