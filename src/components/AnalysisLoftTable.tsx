import type { ChangeEvent } from 'react';
import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { type ClubCategory } from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';

type LoftTableClub = GolfClub & {
  category: ClubCategory;
  estimatedDistance: number;
  actualDistance: number;
};

type AnalysisLoftTableProps = {
  loftTableClubs: LoftTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  onActualDistanceChange: (clubId: number | undefined, event: ChangeEvent<HTMLInputElement>) => void;
};

export const AnalysisLoftTable = ({
  loftTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
  onActualDistanceChange,
}: AnalysisLoftTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>クラブデータ</h2>
      <p>実測飛距離は一覧データに直接反映されます。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ</th>
            <th>ロフト</th>
            <th>推定</th>
            <th>実測</th>
          </tr>
        </thead>
        <tbody>
          {loftTableClubs.map((club) => (
            <tr key={`row-${getAnalysisClubKey(club)}`}>
              <AnalysisSelectionCell
                club={club}
                hiddenClubKeySet={hiddenClubKeySet}
                onSetAnalysisClubVisible={onSetAnalysisClubVisible}
              />
              <td>
                <div className="analysis-club-name">
                  <span className="analysis-club-type">{getClubTypeDisplay(club.clubType, club.number)}</span>
                  <span>{club.name}</span>
                </div>
              </td>
              <td>{club.loftAngle.toFixed(1)}°</td>
              <td>{club.estimatedDistance.toFixed(0)} y</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={club.actualDistance || ''}
                  onChange={(event) => onActualDistanceChange(club.id, event)}
                  className="analysis-input"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);