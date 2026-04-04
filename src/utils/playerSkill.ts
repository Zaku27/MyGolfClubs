export type SkillPreset = {
  label: string;
  value: number;
  score: string;
};

export const SKILL_PRESETS: readonly SkillPreset[] = [
  { label: "初心者", value: 0.1, score: "120以上" },
  { label: "初級者", value: 0.2, score: "110～119" },
  { label: "中級者", value: 0.5, score: "90～109" },
  { label: "上級者", value: 0.8, score: "80～89" },
  { label: "超上級者", value: 1.0, score: "79以下" },
] as const;

export function getSkillLabel(level: number): string {
  if (level < 0.15) return "初心者";
  if (level < 0.35) return "初級者";
  if (level < 0.65) return "中級者";
  if (level < 0.9) return "上級者";
  return "超上級者";
}

export function formatSkillLevelLabel(level: number): string {
  return `${(level * 100).toFixed(0)}% (${getSkillLabel(level)})`;
}
