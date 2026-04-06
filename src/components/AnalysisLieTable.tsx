import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey } from '../utils/clubUtils';
import { getCategoryLabel, type ClubCategory } from '../utils/analysisUtils';
import { lieStatusColor, lieStatusLabelJa, type LieAngleStatus } from '../types/lieStandards';
import { AnalysisSelectionCell, AnalysisSelectionHeaderCell } from './AnalysisSelectionColumn';
import { ClubDisplayName } from './ClubDisplayName';

type LieTableClub = GolfClub & {
  category: ClubCategory;
  standardLieAngle: number;
  deviationFromStandard: number;
  lieStatus: LieAngleStatus;
};

type AnalysisLieTableProps = {
  lieAngleTableClubs: LieTableClub[];
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
};

export const AnalysisLieTable = ({
  lieAngleTableClubs,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
}: AnalysisLieTableProps) => (
  <div className="analysis-card table-card">
    <div className="analysis-table-header">
      <h2>ライ角サマリー</h2>
      <p>クラブ別基準ライ角からの偏差とフィッティング推奨ステータス一覧です。</p>
    </div>
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <AnalysisSelectionHeaderCell />
            <th>クラブ名</th>
            <th>種類</th>
            <th>計測値（°）</th>
            <th>基準値（°）</th>
            <th>偏差（°）</th>
            <th>ステータス</th>
          </tr>
        </thead>
        <tbody>
          {lieAngleTableClubs.map((club) => {
            const deviation = club.deviationFromStandard;
            const status = club.lieStatus;
            return (
              <tr key={`lie-row-${getAnalysisClubKey(club)}`}>
                <AnalysisSelectionCell
                  club={club}
                  hiddenClubKeySet={hiddenClubKeySet}
                  onSetAnalysisClubVisible={onSetAnalysisClubVisible}
                />
                <td>
                  <ClubDisplayName clubType={club.clubType} number={club.number} name={club.name} />
                </td>
                <td>{getCategoryLabel(club.category)}</td>
                <td>{club.lieAngle.toFixed(1)}</td>
                <td>{club.standardLieAngle.toFixed(1)}</td>
                <td>{deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}°</td>
                <td>
                  <span
                    className={
                      status === 'Good'
                        ? 'lie-status-good'
                        : status === 'Slightly Off'
                          ? 'lie-status-slight'
                          : 'lie-status-adjust'
                    }
                    style={{ color: lieStatusColor(status) }}
                  >
                    {lieStatusLabelJa(status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);