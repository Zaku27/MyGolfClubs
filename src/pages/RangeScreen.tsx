import { useEffect, useRef, useState } from 'react';

// ショット品質の英語ラベル関数
function qualityLabel(q: string) {
  switch (q) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "average": return "Average";
    case "poor": return "Poor";
    case "mishit": return "Mishit";
    default: return q;
  }
}
import { useClubStore } from '../store/clubStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { calculateEffectiveSuccessRate } from '../utils/clubUtils';
import { simulateShot, estimateShotDistance } from '../utils/shotSimulation';
import { rangeAutoCalibrate } from '../utils/rangeUtils';
import ShotDispersionChart from '../components/ShotDispersionChart';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';
import type { LieType, RiskLevel, ShotResult, WindDirection } from '../types/game';

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

const qualityStatusColor = (shotQuality: string) => {
  if (shotQuality === 'excellent') return 'text-blue-700';
  if (shotQuality === 'good') return 'text-green-700';
  if (shotQuality === 'average') return 'text-amber-600';
  if (shotQuality === 'poor') return 'text-pink-600';
  if (shotQuality === 'mishit') return 'text-red-600';
  return 'text-gray-700';
};

type RangeSummary = {
  avg: number;
  std: number;
  success: number;
  estimatedDist: number;
  diff: number;
};

function mapLieUiToGameLie(lie: string): LieType {
  switch (lie) {
    case 'フェアウェイ': return 'fairway';
    case 'ラフ':
    case '薄いラフ': return 'rough';
    case 'バンカー': return 'bunker';
    case 'グリーン': return 'green';
    default: return 'fairway';
  }
}

function mapWindDirToGameWind(windDir: string): WindDirection {
  switch (windDir) {
    case 'head': return 'headwind';
    case 'tail': return 'tailwind';
    case 'cross': return 'crosswind';
    default: return 'none';
  }
}

function toLandingResult(raw: ShotResult): LandingResult | null {
  const landing = raw?.landing;
  if (!landing) return null;

  const finalX = Number(landing.finalX);
  const finalY = Number(landing.finalY);
  if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) return null;

  const carry = Number(landing.carry);
  const roll = Number(landing.roll);
  const totalDistance = Number(landing.totalDistance);
  const lateralDeviation = Number(landing.lateralDeviation);

  return {
    carry: Number.isFinite(carry) ? carry : finalY,
    roll: Number.isFinite(roll) ? roll : 0,
    totalDistance: Number.isFinite(totalDistance) ? totalDistance : finalY,
    lateralDeviation: Number.isFinite(lateralDeviation) ? lateralDeviation : finalX,
    finalX,
    finalY,
    qualityMetrics: landing.qualityMetrics,
    apexHeight: landing.apexHeight,
    trajectoryPoints: landing.trajectoryPoints,
  };
}

function buildMonteCarloResult(rawResults: ShotResult[]): MonteCarloResult {
  const shots = rawResults
    .map((r) => toLandingResult(r))
    .filter((shot): shot is LandingResult => shot !== null);

  if (shots.length === 0) {
    return {
      shots: [],
      stats: {
        meanX: 0,
        meanY: 0,
        stdDevX: 0,
        stdDevY: 0,
        correlation: 0,
      },
    };
  }

  const meanX = shots.reduce((sum, shot) => sum + shot.finalX, 0) / shots.length;
  const meanY = shots.reduce((sum, shot) => sum + shot.finalY, 0) / shots.length;
  const varianceX = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) ** 2, 0) / shots.length;
  const varianceY = shots.reduce((sum, shot) => sum + (shot.finalY - meanY) ** 2, 0) / shots.length;
  const covariance = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) * (shot.finalY - meanY), 0) / shots.length;
  const stdDevX = Math.sqrt(varianceX);
  const stdDevY = Math.sqrt(varianceY);

  // X/Y のばらつきの連動を相関係数として保持しておくと、
  // 可視化側で軸平行ではない回転楕円を描ける。
  const correlation = stdDevX > 0 && stdDevY > 0 ? covariance / (stdDevX * stdDevY) : 0;

  return {
    shots,
    stats: {
      meanX,
      meanY,
      stdDevX,
      stdDevY,
      correlation,
    },
  };
}

export default function RangeScreen() {
  const { clubs, personalData } = useClubStore();
  const { profile } = useUserProfileStore();
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
  const [results, setResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showRobotHint, setShowRobotHint] = useState(false);
  const robotHintRef = useRef<HTMLDivElement | null>(null);
  const monteCarloResult = buildMonteCarloResult(results);
  const chartTarget = { x: 0, y: summary?.estimatedDist ?? 0 };
  const skillLevelName =
    seatType === 'robot' ? `Robot Skill ${(robotSkillLevel * 100).toFixed(0)}%` : 'Personal Skill';
  const gameLie = mapLieUiToGameLie(lie);
  const gameWind = mapWindDirToGameWind(windDir);

  useEffect(() => {
    if (!showRobotHint) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (robotHintRef.current && !robotHintRef.current.contains(targetNode)) {
        setShowRobotHint(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showRobotHint]);

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
    const shotResults: ShotResult[] = [];
    for (let i = 0; i < numShots; i++) {
      const context = {
        lie: gameLie,
        wind: gameWind,
        windStrength: windSpeed,
        remainingDistance: simClub.avgDistance,
        hazards: [],
        shotPowerPercent: 100,
      };
      const riskLevel: RiskLevel = 'normal';

      // ロボット打席の場合はクラブ成功率100%、スキル・ヘッドスピードをロボット値で渡す
      let clubForSim = simClub;
      let options;
      if (seatType === 'robot') {
        clubForSim = { ...simClub, successRate: 100 };
        options = {
          personalData: undefined, // 個人データは使わない
          playerSkillLevel: robotSkillLevel,
          headSpeed: robotHeadSpeed,
          shotIndex: i,
          skillWeights: profile.skillWeights,
        };
      } else {
        options = {
          personalData: clubPersonal ?? undefined,
          playerSkillLevel,
          shotIndex: i,
          skillWeights: profile.skillWeights,
        };
      }
      const shotResult = simulateShot(clubForSim, context, riskLevel, options);
      shotResults.push(shotResult);
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

    // 目安値との差分を計算
    const estimatedDist = simClub
      ? seatType === 'robot'
        ? estimateShotDistance(
            { ...simClub, successRate: 100 },
            { lie: gameLie, wind: gameWind, windStrength: windSpeed },
            "normal",
            { personalData: undefined, headSpeed: robotHeadSpeed, useTheoretical: true }
          )
        : estimateShotDistance(
            simClub,
            { lie: gameLie, wind: gameWind, windStrength: windSpeed },
            "normal",
            { personalData: clubPersonal, headSpeed: undefined, useTheoretical: false }
          )
      : 0;
    const diff = Math.round(avg - estimatedDist);

    setSummary({ avg, std, success, estimatedDist, diff });
    setCalibrated(false);
    setIsSimulating(false);
  };

  const handleCalibrate = () => {
    if (!simClub || !results.length || !clubPersonal) return;
    const calibrationResults = results.map((result) => ({
      outcome: result.penalty ? 'Penalty' : result.wasSuccessful ? 'Success' : 'Miss',
      distance: result.distanceHit,
    }));
    rangeAutoCalibrate({ ...simClub, id: Number(simClub.id) }, clubPersonal, calibrationResults);
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
          <div className="flex flex-col gap-2 mt-2 bg-blue-50 rounded p-3 border border-blue-300">
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

        {/* 個人データ打席のみ、スキル合成の重み調整を表示する */}
        {seatType !== 'robot' && (
          <div className="mt-4 pt-4 border-t border-green-200">
            <label className="block font-semibold mb-2">スキル合成の重み</label>
            <div className="flex flex-col gap-3 bg-blue-50 rounded p-3 border border-blue-200">
              <div>
                <label className="block text-sm font-medium mb-1">
                  基本スキル重み: {(profile.skillWeights?.baseSkillWeight ?? 0.35).toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={profile.skillWeights?.baseSkillWeight ?? 0.35}
                  onChange={e => {
                    const { setSkillWeights } = useUserProfileStore.getState();
                    setSkillWeights(
                      Number(e.target.value),
                      profile.skillWeights?.effectiveRateWeight ?? 0.65
                    );
                  }}
                  className="w-full accent-blue-600"
                />
                <span className="text-xs text-gray-600">← 低 | 高 →</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  成功率重み: {(profile.skillWeights?.effectiveRateWeight ?? 0.65).toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={profile.skillWeights?.effectiveRateWeight ?? 0.65}
                  onChange={e => {
                    const { setSkillWeights } = useUserProfileStore.getState();
                    setSkillWeights(
                      profile.skillWeights?.baseSkillWeight ?? 0.35,
                      Number(e.target.value)
                    );
                  }}
                  className="w-full accent-blue-600"
                />
                <span className="text-xs text-gray-600">← 低 | 高 →</span>
              </div>
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
                          { lie: gameLie, wind: gameWind, windStrength: windSpeed },
                          "normal",
                          { personalData: undefined, headSpeed: robotHeadSpeed, useTheoretical: true }
                        )
                      : estimateShotDistance(
                          simClub,
                          { lie: gameLie, wind: gameWind, windStrength: windSpeed },
                          "normal",
                           { personalData: clubPersonal, headSpeed: undefined, useTheoretical: false }
                        )
                  ) : '-'} ヤード
                </span>
                <div ref={robotHintRef} className="relative">
                  <span className="inline-flex items-center gap-2">
                    <span>
                      有効成功率: {
                        simClub ? (
                          seatType === 'robot'
                            ? '100 (ロボット固定)'
                            : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? (effectiveSuccess * 100).toFixed(1) : '--') + '%'
                        ) : '--'
                      }
                    </span>
                    {seatType === 'robot' && (
                      <button
                        type="button"
                        aria-label="ロボット打席の有効成功率ヒント"
                        aria-expanded={showRobotHint}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-xs font-bold text-blue-700"
                        onClick={() => setShowRobotHint((prev) => !prev)}
                      >
                        ?
                      </button>
                    )}
                  </span>
                  {seatType === 'robot' && showRobotHint && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-blue-300 bg-white p-2 text-xs leading-relaxed text-blue-900 shadow-lg">
                      ロボット打席はクラブの個体差や個人データの影響を受けないため、有効成功率は常に100%で固定されます。
                    </div>
                  )}
                </div>
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
          <div className="mb-4 rounded border border-green-200 bg-green-50/40 p-2">
            <ShotDispersionChart
              monteCarloResult={monteCarloResult}
              target={chartTarget}
              clubName={selectedClub?.name ?? 'Club'}
              skillLevelName={skillLevelName}
              numShots={numShots}
            />
          </div>
          {summary.estimatedDist && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <span className="font-semibold">目安との比較：</span>
              <span>目安: {summary.estimatedDist} ヤード / 実績平均: {summary.avg.toFixed(1)} ヤード</span>
              <span className={summary.diff > 0 ? 'text-red-600 font-bold' : summary.diff < 0 ? 'text-blue-600 font-bold' : ''}>
                {summary.diff > 0 ? ` (+${summary.diff}y)` : summary.diff < 0 ? ` (${summary.diff}y)` : ' (一致)'}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-100">
                  <th className="px-1 py-0.5">#</th>
                  <th className="px-1 py-0.5">飛距離</th>
                  <th className="px-1 py-0.5">キャリー</th>
                  <th className="px-1 py-0.5">ラン</th>
                  <th className="px-1 py-0.5">横ブレ</th>
                  <th className="px-1 py-0.5">判定値</th>
                  <th className="px-1 py-0.5">判定内訳(C/L)</th>
                  <th className="px-1 py-0.5">着地X</th>
                  <th className="px-1 py-0.5">着地Y</th>
                  <th className="px-1 py-0.5">ショット品質</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="px-1 py-0.5 text-center">{(r.landing?.totalDistance ?? r.distanceHit).toFixed(1)}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.carry?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.roll?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.lateralDeviation?.toFixed(1) ?? '-'}</td>
                    <td className={`px-1 py-0.5 text-center ${r.landing?.qualityMetrics && r.landing.qualityMetrics.score >= r.landing.qualityMetrics.poorThreshold ? 'text-red-600 font-bold' : ''}`}>
                      {r.landing?.qualityMetrics ? `${r.landing.qualityMetrics.score.toFixed(2)} / ${r.landing.qualityMetrics.poorThreshold.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      {r.landing?.qualityMetrics ? (
                        <>
                          <span className={r.landing.qualityMetrics.decisiveAxis === 'carry' ? 'text-red-600 font-bold' : ''}>
                            {r.landing.qualityMetrics.weightedCarry.toFixed(2)}
                          </span>
                          {' / '}
                          <span className={r.landing.qualityMetrics.decisiveAxis === 'lateral' ? 'text-red-600 font-bold' : ''}>
                            {r.landing.qualityMetrics.weightedLateral.toFixed(2)}
                          </span>
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.finalX?.toFixed(1) ?? '-'}</td>
                    <td className="px-1 py-0.5 text-center">{r.landing?.finalY?.toFixed(1) ?? '-'}</td>
                    <td className={`px-1 py-0.5 text-center font-bold ${qualityStatusColor(r.shotQuality)}`}>{qualityLabel(r.shotQuality)}</td>
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
