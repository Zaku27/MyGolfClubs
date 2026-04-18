import { useMemo } from 'react';
import WindDirectionDial from '../WindDirectionDial';
import {
  LIE_OPTIONS,
  getLiePenaltyInfo,
  formatGroundHardnessLabel,
  type GroundHardness,
} from '../../utils/rangeUtils';
import {
  formatWindDirectionLabel,
  normalizeWindDirection,
} from '../../utils/windDirection';

interface RangeCourseConditionsProps {
  lie: string;
  windDirection: number;
  windSpeed: number;
  groundHardness: GroundHardness;
  slopeAngle: number;
  slopeDirection: number;
  isWindControlOpen: boolean;
  isCourseConditionOpen: boolean;
  onLieChange: (lie: string) => void;
  onWindDirectionChange: (direction: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onGroundHardnessChange: (hardness: GroundHardness) => void;
  onSlopeAngleChange: (angle: number) => void;
  onSlopeDirectionChange: (direction: number) => void;
  onWindControlToggle: () => void;
  onCourseConditionToggle: () => void;
  onWindReset: () => void;
}

export function RangeCourseConditions({
  lie,
  windDirection,
  windSpeed,
  groundHardness,
  slopeAngle,
  slopeDirection,
  isWindControlOpen,
  isCourseConditionOpen,
  onLieChange,
  onWindDirectionChange,
  onWindSpeedChange,
  onGroundHardnessChange,
  onSlopeAngleChange,
  onSlopeDirectionChange,
  onWindControlToggle,
  onCourseConditionToggle,
  onWindReset,
}: RangeCourseConditionsProps) {
  const windDirectionSummary = useMemo(() => formatWindDirectionLabel(windDirection), [windDirection]);
  
  // Slope display helpers
  const normalizeSlopeForDisplay = (slopeAngle: number, slopeDirection: number) => {
    const safeAngle = Number.isFinite(slopeAngle) ? slopeAngle : 0;
    const clampedAngle = Math.min(45, Math.abs(safeAngle));
    const normalizedDirection = Number.isFinite(slopeDirection)
      ? normalizeWindDirection(slopeDirection)
      : 0;

    if (safeAngle < 0) {
      return {
        slopeAngle: clampedAngle,
        slopeDirection: normalizeWindDirection(normalizedDirection + 180),
      };
    }

    return {
      slopeAngle: clampedAngle,
      slopeDirection: normalizedDirection,
    };
  };

  const normalizedSlope = normalizeSlopeForDisplay(slopeAngle, slopeDirection);

  return (
    <>
      <div className="w-full bg-white rounded shadow p-4 flex flex-col gap-3">
        <div className="flex flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <label className="text-lg font-semibold">コースコンディション</label>
            <button
              type="button"
              className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700"
              aria-label="コースコンディションの説明"
            >
              i
              <span className="help-tooltip-text whitespace-normal">
                上級者向けの設定です。通常は閉じておき、必要なときに詳細を開いてください。
              </span>
            </button>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center whitespace-nowrap rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
            onClick={onCourseConditionToggle}
            aria-expanded={isCourseConditionOpen}
          >
            {isCourseConditionOpen ? '閉じる' : '設定'}
          </button>
        </div>

        {/* Simple course condition display */}
        {!isCourseConditionOpen && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-semibold">ライ</p>
                <p>{lie}</p>
              </div>
              <div>
                <p className="font-semibold">風</p>
                <p>{windDirectionSummary} / {windSpeed.toFixed(1)} m/s</p>
              </div>
              <div>
                <p className="font-semibold">地面硬さ</p>
                <p>{formatGroundHardnessLabel(groundHardness)}</p>
              </div>
              <div>
                <p className="font-semibold">傾斜</p>
                <p>{slopeAngle === 0 ? 'フラット' : `傾斜 ${slopeAngle}° (${slopeDirection}°)`}</p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed course condition settings */}
        {isCourseConditionOpen && (
          <>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <label className="block font-semibold mb-1 text-green-900">ライ</label>
              <select
                className="w-full border rounded p-2"
                value={lie}
                onChange={(e) => onLieChange(e.target.value)}
              >
                {LIE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-green-900">
                ライペナルティ: {getLiePenaltyInfo(lie, 'Iron')}
              </p>
            </div>

            <div className="rounded border border-green-200 bg-green-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="font-semibold">風向・風速</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    onClick={onWindReset}
                  >
                    風をリセット
                  </button>
                  <button
                    type="button"
                    className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
                    onClick={onWindControlToggle}
                    aria-expanded={isWindControlOpen}
                    aria-controls="wind-direction-dial-panel"
                  >
                    {isWindControlOpen ? '設定を閉じる' : '設定を開く'}
                  </button>
                </div>
              </div>
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                <span className="mr-3 font-semibold">風向: {windDirectionSummary}</span>
                <span className="font-semibold">風速: {windSpeed.toFixed(1)} m/s</span>
              </div>
              {isWindControlOpen && (
                <div id="wind-direction-dial-panel" className="mt-2">
                  <WindDirectionDial
                    windDirection={windDirection}
                    windSpeed={windSpeed}
                    onDirectionChange={onWindDirectionChange}
                    onSpeedChange={onWindSpeedChange}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 rounded border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold text-emerald-900 mb-2">地面硬さ</p>
              <label className="space-y-1 text-xs font-semibold text-emerald-800">
                <select
                  value={groundHardness}
                  onChange={(event) => onGroundHardnessChange(event.target.value as GroundHardness)}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5"
                >
                  <option value="soft">柔らかい</option>
                  <option value="medium">普通</option>
                  <option value="firm">硬い</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold text-emerald-900 mb-2">傾斜</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-emerald-800">
                  上り方向
                  <div className="grid grid-cols-3 gap-1 text-center place-items-center">
                    <div />
                    <button
                      type="button"
                      onClick={() => onSlopeDirectionChange(normalizeWindDirection(0))}
                      className={[
                        'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                        normalizedSlope.slopeDirection === 0
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                      ].join(' ')}
                    >
                      前
                    </button>
                    <div />
                    <button
                      type="button"
                      onClick={() => onSlopeDirectionChange(normalizeWindDirection(270))}
                      className={[
                        'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                        normalizedSlope.slopeDirection === 270
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                      ].join(' ')}
                    >
                      左
                    </button>
                    <div />
                    <button
                      type="button"
                      onClick={() => onSlopeDirectionChange(normalizeWindDirection(90))}
                      className={[
                        'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                        normalizedSlope.slopeDirection === 90
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                      ].join(' ')}
                    >
                      右
                    </button>
                    <div />
                    <button
                      type="button"
                      onClick={() => onSlopeDirectionChange(normalizeWindDirection(180))}
                      className={[
                        'h-10 w-10 rounded border px-2 py-1 text-[11px] font-bold transition flex items-center justify-center',
                        normalizedSlope.slopeDirection === 180
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100',
                      ].join(' ')}
                    >
                      後
                    </button>
                    <div />
                  </div>
                  <div className="text-right text-[11px] text-emerald-700">
                    {normalizedSlope.slopeDirection}°
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    step={1}
                    value={slopeDirection}
                    onChange={(event) => onSlopeDirectionChange(normalizeWindDirection(Number(event.target.value)))}
                    className="w-full cursor-pointer"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-emerald-800">
                  傾斜角度
                  <input
                    type="range"
                    min={0}
                    max={45}
                    step={1}
                    value={slopeAngle}
                    onChange={(event) => onSlopeAngleChange(Math.max(0, Number(event.target.value)))}
                    className="w-full cursor-pointer"
                  />
                  <div className="text-right text-[11px] text-emerald-700">
                    {slopeAngle === 0 ? 'フラット' : `傾斜量 ${slopeAngle}°`}
                  </div>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
