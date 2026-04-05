import React, { useState } from 'react';
import type { GolfClub, ClubCategory } from '../types/golf';
import {
  buildClubDefaults,
  buildClubDefaultsByTypeAndNumber,
  CLUB_NUMBER_DEFAULT,
  CLUB_NUMBER_OPTIONS,
  CLUB_TYPE_OPTIONS,
  inferNumberPreset,
  normalizeClubNumberForPreset,
  normalizeSwingWeightInput,
} from '../utils/clubFormUtils';
import './ClubForm.css';

interface ClubFormProps {
  club?: GolfClub;
  onSubmit: (club: Omit<GolfClub, 'id'> | Partial<GolfClub>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type ClubFormData = Omit<GolfClub, 'id' | 'clubType' | 'lengthStandard' | 'lengthAdjustment'> & {
  clubType: ClubCategory | '';
  lengthStandard: number;
  lengthAdjustment: number;
};

const EMPTY_FORM_DATA: ClubFormData = {
  clubType: '',
  name: '',
  number: '',
  length: 0,
  lengthStandard: 0,
  lengthAdjustment: 0,
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

const toFormData = (source?: GolfClub): ClubFormData => {
  if (!source) {
    return { ...EMPTY_FORM_DATA };
  }

  const derivedStandard = source.lengthStandard ?? source.length;
  const derivedAdjustment = source.lengthAdjustment ?? (source.length - derivedStandard);

  return {
    clubType: source.clubType,
    name: source.name,
    number: source.number,
    length: source.length,
    lengthStandard: derivedStandard,
    lengthAdjustment: derivedAdjustment,
    weight: source.weight,
    swingWeight: source.swingWeight,
    lieAngle: source.lieAngle,
    loftAngle: source.loftAngle,
    shaftType: source.shaftType,
    torque: source.torque,
    flex: source.flex,
    distance: source.distance,
    notes: source.notes,
  };
};

export const ClubForm: React.FC<ClubFormProps> = ({
  club,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [numberPreset, setNumberPreset] = useState<string>(() => (
    club ? inferNumberPreset(club.clubType, club.number) : 'Custom'
  ));
  const [formData, setFormData] = useState<ClubFormData>(() => toFormData(club));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLengthBreakdown, setShowLengthBreakdown] = useState<boolean>(() =>
    club !== undefined && (club.lengthStandard != null || club.lengthAdjustment != null)
  );

  const toggleLengthBreakdown = () => {
    setShowLengthBreakdown((prev) => {
      if (!prev) {
        // 内訳を開く: 現在の長さを標準長さに初期値として設定
        setFormData((fd) => {
          if (fd.lengthStandard === 0 && fd.lengthAdjustment === 0 && fd.length > 0) {
            return { ...fd, lengthStandard: fd.length, lengthAdjustment: 0 };
          }
          return fd;
        });
      }
      return !prev;
    });
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
        lengthStandard: defaults.length,
        lengthAdjustment: 0,
        name: prev.name,
        swingWeight: clubType === 'Putter' ? '' : defaults.swingWeight,
      }));
    }
    setNumberPreset(clubType === 'Putter' ? 'Putter' : inferNumberPreset(clubType, nextNumber));
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: '' }));

    setFormData((prev) => {
      if (name === 'lengthStandard' || name === 'lengthAdjustment') {
        const val = parseFloat(value) || 0;
        const std = name === 'lengthStandard' ? val : prev.lengthStandard;
        const adj = name === 'lengthAdjustment' ? val : prev.lengthAdjustment;
        return { ...prev, [name]: val, length: std + adj };
      }
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
          lengthStandard: defaults.length,
          lengthAdjustment: 0,
          clubType: prev.clubType,
          name: prev.name,
          number: value,
        };
      });
    } else {
      setFormData((prev) => {
        if (prev.clubType === 'Wedge') {
          return { ...prev, number: '' };
        }
        return prev;
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
    if (formData.clubType && formData.clubType !== 'Putter') {
      const swingWeight = formData.swingWeight.trim();
      if (swingWeight) {
        const normalizedSwingWeight = normalizeSwingWeightInput(swingWeight);
        if (!/^[A-F][0-9](?:\.[0-9])?$/.test(normalizedSwingWeight)) {
          newErrors.swingWeight = 'バランスは A0〜F9.9 形式で入力してください（例: C9, D0, D1.1, E1）';
        }
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
        number: normalizeClubNumberForPreset(selectedClubType, formData.number),
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
        <label htmlFor="number">
          クラブ番号 *
          {formData.clubType === 'Wedge' && (
            <span className="field-help-wrap wedge-help-trigger" aria-label="Pingウェッジ表記のヒント">
              <span className="wedge-help-icon" aria-hidden="true">?</span>
              <span className="field-help-panel wedge-help-panel" role="note">
                Pingのクラブ表記では、WはGW、UはAW、SはSWの目安です。
              </span>
            </span>
          )}
        </label>
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
              placeholder={formData.clubType === 'Wedge' ? '例: 52, 58' : '例: 7, PW, 3W, 4H'}
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

        {/* Length field with optional breakdown */}
        <div className="form-group">
          <label htmlFor="length">
            長さ(インチ)
            <button
              type="button"
              className="length-breakdown-toggle"
              onClick={toggleLengthBreakdown}
            >
              {showLengthBreakdown ? '▲ 内訳を隠す' : '▼ 内訳を入力'}
            </button>
          </label>
          {showLengthBreakdown ? (
            <div className="length-breakdown-inputs">
              <div className="length-breakdown-field">
                <span className="length-breakdown-label">標準長さ(カタログ)</span>
                <input
                  type="number"
                  name="lengthStandard"
                  value={formData.lengthStandard || ''}
                  onChange={handleChange}
                  step="0.25"
                  min="0"
                  placeholder="例: 44.0"
                />
              </div>
              <span className="length-op">+</span>
              <div className="length-breakdown-field">
                <span className="length-breakdown-label">調整</span>
                <input
                  type="number"
                  name="lengthAdjustment"
                  value={formData.lengthAdjustment || ''}
                  onChange={handleChange}
                  step="0.25"
                  placeholder="例: 0.5"
                />
              </div>
              <span className="length-op">=</span>
              <div className="length-total">
                <span className="length-total-label">合計</span>
                <div className="length-total-value">{formData.length || 0}</div>
              </div>
              <span className="form-help-text length-breakdown-note">標準長さに対する調整値を入力すると、合計が長さとして保存されます。</span>
            </div>
          ) : (
            <input
              type="number"
              id="length"
              name="length"
              value={formData.length || ''}
              onChange={handleChange}
              step="0.25"
              className={errors.length ? 'error' : ''}
            />
          )}
          {errors.length && <span className="error-message">{errors.length}</span>}
        </div>

        {/* Lie Angle */}
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

        {/* Weight, Swing Weight Row */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="weight">重さ(グラム)</label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight || ''}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="999"
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
                className={errors.swingWeight ? 'error' : ''}
              />
              {errors.swingWeight && <span className="error-message">{errors.swingWeight}</span>}
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
