import { useMemo } from 'react';
import { ClubCard } from './ClubCard';
import { Link } from 'react-router-dom';
import {
  AddIcon,
  ExportIcon,
  ImportIcon,
  AnalysisIcon,
  ResetIcon,
  DeleteIcon,
  SimulatorIcon,
  PersonalDataIcon,
  ToggleViewIcon,
} from './Icons';
import { RangeIcon } from './RangeIcon';

import type { GolfClub } from '../types/golf';
import './ClubList.css';
import { sortClubsForDisplay } from '../utils/clubSort';
import { getClubTypeDisplay } from '../utils/clubUtils';
import { SHOW_HOME_RELEASE_LIMITED_ACTIONS } from '../config/featureFlags';

const CLUB_TYPE_OPTIONS: GolfClub['clubType'][] = ['Driver', 'Wood', 'Hybrid', 'Iron', 'Wedge', 'Putter'];

interface ClubListProps {
  clubs: GolfClub[];
  searchText: string;
  selectedClubType: 'All' | GolfClub['clubType'];
  onSearchTextChange: (value: string) => void;
  onSelectedClubTypeChange: (value: 'All' | GolfClub['clubType']) => void;
  onEdit: (club: GolfClub) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onClearAll: () => void;
  onDeleteAll: () => void;
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
  listScope?: 'bag' | 'all';
  onChangeListScope?: (scope: 'bag' | 'all') => void;
  onSwitchToAllClubs?: () => void;
  onToggleActiveBagMembership?: (club: GolfClub) => void;
  loading?: boolean;
}


export const ClubList: React.FC<ClubListProps> = ({
  clubs,
  searchText,
  selectedClubType,
  onSearchTextChange,
  onSelectedClubTypeChange,
  onEdit,
  onDelete,
  onAdd,
  onReset,
  onClearAll,
  onDeleteAll,
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
  listScope,
  onChangeListScope,
  onSwitchToAllClubs,
  onToggleActiveBagMembership,
  loading = false,
}) => {
  const normalizedSearchText = searchText.trim().toLowerCase();
  const hasFilter = selectedClubType !== 'All' || normalizedSearchText.length > 0;

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      if (selectedClubType !== 'All' && club.clubType !== selectedClubType) {
        return false;
      }

      if (!normalizedSearchText) {
        return true;
      }

      const clubTypeLabel = getClubTypeDisplay(club.clubType, club.number).toLowerCase();
      const clubName = (club.name ?? '').toLowerCase();
      const clubType = (club.clubType ?? '').toLowerCase();
      return (
        clubName.includes(normalizedSearchText)
        || clubType.includes(normalizedSearchText)
        || clubTypeLabel.includes(normalizedSearchText)
      );
    });
  }, [clubs, selectedClubType, normalizedSearchText]);

  const sortedClubs = useMemo(() => sortClubsForDisplay(filteredClubs), [filteredClubs]);
  const bagQuery = typeof activeBagId === 'number' ? `?bagId=${activeBagId}` : '';
  const activeBagClubIdSet = new Set(activeBagClubIds);
  const isFilteredResult = hasFilter && filteredClubs.length !== clubs.length;
  const filteredCountLabel = isFilteredResult
    ? `${filteredClubs.length}/${clubs.length} clubs`
    : undefined;

  const totalRegisteredClubsLabel = typeof allClubsCount === 'number'
    ? `総クラブ数 ${allClubsCount} 本`
    : undefined;

  return (
    <div className="club-list-container">
      <div className="club-list-header">
        <h1 className="club-list-title">
          <span className="title-main">My Golf Room</span>
          <span className="title-sub">- ゴルフギアを簡単管理＆上達サポート -</span>
        </h1>
        <div className="club-list-header-meta">
          {filteredCountLabel && (
            <div className="club-count">{filteredCountLabel}</div>
          )}
          {listScope && onChangeListScope && (
            <div className="club-list-scope-toggle" aria-label="クラブ一覧の表示範囲">
              <button
                type="button"
                className={listScope === 'bag' ? 'active' : ''}
                onClick={() => onChangeListScope('bag')}
              >
                バッグの{activeBagClubCount}本
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
          {totalRegisteredClubsLabel && (
            <div className="club-total-count">{totalRegisteredClubsLabel}</div>
          )}
        </div>
      </div>

      <div className="club-list-actions">
        <button className="btn-icon btn-add-club" onClick={onAdd} disabled={loading} title="クラブ追加" aria-label="クラブ追加">
          <AddIcon size={20} />
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
            <Link className="btn-icon btn-personal-data" to={`/personal-data${bagQuery}`} title="パーソナルデータ" aria-label="パーソナルデータ">
              <PersonalDataIcon size={20} />
            </Link>
            <Link className="btn-icon btn-range" to={`/range${bagQuery}`} title="レンジシミュレーター" aria-label="レンジシミュレーター">
              <RangeIcon size={20} />
            </Link>
            <button className="btn-icon btn-simulator" onClick={onShowSimulator} disabled={loading} title="コースシミュレーター" aria-label="コースシミュレーター">
              <SimulatorIcon size={20} />
            </button>
            <Link className="btn-icon btn-toggle-view" to="/course-editor" title="コースエディタ" aria-label="コースエディタ">
              <ToggleViewIcon size={20} />
            </Link>
            <Link className="btn-admin-link" to="/admin/clubs" title="管理画面" aria-label="管理画面">
              管理
            </Link>
          </>
        )}
        <div className="club-list-actions-spacer" />
        <div className="club-search-inline" aria-label="クラブ検索">
          <select
            id="club-type-filter"
            aria-label="クラブ種別で絞り込み"
            value={selectedClubType}
            onChange={(event) => onSelectedClubTypeChange(event.target.value as 'All' | GolfClub['clubType'])}
          >
            <option value="All">すべて</option>
            {CLUB_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input
            id="club-name-search"
            aria-label="クラブ名称検索"
            type="search"
            placeholder="名称検索"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
          <button
            type="button"
            className="btn-clear-filter"
            onClick={() => {
              onSelectedClubTypeChange('All');
              onSearchTextChange('');
            }}
            disabled={!hasFilter}
          >
            クリア
          </button>
        </div>
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
      ) : filteredClubs.length === 0 ? (
        <div className="empty-state">
          <p>検索条件に一致するクラブがありません。条件を変更してください。</p>
          <div className="empty-state-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onSelectedClubTypeChange('All');
                onSearchTextChange('');
              }}
            >
              条件をリセット
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="club-list compact">
            {sortedClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onEdit={onEdit}
                onDelete={onDelete}
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
            <button className="btn-clearall-clubs" onClick={onClearAll} disabled={loading} title="全クラブ削除">
              <DeleteIcon size={18} />
              <span>全クラブ削除</span>
            </button>
            <button className="btn-clearall-clubs" onClick={onDeleteAll} disabled={loading} title="全削除">
              <DeleteIcon size={18} />
              <span>全削除</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
