import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { GolfClub } from '../types/golf';
import { ClubDisplayName } from './ClubDisplayName';
import './ClubCard.css';

interface ClubCardProps {
  club: GolfClub;
  onEdit: (club: GolfClub) => void;
  onDelete: (id: number) => void;
  activeBagName?: string;
  isInActiveBag?: boolean;
  isActiveBagFull?: boolean;
  onToggleActiveBagMembership?: (club: GolfClub) => void;
}

export const ClubCard: React.FC<ClubCardProps> = ({
  club,
  onEdit,
  onDelete,
  activeBagName,
  isInActiveBag = false,
  isActiveBagFull = false,
  onToggleActiveBagMembership,
}) => {
  const compactLoft = club.loftAngle != null ? `${club.loftAngle}°` : '-';
  const canToggleBag = typeof onToggleActiveBagMembership === 'function' && !!activeBagName;
  const bagButtonDisabled = !isInActiveBag && isActiveBagFull;
  const [showDetails, setShowDetails] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const clubLabel = [club.number, club.name].filter(Boolean).join(' ');
  const displayImageIndex = club.imageData?.length
    ? Math.min(selectedImageIndex, club.imageData.length - 1)
    : 0;

  const handleOpenDetails = () => {
    if (!showDetails) {
      setSelectedImageIndex(0);
      setShowDetails(true);
    }
  };

  const handleCloseDetails = () => setShowDetails(false);

  return (
    <>
      <div className="club-card compact" onClick={handleOpenDetails}>
      <div className="club-card-header">
        <h3>
          {club.imageData?.length ? (
            <span className="club-image-icon">
              <img src={club.imageData[0]} alt={`${club.name} の画像`} />
            </span>
          ) : null}
          <ClubDisplayName clubType={club.clubType} number={club.number} name={club.name} />
        </h3>
      </div>
      {canToggleBag && (
        <div className="club-card-bag-row">
          <span className={`club-bag-badge ${isInActiveBag ? 'in-bag' : 'out-of-bag'}`}>
            {isInActiveBag ? `${activeBagName}に登録済み` : `${activeBagName}には未登録`}
          </span>
          <button
            type="button"
            className={`club-bag-toggle ${isInActiveBag ? 'remove' : 'add'}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleActiveBagMembership?.(club);
            }}
            disabled={bagButtonDisabled}
          >
            {isInActiveBag ? 'バッグから外す' : isActiveBagFull ? 'バッグは14本です' : 'バッグに入れる'}
          </button>
        </div>
      )}
      <div className="club-card-body">
        <div className="compact-row">
          <div className="compact-view" aria-label="簡易スペック">
            <span className="compact-item"><strong>Loft</strong>{compactLoft}</span>
            <span className="compact-item"><strong>L</strong>{club.length}"</span>
            <span className="compact-item"><strong>W</strong>{club.weight}g</span>
            <span className="compact-item"><strong>Lie</strong>{club.lieAngle != null ? `${club.lieAngle}°` : '-'}</span>
          </div>
          <div className="club-card-actions">
            <button
              className="btn-icon btn-edit"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(club);
              }}
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
              onClick={(event) => {
                event.stopPropagation();
                onDelete(club.id!);
              }}
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
      </div>
      </div>
      {showDetails && createPortal(
        <div
          className="club-detail-popup"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            event.stopPropagation();
            handleCloseDetails();
          }}
        >
          <div className="club-detail-popup-card" onClick={(event) => event.stopPropagation()}>
            <div className="club-detail-popup-header">
              <h4>
                <ClubDisplayName
                  className="club-detail-popup-title"
                  clubType={club.clubType}
                  number={club.number}
                  name={club.name}
                  nameClassName="club-detail-popup-name"
                />
              </h4>
              <button
                type="button"
                className="club-detail-popup-close"
                aria-label="詳細を閉じる"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDetails(false);
                }}
              >
                ×
              </button>
            </div>
            {club.imageData?.length ? (
              <>
                <div className="club-detail-popup-image">
                  <img src={club.imageData[displayImageIndex]} alt={clubLabel} />
                </div>
                {club.imageData.length > 1 && (
                  <div className="club-detail-popup-image-switcher">
                    <button
                      type="button"
                      className="image-switcher-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedImageIndex((prev) => (prev === 0 ? club.imageData!.length - 1 : prev - 1));
                      }}
                      aria-label="前の画像"
                    >
                      ◀
                    </button>
                    <div className="image-switcher-list">
                      {club.imageData.map((src, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`image-switcher-thumb ${index === displayImageIndex ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedImageIndex(index);
                          }}
                          aria-label={`画像 ${index + 1}`}
                        >
                          <img src={src} alt={`サムネイル ${index + 1}`} />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="image-switcher-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedImageIndex((prev) => (prev + 1) % club.imageData!.length);
                      }}
                      aria-label="次の画像"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </>
            ) : null}
            <div className="club-detail-popup-body">
              <div className="spec-row">
                <span className="spec-label">ロフト角</span>
                <span className="spec-value">{club.loftAngle ?? '-'}°</span>
              </div>
              {club.clubType === 'Wedge' && club.bounceAngle != null && (
                <div className="spec-row">
                  <span className="spec-label">バウンス角</span>
                  <span className="spec-value">{club.bounceAngle}°</span>
                </div>
              )}
              <div className="spec-row">
                <span className="spec-label">長さ</span>
                <span className="spec-value">{club.length}"</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">ライ角</span>
                <span className="spec-value">{club.lieAngle ?? '-'}°</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">重さ</span>
                <span className="spec-value">{club.weight}g</span>
              </div>
              {club.clubType !== 'Putter' && (
                <div className="spec-row">
                  <span className="spec-label">バランス</span>
                  <span className="spec-value">{club.swingWeight}</span>
                </div>
              )}
              <div className="spec-row">
                <span className="spec-label">シャフト</span>
                <span className="spec-value">{club.shaftType}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">フレックス</span>
                <span className="spec-value">{club.flex}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">トルク</span>
                <span className="spec-value">{club.torque != null ? club.torque.toFixed(1) : '-'}</span>
              </div>
              {club.notes && (
                <div className="spec-row notes">
                  <span className="spec-label">ノート</span>
                  <span className="spec-value">{club.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
