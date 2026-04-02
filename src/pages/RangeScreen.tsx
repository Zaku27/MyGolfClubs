import { useState } from 'react';

// ショット品質の日本語ラベル関数（ファイル先頭に定義）
function qualityLabel(q: string) {
  switch (q) {
    case "excellent": return "会心の一打！";
    case "good": return "ナイスショット！";
    case "average": return "まずまず";
    case "poor": return "ミス気味...";
    case "mishit": return "ミスショット";
    default: return q;
  }
}
import { useClubStore } from '../store/clubStore';
import { calculateEffectiveSuccessRate } from '../utils/clubUtils';
import { simulateShot, estimateShotDistance } from '../utils/shotSimulation';
import { rangeAutoCalibrate } from '../utils/rangeUtils';

const LIE_OPTIONS = [
  'フェアウェイ',
  'ラフ',
  '薄いラフ',
  'バンカー',
  'グリーン',
];
const WIND_DIRECTIONS = [
  { label: 'フォロー', value: 'tail' },
  { label: 'アゲインスト', value: 'head' },
  { label: '横風', value: 'cross' },
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
  // 打席タイプ: "robot" or "personal"
  const [seatType, setSeatType] = useState<'robot' | 'personal'>('personal');
  // ロボット用: ヘッドスピードとスキルレベル
  const [robotHeadSpeed, setRobotHeadSpeed] = useState<number>(40); // 初期値40m/s
  const [robotSkillLevel, setRobotSkillLevel] = useState<number>(0.5); // 0.0〜1.0
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
    // type/clubType補完
    let type = (club as any).type ?? club.clubType ?? "Unknown";
    // numberやnameからdriver/wood/iron/wedge/putterを推定
    if (!type || type === "Unknown") {
      const n = (club.number ?? "").toString().toLowerCase();
      if (n.includes("d") || n.includes("dr") || club.name?.toLowerCase().includes("driver")) type = "Driver";
      else if (n.includes("w") || club.name?.toLowerCase().includes("wood")) type = "Wood";
      else if (n.includes("h")) type = "Hybrid";
      else if (n.includes("p") && club.name?.toLowerCase().includes("putter")) type = "Putter";
      else if (n.match(/^[0-9]+$/)) type = "Iron";
      else type = "Iron";
    }
    // loftAngle補完（未設定や0なら推定値）
    let loftAngle = club.loftAngle;
    if (!loftAngle || loftAngle === 0) {
      if (type === "Driver") loftAngle = 10.5;
      else if (type === "Wood") loftAngle = 15;
      else if (type === "Hybrid") loftAngle = 22;
      else if (type === "Iron") loftAngle = 30;
      else if (type === "Wedge") loftAngle = 46;
      else if (type === "Putter") loftAngle = 3;
      else loftAngle = 30;
    }
    return {
      ...club,
      type,
      clubType: type,
      loftAngle,
      avgDistance: (club as any).avgDistance ?? club.distance ?? 0,
      successRate: (club as any).successRate ?? 70,
      isWeakClub: (club as any).isWeakClub ?? false,
      number: club.number ?? "",
      name: club.name ?? "",
      id: String(club.id),
    };
  };
  const simClub = toSimClub(selectedClub);
  const clubPersonal: import('../types/golf').ClubPersonalData | undefined =
    simClub && simClub.id !== undefined ? personalData[simClub.id] ?? undefined : undefined;
  // スキルレベルを個人データから取得（なければ0.5）
  const playerSkillLevel = 0.5;
  // DB保存値があればそれを優先、なければ従来通り計算値を使う
  let effectiveSuccess: number | null = null;
  if (simClub && clubPersonal) {
    if (typeof clubPersonal.effectiveSuccessRate === 'number') {
      effectiveSuccess = clubPersonal.effectiveSuccessRate / 100;
    } else {
      effectiveSuccess = calculateEffectiveSuccessRate({ ...simClub, id: Number(simClub.id) }, clubPersonal, playerSkillLevel);
    }
  }

  const handleSimulate = async () => {
    if (!simClub) return;
    setIsSimulating(true);
    const shotResults = [];
    for (let i = 0; i < numShots; i++) {
      // lieをLieTypeに変換
      let lieType: import('../types/game').LieType = 'fairway';
      switch (lie) {
        case 'フェアウェイ': lieType = 'fairway'; break;
        case 'ラフ':
        case '薄いラフ': lieType = 'rough'; break;
        case 'バンカー': lieType = 'bunker'; break;
        case 'グリーン': lieType = 'green'; break;
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

      // ロボット打席の場合はクラブ成功率100%、スキル・ヘッドスピードをロボット値で渡す
      let clubForSim = simClub;
      let options;
      if (seatType === 'robot') {
        clubForSim = { ...simClub, successRate: 100 };
        options = {
          personalData: undefined, // 個人データは使わない
          playerSkillLevel: robotSkillLevel,
          headSpeed: robotHeadSpeed,
        };
      } else {
        options = {
          personalData: clubPersonal ?? undefined,
          playerSkillLevel,
        };
      }
      const shotResult = simulateShot(clubForSim, context, riskLevel, options);
      // outcomeを追加
      let outcome = "";
      if (shotResult.penalty) {
        outcome = "Penalty";
      } else if (!shotResult.wasSuccessful) {
        outcome = "Miss";
      } else {
        outcome = "Good";
      }
      shotResults.push({ ...shotResult, outcome });
    }
    setResults(shotResults);
    // ...existing code...
    // Summary
    const distances = shotResults.map((r) => r.landing?.totalDistance ?? r.distanceHit);
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
        <h1 className="text-2xl font-bold text-green-900">練習場</h1>
        <button
          className="bg-green-200 hover:bg-green-300 text-green-900 rounded px-4 py-2 font-semibold shadow"
          onClick={() => window.history.back()}
        >
          メニューに戻る
        </button>
      </div>


      {/* 打席リスト（ロボット／個人データ）＋ロボット設定 */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
        <label className="block font-semibold mb-2">打席タイプ選択</label>
        <select
          className="w-full border rounded p-2 mb-2"
          value={seatType}
          onChange={e => setSeatType(e.target.value as 'robot' | 'personal')}
        >
          <option value="personal">個人データ</option>
          <option value="robot">ロボット</option>
        </select>

        {/* ロボット選択時のみ設定UIを表示 */}
        {seatType === 'robot' && (
          <div className="flex flex-col gap-2 mt-2 bg-green-50 rounded p-3 border border-green-200">
            <div>
              <label className="block font-semibold mb-1">ヘッドスピード (m/s)</label>
              <input
                type="number"
                min={20}
                max={60}
                step={0.1}
                value={robotHeadSpeed}
                onChange={e => setRobotHeadSpeed(Number(e.target.value))}
                className="w-32 border rounded p-1 mr-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">スキルレベル</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={robotSkillLevel}
                onChange={e => setRobotSkillLevel(Number(e.target.value))}
                className="w-40 accent-green-700"
              />
              <span className="ml-2">{(robotSkillLevel * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ...既存のクラブ選択UI... */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
        <label className="block font-semibold mb-2">クラブ選択</label>
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
              <option value="">-- クラブを選択 --</option>
              {clubs
                .filter(club => club.clubType !== 'Putter')
                .sort((a, b) => (a.loftAngle ?? 999) - (b.loftAngle ?? 999))
                .map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} ({club.number})
                  </option>
                ))}
            </select>
            {selectedClub && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-green-900 text-sm">
                <span className="font-bold">{selectedClub.name}</span>
                <span>
                  目安: {simClub ? (
                    seatType === 'robot'
                      ? estimateShotDistance(
                          { ...simClub, successRate: 100 },
                          { lie: lie as any, wind: windDir as any, windStrength: windSpeed },
                          "normal",
                          { personalData: undefined, headSpeed: robotHeadSpeed, useTheoretical: true }
                        )
                      : estimateShotDistance(
                          simClub,
                          { lie: lie as any, wind: windDir as any, windStrength: windSpeed },
                          "normal",
                          { personalData: clubPersonal, headSpeed: undefined, useTheoretical: true }
                        )
                  ) : '-'} ヤード
                </span>
                <span>
                  有効成功率: {
                    simClub ? (
                      seatType === 'robot'
                        ? (() => {
                            // ロボット用: successRate=100, personalDataなし, スキルレベルはrobotSkillLevel
                            const robotEffective = calculateEffectiveSuccessRate(
                              simClub as any,
                              undefined,
                              robotSkillLevel
                            );
                            return (robotEffective * 100).toFixed(1);
                          })()
                        : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? (effectiveSuccess * 100).toFixed(1) : '--')
                    ) : '--'
                  }%
                </span>
              </div>
            )}

          </>
        )}
      </div>

      {/* Conditions Panel */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4 flex flex-col gap-3">
        <div>
          <label className="block font-semibold mb-1">ライ</label>
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
          <label className="font-semibold">風</label>
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
          <label className="block font-semibold mb-1">試行回数</label>
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
        {isSimulating ? 'シミュレーション中...' : `ショット実行（${numShots}回）`}
      </button>

      {/* Results Section */}
      {results.length > 0 && summary && (
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
                  <th className="px-2 py-1">キャリー</th>
                  <th className="px-2 py-1">ラン</th>
                  <th className="px-2 py-1">横ブレ</th>
                  <th className="px-2 py-1">着地X</th>
                  <th className="px-2 py-1">着地Y</th>
                  <th className="px-2 py-1">ショット品質</th>
                  <th className="px-2 py-1">結果</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-1 text-center">{i + 1}</td>
                    <td className="px-2 py-1 text-center">{(r.landing?.totalDistance ?? r.distanceHit).toFixed(1)}</td>
                    <td className="px-2 py-1 text-center">{r.landing?.carry?.toFixed(1) ?? '-'}</td>
                    <td className="px-2 py-1 text-center">{r.landing?.roll?.toFixed(1) ?? '-'}</td>
                    <td className="px-2 py-1 text-center">{r.landing?.lateralDeviation?.toFixed(1) ?? '-'}</td>
                    <td className="px-2 py-1 text-center">{r.landing?.finalX?.toFixed(1) ?? '-'}</td>
                    <td className="px-2 py-1 text-center">{r.landing?.finalY?.toFixed(1) ?? '-'}</td>
                    <td className="px-2 py-1 text-center">{qualityLabel(r.shotQuality)}</td>
                    <td className={`px-2 py-1 text-center font-bold ${outcomeColor(r.outcome)}`}>{r.outcome}</td>
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
