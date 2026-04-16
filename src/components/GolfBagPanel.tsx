import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { GolfBag } from '../types/golf';
import './GolfBagPanel.css';
import './SharedUI.css';

type ListScope = 'bag' | 'all';

type GolfBagPanelProps = {
  bags: GolfBag[];
  activeBagId: number | null;
  activeBagClubCount: number;
  maxClubs?: number;
  onSelectBag: (bagId: number) => void;
  onCreateBag?: () => void;
  onAddBagImage?: (bagId: number, imageData: string[]) => void;
  onRenameActiveBag?: () => void;
  onDeleteActiveBag?: () => void;
  onShiftSelectedBagLeft?: () => void;
  listScope?: ListScope;
  onChangeListScope?: (scope: ListScope) => void;
  showManagement?: boolean;
  showImage?: boolean;
  compact?: boolean;
  description?: string;
};

export const GolfBagPanel = ({
  bags,
  activeBagId,
  maxClubs = 14,
  onSelectBag,
  onCreateBag,
  onAddBagImage,
  onRenameActiveBag,
  onDeleteActiveBag,
  onShiftSelectedBagLeft,
  showManagement = true,
  showImage = true,
  compact = true,
  description,
}: GolfBagPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeBag = bags.find((bag) => bag.id === activeBagId) ?? bags[0] ?? null;
  const activeImage = activeBag ? (activeBag.imageData?.[0] ?? '/images/GolfBag.png') : undefined;
  const tooltipText = description ?? 'ゴルフクラブを14本選んで、ゴルフバッグに入れて管理します。';

  const handleImageClick = () => {
    if (!activeBag || !onAddBagImage) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeBag || !onAddBagImage) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAddBagImage(activeBag.id ?? 0, [reader.result]);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className={`golf-bag-panel ${compact ? 'compact' : ''}`}>
      {showImage && (
        <div className="golf-bag-panel-image-column">
          <div className="golf-bag-panel-image-wrapper">
            <div className="help-tooltip golf-bag-panel-image-container">
              <button
                type="button"
                className={`golf-bag-panel-image ${activeImage ? 'with-image' : ''}`}
                onClick={handleImageClick}
                aria-label={activeImage ? 'バッグ画像を変更' : 'バッグ画像を追加'}
              >
                {activeBag ? (
                  <img src={activeImage} alt={`バッグ ${activeBag.name} の画像`} />
                ) : (
                  <div className="golf-bag-panel-image-placeholder">
                    <span>画像を追加</span>
                  </div>
                )}
              </button>
              <span className="help-tooltip-text whitespace-normal">
                {tooltipText}
              </span>
              {showManagement && (
                <div className="golf-bag-image-management-overlay">
                  <div className="golf-bag-image-management-actions">
                    {onCreateBag && (
                      <button type="button" className="btn-icon btn-add" onClick={onCreateBag} title="バッグを追加">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    )}
                    {activeBag && onRenameActiveBag && (
                      <button type="button" className="btn-icon btn-edit" onClick={onRenameActiveBag} title="バッグ名を変更">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                    {activeBag && onShiftSelectedBagLeft && (
                      <button
                        type="button"
                        className="btn-icon btn-shift"
                        onClick={onShiftSelectedBagLeft}
                        disabled={bags.findIndex((bag) => bag.id === activeBag.id) <= 0}
                        title="左に移動"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6"/>
                        </svg>
                      </button>
                    )}
                    {activeBag && bags.length > 1 && onDeleteActiveBag && (
                      <button type="button" className="btn-icon btn-delete" onClick={onDeleteActiveBag} title="バッグを削除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              hidden
            />
          </div>
        </div>
      )}

      <div className="golf-bag-panel-content-column">
        {bags.length > 1 ? (
          <div className="golf-bag-chip-list" role="tablist" aria-label="ゴルフバッグ選択">
            {bags.map((bag) => {
              const isActive = bag.id === activeBag?.id;
              return (
                <button
                  key={bag.id}
                  type="button"
                  className={`golf-bag-chip ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (typeof bag.id === 'number') {
                      onSelectBag(bag.id);
                    }
                  }}
                >
                  <span>{bag.name}</span>
                  <span>{bag.clubIds.length}/{maxClubs}</span>
                </button>
              );
            })}
          </div>
        ) : activeBag ? (
          <div className="golf-bag-single-name">{activeBag.name}</div>
        ) : null}
      </div>
    </section>
  );
};