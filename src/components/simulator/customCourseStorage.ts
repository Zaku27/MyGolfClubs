import type { Hole } from "../../types/game";
import { readStoredJson } from "../../utils/storage";
import type { CustomCoursePreset, CustomCourseStorage } from "./courseTypes";

const CUSTOM_COURSE_STORAGE_KEY = "golfbag-custom-course-library-v1";

function normalizeHoleCount(value: unknown): 1 | 3 | 9 | 18 {
  if (value === 1 || value === 3 || value === 9 || value === 18) {
    return value;
  }
  return 9;
}

function normalizeGroundCondition(value: unknown): Hole['groundCondition'] | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  type GroundConditionHardness = NonNullable<Hole['groundCondition']>['hardness'];
  const hardness = raw.hardness === "soft" || raw.hardness === "medium" || raw.hardness === "firm"
    ? (raw.hardness as GroundConditionHardness)
    : undefined;
  const slopeAngle = Number(raw.slopeAngle);
  const slopeDirection = Number(raw.slopeDirection);

  if (hardness === undefined && !Number.isFinite(slopeAngle) && !Number.isFinite(slopeDirection)) {
    return undefined;
  }

  return {
    hardness: hardness ?? "medium",
    slopeAngle: Number.isFinite(slopeAngle) ? slopeAngle : 0,
    slopeDirection: Number.isFinite(slopeDirection)
      ? ((slopeDirection % 360) + 360) % 360
      : 0,
  };
}

function normalizePreset(preset: Partial<CustomCoursePreset>, fallbackName: string): CustomCoursePreset | null {
  const holeCount = normalizeHoleCount(preset.holeCount);

  if (!Array.isArray(preset.course) || preset.course.length === 0) {
    return null;
  }

  const normalizedCourse = preset.course.slice(0, 18).reduce<Hole[]>((acc, rawHole, index) => {
    if (!rawHole || typeof rawHole !== "object") {
      return acc;
    }

    const h = (rawHole as unknown) as Record<string, unknown>;
    const rawPar = typeof h.par === "number" ? Math.max(3, Math.min(5, Math.floor(h.par))) : 4;
    const par: 3 | 4 | 5 = rawPar === 3 ? 3 : rawPar === 5 ? 5 : 4;
    const distance = typeof h.distance === "number" ? Math.max(1, Math.floor(h.distance)) : 300;
    const greenRadius = typeof h.greenRadius === "number" ? Math.max(1, h.greenRadius) : undefined;
    const fairwayWidth = typeof h.fairwayWidth === "number" ? Math.max(10, h.fairwayWidth) : undefined;
    const fairwayCurvature = typeof h.fairwayCurvature === "number" ? h.fairwayCurvature : undefined;
    const doglegAngle = typeof h.doglegAngle === "number" ? h.doglegAngle : undefined;
    const teeGroundCondition = normalizeGroundCondition(h.teeGroundCondition);
    const targetGroundCondition = normalizeGroundCondition(h.targetGroundCondition);

    const normalizedHole: Hole = {
      number: index + 1,
      par,
      distanceFromTee: distance,
      ...(greenRadius !== undefined ? { greenRadius } : {}),
      ...(fairwayWidth !== undefined ? { fairwayWidth } : {}),
      ...(fairwayCurvature !== undefined ? { fairwayCurvature } : {}),
      ...(doglegAngle !== undefined ? { doglegAngle } : {}),
      ...(teeGroundCondition !== undefined ? { teeGroundCondition } : {}),
      ...(targetGroundCondition !== undefined ? { targetGroundCondition } : {}),
    };

    acc.push(normalizedHole);
    return acc;
  }, []);

  if (normalizedCourse.length === 0) {
    return null;
  }

  const name = typeof preset.name === "string" && preset.name.trim().length > 0
    ? preset.name.trim()
    : fallbackName;

  return {
    id: typeof preset.id === "string" ? preset.id : `fallback-${Date.now()}`,
    name,
    holeCount,
    course: normalizedCourse,
  };
}

function normalizeStorage(data: unknown): CustomCourseStorage {
  const fallback: CustomCourseStorage = {
    selectedCourseId: "",
    courses: [],
  };

  if (!data || typeof data !== "object") {
    return fallback;
  }

  const raw = data as Record<string, unknown>;

  const rawCourses = Array.isArray(raw.courses) ? raw.courses : [];
  const courses: CustomCoursePreset[] = [];
  const seenIds = new Set<string>();

  for (const rawCourse of rawCourses) {
    if (!rawCourse || typeof rawCourse !== "object") continue;
    const preset = normalizePreset(rawCourse as Partial<CustomCoursePreset>, "マイコース");
    if (!preset) continue;
    if (seenIds.has(preset.id)) continue;
    seenIds.add(preset.id);
    courses.push(preset);
  }

  const selectedCourseId = typeof raw.selectedCourseId === "string" && seenIds.has(raw.selectedCourseId)
    ? raw.selectedCourseId
    : (courses[0]?.id ?? "");

  return {
    selectedCourseId,
    courses,
  };
}

export function loadStoredCustomCourse(): CustomCourseStorage {
  return readStoredJson<CustomCourseStorage>(
    CUSTOM_COURSE_STORAGE_KEY,
    (() => {
      const empty: CustomCourseStorage = { selectedCourseId: "", courses: [] };
      return empty;
    })(),
    (raw) => normalizeStorage(raw),
  );
}
