import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';
import { getCategoryLabel, type ClubCategory } from '../utils/analysisUtils';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';

type LieLengthTableClub = GolfClub & {
  category: ClubCategory;
  expectedLieAngle: number;
  deviationFromTrend: number;
  lieTrendMessage: string;
};

type AnalysisLieLengthTableProps = {
  hasAnyLieLengthData: boolean;
  lieLengthTableClubs: LieLengthTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  getLieLengthPointStyle: (club: LieLengthTableClub, deviation: number) => {
    fill: string;
  };
  formatSignedDegrees: (deg: number) => string;
};

export const AnalysisLieLengthTable = ({
  hasAnyLieLengthData,
  lieLengthTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
  getLieLengthPointStyle,
  formatSignedDegrees,
}: AnalysisLieLengthTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>ライ角トレンド偏差</h2>
      <p>長さに対する回帰トレンドから、ライ角の上下ズレを確認できます。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ名</th>
            <th>種類</th>
            <th>長さ（in）</th>
            <th>計測値（°）</th>
            <th>期待値（°）</th>
            <th>偏差（°）</th>
            <th>示唆</th>
          </tr>
        </thead>
        <tbody>
          {hasAnyLieLengthData ? (
            lieLengthTableClubs.map((club) => (
              <tr key={`lie-length-row-${getAnalysisClubKey(club)}`}>
                <AnalysisSelectionCell
                  club={club}
                  hiddenClubKeySet={hiddenClubKeySet}
                  onSetAnalysisClubVisible={onSetAnalysisClubVisible}
                />
                <td>
                  <div className="analysis-club-name">
                    <span className="analysis-club-type">
                      {getClubTypeDisplay(club.clubType, club.number)}
                    </span>
                    <span>{club.name}</span>
                  </div>
                </td>
                <td>{getCategoryLabel(club.category)}</td>
                <td>{club.length.toFixed(2)}</td>
                <td>{club.lieAngle.toFixed(1)}</td>
                <td>{club.expectedLieAngle.toFixed(1)}</td>
                <td
                  style={{
                    color: getLieLengthPointStyle(club, club.deviationFromTrend).fill,
                    fontWeight: 700,
                  }}
                >
                  {formatSignedDegrees(club.deviationFromTrend)}
                </td>
                <td>{club.lieTrendMessage}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="analysis-empty-cell">
                クラブがまだ追加されていません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
