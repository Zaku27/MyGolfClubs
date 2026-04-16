import { useState, useEffect, useRef, useCallback } from 'react';
import { numericToSwingWeightLabel, parseSwingWeightInput } from '../utils/analysisUtils';

type SwingWeightEditorProps = {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export const SwingWeightEditor = ({
  value,
  onChange,
  disabled = false,
}: SwingWeightEditorProps) => {
  const [localValue, setLocalValue] = useState(value ?? 20);
  const valueRef = useRef(localValue);

  useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value);
    }
  }, [value]);

  useEffect(() => {
    valueRef.current = localValue;
  }, [localValue]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleIncrement = useCallback(() => {
    const newValue = Math.round((valueRef.current + 0.1) * 10) / 10;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleDecrement = useCallback(() => {
    const newValue = Math.round((valueRef.current - 0.1) * 10) / 10;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const startIncrement = useCallback(() => {
    handleIncrement();
    intervalRef.current = setInterval(handleIncrement, 100);
  }, [handleIncrement]);

  const startDecrement = useCallback(() => {
    handleDecrement();
    intervalRef.current = setInterval(handleDecrement, 100);
  }, [handleDecrement]);

  const stopChange = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleDirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const parsedValue = parseSwingWeightInput(inputValue);
    if (parsedValue !== null && parsedValue >= -10 && parsedValue <= 50) {
      setLocalValue(parsedValue);
      onChange(parsedValue);
    }
  };

  const handleSave = () => {
    onChange(localValue);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="swing-weight-editor">
      <div className="swing-weight-editor-label">SW分布の目安値:</div>
      <div className="swing-weight-editor-controls">
        <button
          type="button"
          className="swing-weight-editor-button decrement"
          onClick={handleDecrement}
          onMouseDown={startDecrement}
          onMouseUp={stopChange}
          onMouseLeave={stopChange}
          onTouchStart={startDecrement}
          onTouchEnd={stopChange}
          disabled={disabled || localValue <= -10}
          aria-label="Decrease swing weight target"
        >
          -
        </button>
        <input
          type="text"
          className="swing-weight-editor-input"
          value={numericToSwingWeightLabel(localValue)}
          onChange={handleDirectChange}
          disabled={disabled}
          aria-label="Swing weight target value"
        />
        <button
          type="button"
          className="swing-weight-editor-button increment"
          onClick={handleIncrement}
          onMouseDown={startIncrement}
          onMouseUp={stopChange}
          onMouseLeave={stopChange}
          onTouchStart={startIncrement}
          onTouchEnd={stopChange}
          disabled={disabled || localValue >= 50}
          aria-label="Increase swing weight target"
        >
          +
        </button>
        <button
          type="button"
          className="swing-weight-editor-button save"
          onClick={handleSave}
          disabled={disabled}
          aria-label="Save swing weight target"
        >
          保存
        </button>
      </div>
    </div>
  );
};
