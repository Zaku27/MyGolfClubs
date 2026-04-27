import { useGameStore } from "../../store/gameStore";
import type { GamePhase, Hole, HoleScore } from "../../types/game";

interface Props {
  onPlayAgain: () => void;
  onBack: () => void;
  onViewStatistics?: () => void;
}

interface CompactScorecardProps {
  course: Hole[];
  scores: HoleScore[];
  currentHoleIndex: number;
  holeStrokes: number;
  phase: GamePhase;
  className?: string;
}

function formatRelative(value: number) {
  return value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
}

function scoreTone(diff: number) {
  if (diff < 0) return "text-lime-300";
  if (diff > 0) return "text-rose-300";
  return "text-emerald-100";
}

export function CompactScorecard({
  course,
  scores,
  currentHoleIndex,
  holeStrokes,
  phase,
  className,
}: CompactScorecardProps) {
  const scoreMap = new Map(scores.map((score) => [score.holeNumber, score]));
  let completedCumulative = 0;

  const rows = course.map((hole, index) => {
    const scored = scoreMap.get(hole.number);
    const isCurrent = index === currentHoleIndex;
    const isPlayingCurrent = isCurrent && phase === "playing";

    if (scored) {
      const diff = scored.strokes - hole.par;
      completedCumulative += diff;
      return {
        holeNumber: hole.number,
        par: hole.par,
        isCurrent,
        scoreText: String(scored.strokes),
        scoreClass: scoreTone(diff),
        cumulativeText: formatRelative(completedCumulative),
        cumulativeClass: scoreTone(completedCumulative),
      };
    }

    if (isPlayingCurrent && holeStrokes > 0) {
      const currentDiff = holeStrokes - hole.par;
      const liveCumulative = completedCumulative + currentDiff;
      return {
        holeNumber: hole.number,
        par: hole.par,
        isCurrent,
        scoreText: `${holeStrokes}*`,
        scoreClass: scoreTone(currentDiff),
        cumulativeText: formatRelative(liveCumulative),
        cumulativeClass: scoreTone(liveCumulative),
      };
    }

    return {
      holeNumber: hole.number,
      par: hole.par,
      isCurrent,
      scoreText: "-",
      scoreClass: "text-emerald-300/70",
      cumulativeText: "-",
      cumulativeClass: "text-emerald-300/70",
    };
  });

  return (
    <div className={[
      "rounded-2xl border border-emerald-700/50 bg-emerald-950/65 shadow-xl shadow-emerald-950/30",
      className ?? "",
    ].join(" ")}>
      <div className="grid grid-cols-4 border-b border-emerald-700/60 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">
        <span>Hole</span>
        <span className="text-center">Par</span>
        <span className="text-center">Score</span>
        <span className="text-right">Cumulative</span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.holeNumber}
            className={[
              "grid grid-cols-4 items-center border-b border-emerald-800/50 px-3 py-2 text-sm",
              row.isCurrent ? "bg-emerald-500/20" : "bg-transparent",
            ].join(" ")}
          >
            <span className={row.isCurrent ? "font-bold text-emerald-50" : "text-emerald-100"}>
              {row.holeNumber}
            </span>
            <span className="text-center text-emerald-300">{row.par}</span>
            <span className={`text-center font-bold ${row.scoreClass}`}>{row.scoreText}</span>
            <span className={`text-right font-bold ${row.cumulativeClass}`}>{row.cumulativeText}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function scoreDiff(strokes: number, par: number) {
  const d = strokes - par;
  const label =
    d <= -2 ? "Eagle"    :
    d === -1 ? "Birdie"   :
    d === 0  ? "Par"      :
    d === 1  ? "Bogey"    :
    d === 2  ? "Dbl Bogey": `+${d}`;
  const color =
    d <= -2 ? "text-yellow-300" :
    d === -1 ? "text-emerald-700" :
    d === 0  ? "text-emerald-900" :
    d === 1  ? "text-orange-400": "text-red-400";
  const display = d === 0 ? "E" : d > 0 ? `+${d}` : String(d);
  return { label, color, display };
}

export function Scorecard({ onPlayAgain, onBack, onViewStatistics }: Props) {
  const { scores } = useGameStore();

  const totalPar     = scores.reduce((s, h) => s + h.par, 0);
  const totalStrokes = scores.reduce((s, h) => s + h.strokes, 0);
  const overallDiff  = totalStrokes - totalPar;

  const front = scores.filter((s) => s.holeNumber <= 9);
  const back  = scores.filter((s) => s.holeNumber >= 10);

  const frontPar  = front.reduce((s, h) => s + h.par, 0);
  const frontStr  = front.reduce((s, h) => s + h.strokes, 0);
  const backPar   = back.reduce((s, h) => s + h.par, 0);
  const backStr   = back.reduce((s, h) => s + h.strokes, 0);

  const overallColor =
    overallDiff <= -2 ? "text-yellow-300" :
    overallDiff === -1 ? "text-emerald-700" :
    overallDiff === 0  ? "text-emerald-900" :
    overallDiff <= 5   ? "text-orange-400": "text-red-400";
  const overallDisplay =
    overallDiff === 0 ? "E" : overallDiff > 0 ? `+${overallDiff}` : String(overallDiff);

  function SubtotalRow({ label, par, strokes }: { label: string; par: number; strokes: number }) {
    const d = strokes - par;
    const c = d > 0 ? "text-orange-500" : d < 0 ? "text-emerald-700" : "text-emerald-900";
    return (
      <div className="grid grid-cols-4 px-3 py-2 bg-emerald-100/80 border-b border-emerald-300 text-sm font-bold">
        <span className="text-emerald-700">{label}</span>
        <span className="text-center text-emerald-700">{par}</span>
        <span className="text-center">{strokes}</span>
        <span className={`text-right ${c}`}>{d === 0 ? "E" : d > 0 ? `+${d}` : d}</span>
      </div>
    );
  }

  return (
    <div className="text-emerald-900 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center py-6">
        <div className="text-4xl mb-2">🏆</div>
        <h2 className="text-2xl font-black">ラウンド終了</h2>
        <div className={`text-6xl font-black mt-2 ${overallColor}`}>{overallDisplay}</div>
        <div className="text-emerald-700 text-lg mt-1">
          {totalStrokes}打 / PAR {totalPar}
        </div>

      </div>

      {/* Table */}
      <div className="bg-emerald-50/90 rounded-2xl overflow-hidden border border-emerald-300 mb-5 shadow-sm shadow-emerald-300/40">
        {/* Table header */}
        <div className="grid grid-cols-4 text-xs text-emerald-700 font-bold px-3 py-2 bg-emerald-100 border-b border-emerald-300 uppercase tracking-wide">
          <span>Hole</span>
          <span className="text-center">Par</span>
          <span className="text-center">Score</span>
          <span className="text-right">+/−</span>
        </div>

        {/* Hole rows */}
        {scores.map((hole) => {
          const { label, color, display } = scoreDiff(hole.strokes, hole.par);
          return (
            <div
              key={hole.holeNumber}
              className="grid grid-cols-4 px-3 py-2.5 border-b border-emerald-200 items-center hover:bg-emerald-100/70 transition-colors"
            >
              <span className="font-bold text-sm">{hole.holeNumber}</span>
              <span className="text-center text-emerald-700 text-sm">{hole.par}</span>
              <span className="text-center font-bold">{hole.strokes}</span>
              <div className="text-right">
                <span className={`text-sm font-bold ${color}`}>{display}</span>
                <div className="text-xs text-emerald-600">{label}</div>
              </div>
            </div>
          );
        })}

        {/* Front 9 subtotal (only for 18-hole rounds) */}
        {back.length > 0 && <SubtotalRow label="OUT" par={frontPar} strokes={frontStr} />}
        {back.length > 0 && <SubtotalRow label="IN"  par={backPar}  strokes={backStr}  />}

        {/* Total */}
        <div className="grid grid-cols-4 px-3 py-3 bg-emerald-200/70 font-bold items-center">
          <span className="text-emerald-900">TOTAL</span>
          <span className="text-center text-emerald-700">{totalPar}</span>
          <span className="text-center text-emerald-900 text-lg">{totalStrokes}</span>
          <span className={`text-right text-xl ${overallColor}`}>{overallDisplay}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-3 pb-10">
        {onViewStatistics && (
          <button
            onClick={onViewStatistics}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors text-sm"
          >
            📊 ラウンド統計を見る
          </button>
        )}
        <button
          onClick={onPlayAgain}
          className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors"
        >
          ⛳ もう一度プレー
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 bg-transparent border border-emerald-400 text-emerald-700 hover:text-white hover:bg-emerald-700 hover:border-emerald-700 rounded-xl transition-colors text-sm"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
