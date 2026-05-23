import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey } from '../utils/clubUtils';
import { formatSignedGrams, getCategoryLabel, getWeightPointStyle, type ClubCategory } from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';
import { ClubDisplayName } from './ClubDisplayName';

type WeightTableClub = GolfClub & {
  category: ClubCategory;
  expectedWeight: number;
  deviation: number;
  splitExpectedWeight?: number;
  splitDeviation?: number;
  splitWeightTrendMessage?: string;
};

type AnalysisWeightTableProps = {
  hasAnyWeightLengthData: boolean;
  weightLengthTableClubs: WeightTableClub[];
  weightTrendMode: 'single' | 'split';
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
};

export const AnalysisWeightTable = ({
  hasAnyWeightLengthData,
  weightLengthTableClubs,
  weightTrendMode,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
}: AnalysisWeightTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>クラブ仕様</h2>
      <p>クラブ長と重量の実測データ一覧です。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ名</th>
            <th>種類</th>
            <th>長さ（in）</th>
            <th>重量（g）</th>
            <th>期待値（g）</th>
            <th>偏差（g）</th>
          </tr>
        </thead>
        <tbody>
          {hasAnyWeightLengthData ? (
            weightLengthTableClubs.map((club) => {
              const displayExpectedWeight =
                weightTrendMode === 'split' && club.splitExpectedWeight != null
                  ? club.splitExpectedWeight
                  : club.expectedWeight;
              const displayDeviation =
                weightTrendMode === 'split' && club.splitDeviation != null
                  ? club.splitDeviation
                  : club.deviation;

              return (
                <tr key={`wl-row-${getAnalysisClubKey(club)}`}>
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
                  <td>{club.weight.toFixed(1)}</td>
                  <td>{displayExpectedWeight.toFixed(1)}</td>
                  <td style={{ color: getWeightPointStyle(club, displayDeviation).fill, fontWeight: 700 }}>
                    {formatSignedGrams(displayDeviation)}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="analysis-empty-cell">クラブがまだ追加されていません</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);