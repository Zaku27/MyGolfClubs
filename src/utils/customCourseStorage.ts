import { readStoredJson } from "./storage";
import type { CustomCoursePreset, CustomCourseStorage } from "../components/simulator/courseTypes";
import type { Hole, HazardType } from "../types/game";

export type { CustomCoursePreset, CustomCourseStorage };

const CUSTOM_COURSE_STORAGE_KEY = "golfbag-custom-course-library-v1";

function createCourseId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


function normalizeHoleCount(value: unknown): 1 | 3 | 9 | 18 {
  if (value === 1 || value === 3 || value === 9 || value === 18) {
    return value;
  }
  return 9;
}

function normalizeGroundCondition(value: unknown): { hardness: "soft" | "medium" | "firm"; slopeAngle: number; slopeDirection: number } | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  type GroundConditionHardness = "soft" | "medium" | "firm";
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

  const normalizedCourse = preset.course.slice(0, 18).reduce<Hole[]>((acc, hole, index) => {
    if (!hole || typeof hole !== "object") {
      return acc;
    }

    const raw = hole as unknown as Record<string, unknown>;
    const par = raw.par === 3 || raw.par === 4 || raw.par === 5 ? raw.par : 4;
    const distance = Number(raw.distanceFromTee) || 360;
    const greenRadius = Math.max(6, Math.min(25, Number(raw.greenRadius) || 12));
    const hazards = Array.isArray(raw.hazards)
      ? raw.hazards
          .filter((hazard) => hazard && typeof hazard === "object")
          .map((hazard, hazardIndex) => {
            const h = hazard as unknown as Record<string, unknown>;
            const yFront = Math.max(0, Number(h.yFront) || 0);
            const yBack = Math.max(yFront + 3, Number(h.yBack) || yFront + 15);
            const width = Math.max(6, Number(h.width) || 20);
            const type: HazardType = h.type === "bunker" || h.type === "water" || h.type === "ob" || h.type === "rough" || h.type === "semirough" || h.type === "bareground"
              ? (h.type as HazardType)
              : "bunker";
            const penaltyStrokes: 0 | 1 | 2 = type === "ob" ? 2 : type === "water" ? 1 : 0;
            const points = Array.isArray(h.points)
              ? h.points
                  .filter((point: unknown) => point && typeof point === "object")
                  .map((point: unknown) => {
                    const rawPoint = point as Record<string, unknown>;
                    return {
                      x: Number(rawPoint.x) || 0,
                      y: Number(rawPoint.y) || 0,
                    };
                  })
              : [];
            const isPolygon = h.shape === "polygon" && points.length >= 3;

            if (isPolygon) {
              const xs = points.map((p: { x: number; y: number }) => p.x);
              const ys = points.map((p: { x: number; y: number }) => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);
              const xCenter = Number(h.xCenter) || (minX + maxX) / 2;

              return {
                id: typeof h.id === "string" && h.id.length > 0
                  ? h.id
                  : `restored-${index + 1}-${hazardIndex + 1}`,
                type,
                shape: "polygon" as const,
                points,
                x: Number(h.x) || minX,
                y: Number(h.y) || minY,
                width: Number(h.width) || maxX - minX,
                height: Number(h.height) || maxY - minY,
                xCenter,
                yFront: Number(h.yFront) || minY,
                yBack: Number(h.yBack) || maxY,
                penaltyStrokes,
                name: typeof h.name === "string" && h.name.length > 0 ? h.name : undefined,
                groundCondition: normalizeGroundCondition(h.groundCondition),
              };
            }

            return {
              id: typeof h.id === "string" && h.id.length > 0
                ? h.id
                : `restored-${index + 1}-${hazardIndex + 1}`,
              type,
              shape: "rectangle" as const,
              yFront,
              yBack,
              xCenter: Number(h.xCenter) || 0,
              width,
              penaltyStrokes,
              name: typeof h.name === "string" && h.name.length > 0 ? h.name : undefined,
              groundCondition: normalizeGroundCondition(h.groundCondition),
            };
          })
        : [];

    const greenPolygon = Array.isArray(raw.greenPolygon)
      ? raw.greenPolygon
          .filter((pt) => pt && typeof pt === "object")
          .map((pt) => {
            const rawPoint = pt as Record<string, unknown>;
            return {
              x: Number(rawPoint.x) || 0,
              y: Number(rawPoint.y) || 0,
            };
          })
      : [];

    acc.push({
      number: index + 1,
      par,
      distanceFromTee: distance,
      targetDistance: distance,
      greenRadius,
      greenPolygon: greenPolygon.length >= 3 ? greenPolygon : undefined,
      hazards,
      groundCondition: normalizeGroundCondition(raw.groundCondition),
    });

    return acc;
  }, []);

  if (normalizedCourse.length === 0) {
    return null;
  }

  const courseId = typeof preset.id === "string" && preset.id.length > 0
    ? preset.id
    : createCourseId();

  return {
    id: courseId,
    name: typeof preset.name === "string" && preset.name.length > 0 ? preset.name : fallbackName,
    holeCount,
    course: normalizedCourse,
  };
}

function buildDefaultPreset(): CustomCoursePreset {
  return {
    id: createCourseId(),
    name: "マイコース 1",
    holeCount: 9,
    course: [], // This will be filled by the caller
  };
}

function parseStoredCustomCourse(value: unknown): CustomCourseStorage {
  const fallbackPreset = buildDefaultPreset();
  const fallback: CustomCourseStorage = {
    selectedCourseId: fallbackPreset.id,
    courses: [fallbackPreset],
  };

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<CustomCourseStorage>;
  const legacyCandidate = value as Partial<{ holeCount: 1 | 3 | 9 | 18; course: unknown[] }>;

  if (Array.isArray(legacyCandidate.course) && legacyCandidate.course.length > 0) {
    const migrated = normalizePreset(
      {
        id: createCourseId(),
        name: "マイコース 1",
        holeCount: legacyCandidate.holeCount,
        course: legacyCandidate.course as Hole[],
      },
      "マイコース 1",
    );
    if (migrated) {
      return {
        selectedCourseId: migrated.id,
        courses: [migrated],
      };
    }
  }

  if (!Array.isArray(candidate.courses) || candidate.courses.length === 0) {
    return fallback;
  }

  const normalizedCourses = candidate.courses
    .map((course, index) => normalizePreset(course, `マイコース ${index + 1}`))
    .filter((course): course is CustomCoursePreset => course !== null);

  if (normalizedCourses.length === 0) {
    return fallback;
  }

  const selectedCourseId = typeof candidate.selectedCourseId === "string"
    ? candidate.selectedCourseId
    : normalizedCourses[0].id;
  const selectedExists = normalizedCourses.some((course) => course.id === selectedCourseId);

  return {
    selectedCourseId: selectedExists ? selectedCourseId : normalizedCourses[0].id,
    courses: normalizedCourses,
  };
}

export function loadStoredCustomCourse(): CustomCourseStorage {
  return readStoredJson<CustomCourseStorage>(
    CUSTOM_COURSE_STORAGE_KEY,
    (() => {
      const preset = buildDefaultPreset();
      return {
        selectedCourseId: preset.id,
        courses: [preset],
      };
    })(),
    parseStoredCustomCourse,
  );
}
