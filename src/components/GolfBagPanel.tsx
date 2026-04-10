import type { GolfBag } from '../types/golf';
import './GolfBagPanel.css';

type ListScope = 'bag' | 'all';

type GolfBagPanelProps = {
  bags: GolfBag[];
  activeBagId: number | null;
  activeBagClubCount: number;
  maxClubs?: number;
  onSelectBag: (bagId: number) => void;
  onCreateBag?: () => void;
  onRenameActiveBag?: () => void;
  onDeleteActiveBag?: () => void;
  onShiftSelectedBagLeft?: () => void;
  listScope?: ListScope;
  onChangeListScope?: (scope: ListScope) => void;
  showManagement?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
};

export const GolfBagPanel = ({
  bags,
  activeBagId,
  activeBagClubCount,
  maxClubs = 14,
  onSelectBag,
  onCreateBag,
  onRenameActiveBag,
  onDeleteActiveBag,
  onShiftSelectedBagLeft,
  listScope,
  onChangeListScope,
  showManagement = true,
  compact = true,
  title,
  description,
}: GolfBagPanelProps) => {
  const activeBag = bags.find((bag) => bag.id === activeBagId) ?? bags[0] ?? null;

  return (
    <section className={`golf-bag-panel ${compact ? 'compact' : ''}`}>
      <div className="golf-bag-panel-main">
        <div>
          <h2>{title ?? (compact ? 'Golf Bag' : 'Golf Bag')}</h2>
          <p className="golf-bag-panel-description">
            {description ?? 'ゴルフクラブを14本選んで、ゴルフバッグに入れて管理します。'}
          </p>
        </div>

      </div>

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

      {showManagement && (
        <div className="golf-bag-panel-actions">
          {onCreateBag && (
            <button type="button" className="primary" onClick={onCreateBag}>
              バッグを追加
            </button>
          )}
          {activeBag && onRenameActiveBag && (
            <button type="button" onClick={onRenameActiveBag}>
              バッグ名を変更
            </button>
          )}
          {activeBag && onShiftSelectedBagLeft && (
            <button
              type="button"
              className="golf-bag-panel-shift-button"
              onClick={onShiftSelectedBagLeft}
              disabled={bags.findIndex((bag) => bag.id === activeBag.id) <= 0}
            >
              ← 左へ移動
            </button>
          )}
          {activeBag && bags.length > 1 && onDeleteActiveBag && (
            <button type="button" className="danger" onClick={onDeleteActiveBag}>
              このバッグを削除
            </button>
          )}
        </div>
      )}
    </section>
  );
};