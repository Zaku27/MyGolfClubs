import type { ChangeEvent } from 'react';

type ShotControlPanelProps = {
  aimXOffset: number;
  onAimXOffsetChange: (value: number) => void;
  shotPowerPercent: number;
  onShotPowerPercentChange: (value: number) => void;
  onShot: () => void;
  shotButtonLabel: string;
  buttonDisabled: boolean;
  inputsDisabled?: boolean;
  showAim?: boolean;
  showPower?: boolean;
};

export function ShotControlPanel({
  aimXOffset,
  onAimXOffsetChange,
  shotPowerPercent,
  onShotPowerPercentChange,
  onShot,
  shotButtonLabel,
  buttonDisabled,
  inputsDisabled,
  showAim = true,
  showPower = true,
}: ShotControlPanelProps) {
  const effectiveInputsDisabled = inputsDisabled ?? buttonDisabled;

  return (
    <div className="w-full flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-center">
      {showAim ? (
        <div className="w-full rounded-xl border border-sky-300/70 bg-sky-50/80 px-3 py-3 lg:w-72">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-[0.08em] text-sky-800">
            <span>方向</span>
            <span>{aimXOffset > 0 ? `右 ${aimXOffset}yd` : aimXOffset < 0 ? `左 ${Math.abs(aimXOffset)}yd` : '中央'}</span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={aimXOffset}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onAimXOffsetChange(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sky-200 accent-sky-600"
            aria-label="狙い"
            disabled={effectiveInputsDisabled}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-sky-700">
            <span>左 50yd</span>
            <span>中央</span>
            <span>右 50yd</span>
          </div>
        </div>
      ) : null}

      <div className="w-full lg:w-72">
        <button
          type="button"
          disabled={buttonDisabled}
          onClick={onShot}
          className={`w-full rounded-2xl px-4 py-6 text-2xl font-black tracking-[0.08em] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70 ${buttonDisabled ? 'cursor-not-allowed bg-emerald-200 text-emerald-500' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-300/70 hover:bg-emerald-500'}`}
        >
          {shotButtonLabel}
        </button>
      </div>

      {showPower ? (
        <div className={`w-full lg:w-72 rounded-xl border px-3 py-3 ${shotPowerPercent > 100 ? 'border-red-300/70 bg-red-100/70' : 'border-emerald-300/70 bg-emerald-100/70'}`}>
          <div className={`mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-[0.08em] ${shotPowerPercent > 100 ? 'text-red-800' : 'text-emerald-800'}`}>
            <span>パワー</span>
            <span>{shotPowerPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={110}
            step={1}
            value={shotPowerPercent}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onShotPowerPercentChange(Number(event.target.value))}
            className={`h-1.5 w-full cursor-pointer appearance-none rounded-full ${shotPowerPercent > 100 ? 'bg-red-200 accent-red-600' : 'bg-emerald-200 accent-emerald-600'}`}
            aria-label="ショットパワー"
            disabled={effectiveInputsDisabled}
          />
          <div className={`mt-1 flex items-center justify-between text-[10px] font-medium ${shotPowerPercent > 100 ? 'text-red-700' : 'text-emerald-700'}`}>
            <span>0%</span>
            <span>110%</span>
          </div>
          {shotPowerPercent > 100 && (
            <div className="mt-2 text-[10px] font-medium text-red-600">
              パワー超過：スキルレベルが低下します
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
