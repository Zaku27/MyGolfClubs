export type RangeSeatType = "robot" | "personal";

export type RangePlayerSettings = {
  seatType: RangeSeatType;
  robotHeadSpeed: number;
  robotSkillLevel: number;
};

export const RANGE_PLAYER_SETTINGS_KEY = "rangePlayerSettings";
export const DEFAULT_ROBOT_HEAD_SPEED = 40;
export const DEFAULT_ROBOT_SKILL_LEVEL = 0.5;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function loadRangePlayerSettings(): RangePlayerSettings {
  if (typeof window === "undefined") {
    return {
      seatType: "personal",
      robotHeadSpeed: DEFAULT_ROBOT_HEAD_SPEED,
      robotSkillLevel: DEFAULT_ROBOT_SKILL_LEVEL,
    };
  }

  try {
    const raw = localStorage.getItem(RANGE_PLAYER_SETTINGS_KEY);
    if (!raw) {
      return {
        seatType: "personal",
        robotHeadSpeed: DEFAULT_ROBOT_HEAD_SPEED,
        robotSkillLevel: DEFAULT_ROBOT_SKILL_LEVEL,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RangePlayerSettings>;

    return {
      seatType: parsed.seatType === "robot" ? "robot" : "personal",
      robotHeadSpeed: clampNumber(Number(parsed.robotHeadSpeed), 20, 60),
      robotSkillLevel: clampNumber(Number(parsed.robotSkillLevel), 0, 1),
    };
  } catch {
    return {
      seatType: "personal",
      robotHeadSpeed: DEFAULT_ROBOT_HEAD_SPEED,
      robotSkillLevel: DEFAULT_ROBOT_SKILL_LEVEL,
    };
  }
}

export function saveRangePlayerSettings(settings: RangePlayerSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RANGE_PLAYER_SETTINGS_KEY, JSON.stringify(settings));
}
