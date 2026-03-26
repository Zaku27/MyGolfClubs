import React, { useState, useEffect } from 'react';
import type { GolfClub } from '../types/golf';
import './ClubForm.css';

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
    name: '',
    length: 0,
    weight: 0,
    swingWeight: '',
    lieAngle: 0,
    loftAngle: 0,
    shaftType: '',
    notes: '',
  });

  useEffect(() => {
    if (club) {
      const { id, createdAt, updatedAt, ...rest } = club;
      setFormData(rest);
    }
  }, [club]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes('Angle') || name === 'length' || name === 'weight'
        ? parseFloat(value) || 0
        : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="club-form" onSubmit={handleSubmit}>
      <h2>{club ? 'クラブ編集' : '新規クラブ追加'}</h2>

      <div className="form-group">
        <label htmlFor="name">クラブ名 *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="例: ドライバー, 3-アイアン"
          required
        />
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
          <label htmlFor="swingWeight">スイングウェイト *</label>
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
          <label htmlFor="shaftType">シャフトタイプ *</label>
          <input
            type="text"
            id="shaftType"
            name="shaftType"
            value={formData.shaftType}
            onChange={handleChange}
            placeholder="例: スティール レギュラー"
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
          placeholder="このクラブについてのより简単な掲ぐを入力"
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
