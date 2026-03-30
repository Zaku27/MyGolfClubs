import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { formatSignedGrams, getCategoryLabel, getWeightPointStyle, type ClubCategory } from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';

type WeightTableClub = GolfClub & {
  category: ClubCategory;
  expectedWeight: number;
  deviation: number;
};

type AnalysisWeightTableProps = {
  hasAnyWeightLengthData: boolean;
  weightLengthTableClubs: WeightTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
};

export const AnalysisWeightTable = ({
  hasAnyWeightLengthData,
  weightLengthTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
}: AnalysisWeightTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>クラブ仕様</h2>
      <p>クラブ長と重量の実データ一覧です。</p>
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
            weightLengthTableClubs.map((club) => (
              <tr key={`wl-row-${getAnalysisClubKey(club)}`}>
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
                <td>{getCategoryLabel(club.category)}</td>
                <td>{club.length.toFixed(2)}</td>
                <td>{club.weight.toFixed(1)}</td>
                <td>{club.expectedWeight.toFixed(1)}</td>
                <td style={{ color: getWeightPointStyle(club, club.deviation).fill, fontWeight: 700 }}>
                  {formatSignedGrams(club.deviation)}
                </td>
              </tr>
            ))
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