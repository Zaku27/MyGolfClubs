import type { SimClub } from "../../types/game";
import { useGameStore } from "../../store/gameStore";

interface Props {
  remainingDistance: number;
  isOnGreen: boolean;
}

const TYPE_ORDER = ["Driver", "Wood", "Hybrid", "Iron", "Wedge", "Putter"];

function sortBag(bag: SimClub[]): SimClub[] {
  return [...bag].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type);
    const bi = TYPE_ORDER.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    const an = parseFloat(a.number) || 99;
    const bn = parseFloat(b.number) || 99;
    return an - bn;
  });
}

type DistanceTag = "best" | "good" | "ok" | "far";

function getDistanceTag(club: SimClub, remaining: number): DistanceTag {
  if (club.type === "Putter") return "ok"; // putter uses its own badge
  const ratio = club.avgDistance / remaining;
  if (ratio >= 0.88 && ratio <= 1.04) return "best";
  if (ratio >= 0.72 && ratio <= 1.14) return "good";
  if (club.avgDistance > remaining * 1.30) return "far";
  return "ok";
}

export function ClubSelectionPanel({ remainingDistance, isOnGreen }: Props) {
  const { bag, selectedClubId, selectClub } = useGameStore();
  const sorted = sortBag(bag);

  return (
    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
      {sorted.map((club) => {
        const isSelected = selectedClubId === club.id;
        const isPutter   = club.type === "Putter";
        const tag        = getDistanceTag(club, remainingDistance);

        return (
          <button
            key={club.id}
            onClick={() => selectClub(club.id)}
            className={[
              "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all border",
              isSelected
                ? "bg-yellow-400/20 border-yellow-400 text-white shadow-md shadow-yellow-900/20"
                : "bg-green-900/40 border-green-800 text-green-200 hover:border-green-600 hover:bg-green-900/60",
            ].join(" ")}
          >
            {/* Club label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm">
                  {club.name} {club.number}
                </span>

                {/* Recommendation badges */}
                {isPutter && isOnGreen && (
                  <span className="text-xs bg-yellow-500/30 text-yellow-300 border border-yellow-700/50 rounded px-1.5 py-0.5 leading-none">
                    推奨
                  </span>
                )}
                {!isPutter && tag === "best" && !isOnGreen && (
                  <span className="text-xs bg-green-500/30 text-green-300 border border-green-600/50 rounded px-1.5 py-0.5 leading-none">
                    ◎ 届く
                  </span>
                )}
                {!isPutter && tag === "good" && !isOnGreen && (
                  <span className="text-xs text-green-400 leading-none">○</span>
                )}
                {!isPutter && tag === "far" && (
                  <span className="text-xs text-orange-400 leading-none">⚠ オーバー注意</span>
                )}
              </div>
              <div className="text-xs text-green-500 mt-0.5">{club.type}</div>
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-mono font-bold">
                {club.avgDistance}
                <span className="text-xs text-green-500 font-normal">y</span>
              </div>
              <div className="text-xs text-green-500">{club.successRate}%</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
