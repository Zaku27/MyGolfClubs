import { SHOT_COUNTS } from '../../utils/rangeUtils';

interface RangeSimulationControlsProps {
  numShots: number;
  reuseLastSeed: boolean;
  onNumShotsChange: (num: number) => void;
  onReuseLastSeedChange: (reuse: boolean) => void;
}

export function RangeSimulationControls({
  numShots,
  reuseLastSeed,
  onNumShotsChange,
  onReuseLastSeedChange,
}: RangeSimulationControlsProps) {
  return (
    <div className="w-full bg-white rounded shadow p-4">
      <label className="block font-semibold mb-2">試行設定</label>
      <div className="space-y-4">
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <label className="block font-semibold mb-1">試行回数</label>
          <div className="flex gap-2 flex-wrap">
            {SHOT_COUNTS.map((n) => (
              <button
                key={n}
                className={`px-3 py-1 rounded border ${numShots === n ? 'bg-green-200 border-green-600' : 'bg-white border-green-200'} font-semibold`}
                onClick={() => onNumShotsChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <label htmlFor="reuse-last-seed" className="block font-semibold text-green-900">
                再実行時の乱数
              </label>
              <button
                type="button"
                className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700"
                aria-label="再実行時の乱数の説明"
              >
                i
                <span className="help-tooltip-text whitespace-normal">
                  {reuseLastSeed
                    ? '前回と同じ乱数で再実行します。条件が同じなら結果も再現されます。'
                    : '毎回新しい乱数で再実行します。'}
                </span>
              </button>
            </div>
            <label htmlFor="reuse-last-seed" className="inline-flex cursor-pointer items-center gap-2">
              <span className={`text-sm font-medium ${reuseLastSeed ? 'text-green-900' : 'text-gray-500'}`}>
                同じ乱数
              </span>
              <span className="relative inline-flex items-center">
                <input
                  id="reuse-last-seed"
                  type="checkbox"
                  className="peer sr-only"
                  checked={reuseLastSeed}
                  onChange={(e) => onReuseLastSeedChange(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-green-600" />
                <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
              <span className={`text-sm font-medium ${reuseLastSeed ? 'text-gray-500' : 'text-green-900'}`}>
                新しい乱数
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
