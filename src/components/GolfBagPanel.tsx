import type { GolfBag } from '../types/golf';
import './GolfBagPanel.css';

type ListScope = 'bag' | 'all';

type GolfBagPanelProps = {
  bags: GolfBag[];
  activeBagId: number | null;
  activeBagClubCount: number;
  totalClubCount: number;
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
  totalClubCount,
  maxClubs = 14,
  onSelectBag,
  onCreateBag,
  onRenameActiveBag,
  onDeleteActiveBag,
  onShiftSelectedBagLeft,
  listScope,
  onChangeListScope,
  showManagement = true,
  compact = false,
  title,
  description,
}: GolfBagPanelProps) => {
  const activeBag = bags.find((bag) => bag.id === activeBagId) ?? bags[0] ?? null;

  return (
    <section className={`golf-bag-panel ${compact ? 'compact' : ''}`}>
      <div className="golf-bag-panel-main">
        <div>
          <p className="golf-bag-panel-eyebrow">Golf Bag</p>
          <h2>{title ?? (compact ? '表示中のバッグ' : '現在のゴルフバッグ')}</h2>
          <p className="golf-bag-panel-description">
            {description ?? '通常は1つのバッグを使う前提で、ここで表示対象と14本を管理します。'}
          </p>
        </div>

        {activeBag && (
          <div className="golf-bag-panel-summary">
            <div className="golf-bag-panel-summary-name">{activeBag.name}</div>
            <div className="golf-bag-panel-summary-count">
              <strong>{activeBagClubCount}</strong>
              <span>/ {maxClubs} 本</span>
            </div>
            <div className="golf-bag-panel-summary-meta">登録クラブ総数 {totalClubCount} 本</div>
          </div>
        )}
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

      {listScope && onChangeListScope && (
        <div className="golf-bag-scope-toggle" aria-label="クラブ一覧の表示範囲">
          <button
            type="button"
            className={listScope === 'bag' ? 'active' : ''}
            onClick={() => onChangeListScope('bag')}
          >
            バッグの14本
          </button>
          <button
            type="button"
            className={listScope === 'all' ? 'active' : ''}
            onClick={() => onChangeListScope('all')}
          >
            全クラブ一覧
          </button>
        </div>
      )}

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