import type { WindDirection } from '../types/game';

// 角度のスナップ刻み（45度）を定数化しておくことで、
// Monte Carlo 側へ引き渡す時にも同じ定義を再利用しやすくする。
export const WIND_SNAP_STEP_DEGREES = 45;

// 風速の上限/下限を定数化し、UI・計算の両方で値域を統一する。
export const WIND_SPEED_MPS_MIN = 0;
export const WIND_SPEED_MPS_MAX = 15;

// SVG ダイアルの入力値を 0〜359 の範囲へ正規化する純粋関数。
export function normalizeWindDirection(direction: number): number {
  // JavaScript の剰余は負数を返すことがあるため、
  // 2段階で必ず 0〜359 の範囲に丸める。
  const normalized = Math.round(direction) % 360;
  return (normalized + 360) % 360;
}

// 指定された値を最小〜最大の範囲へ収める共通関数。
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// 風速入力を 0〜15 m/s の範囲へ収める純粋関数。
export function normalizeWindSpeedMps(speed: number): number {
  return clampNumber(speed, WIND_SPEED_MPS_MIN, WIND_SPEED_MPS_MAX);
}

// コンパス方位の日本語ラベル（8方位）を返す。
// 例: 225 -> "南西"
export function getCompassDirectionLabelJa(direction: number): string {
  const normalized = normalizeWindDirection(direction);
  const index = Math.round(normalized / 45) % 8;
  const labels = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'] as const;
  return labels[index];
}

// 角度表示用のラベルを作る。
// ここでは「その方角へ吹く」意味を明示するため「へ」を付ける。
// 例: 225 -> "225° 南西へ"
export function formatWindDirectionLabel(direction: number): string {
  const normalized = normalizeWindDirection(direction);
  // 0° は基準向きとして扱い、方位文字列を付けない。
  if (normalized === 0) {
    return `${normalized}°`;
  }
  return `${normalized}° ${getCompassDirectionLabelJa(normalized)}へ`;
}

// 画面座標 (clientX, clientY) をダイアル角度へ変換する。
// 仕様どおり 0°=北、時計回りを採用する。
export function calculateWindDirectionFromPoint(
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
): number {
  // ダイアル中心から見た相対ベクトルを計算する。
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  // atan2 は「右方向0°・反時計回り」を返すので、
  // +90 度して「上方向0°・時計回り」へ変換する。
  const degree = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return normalizeWindDirection(degree);
}

// 45度単位のスナップ処理を純粋関数として分離。
// スナップの ON/OFF は呼び出し側で渡す。
export function applyWindDirectionSnap(
  direction: number,
  shouldSnap: boolean,
  snapStep: number = WIND_SNAP_STEP_DEGREES,
): number {
  const normalized = normalizeWindDirection(direction);
  if (!shouldSnap) return normalized;
  if (snapStep <= 0) return normalized;
  return normalizeWindDirection(Math.round(normalized / snapStep) * snapStep);
}

// 既存シミュレーション互換のため、角度を旧3分類へマッピングする。
// 角度は「その方角へ吹く風」として扱う。
// 0°(北)は追い風、180°(南)は向かい風、東西成分は横風として扱う。
export function mapWindDirectionToLegacyType(direction: number): WindDirection {
  const normalized = normalizeWindDirection(direction);

  // 北寄り（315〜359, 0〜44）を追い風として扱う。
  if (normalized >= 315 || normalized < 45) {
    return 'tailwind';
  }

  // 南寄り（135〜224）を向かい風として扱う。
  if (normalized >= 135 && normalized < 225) {
    return 'headwind';
  }

  // それ以外は横風として扱う。
  return 'crosswind';
}

// UI は m/s、既存シミュレーションは mph を前提としているため相互変換を提供。
export function convertMpsToMph(speedMps: number): number {
  return normalizeWindSpeedMps(speedMps) * 2.2369362921;
}

// 将来 Monte Carlo 側が m/s を受ける場合に備えた逆変換。
export function convertMphToMps(speedMph: number): number {
  if (!Number.isFinite(speedMph)) return 0;
  return speedMph / 2.2369362921;
}
