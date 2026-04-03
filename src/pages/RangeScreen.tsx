import { useEffect, useRef, useState } from 'react';
import { GolfBagPanel } from '../components/GolfBagPanel';

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
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  selectSortedClubsForDisplay,
  useClubStore,
} from '../store/clubStore';
import { useBagIdUrlSync } from '../hooks/useBagIdUrlSync';
import { useUserProfileStore } from '../store/userProfileStore';
import { calculateEffectiveSuccessRate } from '../utils/clubUtils';
import { formatGolfClubDisplayName } from '../utils/simClubLabel';
import { simulateShot, estimateBaseDistance, getLieDistanceMultiplierValue } from '../utils/shotSimulation';
import { rangeAutoCalibrate } from '../utils/rangeUtils';
import ShotDispersionChart from '../components/ShotDispersionChart';
import WindDirectionDial from '../components/WindDirectionDial';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';
import type { LieType, RiskLevel, ShotResult, WindDirection } from '../types/game';
import type { GolfClub } from '../types/golf';
import {
  convertMpsToMph,
  formatWindDirectionLabel,
  mapWindDirectionToLegacyType,
  normalizeWindDirection,
  normalizeWindSpeedMps,
} from '../utils/windDirection';

const LIE_OPTIONS = [
  'ティー',
  'フェアウェイ',
  'セミラフ',
  'ラフ',
  'ベアグラウンド',
  'バンカー',
  'グリーン',
];
const SHOT_COUNTS = [5, 10, 20];

const RANGE_PLAYER_SETTINGS_KEY = 'rangePlayerSettings';
const RANGE_CONDITION_SETTINGS_KEY = 'rangeConditionSettings';

type RangePlayerSettings = {
  seatType: 'robot' | 'personal';
  robotHeadSpeed: number;
  robotSkillLevel: number;
};

type RangeConditionSettings = {
  lie: string;
  windDirection: number;
  windSpeed: number;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function loadRangePlayerSettings(): RangePlayerSettings {
  if (typeof window === 'undefined') {
    return {
      seatType: 'personal',
      robotHeadSpeed: 40,
      robotSkillLevel: 0.5,
    };
  }

  try {
    const raw = localStorage.getItem(RANGE_PLAYER_SETTINGS_KEY);
    if (!raw) {
      return {
        seatType: 'personal',
        robotHeadSpeed: 40,
        robotSkillLevel: 0.5,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RangePlayerSettings>;
    return {
      seatType: parsed.seatType === 'robot' ? 'robot' : 'personal',
      robotHeadSpeed: clampNumber(Number(parsed.robotHeadSpeed), 20, 60),
      robotSkillLevel: clampNumber(Number(parsed.robotSkillLevel), 0, 1),
    };
  } catch {
    return {
      seatType: 'personal',
      robotHeadSpeed: 40,
      robotSkillLevel: 0.5,
    };
  }
}

function saveRangePlayerSettings(settings: RangePlayerSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RANGE_PLAYER_SETTINGS_KEY, JSON.stringify(settings));
}

function loadRangeConditionSettings(): RangeConditionSettings {
  if (typeof window === 'undefined') {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
    };
  }

  try {
    const raw = localStorage.getItem(RANGE_CONDITION_SETTINGS_KEY);
    if (!raw) {
      return {
        lie: 'ティー',
        windDirection: 180,
        windSpeed: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<RangeConditionSettings>;
    const safeLie = LIE_OPTIONS.includes(String(parsed.lie)) ? String(parsed.lie) : 'ティー';

    return {
      lie: safeLie,
      windDirection: normalizeWindDirection(Number(parsed.windDirection)),
      windSpeed: normalizeWindSpeedMps(Number(parsed.windSpeed)),
    };
  } catch {
    return {
      lie: 'ティー',
      windDirection: 180,
      windSpeed: 0,
    };
  }
}

function saveRangeConditionSettings(settings: RangeConditionSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    RANGE_CONDITION_SETTINGS_KEY,
    JSON.stringify({
      lie: settings.lie,
      windDirection: normalizeWindDirection(settings.windDirection),
      windSpeed: normalizeWindSpeedMps(settings.windSpeed),
    }),
  );
}

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
  avgToTargetDistance: number;
};

function mapLieUiToGameLie(lie: string): LieType {
  switch (lie) {
    case 'ティー': return 'tee';
    case 'フェアウェイ': return 'fairway';
    case 'セミラフ': return 'semirough';
    case 'ラフ': return 'rough';
    case 'ベアグラウンド': return 'bareground';
    case 'バンカー': return 'bunker';
    case 'グリーン': return 'green';
    default: return 'tee';
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

function getSelectableRangeClubs(
  clubs: GolfClub[],
  seatType: 'robot' | 'personal',
): GolfClub[] {
  const filtered = clubs.filter((club) => seatType === 'robot' || club.clubType !== 'Putter');

  return [...filtered].sort((a, b) => {
    if (seatType === 'robot') {
      const aIsPutter = a.clubType === 'Putter';
      const bIsPutter = b.clubType === 'Putter';
      if (aIsPutter && !bIsPutter) return 1;
      if (!aIsPutter && bIsPutter) return -1;
    }

    return (a.loftAngle ?? 999) - (b.loftAngle ?? 999);
  });
}

export default function RangeScreen() {
  const allClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const personalData = useClubStore((state) => state.personalData);
  const initializeDefaults = useClubStore((state) => state.initializeDefaults);
  const loadClubs = useClubStore((state) => state.loadClubs);
  const loadBags = useClubStore((state) => state.loadBags);
  const loadPersonalData = useClubStore((state) => state.loadPersonalData);
  const loadPlayerSkillLevel = useClubStore((state) => state.loadPlayerSkillLevel);
  const storedPlayerSkillLevel = useClubStore((state) => state.playerSkillLevel);
  const setActiveBag = useClubStore((state) => state.setActiveBag);
  const { profile } = useUserProfileStore();
  const initialRangePlayerSettings = loadRangePlayerSettings();
  const initialRangeConditionSettings = loadRangeConditionSettings();
  // const { playerSkillLevel } = useGameStore();
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  // プレイヤー: "robot" or "personal"
  const [seatType, setSeatType] = useState<'robot' | 'personal'>(initialRangePlayerSettings.seatType);
  // ロボット用: ヘッドスピードとスキルレベル
  const [robotHeadSpeed, setRobotHeadSpeed] = useState<number>(initialRangePlayerSettings.robotHeadSpeed);
  const [robotSkillLevel, setRobotSkillLevel] = useState<number>(initialRangePlayerSettings.robotSkillLevel);
  const [lie, setLie] = useState<string>(initialRangeConditionSettings.lie);
  // 風向は 0〜359 度（0°=北、時計回り）で保持する。
  const [windDirection, setWindDirection] = useState<number>(initialRangeConditionSettings.windDirection);
  // 風速は UI 仕様どおり m/s で保持する。
  const [windSpeed, setWindSpeed] = useState<number>(initialRangeConditionSettings.windSpeed);
  // 風ダイアルは通常閉じ、必要な時だけ開いて調整できるようにする。
  const [isWindControlOpen, setIsWindControlOpen] = useState<boolean>(false);
  const [numShots, setNumShots] = useState<number>(10);
  const [results, setResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [reuseLastSeed, setReuseLastSeed] = useState(false);
  const [lastSimulationSeedNonce, setLastSimulationSeedNonce] = useState<string | null>(null);
  const [showRobotHint, setShowRobotHint] = useState(false);
  const robotHintRef = useRef<HTMLDivElement | null>(null);
  const monteCarloResult = buildMonteCarloResult(results);
  const chartTarget = { x: 0, y: summary?.estimatedDist ?? 0 };
  const skillLevelName =
    seatType === 'robot' ? `Robot Skill ${(robotSkillLevel * 100).toFixed(0)}%` : 'Personal Skill';
  const personalHeadSpeed = profile.headSpeed;
  const personalSkillLevel = storedPlayerSkillLevel;
  const clubs = seatType === 'personal' ? activeBagClubs : allClubs;
  const selectableClubs = getSelectableRangeClubs(clubs, seatType);

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });
  const gameLie = mapLieUiToGameLie(lie);
  // 既存シミュレーション API 互換のため、角度風向を旧3分類へ変換する。
  const gameWind: WindDirection = mapWindDirectionToLegacyType(windDirection);
  // 既存シミュレーションは mph 前提なので、UI(m/s)から変換して渡す。
  const windSpeedMph = convertMpsToMph(windSpeed);
  // 閉じた状態でも現在値が分かるよう、角度+方位ラベルを作って表示する。
  const windDirectionSummary = formatWindDirectionLabel(windDirection);

  // 風向・風速を初期状態へ戻す。
  const handleResetWind = () => {
    setWindDirection(0);
    setWindSpeed(0);
  };

  useEffect(() => {
    const initializeScreen = async () => {
      await initializeDefaults();
      await Promise.all([
        loadClubs(),
        loadBags(),
        loadPersonalData(),
        loadPlayerSkillLevel(),
      ]);
    };

    void initializeScreen();
  }, [initializeDefaults, loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel]);

  useEffect(() => {
    if (clubs.length === 0) {
      if (selectedClubId !== '') {
        setSelectedClubId('');
      }
      return;
    }

    const hasSelectedClub = selectableClubs.some((club) => String(club.id) === String(selectedClubId));
    if (hasSelectedClub) {
      return;
    }

    const firstPlayableClub = selectableClubs[0] ?? null;
    setSelectedClubId(firstPlayableClub?.id != null ? String(firstPlayableClub.id) : '');
  }, [selectableClubs, selectedClubId]);

  useEffect(() => {
    saveRangePlayerSettings({
      seatType,
      robotHeadSpeed,
      robotSkillLevel,
    });
  }, [seatType, robotHeadSpeed, robotSkillLevel]);

  useEffect(() => {
    saveRangeConditionSettings({
      lie,
      windDirection,
      windSpeed,
    });
  }, [lie, windDirection, windSpeed]);

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
  const lieDistanceMultiplier = getLieDistanceMultiplierValue(gameLie, simClub?.type ?? 'Iron');
  const clubPersonal: import('../types/golf').ClubPersonalData | undefined =
    simClub && simClub.id !== undefined ? personalData[simClub.id] ?? undefined : undefined;
  // DB保存値があればそれを優先、なければ従来通り計算値を使う
  let effectiveSuccess: number | null = null;
  if (simClub && clubPersonal) {
    if (typeof clubPersonal.effectiveSuccessRate === 'number') {
      effectiveSuccess = clubPersonal.effectiveSuccessRate / 100;
    } else {
      effectiveSuccess = calculateEffectiveSuccessRate({ ...simClub, id: Number(simClub.id) }, clubPersonal, personalSkillLevel);
    }
  }

  const handleSimulate = async () => {
    if (!simClub) return;
    setIsSimulating(true);
    const shotResults: ShotResult[] = [];
    const simulationSeedNonce = reuseLastSeed && lastSimulationSeedNonce
      ? lastSimulationSeedNonce
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setLastSimulationSeedNonce(simulationSeedNonce);
    for (let i = 0; i < numShots; i++) {
      const context = {
        lie: gameLie,
        wind: gameWind,
        windDirectionDegrees: windDirection,
        // Range 画面の入力は m/s だが、内部計算は互換のため mph を利用する。
        windStrength: windSpeedMph,
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
          seedNonce: simulationSeedNonce,
          skillWeights: profile.skillWeights,
        };
      } else {
        options = {
          personalData: clubPersonal ?? undefined,
          playerSkillLevel: personalSkillLevel,
          headSpeed: personalHeadSpeed ?? undefined,
          shotIndex: i,
          seedNonce: simulationSeedNonce,
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
        ? estimateBaseDistance(
            { ...simClub, successRate: 100 },
            robotHeadSpeed,
            undefined,
            true
          )
        : estimateBaseDistance(
            simClub,
            personalHeadSpeed ?? undefined,
            undefined,
            false
          )
      : 0;
    const diff = Math.round(avg - estimatedDist);
    const avgToTargetDistance =
      shotResults.reduce((sum, result) => {
        const finalX = result.landing?.finalX ?? 0;
        const finalY = result.landing?.finalY ?? (result.landing?.totalDistance ?? result.distanceHit ?? 0);
        const dx = finalX;
        const dy = finalY - estimatedDist;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / Math.max(1, shotResults.length);

    setSummary({ avg, std, success, estimatedDist, diff, avgToTargetDistance });
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


      {/* 打席リスト（ロボット／ユーザー）＋ロボット設定 */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
        <label className="block font-semibold mb-2">プレイヤー選択</label>
        <select
          className="w-full border rounded p-2 mb-2"
          value={seatType}
          onChange={e => setSeatType(e.target.value as 'robot' | 'personal')}
        >
          <option value="personal">ユーザー</option>
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

        {seatType === 'personal' && (
          <div className="flex flex-col gap-2 mt-2 bg-green-50 rounded p-3 border border-green-200 text-sm text-green-900">
            <span className="text-xs text-green-700">
              ユーザーの値は個人データ入力画面で保存された設定を使用します。
            </span>
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

      {seatType === 'personal' && (
        <div className="w-full max-w-xl">
          <GolfBagPanel
            bags={bags}
            activeBagId={activeBag?.id ?? null}
            activeBagClubCount={activeBag?.clubIds.length ?? 0}
            totalClubCount={allClubs.length}
            onSelectBag={(bagId) => void setActiveBag(bagId)}
            showManagement={false}
            compact
            title="練習するバッグ"
            description="個人データではバッグ内クラブを使用します。ロボットでは全クラブを使用します。"
          />
        </div>
      )}

      {/* ...既存のクラブ選択UI... */}
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4">
        <label className="block font-semibold mb-2">クラブ選択</label>
        <div className="mb-2 text-xs text-gray-500">
          クラブ本数: {clubs.length}
          {seatType === 'personal' && activeBag ? ` ・ ${activeBag.name}` : ''}
        </div>
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
                  推定飛距離: {simClub ? (
                    seatType === 'robot'
                      ? estimateBaseDistance(
                          { ...simClub, successRate: 100 },
                          robotHeadSpeed,
                          undefined,
                          true
                        )
                      : estimateBaseDistance(
                          simClub,
                          personalHeadSpeed ?? undefined,
                          undefined,
                          false
                        )
                  ) : '-'} y
                </span>
                <div ref={robotHintRef} className="relative">
                  <span className="inline-flex items-center gap-2">
                    <span>
                      クラブ成功率: {
                        simClub ? (
                          seatType === 'robot'
                            ? '100% (ロボット固定)'
                            : (clubPersonal && effectiveSuccess !== null && effectiveSuccess !== undefined ? (effectiveSuccess * 100).toFixed(1) : '--') + '%'
                        ) : '--'
                      }
                    </span>
                    {seatType === 'robot' && (
                      <button
                        type="button"
                        aria-label="ロボット打席のクラブ成功率ヒント"
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
                      ロボット打席はクラブの個体差や個人データの影響を受けないため、クラブ成功率は常に100%で固定されます。
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
          <p className="mt-1 text-xs text-gray-600">
            飛距離補正: ×{lieDistanceMultiplier.toFixed(2)}
          </p>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="font-semibold">風向・風速</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                onClick={handleResetWind}
              >
                風をリセット
              </button>
              <button
                type="button"
                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100"
                onClick={() => setIsWindControlOpen((prev) => !prev)}
                aria-expanded={isWindControlOpen}
                aria-controls="wind-direction-dial-panel"
              >
                {isWindControlOpen ? '設定を閉じる' : '設定を開く'}
              </button>
            </div>
          </div>

          {/*
            通常時は数値サマリーのみ表示して画面をコンパクトに保つ。
            設定が必要な時だけダイアルを展開する。
          */}
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            <span className="mr-3 font-semibold">風向: {windDirectionSummary}</span>
            <span className="font-semibold">風速: {windSpeed.toFixed(1)} m/s</span>
          </div>

          {isWindControlOpen && (
            <div id="wind-direction-dial-panel" className="mt-2">
              <WindDirectionDial
                windDirection={windDirection}
                windSpeed={windSpeed}
                onDirectionChange={(newDirection) => {
                  // 子コンポーネントの入力値を安全に正規化して保持する。
                  setWindDirection(normalizeWindDirection(newDirection));
                }}
                onSpeedChange={(newSpeed) => {
                  // 速度値は 0〜15 m/s に収める。
                  setWindSpeed(normalizeWindSpeedMps(newSpeed));
                }}
              />
            </div>
          )}
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
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label htmlFor="reuse-last-seed" className="block font-semibold text-green-900">
                再実行時の乱数
              </label>
              <p className="text-xs text-gray-600">
                {reuseLastSeed
                  ? '前回と同じ乱数で再実行します。条件が同じなら結果も再現されます。'
                  : '毎回新しい乱数で再実行します。'}
              </p>
            </div>
            <label htmlFor="reuse-last-seed" className="inline-flex cursor-pointer items-center gap-2">
              <span className={`text-sm font-medium ${reuseLastSeed ? 'text-green-900' : 'text-gray-500'}`}>
                同じ乱数
              </span>
              <span className="relative inline-flex items-center">
                <input
                  id="reuse-last-seed"
                  type="checkbox"
                  className="peer sr-only"
                  checked={reuseLastSeed}
                  onChange={(e) => setReuseLastSeed(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-green-600" />
                <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
              <span className={`text-sm font-medium ${reuseLastSeed ? 'text-gray-500' : 'text-green-900'}`}>
                新しい乱数
              </span>
            </label>
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
            <span>平均: {summary.avg.toFixed(1)} y</span>
            <span>成功率: {(summary.success * 100).toFixed(1)}%</span>
            <span>目標まで平均距離: {(summary.avgToTargetDistance ?? 0).toFixed(1)} y</span>
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
              <span>目安: {summary.estimatedDist} y / 実績平均: {summary.avg.toFixed(1)} y</span>
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
