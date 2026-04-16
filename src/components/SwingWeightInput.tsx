import { useState, useRef, useCallback } from 'react';
import { normalizeSwingWeightText, swingWeightToNumeric, numericToSwingWeightLabel } from '../utils/analysisUtils';

type SwingWeightInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export const SwingWeightInput = ({
  value,
  onChange,
  disabled = false,
  error,
}: SwingWeightInputProps) => {
  const [localValue, setLocalValue] = useState(value);
  const valueRef = useRef(localValue);

  // Update local value when prop changes
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setLocalValue(value);
    valueRef.current = value;
  }

  const handleIncrement = useCallback(() => {
    const currentNumeric = swingWeightToNumeric(localValue);
    if (currentNumeric === null) return;
    
    const newNumeric = Math.round((currentNumeric + 0.1) * 10) / 10;
    const newLabel = numericToSwingWeightLabel(newNumeric);
    setLocalValue(newLabel);
    valueRef.current = newLabel;
    onChange(newLabel);
  }, [localValue, onChange]);

  const handleDecrement = useCallback(() => {
    const currentNumeric = swingWeightToNumeric(localValue);
    if (currentNumeric === null) return;
    
    const newNumeric = Math.round((currentNumeric - 0.1) * 10) / 10;
    const newLabel = numericToSwingWeightLabel(newNumeric);
    setLocalValue(newLabel);
    valueRef.current = newLabel;
    onChange(newLabel);
  }, [localValue, onChange]);

  const handleDirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.toUpperCase();
    setLocalValue(inputValue);
    valueRef.current = inputValue;
    
    const normalized = normalizeSwingWeightText(inputValue);
    if (normalized) {
      onChange(normalized);
    } else {
      onChange(inputValue);
    }
  };

  const handleBlur = () => {
    const normalized = normalizeSwingWeightText(localValue);
    if (normalized && normalized !== localValue) {
      setLocalValue(normalized);
      onChange(normalized);
    }
  };

  return (
    <div className="swing-weight-input-wrapper">
      <div className="swing-weight-input-controls">
        <button
          type="button"
          className="swing-weight-input-button decrement"
          onClick={handleDecrement}
          disabled={disabled}
          aria-label="Decrease swing weight"
        >
          −
        </button>
        <input
          type="text"
          className={`swing-weight-input-field ${error ? 'error' : ''}`}
          value={localValue}
          onChange={handleDirectChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="例: C9, D0.5, E1"
          aria-label="Swing weight value"
        />
        <button
          type="button"
          className="swing-weight-input-button increment"
          onClick={handleIncrement}
          disabled={disabled}
          aria-label="Increase swing weight"
        >
          +
        </button>
      </div>
      {error && <span className="error-message swing-weight-error">{error}</span>}
    </div>
  );
};
