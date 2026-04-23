import type { ChangeEvent } from 'react';
import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey } from '../utils/clubUtils';
import { type ClubCategory } from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';
import { ClubDisplayName } from './ClubDisplayName';

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
  onReflectAllEstimatedToActual: () => void;
};

export const AnalysisLoftTable = ({
  loftTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
  onActualDistanceChange,
  onReflectAllEstimatedToActual,
}: AnalysisLoftTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <div className="analysis-table-header-content">
        <div>
          <h2>クラブデータ</h2>
          <p>実測飛距離は一覧データに直接反映されます。</p>
        </div>
        <button
          type="button"
          onClick={onReflectAllEstimatedToActual}
          className="analysis-button reflect-button"
          title="すべてのクラブの推定飛距離を実測飛距離に反映します"
        >
          推定→実測を反映
        </button>
      </div>
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
                <ClubDisplayName clubType={club.clubType} number={club.number} name={club.name} />
              </td>
              <td>{club.loftAngle.toFixed(1)}°</td>
              <td>{club.estimatedDistance.toFixed(1)} y</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.1"
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