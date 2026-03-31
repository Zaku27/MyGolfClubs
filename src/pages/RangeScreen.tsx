import { useState } from 'react';
import { useClubStore } from '../store/clubStore';
import { calculateEffectiveSuccessRate } from '../utils/clubUtils';
import { simulateShot } from '../utils/shotSimulation';
import { rangeAutoCalibrate } from '../utils/rangeUtils';

const LIE_OPTIONS = [
  'Fairway',
  'Rough',
  'Light Rough',
  'Bunker',
  'Green',
];
const WIND_DIRECTIONS = [
  { label: 'Tailwind', value: 'tail' },
  { label: 'Headwind', value: 'head' },
  { label: 'Crosswind', value: 'cross' },
];
const SHOT_COUNTS = [5, 10, 20];

const outcomeColor = (outcome: string) => {
  if (outcome === 'Penalty') return 'text-red-600';
  if (outcome === 'Miss') return 'text-yellow-600';
  if (outcome === 'Good') return 'text-green-700';
  return 'text-green-900';
};

export default function RangeScreen() {
  const { clubs, personalData } = useClubStore();
  // const { playerSkillLevel } = useGameStore();
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [lie, setLie] = useState<string>('Fairway');
  const [windSpeed, setWindSpeed] = useState<number>(0);
  const [windDir, setWindDir] = useState<string>('tail');
  const [numShots, setNumShots] = useState<number>(10);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // avgDistanceが無い場合はdistanceをavgDistanceとして使う
  let selectedClub = clubs.find((c) => String(c.id) === String(selectedClubId));
  // SimClub型に変換（最低限必要なプロパティを補完）
  const toSimClub = (club: import('../types/golf').GolfClub | undefined) => {
    if (!club) return undefined;
    return {
      ...club,
      type: (club as any).type ?? "Unknown",
      avgDistance: (club as any).avgDistance ?? club.distance ?? 0,
      successRate: (club as any).successRate ?? 70,
      isWeakClub: (club as any).isWeakClub ?? false,
      number: club.number ?? "",
      name: club.name ?? "",
      id: String(club.id),
    };
  };
  const simClub = toSimClub(selectedClub);
  const clubPersonal = simClub && simClub.id !== undefined ? personalData[simClub.id] : null;
  // スキルレベルを個人データから取得（なければ0.5）
  const playerSkillLevel = 0.5;
  const effectiveSuccess = simClub && clubPersonal
    ? calculateEffectiveSuccessRate({ ...simClub, id: Number(simClub.id) }, clubPersonal, playerSkillLevel)
    : null;

  const handleSimulate = async () => {
    if (!simClub) return;
    setIsSimulating(true);
    const shotResults = [];
    // ...existing code...
    for (let i = 0; i < numShots; i++) {
      const club = simClub;
      // lieをLieTypeに変換
      let lieType: import('../types/game').LieType = 'fairway';
      switch (lie) {
        case 'Fairway': lieType = 'fairway'; break;
        case 'Rough':
        case 'Light Rough': lieType = 'rough'; break;
        case 'Bunker': lieType = 'bunker'; break;
        case 'Green': lieType = 'green'; break;
        default: lieType = 'fairway';
      }
      const context = {
        lie: lieType,
        wind: windDir as any,
        windStrength: windSpeed,
        remainingDistance: simClub.avgDistance,
        hazards: [],
        shotPowerPercent: 100,
      };
      const riskLevel = "normal";
      const options = { personalData: clubPersonal ?? undefined, playerSkillLevel };
      const shotResult = simulateShot(club, context, riskLevel, options);
      debugShots.push({
        i,
        actualDistance: shotResult.distanceHit,
        shotQuality: shotResult.shotQuality,
        effectiveRate: shotResult.effectiveSuccessRate,
        isGoodShot: shotResult.wasSuccessful,
        penalty: shotResult.penalty,
      });
      shotResults.push(shotResult);
    }
    setResults(shotResults);
    // ...existing code...
    // Summary
    const distances = shotResults.map((r) => r.distanceHit);
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const std = Math.sqrt(
      distances.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / distances.length
    );
    const success = shotResults.filter((r) => r.wasSuccessful).length / numShots;
    setSummary({ avg, std, success });
    setCalibrated(false);
    setIsSimulating(false);
  };

  const handleCalibrate = () => {
    if (!simClub || !results.length || !clubPersonal) return;
    rangeAutoCalibrate({ ...simClub, id: Number(simClub.id) }, clubPersonal, results);
    setCalibrated(true);
  };

  // ...existing code...

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center py-4 px-2">
      {/* Header */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-green-900">Practice Range</h1>
        <button
          className="bg-green-200 hover:bg-green-300 text-green-900 rounded px-4 py-2 font-semibold shadow"
          onClick={() => window.history.back()}
        >
          Back to Menu
        </button>
      </div>

      {/* ...existing code... */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
        <label className="block font-semibold mb-2">Select Club</label>
        <div className="mb-2 text-xs text-gray-500">クラブ本数: {clubs.length}</div>
        {clubs.length === 0 ? (
          <div className="text-red-600 font-bold py-2">クラブが登録されていません。<br/>クラブ管理画面でクラブを追加してください。</div>
        ) : (
          <>
            <select
              className="w-full border rounded p-2 mb-2"
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
            >
              <option value="">-- Choose a club --</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name} ({club.number})
                </option>
              ))}
            </select>
            {selectedClub && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-green-900 text-sm">
                <span className="font-bold">{selectedClub.name}</span>
                <span>Avg: {simClub?.avgDistance ?? '-'} yd</span>
                <span>
                  有効成功率: {effectiveSuccess !== null && effectiveSuccess !== undefined ? (effectiveSuccess * 100).toFixed(1) : '--'}%
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Conditions Panel */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4 flex flex-col gap-3">
        <div>
          <label className="block font-semibold mb-1">Lie</label>
          <select
            className="w-full border rounded p-2"
            value={lie}
            onChange={(e) => setLie(e.target.value)}
          >
            {LIE_OPTIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label className="font-semibold">Wind</label>
          <input
            type="range"
            min={0}
            max={25}
            value={windSpeed}
            onChange={(e) => setWindSpeed(Number(e.target.value))}
            className="w-24 accent-green-700"
          />
          <span className="w-8 text-center">{windSpeed} mph</span>
          <select
            className="border rounded p-1"
            value={windDir}
            onChange={(e) => setWindDir(e.target.value)}
          >
            {WIND_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Number of Shots</label>
          <div className="flex gap-2">
            {SHOT_COUNTS.map((n) => (
              <button
                key={n}
                className={`px-3 py-1 rounded border ${numShots === n ? 'bg-green-200 border-green-600' : 'bg-white border-green-200'} font-semibold`}
                onClick={() => setNumShots(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hit Shots Button */}
      <button
        className={`w-full max-w-xl py-3 rounded text-lg font-bold shadow mb-4 transition ${selectedClub ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-green-100 text-green-400 cursor-not-allowed'}`}
        disabled={!selectedClub || isSimulating}
        onClick={handleSimulate}
      >
        {isSimulating ? 'Simulating...' : `Hit ${numShots} Shots`}
      </button>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-green-900">セッション結果：</span>
            <span>平均: {summary.avg.toFixed(1)} ヤード</span>
            <span>成功率: {(summary.success * 100).toFixed(1)}%</span>
            <span>ばらつき: {summary.std.toFixed(1)} ヤード</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">飛距離</th>
                  <th className="px-2 py-1">結果</th>
                  <th className="px-2 py-1">備考</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-1 text-center">{i + 1}</td>
                    <td className="px-2 py-1 text-center">{r.distanceHit.toFixed(1)}</td>
                    <td className={`px-2 py-1 text-center font-bold ${outcomeColor(r.outcome)}`}>{r.outcome}</td>
                    <td className="px-2 py-1">{r.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* オートキャリブレーション（個人データ更新） */}
      {results.length > 0 && (
        <div className="w-full max-w-xl flex flex-col items-center mb-4">
          <button
            className={`px-4 py-2 rounded font-semibold shadow ${calibrated ? 'bg-green-100 text-green-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            disabled={calibrated}
            onClick={handleCalibrate}
          >
            このセッションで個人データを更新
          </button>
          {calibrated && (
            <span className="mt-2 text-green-800 font-semibold text-sm text-center">
              個人データを更新しました。{selectedClub?.name}のミス率がより現実的になりました。
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// --- Route Integration ---
// Add to your router:
// import RangeScreen from './pages/RangeScreen';
// <Route path="/range" element={<RangeScreen />} />
