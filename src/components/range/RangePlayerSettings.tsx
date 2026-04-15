import { type RangeSeatType } from '../../utils/rangePlayerSettings';

interface RangePlayerSettingsProps {
  seatType: RangeSeatType;
  robotHeadSpeed: number;
  robotSkillLevel: number;
  personalSkillLevel: number;
  onSeatTypeChange: (type: RangeSeatType) => void;
  onRobotHeadSpeedChange: (speed: number) => void;
  onRobotSkillLevelChange: (level: number) => void;
}

export function RangePlayerSettings({
  seatType,
  robotHeadSpeed,
  robotSkillLevel,
  personalSkillLevel,
  onSeatTypeChange,
  onRobotHeadSpeedChange,
  onRobotSkillLevelChange,
}: RangePlayerSettingsProps) {
  return (
    <div className="w-full bg-white rounded shadow p-4">
      <label className="block font-semibold mb-2">プレイヤー選択</label>
      <select
        className="w-full border rounded p-2 mb-2"
        value={seatType}
        onChange={e => onSeatTypeChange(e.target.value as RangeSeatType)}
      >
        <option value="personal">ユーザー</option>
        <option value="robot">ロボット</option>
        <option value="actual">実測データ</option>
      </select>

      {seatType === 'robot' && (
        <div className="flex flex-col gap-2 mt-2 bg-blue-50 rounded p-3 border border-blue-300">
          <div>
            <label className="block font-semibold mb-1">ヘッドスピード (m/s)</label>
            <input
              type="number"
              min={20}
              max={60}
              step={0.1}
              value={robotHeadSpeed}
              onChange={e => onRobotHeadSpeedChange(Number(e.target.value))}
              className="w-32 border rounded p-1 mr-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">スキルレベル</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={robotSkillLevel}
              onChange={e => onRobotSkillLevelChange(Number(e.target.value))}
              className="w-40 accent-green-700"
            />
            <span className="ml-2">{(robotSkillLevel * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {seatType === 'personal' && (
        <div className="flex flex-col gap-2 mt-2 bg-green-50 rounded p-3 border border-green-200 text-sm text-green-900">
          <span className="text-xs text-green-700">
            レンジではパーソナルデータ画面で保存したスキルレベルが適用されます。
          </span>
          <div className="rounded border border-green-200 bg-white/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <span className="font-semibold">適用スキルレベル:</span>{' '}
                {(personalSkillLevel * 100).toFixed(0)}% ({getSkillLabel(personalSkillLevel)})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get skill label
function getSkillLabel(level: number): string {
  if (level >= 0.9) return '上級者';
  if (level >= 0.7) return '中級者';
  if (level >= 0.5) return '初級者';
  return 'ビギナー';
}
