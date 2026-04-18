import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey } from '../utils/clubUtils';
import {
  formatSignedSwingWeight,
  getCategoryLabel,
  getSwingLengthPointStyle,
  numericToSwingWeightLabel,
  type ClubCategory,
} from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';
import { ClubDisplayName } from './ClubDisplayName';

type SwingLengthTableClub = GolfClub & {
  category: ClubCategory;
  swingWeightNumeric: number;
  expectedSwingWeight: number;
  deviationFromTrend: number;
  trendStatus: '良好' | 'やや重い' | 'やや軽い' | '調整推奨';
};

type AnalysisSwingLengthTableProps = {
  hasAnySwingLengthData: boolean;
  swingLengthTableClubs: SwingLengthTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
};

export const AnalysisSwingLengthTable = ({
  hasAnySwingLengthData,
  swingLengthTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
}: AnalysisSwingLengthTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>スイングウェイト詳細</h2>
      <p>クラブ長とスイングウェイトの回帰分析結果です。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ名</th>
            <th>種類</th>
            <th>長さ（in）</th>
            <th>スイングウェイト</th>
            <th>期待値</th>
            <th>偏差</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {hasAnySwingLengthData ? (
            swingLengthTableClubs.map((club) => (
              <tr key={`sl-row-${getAnalysisClubKey(club)}`}>
                <AnalysisSelectionCell
                  club={club}
                  hiddenClubKeySet={hiddenClubKeySet}
                  onSetAnalysisClubVisible={onSetAnalysisClubVisible}
                />
                <td>
                  <ClubDisplayName clubType={club.clubType} number={club.number} name={club.name} />
                </td>
                <td>{getCategoryLabel(club.category)}</td>
                <td>{club.length.toFixed(2)}</td>
                <td>{numericToSwingWeightLabel(club.swingWeightNumeric)}</td>
                <td>{numericToSwingWeightLabel(club.expectedSwingWeight)}</td>
                <td
                  style={{
                    color: getSwingLengthPointStyle(club, club.deviationFromTrend, 1.5, 2.0).fill,
                    fontWeight: 700,
                  }}
                >
                  {formatSignedSwingWeight(club.deviationFromTrend)}
                </td>
                <td
                  style={{
                    color:
                      club.trendStatus === '調整推奨'
                        ? '#c62828'
                        : club.trendStatus === '良好'
                          ? '#2e7d32'
                          : '#ef6c00',
                    fontWeight: 700,
                  }}
                >
                  {club.trendStatus}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="analysis-empty-cell">
                スイングウェイトデータがまだ追加されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
