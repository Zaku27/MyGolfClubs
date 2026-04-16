import { useState, useEffect } from 'react';
import { numericToSwingWeightLabel } from '../utils/analysisUtils';

type SwingTargetInputProps = {
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
};

export const SwingTargetInput = ({
  value,
  onChange,
  onReset,
}: SwingTargetInputProps) => {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    
    const parsedValue = Number(newValue);
    if (!Number.isNaN(parsedValue)) {
      onChange(parsedValue);
    }
  };

  const handleIncrement = () => {
    const newValue = value + 0.1;
    onChange(Math.round(newValue * 10) / 10);
  };

  const handleDecrement = () => {
    const newValue = value - 0.1;
    onChange(Math.round(newValue * 10) / 10);
  };

  return (
    <div className="swing-target-input">
      <div className="swing-target-labels">
        <label htmlFor="swing-target-input">
          <strong>目安値</strong>
        </label>
        <span className="swing-target-default">既定値: D2 ({numericToSwingWeightLabel(20)})</span>
        <span className="swing-target-current">
          現在値: {numericToSwingWeightLabel(value)}
        </span>
      </div>
      
      <div className="swing-target-controls">
        <button
          type="button"
          className="swing-target-button decrement"
          onClick={handleDecrement}
          aria-label="0.1減少"
        >
          −
        </button>
        
        <input
          id="swing-target-input"
          type="number"
          value={inputValue}
          onChange={handleChange}
          step="0.1"
          min="0"
          max="99"
          className="swing-target-field"
          aria-label="目安値値"
        />
        
        <button
          type="button"
          className="swing-target-button increment"
          onClick={handleIncrement}
          aria-label="0.1増加"
        >
          +
        </button>
        
        <button
          type="button"
          className="swing-target-button reset"
          onClick={onReset}
          aria-label="リセット"
        >
          リセット
        </button>
      </div>
    </div>
  );
};
