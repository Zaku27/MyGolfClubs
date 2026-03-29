import React, { useState, useEffect } from 'react';
import type { GolfClub, ClubCategory } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';
import './ClubForm.css';

const CLUB_TYPE_OPTIONS: { value: ClubCategory; label: string }[] = [
  { value: 'Driver', label: 'Driver' },
  { value: 'Wood', label: 'Wood' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Iron', label: 'Iron' },
  { value: 'Wedge', label: 'Wedge' },
  { value: 'Putter', label: 'Putter' },
];

const CLUB_NUMBER_OPTIONS: Partial<Record<ClubCategory, string[]>> = {
  Driver: ['1W'],
  Wood: ['3W', '5W', '7W', '9W'],
  Hybrid: ['2H', '3H', '4H', '5H', '6H'],
  Iron: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  Wedge: ['PW', 'GW', 'AW', 'SW', 'LW'],
};

const CLUB_NUMBER_DEFAULT: Record<ClubCategory, string> = {
  Driver: '1W',
  Wood: '3W',
  Hybrid: '3H',
  Iron: '7',
  Wedge: 'PW',
  Putter: 'Putter',
};

interface ClubFormProps {
  club?: GolfClub;
  onSubmit: (club: Omit<GolfClub, 'id'> | Partial<GolfClub>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type ClubFormData = Omit<GolfClub, 'id' | 'clubType'> & {
  clubType: ClubCategory | '';
};

const buildClubDefaults = (clubType: ClubCategory): Omit<GolfClub, 'id'> => {
  const source = DEFAULT_CLUBS.find((defaultClub) => defaultClub.clubType === clubType);

  if (source) {
    return {
      ...source,
      clubType,
      name: '',
      number: CLUB_NUMBER_DEFAULT[clubType],
    };
  }

  return {
    clubType,
    name: '',
    number: CLUB_NUMBER_DEFAULT[clubType],
    length: 0,
    weight: 0,
    swingWeight: '',
    lieAngle: 0,
    loftAngle: 0,
    shaftType: '',
    torque: 0,
    flex: 'S',
    distance: 0,
    notes: '',
  };
};

const normalizeNumberForMatch = (clubType: ClubCategory, value: string): string => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');

  if (clubType === 'Driver') {
    return normalized.replace(/W$/, '') || '1';
  }

  if (clubType === 'Wood') {
    const match = normalized.match(/^(\d+)/);
    return match?.[1] ?? normalized.replace(/W$/, '');
  }

  if (clubType === 'Hybrid') {
    const match = normalized.match(/^(\d+)/);
    return match?.[1] ?? normalized.replace(/H$/, '');
  }

  if (clubType === 'Putter') {
    return 'P';
  }

  return normalized;
};

const buildClubDefaultsByTypeAndNumber = (
  clubType: ClubCategory,
  selectedNumber: string,
): Omit<GolfClub, 'id'> => {
  const candidates = DEFAULT_CLUBS.filter((defaultClub) => defaultClub.clubType === clubType);
  if (candidates.length === 0) {
    return {
      ...buildClubDefaults(clubType),
      number: selectedNumber,
    };
  }

  const selectedNormalized = normalizeNumberForMatch(clubType, selectedNumber);
  const exact = candidates.find(
    (candidate) => normalizeNumberForMatch(clubType, candidate.number) === selectedNormalized,
  );

  if (exact) {
    return {
      ...exact,
      number: selectedNumber,
    };
  }

  const selectedNumeric = Number(selectedNormalized);
  if (Number.isFinite(selectedNumeric)) {
    const nearest = candidates
      .map((candidate) => ({
        candidate,
        numeric: Number(normalizeNumberForMatch(clubType, candidate.number)),
      }))
      .filter((entry) => Number.isFinite(entry.numeric))
      .sort((left, right) => Math.abs(left.numeric - selectedNumeric) - Math.abs(right.numeric - selectedNumeric))[0];

    if (nearest) {
      return {
        ...nearest.candidate,
        number: selectedNumber,
      };
    }
  }

  return {
    ...candidates[0],
    number: selectedNumber,
  };
};

export const ClubForm: React.FC<ClubFormProps> = ({
  club,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [numberPreset, setNumberPreset] = useState<string>('Custom');
  const [formData, setFormData] = useState<ClubFormData>({
    clubType: '',
    name: '',
    number: '',
    length: 0,
    weight: 0,
    swingWeight: '',
    lieAngle: 0,
    loftAngle: 0,
    shaftType: '',
    torque: 0,
    flex: 'S',
    distance: 0,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const normalizeClubNumber = (clubType: ClubCategory, value: string): string => {
    if (clubType === 'Putter') {
      return 'Putter';
    }
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
    if (clubType === 'Driver' && !normalized) {
      return '1W';
    }
    return normalized;
  };

  const inferPreset = (clubType: ClubCategory, value: string): string => {
    const options = CLUB_NUMBER_OPTIONS[clubType] ?? [];
    const normalized = normalizeClubNumber(clubType, value);
    return options.includes(normalized) ? normalized : 'Custom';
  };

  const applyClubTypeChange = (clubType: ClubCategory) => {
    const nextNumber = CLUB_NUMBER_DEFAULT[clubType];
    if (club) {
      setFormData((prev) => ({
        ...prev,
        clubType,
        number: nextNumber,
        swingWeight: clubType === 'Putter' ? '' : prev.swingWeight,
      }));
    } else {
      const defaults = buildClubDefaults(clubType);
      setFormData((prev) => ({
        ...defaults,
        name: prev.name,
        swingWeight: clubType === 'Putter' ? '' : defaults.swingWeight,
      }));
    }
    setNumberPreset(clubType === 'Putter' ? 'Putter' : inferPreset(clubType, nextNumber));
    setErrors((prev) => ({ ...prev, clubType: '', number: '' }));
  };

  const clearClubTypeSelection = () => {
    setFormData((prev) => ({
      ...prev,
      clubType: '',
      number: '',
    }));
    setNumberPreset('Custom');
    setErrors((prev) => ({ ...prev, clubType: '', number: '' }));
  };

  useEffect(() => {
    if (club) {
      const { id, createdAt, updatedAt, ...rest } = club;
      setFormData(rest);
      setNumberPreset(inferPreset(rest.clubType, rest.number));
    } else {
      const initial: ClubFormData = {
        clubType: '',
        name: '',
        number: '',
        length: 0,
        weight: 0,
        swingWeight: '',
        lieAngle: 0,
        loftAngle: 0,
        shaftType: '',
        torque: 0,
        flex: 'S',
        distance: 0,
        notes: '',
      };
      setFormData(initial);
      setNumberPreset('Custom');
    }
    setErrors({});
  }, [club]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: '' }));

    setFormData((prev) => {
      if (name === 'torque') {
        return { ...prev, [name]: parseFloat(value) || 0 };
      }
      if (name === 'distance') {
        return { ...prev, [name]: parseInt(value) || 0 };
      }
      if (name === 'flex') {
        return { ...prev, [name]: value as GolfClub['flex'] };
      }
      if (name === 'clubType') {
        return prev;
      }
      if (name.includes('Angle') || name === 'length' || name === 'weight') {
        return { ...prev, [name]: parseFloat(value) || 0 };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleNumberTextChange = (value: string) => {
    setFormData((prev) => ({ ...prev, number: value }));
    setErrors((prev) => ({ ...prev, number: '' }));
  };

  const handleNumberPresetChange = (value: string) => {
    setNumberPreset(value);
    if (value !== 'Custom') {
      setFormData((prev) => {
        if (!prev.clubType) {
          return { ...prev, number: value };
        }

        if (club) {
          return { ...prev, number: value };
        }

        const defaults = buildClubDefaultsByTypeAndNumber(prev.clubType, value);
        return {
          ...defaults,
          clubType: prev.clubType,
          name: prev.name,
          number: value,
        };
      });
    }
    setErrors((prev) => ({ ...prev, number: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.clubType) {
      newErrors.clubType = 'クラブの種類を選択してください';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'クラブ名を入力してください';
    }
    if (!formData.number.trim()) {
      newErrors.number = 'クラブ番号を入力してください';
    }
    if (!formData.loftAngle) {
      newErrors.loftAngle = 'ロフト角を入力してください';
    } else {
      const times10 = Math.round(formData.loftAngle * 10);
      if (Math.abs(times10 / 10 - formData.loftAngle) > 0.001) {
        newErrors.loftAngle = '0.1刻みで入力してください（例: 10.5, 11.0）';
      } else if (formData.loftAngle < 0 || formData.loftAngle > 60) {
        newErrors.loftAngle = '0°〜60°の範囲で入力してください';
      }
    }
    if (formData.length > 0) {
      const times4 = Math.round(formData.length * 4);
      if (Math.abs(times4 / 4 - formData.length) > 0.001) {
        newErrors.length = '0.25刻みで入力してください（例: 45.0, 45.25, 45.5, 45.75）';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const selectedClubType = formData.clubType as ClubCategory;
      onSubmit({
        ...formData,
        clubType: selectedClubType,
        number: normalizeClubNumber(selectedClubType, formData.number),
        swingWeight: selectedClubType === 'Putter' ? '' : formData.swingWeight.trim(),
        torque: selectedClubType === 'Putter' ? 0 : formData.torque,
      });
    }
  };

  const renderClubNumberField = () => {
    if (!formData.clubType) {
      return null;
    }

    if (formData.clubType === 'Putter') {
      return null;
    }

    if (formData.clubType === 'Driver') {
      return (
        <div className="form-group">
          <label htmlFor="driverNumber">クラブ番号 *</label>
          <select
            id="driverNumber"
            value={formData.number || CLUB_NUMBER_DEFAULT.Driver}
            onChange={(e) => handleNumberPresetChange(e.target.value)}
            required
            className={errors.number ? 'error' : ''}
          >
            {(CLUB_NUMBER_OPTIONS.Driver ?? []).map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
          {errors.number && <span className="error-message">{errors.number}</span>}
        </div>
      );
    }

    const suggestions = CLUB_NUMBER_OPTIONS[formData.clubType] ?? [];

    return (
      <div className="form-group">
        <label htmlFor="number">クラブ番号 *</label>
        <div className="club-number-stack">
          <select
            id="numberSuggestion"
            value={numberPreset}
            onChange={(e) => handleNumberPresetChange(e.target.value)}
          >
            {suggestions.map((num) => {
              const label = formData.clubType === 'Iron' && num === '1'
                ? '1 (Rare 1I)'
                : formData.clubType === 'Iron' && num === '2'
                ? '2 (Rare 2I)'
                : num;
              return (
                <option key={num} value={num}>
                  {label}
                </option>
              );
            })}
            <option value="Custom">Custom (free text)</option>
          </select>
          {numberPreset === 'Custom' && (
            <input
              type="text"
              id="number"
              name="number"
              value={formData.number}
              onChange={(e) => handleNumberTextChange(e.target.value)}
              placeholder="例: 7, PW, 3W, 4H"
              required
              className={errors.number ? 'error' : ''}
            />
          )}
        </div>
        {errors.number && <span className="error-message">{errors.number}</span>}
      </div>
    );
  };

  return (
    <form className="club-form" onSubmit={handleSubmit}>
      <h2>{club ? 'クラブ編集' : 'クラブ追加'}</h2>

      {/* Section 1: Basic Information */}
      <div className="form-section">
        <h3 className="form-section-title">基本情報</h3>
        
        {/* Club Type */}
        <div className="form-group">
          <label htmlFor="clubType">クラブの種類 *</label>
          <div className="club-type-select-wrap">
            <select
              id="clubType"
              name="clubType"
              value={formData.clubType}
              onChange={(e) => {
                const selected = e.target.value;
                if (!selected) {
                  clearClubTypeSelection();
                  return;
                }
                applyClubTypeChange(selected as ClubCategory);
              }}
              required
              className={errors.clubType ? 'error' : ''}
            >
              <option value="">種類を選択してください</option>
              {CLUB_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.clubType && (
            <span className="error-message">{errors.clubType}</span>
          )}
          {!formData.clubType && !errors.clubType && (
            <span className="form-help-text">種類を選択すると、クラブ名以外の項目にデフォルト値を読み込みます。</span>
          )}
        </div>
        
        {/* Club Name */}
        <div className="form-group">
          <label htmlFor="name">クラブ名 *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="例: Ping G430、Titleist T150"
            required
            className={errors.name ? 'error' : ''}
          />
          {errors.name && (
            <span className="error-message">{errors.name}</span>
          )}
        </div>

        {/* Club Number */}
        {renderClubNumberField()}
      </div>

      {/* Section 2: Specifications */}
      <div className="form-section">
        <h3 className="form-section-title">スペック</h3>
        
        {/* Loft Row (alone) */}
        <div className="form-group">
          <label htmlFor="loftAngle">ロフト角(度数) *</label>
          <input
            type="number"
            id="loftAngle"
            name="loftAngle"
            value={formData.loftAngle || ''}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="60"
            required
            className={errors.loftAngle ? 'error' : ''}
          />
          {errors.loftAngle && (
            <span className="error-message">{errors.loftAngle}</span>
          )}
        </div>

        {/* Length, Weight Row */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="length">長さ(インチ)</label>
            <input
              type="number"
              id="length"
              name="length"
              value={formData.length || ''}
              onChange={handleChange}
              step="0.25"
              className={errors.length ? 'error' : ''}
            />
            {errors.length && <span className="error-message">{errors.length}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="weight">重さ(グラム)</label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight || ''}
              onChange={handleChange}
              step="1"
            />
          </div>
        </div>

      {/* Lie Angle, Swing Weight Row */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="lieAngle">ライ角(度数)</label>
          <input
            type="number"
            id="lieAngle"
            name="lieAngle"
            value={formData.lieAngle || ''}
            onChange={handleChange}
            step="0.5"
          />
        </div>
        {formData.clubType !== 'Putter' && (
          <div className="form-group">
            <label htmlFor="swingWeight">バランス</label>
            <input
              type="text"
              id="swingWeight"
              name="swingWeight"
              value={formData.swingWeight}
              onChange={handleChange}
              placeholder="例: C9, D0.5, E1"
            />
          </div>
        )}
      </div>

      {/* Shaft, Torque, Flex Row */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="shaftType">シャフト名</label>
          <input
            type="text"
            id="shaftType"
            name="shaftType"
            value={formData.shaftType}
            onChange={handleChange}
            placeholder="例: VENTUS TR"
          />
        </div>
        <div className="form-group">
          <label htmlFor="flex">フレックス</label>
          <select
            id="flex"
            name="flex"
            value={formData.flex}
            onChange={handleChange}
          >
            <option value="S">S</option>
            <option value="SR">SR</option>
            <option value="R">R</option>
            <option value="A">A</option>
            <option value="L">L</option>
          </select>
        </div>
        {formData.clubType !== 'Putter' && (
          <div className="form-group">
            <label htmlFor="torque">トルク</label>
            <input
              type="number"
              id="torque"
              name="torque"
              value={formData.torque || ''}
              onChange={handleChange}
              step="0.1"
              min="0"
            />
          </div>
        )}
      </div>

      </div>

      <div className="form-section">
        <h3 className="form-section-title">追加情報</h3>
        <p className="form-section-description">飛距離やノートなど、プレー時の記録をまとめます。</p>

        <div className="form-group">
          <label htmlFor="distance">飛距離</label>
          <input
            type="number"
            id="distance"
            name="distance"
            value={formData.distance || ''}
            onChange={handleChange}
            min="0"
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <label htmlFor="notes">ノート</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="このクラブについての簡単なメモを入力できます。"
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? '保存中...' : club ? 'クラブ更新' : 'クラブ追加'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
};
