import { ClubCard } from './ClubCard';
import {
  AddIcon,
  ToggleViewIcon,
  CompactViewIcon,
  ExportIcon,
  ImportIcon,
  AnalysisIcon,
  ResetIcon,
  DeleteIcon,
} from './Icons';

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
  onShowAnalysis: () => void;
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
  onShowAnalysis,
  loading = false,
}) => {
  const normalizeClubType = (club: GolfClub): string => {
    return (club.clubType ?? '').toUpperCase().replace(/\s|-/g, '');
  };

  const getClubOrderRank = (club: GolfClub): number => {
    const type = normalizeClubType(club);
    const name = (club.name ?? '').toUpperCase();

    if (type === 'D' || name.includes('DRIVER')) return 0;
    if (/^\d+W$/.test(type) || name.includes('WOOD')) return 1;
    if (/^\d+H$/.test(type) || type === 'UT' || name.includes('HYBRID')) return 2;
    if (/^\d+I$/.test(type) || type === 'PW' || name.includes('IRON')) return 3;
    if (['AW', 'GW', 'SW', 'LW'].includes(type) || name.includes('WEDGE') || /^\d{2}$/.test(type)) return 4;
    if (type === 'P' || name.includes('PUTTER')) return 5;
    return 6;
  };

  const getWithinTypeOrder = (club: GolfClub): number => {
    const type = normalizeClubType(club);

    const numberMatch = type.match(/^(\d+)/);
    const typeNumber = numberMatch ? Number(numberMatch[1]) : Number.MAX_SAFE_INTEGER;

    if (type === 'D') return 0;
    if (/^\d+W$/.test(type)) return typeNumber;
    if (/^\d+H$/.test(type)) return typeNumber;
    if (/^\d+I$/.test(type)) return typeNumber;
    if (type === 'PW') return 10;
    if (/^\d{2}$/.test(type)) return Number(type);

    const wedgeOrder: Record<string, number> = {
      AW: 48,
      GW: 50,
      SW: 56,
      LW: 60,
    };
    if (wedgeOrder[type] != null) return wedgeOrder[type];

    return Number.MAX_SAFE_INTEGER;
  };

  const sortedClubs = [...clubs].sort((a, b) => {
    const rankDiff = getClubOrderRank(a) - getClubOrderRank(b);
    if (rankDiff !== 0) return rankDiff;

    const withinTypeDiff = getWithinTypeOrder(a) - getWithinTypeOrder(b);
    if (withinTypeDiff !== 0) return withinTypeDiff;

    const loftA = a.loftAngle ?? Number.MAX_SAFE_INTEGER;
    const loftB = b.loftAngle ?? Number.MAX_SAFE_INTEGER;
    if (loftA !== loftB) return loftA - loftB;

    return (a.length ?? 0) - (b.length ?? 0);
  });

  return (
    <div className="club-list-container">
      <div className="club-list-header">
        <h1 className="club-list-title">
          <span className="title-main">My Golf Clubs</span>
          <span className="title-sub">- マイクラブを簡単管理＆上達サポート -</span>
        </h1>
        <div className="club-count">{clubs.length} clubs</div>
      </div>

      <div className="club-list-actions">
        <button className="btn-icon btn-add-club" onClick={onAdd} disabled={loading} title="クラブ追加" aria-label="クラブ追加">
          <AddIcon size={20} />
        </button>
        <button className="btn-icon btn-toggle-view" onClick={onToggleViewMode} disabled={loading} title={viewMode === 'full' ? '簡易表示へ' : '詳細表示へ'} aria-label={viewMode === 'full' ? '簡易表示へ' : '詳細表示へ'}>
          {viewMode === 'full' ? <CompactViewIcon size={20} /> : <ToggleViewIcon size={20} />}
        </button>
        <button className="btn-icon btn-export-json" onClick={onExport} disabled={loading} title="エクスポート(JSON)" aria-label="エクスポート">
          <ExportIcon size={20} />
        </button>
        <label className="btn-icon btn-import-json" title="インポート(JSON)">
          <ImportIcon size={20} />
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
        </label>
        <button className="btn-icon btn-analysis" onClick={onShowAnalysis} disabled={loading} title="分析画面" aria-label="分析画面">
          <AnalysisIcon size={20} />
        </button>
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
          <div className={`club-list ${viewMode === 'compact' ? 'compact' : ''}`}>
            {sortedClubs.map((club) => (
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
            <button className="btn-reset-clubs" onClick={onReset} disabled={loading} title="初期14本に戻す">
              <ResetIcon size={18} />
              <span>初期14本に戻す</span>
            </button>
            <button className="btn-clearall-clubs" onClick={onClearAll} disabled={loading} title="全削除">
              <DeleteIcon size={18} />
              <span>全削除</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
