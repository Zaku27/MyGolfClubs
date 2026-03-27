import { ClubCard } from './ClubCard';

import type { GolfClub } from '../types/golf';
import './ClubList.css';

interface ClubListProps {
  clubs: GolfClub[];
  onEdit: (club: GolfClub) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onClearAll: () => void;
  viewMode: 'full' | 'compact';
  onToggleViewMode: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
}


export const ClubList: React.FC<ClubListProps> = ({
  clubs,
  onEdit,
  onDelete,
  onAdd,
  onReset,
  onClearAll,
  viewMode,
  onToggleViewMode,
  onExport,
  onImport,
  loading = false,
}) => {

  return (
    <div className="club-list-container">
      <div className="club-list-header">
        <h1>⛳ My Golf Bag</h1>
        <div className="club-count">{clubs.length} clubs</div>
      </div>

      <div className="club-list-actions">
        <button className="btn-icon btn-add-club" onClick={onAdd} disabled={loading} title="クラブ追加">
          <span role="img" aria-label="add">➕</span>
        </button>
        <button className="btn-icon btn-toggle-view" onClick={onToggleViewMode} disabled={loading} title={viewMode === 'full' ? '簡易表示へ' : '詳細表示へ'}>
          <span role="img" aria-label="toggle">{viewMode === 'full' ? '📊' : '📋'}</span>
        </button>
        <button className="btn-icon btn-export-json" onClick={onExport} disabled={loading} title="エクスポート(JSON)">
          <span role="img" aria-label="export">⬇️</span>
        </button>
        <label className="btn-icon btn-import-json" title="インポート(JSON)" style={{ marginLeft: 4 }}>
          <span role="img" aria-label="import">⬆️</span>
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
        </label>
      </div>

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
        <>
          <div className="club-list">
            {clubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onEdit={onEdit}
                onDelete={onDelete}
                viewMode={viewMode}
              />
            ))}
          </div>
          <div className="club-list-bottom">
            <button className="btn-reset-clubs" onClick={onReset} disabled={loading}>
              🧹 初期14本に戻す
            </button>
            <button className="btn-clearall-clubs" onClick={onClearAll} disabled={loading} style={{ marginLeft: 8 }}>
              ❌ 全削除
            </button>
          </div>
        </>
      )}
    </div>
  );
};
