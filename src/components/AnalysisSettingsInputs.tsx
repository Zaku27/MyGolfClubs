import { useEffect, useState } from 'react';
import { numericToSwingWeightLabel, parseSwingWeightInput } from '../utils/analysisUtils';

type LieStandardInputRowProps = {
  label: string;
  defaultValue: number;
  currentValue?: number;
  onCommit: (value: number) => void;
  onClear: () => void;
  subLabel?: string;
};

type SwingTargetInputRowProps = {
  value: number;
  onCommit: (value: number) => void;
  onReset: () => void;
};

type SwingThresholdInputRowProps = {
  label: string;
  value: number;
  description: string;
  onCommit: (value: number) => void;
};

export const LieStandardInputRow = ({
  label,
  defaultValue,
  currentValue,
  onCommit,
  onClear,
  subLabel,
}: LieStandardInputRowProps) => {
  const isOverridden = currentValue != null;

  const commit = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>{label}</strong>
        {subLabel ? <span>{subLabel}</span> : null}
        <em className={isOverridden ? 'lie-setting-state is-overridden' : 'lie-setting-state'}>
          {isOverridden
            ? `上書き中: ${currentValue!.toFixed(1)}°`
            : `未設定（標準値 ${defaultValue.toFixed(1)}° を使用）`}
        </em>
      </div>
      <input
        key={`${currentValue ?? 'default'}-${defaultValue}`}
        className="analysis-input lie-setting-input"
        type="number"
        step="0.1"
        defaultValue={(currentValue ?? defaultValue).toFixed(1)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit((event.currentTarget as HTMLInputElement).value);
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={(event) => commit(event.target.value)}
      />
      <button
        className="btn-secondary lie-setting-reset"
        type="button"
        title="この行の上書きを解除"
        onClick={onClear}
      >
        解除
      </button>
    </div>
  );
};

export const SwingTargetInputRow = ({
  value,
  onCommit,
  onReset,
}: SwingTargetInputRowProps) => {
  const [draft, setDraft] = useState(numericToSwingWeightLabel(value));

  useEffect(() => {
    setDraft(numericToSwingWeightLabel(value));
  }, [value]);

  const commit = () => {
    const parsed = parseSwingWeightInput(draft);
    if (parsed == null) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>目安ターゲット</strong>
        <span>既定値: D2</span>
        <em className="lie-setting-state">D1 や D1.5 の形式で設定できます</em>
      </div>
      <input
        className="analysis-input lie-setting-input"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={commit}
        placeholder="D2"
      />
      <button
        className="btn-secondary lie-setting-reset"
        type="button"
        onClick={onReset}
      >
        リセット
      </button>
    </div>
  );
};

export const SwingThresholdInputRow = ({
  label,
  value,
  description,
  onCommit,
}: SwingThresholdInputRowProps) => {
  const [draft, setDraft] = useState(value.toFixed(1));

  useEffect(() => {
    setDraft(value.toFixed(1));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
  };

  return (
    <div className="lie-setting-row">
      <div className="lie-setting-labels">
        <strong>{label}</strong>
        <span>{description}</span>
        <em className="lie-setting-state">0.1 刻みで設定できます</em>
      </div>
      <input
        className="analysis-input lie-setting-input"
        type="number"
        step="0.1"
        min="0.1"
        max="30"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={commit}
      />
      <div />
    </div>
  );
};