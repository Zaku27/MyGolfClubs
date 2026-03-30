import type { GolfClub } from '../types/golf';
import { getAnalysisClubKey, getClubTypeDisplay } from '../utils/clubUtils';

type AnalysisSelectionHeaderCellProps = {
  label?: string;
};

type AnalysisSelectionCellProps = {
  club: GolfClub;
  hiddenClubKeySet: Set<string>;
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
};

export const AnalysisSelectionHeaderCell = ({
  label = '表示',
}: AnalysisSelectionHeaderCellProps) => (
  <th className="analysis-select-column">{label}</th>
);

export const AnalysisSelectionCell = ({
  club,
  hiddenClubKeySet,
  onSetAnalysisClubVisible,
}: AnalysisSelectionCellProps) => {
  const clubKey = getAnalysisClubKey(club);
  const checked = !hiddenClubKeySet.has(clubKey);

  return (
    <td className="analysis-select-cell">
      <input
        type="checkbox"
        className="analysis-checkbox"
        checked={checked}
        onChange={(event) => onSetAnalysisClubVisible(clubKey, event.target.checked)}
        aria-label={`${getClubTypeDisplay(club.clubType, club.number)} ${club.name} をグラフに表示`}
      />
    </td>
  );
};