import { useState, useEffect } from 'react';
import { numericToSwingWeightLabel } from '../utils/analysisUtils';

type SwingWeightEditorProps = {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export const SwingWeightEditor = ({
  value = 20,
  onChange,
  disabled = false,
}: SwingWeightEditorProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleIncrement = () => {
    const newValue = Math.round((localValue + 0.1) * 10) / 10;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.round((localValue - 0.1) * 10) / 10;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleDirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(e.target.value);
    if (!isNaN(inputValue) && inputValue >= -10 && inputValue <= 50) {
      setLocalValue(inputValue);
      onChange(inputValue);
    }
  };

  return (
    <div className="swing-weight-editor">
      <div className="swing-weight-editor-label">SW分布の目安値:</div>
      <div className="swing-weight-editor-controls">
        <button
          type="button"
          className="swing-weight-editor-button decrement"
          onClick={handleDecrement}
          disabled={disabled || localValue <= -10}
          aria-label="Decrease swing weight target"
        >
          -
        </button>
        <input
          type="number"
          className="swing-weight-editor-input"
          value={localValue}
          onChange={handleDirectChange}
          disabled={disabled}
          min="-10"
          max="50"
          step="0.1"
          aria-label="Swing weight target value"
        />
        <button
          type="button"
          className="swing-weight-editor-button increment"
          onClick={handleIncrement}
          disabled={disabled || localValue >= 50}
          aria-label="Increase swing weight target"
        >
          +
        </button>
        <span className="swing-weight-editor-display">
          {numericToSwingWeightLabel(localValue)}
        </span>
      </div>
    </div>
  );
};
