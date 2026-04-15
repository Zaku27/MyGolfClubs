import type { GolfClub, ClubPersonalData } from '../types/golf';
import type { SimClub } from '../types/game';
import { formatGolfClubDisplayName } from '../utils/simClubLabel';
import type { RangeSeatType } from '../utils/rangePlayerSettings';

type RangeClubSelectionPanelProps = {
  clubs: GolfClub[];
  selectableClubs: GolfClub[];
  selectedClubId: string;
  onSelectedClubIdChange: (clubId: string) => void;
  selectedClub: GolfClub | undefined;
  simClub: SimClub | undefined;
  estimatedClubDistance: number;
  seatType: RangeSeatType;
  clubPersonal: ClubPersonalData | undefined;
  effectiveSuccess: number | null;
};

export function RangeClubSelectionPanel({
  clubs,
  selectableClubs,
  selectedClubId,
  onSelectedClubIdChange,
  selectedClub,
  simClub,
  estimatedClubDistance,
  seatType,
  clubPersonal,
  effectiveSuccess,
}: RangeClubSelectionPanelProps) {
  return (
    <div className="w-full bg-white rounded shadow p-4">
      <label className="block font-semibold mb-2">クラブ選択</label>
      {clubs.length === 0 ? (
        <div className="text-red-600 font-bold py-2">
          No clubs registered.<br />Please add clubs in the club management screen.
        </div>
      ) : (
        <>
          <select
            className="w-full border rounded p-2 mb-2"
            value={selectedClubId}
            onChange={(e) => onSelectedClubIdChange(e.target.value)}
          >
            <option value="">-- Select Club --</option>
            {selectableClubs.map((club) => (
              <option key={club.id} value={club.id}>
                {formatGolfClubDisplayName(club)}
              </option>
            ))}
          </select>
          {selectedClub && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-green-900 text-sm">
              <span className="font-bold">{selectedClub.name}</span>
              <span>
                {seatType === 'personal'
                  ? `実測飛距離: ${selectedClub?.distance != null ? selectedClub.distance.toFixed(1) : '-'} y`
                  : `推定飛距離: ${simClub ? estimatedClubDistance.toFixed(1) : '-'} y`}
              </span>
              {seatType !== 'actual' && (
                <div className="relative inline-flex items-center gap-2 whitespace-nowrap">
                  <span>
                    クラブ成功率: {
                      simClub ? (
                        seatType === 'robot'
                          ? '100% (ロボット固定)'
                          : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? effectiveSuccess.toFixed(1) : '--') + '%'
                      ) : '--'
                    }
                  </span>
                  {seatType === 'robot' && (
                    <button
                      type="button"
                      aria-label="Robot seat クラブ成功率 hint"
                      className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-xs font-bold text-blue-700"
                    >
                      ?
                      <span className="help-tooltip-text whitespace-normal">
                        Robot seat is not affected by club individual differences or personal data, so クラブ成功率 is always fixed at 100%.
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
