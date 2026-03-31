import React, { useState } from 'react';
import { useClubStore } from '../store/clubStore';
import { useGameStore } from '../store/gameStore';
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
  const { clubs, personalData, updatePersonalData } = useClubStore();
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
  if (selectedClub && selectedClub.avgDistance === undefined && selectedClub.distance !== undefined) {
    selectedClub = { ...selectedClub, avgDistance: selectedClub.distance };
  }
  const clubPersonal = selectedClub ? personalData[selectedClub.id] : null;
  // スキルレベルを個人データから取得（なければ0.5）
  const playerSkillLevel = clubPersonal && typeof clubPersonal.playerSkillLevel === 'number'
    ? clubPersonal.playerSkillLevel
    : 0.5;
  const effectiveSuccess = selectedClub && clubPersonal
    ? calculateEffectiveSuccessRate(selectedClub, clubPersonal, playerSkillLevel)
    : null;

  const handleSimulate = async () => {
    if (!selectedClub) return;
    setIsSimulating(true);
    const shotResults = [];
    // デバッグ用: 各ショットの途中計算値を格納
    const debugShots = [];
    for (let i = 0; i < numShots; i++) {
      // simulateShotの中身を再現し、途中値を取得
      const club = selectedClub;
      const context = {
        lie,
        wind: windDir,
        windStrength: windSpeed,
        remainingDistance: selectedClub.avgDistance,
        hazards: [],
        shotPowerPercent: 100,
      };
      const riskLevel = "normal";
      const options = { personalData: clubPersonal, playerSkillLevel };
      // --- ここからsimulateShotの主要計算 ---
      const { remainingDistance, lie: _lie, wind, windStrength = 7, hazards = [] } = context;
      const confidenceBoost = options.confidenceBoost ?? 0;
      const weakClub = club.isWeakClub === true || club.successRate < 65;
      // effectiveRate
      const effectiveRate = (() => {
        let rate = calculateEffectiveSuccessRate(
          club.successRate,
          options.personalData,
          weakClub,
          options.playerSkillLevel,
        );
        if (_lie === "rough")   rate -= 12;
        if (_lie === "bunker")  rate -= 20;
        if (_lie === "penalty") rate -= 30;
        if (riskLevel === "aggressive") rate -= 15;
        if (riskLevel === "safe")       rate +=  8;
        if (weakClub) {
          const weakPenaltyBase = club.successRate < 60 ? 16 : 14;
          rate -= weakPenaltyBase * 0.5;
        }
        rate += confidenceBoost;
        return Math.max(15, Math.min(95, rate));
      })();
      const roll = Math.random() * 100;
      const isGoodShot = roll < effectiveRate;
      let shotQuality;
      if (isGoodShot) {
        if      (roll < effectiveRate * 0.12) shotQuality = "excellent";
        else if (roll < effectiveRate * 0.55) shotQuality = "good";
        else                                  shotQuality = "average";
      } else {
        shotQuality = roll < effectiveRate + (100 - effectiveRate) * 0.45 ? "poor" : "mishit";
      }
      // 距離計算
      const lieMultiplier  = (() => {
        switch (_lie) {
          case "tee":     return 1.00;
          case "fairway": return 0.98;
          case "rough":   return 0.82;
          case "bunker":  return club.type === "Wedge" ? 0.70 : 0.50;
          case "green":   return 1.00;
          case "penalty": return 0.60;
          default:         return 0.95;
        }
      })();
      const windYards = (() => {
        if (!wind || wind === "none") return 0;
        switch (wind) {
          case "headwind":  return -(windStrength * 1.5);
          case "tailwind":  return  windStrength * 0.8;
          case "crosswind": return -(windStrength * 0.4);
          default:           return 0;
        }
      })();
      const weakDistancePenaltyBase = weakClub ? (club.successRate < 60 ? 0.14 : 0.10) : 0;
      const weakDistanceMultiplier = 1 - weakDistancePenaltyBase * 0.5;
      const expected = club.avgDistance * lieMultiplier * weakDistanceMultiplier + windYards;
      const varianceFactor = ((successRate, risk, weak) => {
        const base = (100 - successRate) / 250;
        const riskMult = risk === "aggressive" ? 2.0 : risk === "safe" ? 0.4 : 1.0;
        return base * riskMult + (weak ? 0.06 * 0.5 : 0);
      })(club.successRate, riskLevel, weakClub);
      const varRoll = Math.random() * 2 - 1;
      let actualDistance;
      if      (shotQuality === "excellent") actualDistance = expected * (1 + Math.abs(varRoll) * varianceFactor * 0.3 + 0.04);
      else if (isGoodShot)                 actualDistance = expected * (1 + varRoll * varianceFactor);
      else if (shotQuality === "poor")     actualDistance = expected * (weakClub ? 0.48 + Math.random() * 0.18 : 0.60 + Math.random() * 0.22);
      else /* mishit */                    actualDistance = expected * (weakClub ? 0.18 + Math.random() * 0.20 : 0.30 + Math.random() * 0.30);
      actualDistance = Math.round(Math.max(5, actualDistance));
      // ペナルティ
      const penaltyBase =
        shotQuality === "mishit"
          ? (hazards.length > 0 ? 0.42 : 0.10) + (weakClub ? 0.12 * 0.5 : 0)
          : shotQuality === "poor"
            ? (hazards.length > 0 ? 0.18 : 0.04) + (weakClub ? 0.08 * 0.5 : 0)
            : 0;
      const penalty = penaltyBase > 0 && Math.random() < penaltyBase;
      // --- ここまでsimulateShotの主要計算 ---
      debugShots.push({
        i,
        lieMultiplier,
        windYards,
        weakDistanceMultiplier,
        expected,
        varianceFactor,
        varRoll,
        actualDistance,
        shotQuality,
        effectiveRate,
        roll,
        isGoodShot,
        penalty,
      });
      shotResults.push(
        simulateShot(
          club,
          context,
          riskLevel,
          options
        )
      );
    }
    setResults(shotResults);
    // デバッグ用: 計算途中値をstateに保存
    setDebugShots(debugShots);
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
    if (!selectedClub || !results.length) return;
    const updated = rangeAutoCalibrate(selectedClub, clubPersonal, results);
    updatePersonalData(selectedClub.id, updated);
    setCalibrated(true);
  };

  // デバッグ用: 計算途中値state
  const [debugShots, setDebugShots] = useState<any[]>([]);

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

      {/* Debug Parameters */}
      {debugShots.length > 0 && (
        <div className="w-full max-w-xl bg-yellow-100 border border-yellow-400 rounded shadow p-2 mb-4 text-xs text-yellow-900">
          <div className="font-bold mb-1">[DEBUG] 飛距離計算 途中値</div>
          <table className="text-[10px]">
            <thead>
              <tr>
                <th>#</th>
                <th>lieM</th>
                <th>windY</th>
                <th>weakM</th>
                <th>expected</th>
                <th>varF</th>
                <th>varR</th>
                <th>actual</th>
                <th>shotQ</th>
                <th>effRate</th>
                <th>roll</th>
                <th>isGood</th>
                <th>penalty</th>
              </tr>
            </thead>
            <tbody>
              {debugShots.map((d) => (
                <tr key={d.i}>
                  <td>{d.i+1}</td>
                  <td>{d.lieMultiplier}</td>
                  <td>{d.windYards}</td>
                  <td>{d.weakDistanceMultiplier}</td>
                  <td>{d.expected}</td>
                  <td>{d.varianceFactor}</td>
                  <td>{d.varRoll}</td>
                  <td>{d.actualDistance}</td>
                  <td>{d.shotQuality}</td>
                  <td>{d.effectiveRate}</td>
                  <td>{d.roll.toFixed(1)}</td>
                  <td>{d.isGoodShot ? '○' : ''}</td>
                  <td>{d.penalty ? 'P' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="w-full max-w-xl bg-yellow-50 border border-yellow-300 rounded shadow p-2 mb-4 text-xs text-yellow-900">
        <div className="font-bold mb-1">[DEBUG] 飛距離計算パラメータ</div>
        <div>lie: {String(lie)}</div>
        <div>windDir: {String(windDir)}</div>
        <div>windSpeed: {String(windSpeed)}</div>
        <div>playerSkillLevel: {String(playerSkillLevel)}</div>
        <div>selectedClub: {selectedClub ? JSON.stringify(selectedClub) : 'null'}</div>
        <div>clubPersonal: {clubPersonal ? JSON.stringify(clubPersonal) : 'null'}</div>
      </div>
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
                <span>Avg: {selectedClub.avgDistance} yd</span>
                <span>Success: {effectiveSuccess ? (effectiveSuccess * 100).toFixed(1) : '--'}%</span>
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
            <span className="font-bold text-green-900">Session Summary:</span>
            <span>Avg: {summary.avg.toFixed(1)} yd</span>
            <span>Success: {(summary.success * 100).toFixed(1)}%</span>
            <span>Dispersion: {summary.std.toFixed(1)} yd</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Distance</th>
                  <th className="px-2 py-1">Outcome</th>
                  <th className="px-2 py-1">Note</th>
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

      {/* Auto-Calibrate Section */}
      {results.length > 0 && (
        <div className="w-full max-w-xl flex flex-col items-center mb-4">
          <button
            className={`px-4 py-2 rounded font-semibold shadow ${calibrated ? 'bg-green-100 text-green-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            disabled={calibrated}
            onClick={handleCalibrate}
          >
            Update my personal data with this session
          </button>
          {calibrated && (
            <span className="mt-2 text-green-800 font-semibold text-sm text-center">
              Personal data updated. Your {selectedClub?.name} miss rate is now more realistic.
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
