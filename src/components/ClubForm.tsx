import React, { useState, useEffect } from 'react';
import type { GolfClub } from '../types/golf';
import { DEFAULT_CLUBS } from '../types/golf';
import './ClubForm.css';

const CLUB_TYPE_OPTIONS = [
  { value: 'D', label: 'Driver' },
  { value: '3W', label: '3W' },
  { value: '5W', label: '5W' },
  { value: '4H', label: '4H' },
  { value: '5H', label: '5H' },
  { value: '6I', label: '6I' },
  { value: '7I', label: '7I' },
  { value: '8I', label: '8I' },
  { value: '9I', label: '9I' },
  { value: 'PW', label: 'PW' },
  { value: '50', label: '50' },
  { value: '54', label: '54' },
  { value: '58', label: '58' },
  { value: 'P', label: 'Putter' },
  { value: 'Custom', label: 'その他（手入力）' },
];

interface ClubFormProps {
  club?: GolfClub;
  onSubmit: (club: Omit<GolfClub, 'id'> | Partial<GolfClub>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ClubForm: React.FC<ClubFormProps> = ({
  club,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<Omit<GolfClub, 'id'>>({
    clubType: '',
    name: '',
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
  const [clubType, setClubType] = useState<string>('');
  const [customClubType, setCustomClubType] = useState<string>('');

  useEffect(() => {
    if (club) {
      const { id, createdAt, updatedAt, ...rest } = club;
      setFormData(rest);
      const initialType = rest.clubType && CLUB_TYPE_OPTIONS.some(option => option.value === rest.clubType)
        ? rest.clubType
        : 'Custom';
      setClubType(initialType);
      setCustomClubType(initialType === 'Custom' ? rest.clubType : '');
    } else {
      setFormData({
        clubType: '',
        name: '',
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
      setClubType('');
      setCustomClubType('');
    }
  }, [club]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
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
      if (name.includes('Angle') || name === 'length' || name === 'weight') {
        return { ...prev, [name]: parseFloat(value) || 0 };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = e.target.value;
    setClubType(selectedType);

    if (selectedType === 'Custom') {
      setCustomClubType('');
      setFormData((prev) => ({
        ...prev,
        clubType: '',
        // クラブ名は保持する（リセットしない）
      }));
    } else {
      setCustomClubType('');
      const defaultClub = DEFAULT_CLUBS.find((c) => c.clubType === selectedType);
      if (defaultClub) {
        setFormData((prev) => ({
          ...prev,
          clubType: selectedType,
          length: defaultClub.length,
          weight: defaultClub.weight,
          swingWeight: defaultClub.swingWeight,
          lieAngle: defaultClub.lieAngle,
          loftAngle: defaultClub.loftAngle,
          shaftType: defaultClub.shaftType,
          torque: defaultClub.torque,
          distance: defaultClub.distance,
          notes: defaultClub.notes,
          // nameはそのまま保持（デフォルトには置き換えない）
          name: prev.name,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          clubType: selectedType,
          // nameは保持
          name: prev.name,
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="club-form" onSubmit={handleSubmit}>
      <h2>{club ? 'クラブ編集' : 'クラブ追加'}</h2>

      <div className="form-group">
        <label htmlFor="clubType">クラブ種別 *</label>
        <select
          id="clubType"
          name="clubType"
          value={clubType}
          onChange={handleTypeChange}
          required
        >
          <option value="">選択してください</option>
          {CLUB_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {clubType === 'Custom' && (
        <div className="form-group">
          <label htmlFor="customClubType">クラブ種別（手入力） *</label>
          <input
            type="text"
            id="customClubType"
            name="customClubType"
            value={customClubType}
            onChange={(e) => {
              const value = e.target.value;
              setCustomClubType(value);
              setFormData((prev) => ({ ...prev, clubType: value }));
            }}
            placeholder="例: 3.5W"
            required
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name">クラブ名 *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="例: メーカー、モデル名など"
          required
        />
        {clubType && (
          <small className="club-type-hint">クラブ種別: {clubType === 'Custom' ? customClubType : clubType}</small>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="length">長さ(インチ) *</label>
          <input
            type="number"
            id="length"
            name="length"
            value={formData.length || ''}
            onChange={handleChange}
            step="0.5"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="weight">重さ(グラム) *</label>
          <input
            type="number"
            id="weight"
            name="weight"
            value={formData.weight || ''}
            onChange={handleChange}
            step="1"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="loftAngle">ロフト角(度数) *</label>
          <input
            type="number"
            id="loftAngle"
            name="loftAngle"
            value={formData.loftAngle || ''}
            onChange={handleChange}
            step="0.5"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="lieAngle">ライ角(度数) *</label>
          <input
            type="number"
            id="lieAngle"
            name="lieAngle"
            value={formData.lieAngle || ''}
            onChange={handleChange}
            step="0.5"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="swingWeight">バランス *</label>
          <input
            type="text"
            id="swingWeight"
            name="swingWeight"
            value={formData.swingWeight}
            onChange={handleChange}
            placeholder="例: D0, D2"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="shaftType">シャフト名 *</label>
          <input
            type="text"
            id="shaftType"
            name="shaftType"
            value={formData.shaftType}
            onChange={handleChange}
            placeholder="例: VENTUS TR"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="torque">トルク *</label>
          <input
            type="number"
            id="torque"
            name="torque"
            value={formData.torque || ''}
            onChange={handleChange}
            step="0.1"
            min="0"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="flex">フレックス *</label>
          <select
            id="flex"
            name="flex"
            value={formData.flex}
            onChange={handleChange}
            required
          >
            <option value="S">S</option>
            <option value="SR">SR</option>
            <option value="R">R</option>
            <option value="A">A</option>
            <option value="L">L</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="distance">飛距離 *</label>
          <input
            type="number"
            id="distance"
            name="distance"
            value={formData.distance || ''}
            onChange={handleChange}
            min="0"
            required
          />
        </div>
      </div>

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
