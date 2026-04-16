import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey } from '../utils/clubUtils';
import {
  getCategoryLabel,
  getSwingStatusColor,
  numericToSwingWeightLabel,
  type ClubCategory,
} from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';
import { ClubDisplayName } from './ClubDisplayName';

type SwingTableClub = GolfClub & {
  category: ClubCategory;
  swingWeightNumeric: number;
  swingDeviation: number;
  swingStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
};

type AnalysisSwingTableProps = {
  hasAnySwingWeightData: boolean;
  swingWeightTableClubs: SwingTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  swingWeightTarget?: number;
};

export const AnalysisSwingTable = ({
  hasAnySwingWeightData,
  swingWeightTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
  swingWeightTarget,
}: AnalysisSwingTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>スイングウェイト詳細</h2>
      <p>目安値 {numericToSwingWeightLabel(swingWeightTarget ?? 20)} を基準に、クラブごとの偏差と調整優先度を表示します。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ名</th>
            <th>種類</th>
            <th>スイングウェイト</th>
            <th>目安偏差</th>
            <th>ステータス</th>
          </tr>
        </thead>
        <tbody>
          {hasAnySwingWeightData ? (
            swingWeightTableClubs.map((club) => (
              <tr key={`sw-row-${getAnalysisClubKey(club)}`}>
                <AnalysisSelectionCell
                  club={club}
                  hiddenClubKeySet={hiddenClubKeySet}
                  onSetAnalysisClubVisible={onSetAnalysisClubVisible}
                />
                <td>
                  <ClubDisplayName clubType={club.clubType} number={club.number} name={club.name} />
                </td>
                <td>{getCategoryLabel(club.category)}</td>
                <td>{club.swingWeight || '-'}</td>
                <td>{club.swingDeviation >= 0 ? '+' : ''}{club.swingDeviation.toFixed(1)}</td>
                <td>
                  <span style={{ color: getSwingStatusColor(club.swingStatus), fontWeight: 700 }}>
                    {club.swingStatus}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="analysis-empty-cell">クラブがまだ追加されていません</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);