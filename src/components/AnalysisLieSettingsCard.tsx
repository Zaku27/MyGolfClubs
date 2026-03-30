import type { GolfClub } from '../types/golf';
import {
  DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE,
  compareLieStandardTypeOrder,
  displayLieStandardTypeLabel,
  fallbackLieStandardForType,
  getLieStandardTypeKeyForClub,
  makePerClubLieStandardKey,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import { getAnalysisClubKey } from '../utils/clubUtils';
import { LieStandardInputRow } from './AnalysisSettingsInputs';

type LieSettingsClub = GolfClub & {
  standardLieAngle: number;
};

type AnalysisLieSettingsCardProps = {
  clubs: GolfClub[];
  lieAngleTableClubs: LieSettingsClub[];
  userLieAngleStandards: UserLieAngleStandards;
  onSetLieTypeStandard: (clubType: string, value: number) => void;
  onSetLieClubStandard: (clubName: string, value: number) => void;
  onClearLieTypeStandard: (clubType: string) => void;
  onClearLieClubStandard: (clubName: string) => void;
  onResetLieStandards: () => void;
};

export const AnalysisLieSettingsCard = ({
  clubs,
  lieAngleTableClubs,
  userLieAngleStandards,
  onSetLieTypeStandard,
  onSetLieClubStandard,
  onClearLieTypeStandard,
  onClearLieClubStandard,
  onResetLieStandards,
}: AnalysisLieSettingsCardProps) => (
  <div className="analysis-card lie-settings-card">
    <div className="analysis-table-header">
      <h2>ライ角基準値設定</h2>
      <p>まずはクラブタイプ別を設定し、必要なクラブだけ個別上書きを入れてください。</p>
    </div>
    <div className="lie-settings-guide" role="note" aria-label="ライ角基準値設定の使い方">
      <div className="lie-settings-guide-title">使い方（おすすめ手順）</div>
      <ul className="lie-settings-guide-list">
        <li>1. 先に「クラブタイプ別（基本）」を設定する</li>
        <li>2. ずれが気になるクラブだけ「クラブ別 override」を設定する</li>
        <li>3. 入力後は Enter またはフォーカス移動で保存。解除で元に戻せます</li>
      </ul>
    </div>
    <div className="lie-settings-grid">
      <div className="lie-settings-section">
        <div className="lie-settings-section-title">1) クラブタイプ別（基本）</div>
        {[...new Set([...Object.keys(DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE), ...clubs.map(getLieStandardTypeKeyForClub)])]
          .sort(compareLieStandardTypeOrder)
          .map((clubType) => (
            <LieStandardInputRow
              key={`type-${clubType}`}
              label={displayLieStandardTypeLabel(clubType)}
              defaultValue={DEFAULT_LIE_ANGLE_STANDARDS_BY_TYPE[clubType] ?? fallbackLieStandardForType(clubType)}
              currentValue={userLieAngleStandards.byClubType[clubType]}
              onCommit={(value) => onSetLieTypeStandard(clubType, value)}
              onClear={() => onClearLieTypeStandard(clubType)}
            />
          ))}
      </div>
      <div className="lie-settings-section">
        <div className="lie-settings-section-title">2) クラブ別 override（必要なものだけ）</div>
        {lieAngleTableClubs.map((club) => (
          <LieStandardInputRow
            key={`club-${getAnalysisClubKey(club)}`}
            label={`${club.name} ${club.number}`.trim()}
            subLabel={club.clubType}
            defaultValue={club.standardLieAngle}
            currentValue={
              userLieAngleStandards.byClubName[
                makePerClubLieStandardKey(club.name, club.clubType, club.number)
              ] ?? userLieAngleStandards.byClubName[
                makePerClubLieStandardKey(club.name, club.clubType)
              ]
            }
            onCommit={(value) =>
              onSetLieClubStandard(
                makePerClubLieStandardKey(club.name, club.clubType, club.number),
                value,
              )
            }
            onClear={() =>
              onClearLieClubStandard(
                makePerClubLieStandardKey(club.name, club.clubType, club.number),
              )
            }
          />
        ))}
      </div>
    </div>
    <div className="lie-settings-actions">
      <button className="btn-secondary" onClick={onResetLieStandards}>全てリセット</button>
    </div>
  </div>
);