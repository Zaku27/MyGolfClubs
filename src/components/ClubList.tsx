import React from 'react';
import type { GolfClub } from '../types/golf';
import { ClubCard } from './ClubCard';
import './ClubList.css';

interface ClubListProps {
  clubs: GolfClub[];
  onEdit: (club: GolfClub) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  loading?: boolean;
}

export const ClubList: React.FC<ClubListProps> = ({
  clubs,
  onEdit,
  onDelete,
  onAdd,
  loading = false,
}) => {
  return (
    <div className="club-list-container">
      <div className="club-list-header">
        <h1>⛳ My Golf Bag</h1>
        <div className="club-count">{clubs.length} clubs</div>
      </div>

      <button className="btn-add-club" onClick={onAdd} disabled={loading}>
        + クラブ追加
      </button>

      {loading ? (
        <div className="loading">クラブを読み込み中...</div>
      ) : clubs.length === 0 ? (
        <div className="empty-state">
          <p>クラブが見つかりません。バッグにクラブを追加してください!</p>
          <button className="btn-primary" onClick={onAdd}>
            最初のクラブを追加
          </button>
        </div>
      ) : (
        <div className="club-list">
          {clubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
