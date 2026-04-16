
type LieStandardInputRowProps = {
  label: string;
  defaultValue: number;
  currentValue?: number;
  onCommit: (value: number) => void;
  onClear: () => void;
  subLabel?: string;
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