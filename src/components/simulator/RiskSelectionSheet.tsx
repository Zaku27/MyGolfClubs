import type { RiskLevel, SimClub } from "../../types/game";
import { useGameStore } from "../../store/gameStore";
import { useClubStore } from "../../store/clubStore";
import { estimateEffectiveSuccessRate, estimateShotDistanceRange } from "../../utils/shotSimulation";
import { formatSimClubDisplayName } from "../../utils/simClubLabel";
import { resolvePersonalDataForSimClub } from "../../utils/personalData";

interface Props {
  club: SimClub | null;
  onClose: () => void;
  onSelectRisk: (risk: RiskLevel) => void;
}

const RISK_OPTIONS: Array<{
  risk: RiskLevel;
  title: string;
  cardClass: string;
}> = [
  {
    risk: "safe",
    title: "安全に打つ",
    cardClass: "border-emerald-300 bg-emerald-100/90",
  },
  {
    risk: "normal",
    title: "通常ショット",
    cardClass: "border-sky-300 bg-sky-100/80",
  },
  {
    risk: "aggressive",
    title: "攻める",
    cardClass: "border-amber-300 bg-amber-100/80",
  },
];

export function RiskSelectionSheet({ club, onClose, onSelectRisk }: Props) {
  const { roundShots, confidenceBoost, shotContext } = useGameStore();
  const personalData = useClubStore((state) => state.personalData);
  const playerSkillLevel = useClubStore((state) => state.playerSkillLevel);

  if (!club) return null;

  const weakClub = club.isWeakClub === true || club.successRate < 65;
  const clubShotsToday = roundShots.filter((shot) => shot.clubId === club.id);
  const clubSuccessesToday = clubShotsToday.filter((shot) => shot.success).length;
  const todayRate = clubShotsToday.length > 0
    ? Math.round((clubSuccessesToday / clubShotsToday.length) * 100)
    : null;
  const distancePreview = {
    safe: estimateShotDistanceRange(club, shotContext),
    normal: estimateShotDistanceRange(club, shotContext),
    aggressive: estimateShotDistanceRange(club, shotContext),
  };
  const effectiveRatePreview = {
    safe: estimateEffectiveSuccessRate(club, shotContext, "safe", {
      confidenceBoost,
      personalData: resolvePersonalDataForSimClub(club, personalData),
      playerSkillLevel,
    }),
    normal: estimateEffectiveSuccessRate(club, shotContext, "normal", {
      confidenceBoost,
      personalData: resolvePersonalDataForSimClub(club, personalData),
      playerSkillLevel,
    }),
    aggressive: estimateEffectiveSuccessRate(club, shotContext, "aggressive", {
      confidenceBoost,
      personalData: resolvePersonalDataForSimClub(club, personalData),
      playerSkillLevel,
    }),
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-emerald-300 bg-emerald-50/95 p-4 shadow-xl shadow-emerald-300/40 sm:rounded-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-emerald-900 sm:text-xl">ショット方針を選択</h3>
          <p className="mt-1 text-sm text-emerald-700">
            {formatSimClubDisplayName(club)} を選択中
          </p>
        </div>

        {weakClub && (
          <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-bold tracking-[0.18em] text-amber-700">注意</p>
            <p className="mt-2 text-base font-semibold">このクラブは最近安定していません</p>
            <p className="mt-2 text-sm text-amber-800">
              基本成功率 {club.successRate}%
              {` ・有効成功率(通常) ${effectiveRatePreview.normal}%`}
              {todayRate !== null ? ` ・今日の成功 ${clubSuccessesToday}/${clubShotsToday.length}本 (${todayRate}%)` : ""}
            </p>
          </div>
        )}

        {confidenceBoost > 0 && (
          <div className="mb-4 rounded-2xl border border-lime-300/70 bg-lime-100 p-4 text-lime-900">
            <p className="text-sm font-bold tracking-[0.18em] text-lime-700">勢いボーナス</p>
            <p className="mt-2 text-sm text-lime-800">連続成功の流れで、次の1打に成功率 +{confidenceBoost}% が付きます。</p>
          </div>
        )}

        <div className="space-y-3">
          {RISK_OPTIONS.map((option) => (
            <button
              key={option.risk}
              type="button"
              onClick={() => onSelectRisk(option.risk)}
              className={[
                "w-full rounded-xl border px-4 py-4 text-left transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80",
                "active:scale-[0.99]",
                option.cardClass,
              ].join(" ")}
            >
              <p className="text-base font-semibold text-emerald-900">{option.title}</p>
              <p className="mt-1 text-sm text-emerald-700">
                想定レンジ {distancePreview[option.risk].min}-{distancePreview[option.risk].max}ヤード
                {option.risk === "safe" ? " / リスク低め" : ""}
                {option.risk === "aggressive" ? " / ミスの振れ幅大" : ""}
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                有効成功率: {effectiveRatePreview[option.risk]}%
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-emerald-400 bg-emerald-100/80 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200/80"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
