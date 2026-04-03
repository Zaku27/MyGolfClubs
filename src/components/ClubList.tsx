import { ClubCard } from './ClubCard';
import { Link } from 'react-router-dom';
import {
  AddIcon,
  ToggleViewIcon,
  CompactViewIcon,
  ExportIcon,
  ImportIcon,
  AnalysisIcon,
  ResetIcon,
  DeleteIcon,
  SimulatorIcon,
  PersonalDataIcon,
} from './Icons';
import { RangeIcon } from './RangeIcon';

import type { GolfClub } from '../types/golf';
import './ClubList.css';
import { sortClubsForDisplay } from '../utils/clubSort';

const SHOW_HOME_RELEASE_LIMITED_ACTIONS = true;

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
  onShowSimulator: () => void;
  activeBagName?: string;
  activeBagId?: number;
  activeBagClubIds?: number[];
  activeBagClubCount?: number;
  activeBagLimit?: number;
  isBagView?: boolean;
  allClubsCount?: number;
  onSwitchToAllClubs?: () => void;
  onToggleActiveBagMembership?: (club: GolfClub) => void;
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
  onShowSimulator,
  activeBagName,
  activeBagId,
  activeBagClubIds = [],
  activeBagClubCount = 0,
  activeBagLimit = 14,
  isBagView = false,
  allClubsCount = clubs.length,
  onSwitchToAllClubs,
  onToggleActiveBagMembership,
  loading = false,
}) => {
  const sortedClubs = sortClubsForDisplay(clubs);
  const bagQuery = typeof activeBagId === 'number' ? `?bagId=${activeBagId}` : '';
  const activeBagClubIdSet = new Set(activeBagClubIds);
  const clubCountLabel = isBagView && activeBagName
    ? `${activeBagName} ${activeBagClubCount}/${activeBagLimit}`
    : `${clubs.length} clubs`;

  return (
    <div className="club-list-container">
      <div className="club-list-header">
        <h1 className="club-list-title">
          <span className="title-main">My Golf Clubs</span>
          <span className="title-sub">- マイクラブを簡単管理＆上達サポート -</span>
        </h1>
        <div className="club-count">{clubCountLabel}</div>
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
        {SHOW_HOME_RELEASE_LIMITED_ACTIONS && (
          <>
            <button className="btn-icon btn-simulator" onClick={onShowSimulator} disabled={loading} title="コースシミュレーター" aria-label="コースシミュレーター">
              <SimulatorIcon size={20} />
            </button>
            <Link className="btn-icon btn-range" to={`/range${bagQuery}`} title="練習場" aria-label="練習場">
              <RangeIcon size={20} />
            </Link>
            <Link className="btn-icon btn-personal-data" to={`/personal-data${bagQuery}`} title="パーソナルデータ" aria-label="パーソナルデータ">
              <PersonalDataIcon size={20} />
            </Link>
          </>
        )}
      </div>

      {loading ? (
        <div className="loading">クラブを読み込み中...</div>
      ) : clubs.length === 0 ? (
        <div className="empty-state">
          <p>
            {isBagView && allClubsCount > 0
              ? 'このバッグはまだ空です。全クラブ一覧から14本まで選んで入れてください。'
              : 'クラブが見つかりません。バッグにクラブを追加してください!'}
          </p>
          <div className="empty-state-buttons">
            {isBagView && allClubsCount > 0 && onSwitchToAllClubs ? (
              <button className="btn-primary" onClick={onSwitchToAllClubs}>
                全クラブから選ぶ
              </button>
            ) : (
              <button className="btn-primary" onClick={onAdd}>
                最初のクラブを追加
              </button>
            )}
            <button className="btn-reset-clubs" onClick={onReset} disabled={loading} title="初期14本に戻す">
              <ResetIcon size={18} />
              <span>初期14本に戻す</span>
            </button>
          </div>
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
                activeBagName={activeBagName}
                isInActiveBag={club.id != null && activeBagClubIdSet.has(club.id)}
                isActiveBagFull={activeBagClubCount >= activeBagLimit}
                onToggleActiveBagMembership={onToggleActiveBagMembership}
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
