import React from 'react';
import type { GolfClub } from '../types/golf';
import { getClubTypeDisplay } from '../utils/clubUtils';
import './ClubCard.css';

interface ClubCardProps {
  club: GolfClub;
  onEdit: (club: GolfClub) => void;
  onDelete: (id: number) => void;
  viewMode?: 'full' | 'compact';
}

export const ClubCard: React.FC<ClubCardProps> = ({ club, onEdit, onDelete, viewMode = 'full' }) => {
  const clubTypeDisplay = getClubTypeDisplay(club.clubType, club.number);
  const compactLoft = club.loftAngle != null ? `${club.loftAngle}°` : '-';

  return (
    <div className={`club-card ${viewMode === 'compact' ? 'compact' : ''}`}>
      <div className="club-card-header">
        <h3>
          <span className="club-type">{clubTypeDisplay}</span>
          <span className="club-fullname">{club.name}</span>
        </h3>
        <div className="club-card-actions">
          <button
            className="btn-icon btn-edit"
            onClick={() => onEdit(club)}
            title="編集"
            aria-label="編集"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            className="btn-icon btn-delete"
            onClick={() => onDelete(club.id!)}
            title="削除"
            aria-label="削除"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
      <div className="club-card-body">
          {viewMode === 'full' ? (
            <>
              <div className="spec-row">
                <span className="spec-label">ロフト角:</span>
                  <span className="spec-value">{club.loftAngle ?? '-'}°</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">長さ:</span>
                <span className="spec-value">{club.length}"</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">重さ:</span>
                <span className="spec-value">{club.weight}g</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">ライ角:</span>
                  <span className="spec-value">{club.lieAngle ?? '-'}°</span>
              </div>
              {club.clubType !== 'Putter' && (
                <div className="spec-row">
                  <span className="spec-label">バランス:</span>
                  <span className="spec-value">{club.swingWeight}</span>
                </div>
              )}
              <div className="spec-row">
                <span className="spec-label">シャフト:</span>
                <span className="spec-value">{club.shaftType}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">フレックス:</span>
                <span className="spec-value">{club.flex}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">トルク:</span>
                  <span className="spec-value">{club.torque != null ? club.torque.toFixed(1) : '-'}</span>
              </div>
              {club.notes && (
                <div className="spec-row notes">
                  <span className="spec-label">ノート:</span>
                  <span className="spec-value">{club.notes}</span>
                </div>
              )}
            </>
          ) : (
            <div className="compact-view" aria-label="簡易スペック">
              <span className="compact-item"><strong>Loft</strong>{compactLoft}</span>
              <span className="compact-item"><strong>L</strong>{club.length}"</span>
              <span className="compact-item"><strong>W</strong>{club.weight}g</span>
              {club.clubType !== 'Putter' && (
                <span className="compact-item"><strong>SW</strong>{club.swingWeight}</span>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
