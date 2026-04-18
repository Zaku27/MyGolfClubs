import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";

const EMPTY_SHOT_RECORDS: ShotRecord[] = [];
import { GolfBagPanel } from "../GolfBagPanel";
import "../ClubList.css";
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  useClubStore,
} from "../../store/clubStore";
import { useBagIdUrlSync } from "../../hooks/useBagIdUrlSync";
import { toSimClub } from "../../utils/clubSimAdapter";
import { calculateBaseClubSuccessRate } from "../../utils/calculateSuccessRate";
import {
  getAnalysisAdjustedBaseSuccessRate,
  isWeakClubByAnalysisAdjustedRate,
} from "../../utils/clubSuccessDisplay";
import { ClubDisplayName } from "../ClubDisplayName";
import { resolvePersonalDataForSimClub } from "../../utils/personalData";
import { formatSimClubLabel } from "../../utils/simClubLabel";
import {
  buildLieAngleAnalysis,
  buildSwingWeightAnalysis,
  buildWeightLengthAnalysis,
} from "../../utils/analysisBuilders";
import { classifyWeightDeviation } from "../../utils/analysisRules";
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  type UserLieAngleStandards,
} from "../../types/lieStandards";
import { readStoredJson, readStoredNumber } from "../../utils/storage";
import { SKILL_PRESETS, getSkillLabel } from "../../utils/playerSkill";

type DraftRow = {
  weaknessFactor: number;
};

type AnalysisPenalty = {
  points: number;
  reasons: string[];
};

type ShotRecord = {
  club: string;
  Shot: string;
  "Ball (mph)": string;
  "Club (mph)": string;
  Smash: string;
  "Carry (yds)": string;
  "Total (yds)": string;
  "Roll (yds)": string;
  "Spin (rpm)": string;
  "Height (ft)": string;
  "Time (s)": string;
  "AOA (°)": string;
  "Spin Loft (°)": string;
  "Spin Axis (°)": string;
  "Lateral (yds)": string;
  "Shot Type": string;
  "Launch H (°)": string;
  "Launch V (°)": string;
  Mode: string;
  Location: string;
  "Altitude (ft)": string;
};

const SWING_TARGET_STORAGE_KEY = "golfbag-swing-weight-target";
const SWING_GOOD_TOLERANCE_STORAGE_KEY = "golfbag-swing-good-tolerance";
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = "golfbag-swing-adjust-threshold";
const LIE_STANDARDS_STORAGE_KEY = "golfbag-user-lie-angle-standards";
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.0;
const DEFAULT_SWING_ADJUST_THRESHOLD = 1.5;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const toWeakness = (value: number): number => {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
};

const toSkillLevel = (value: number): number => {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
};

const parseUserLieAngleStandards = (value: unknown): UserLieAngleStandards => {
  if (!value || typeof value !== "object") {
    return DEFAULT_USER_LIE_ANGLE_STANDARDS;
  }

  const parsed = value as Partial<UserLieAngleStandards>;
  return {
    byClubType: parsed.byClubType ?? {},
    byClubName: parsed.byClubName ?? {},
  };
};

export function PersonalDataInput() {
  const clubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const personalData = useClubStore((state) => state.personalData);
  const playerSkillLevel = useClubStore((state) => state.playerSkillLevel);
  const loading = useClubStore((state) => state.loading);
  const error = useClubStore((state) => state.error);
  const loadClubs = useClubStore((state) => state.loadClubs);
  const loadBags = useClubStore((state) => state.loadBags);
  const initializeDefaults = useClubStore((state) => state.initializeDefaults);
  const loadPersonalData = useClubStore((state) => state.loadPersonalData);
  const loadPlayerSkillLevel = useClubStore((state) => state.loadPlayerSkillLevel);
  const loadActualShotRows = useClubStore((state) => state.loadActualShotRows);
  const setPersonalData = useClubStore((state) => state.setPersonalData);
  const setPlayerSkillLevel = useClubStore((state) => state.setPlayerSkillLevel);
  const setActualShotRows = useClubStore((state) => state.setActualShotRows);
  const actualShotRows = useClubStore((state) => state.actualShotRows);
  const setActiveBag = useClubStore((state) => state.setActiveBag);
  const swingWeightTarget = readStoredNumber(
    SWING_TARGET_STORAGE_KEY,
    DEFAULT_SWING_TARGET,
    { decimals: 1 },
  );
  const swingGoodTolerance = readStoredNumber(
    SWING_GOOD_TOLERANCE_STORAGE_KEY,
    DEFAULT_SWING_GOOD_TOLERANCE,
    { decimals: 1 },
  );
  const swingAdjustThreshold = readStoredNumber(
    SWING_ADJUST_THRESHOLD_STORAGE_KEY,
    DEFAULT_SWING_ADJUST_THRESHOLD,
    { decimals: 1 },
  );
  const userLieAngleStandards = readStoredJson(
    LIE_STANDARDS_STORAGE_KEY,
    DEFAULT_USER_LIE_ANGLE_STANDARDS,
    parseUserLieAngleStandards,
  );

  const [draftByClubId, setDraftByClubId] = useState<Record<string, DraftRow>>({});
  // 分析減点の寄与割合（重み）: 全クラブ共通
  const [analysisPenaltyWeight, setAnalysisPenaltyWeight] = useState(1.0);
  const [activeMode, setActiveMode] = useState<'skill' | 'actual'>('actual');
  const [shotRows, setShotRows] = useState<ShotRecord[]>([]);
  const [shotSearchText, setShotSearchText] = useState('');
  const [shotLoadError, setShotLoadError] = useState<string | null>(null);
  const [isLoadingShotData, setIsLoadingShotData] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });

  const parseShotValue = (value: string) => {
    const normalized = value.replace(/,/g, '').replace(/ /g, ' ').trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const formatLateralValue = (value: string | undefined) => {
    if (!value) {
      return '';
    }

    return value
      .replace(/ /g, ' ')
      .trim()
      .replace(/\bL\b/g, '左')
      .replace(/\bR\b/g, '右');
  };

  const formatBallSpeed = (value: string | undefined) => {
    if (!value) {
      return '';
    }

    const normalized = value.replace(/,/g, '').replace(/ /g, ' ').trim();
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
      return value;
    }

    const metersPerSecond = numeric * 0.44704;
    return `${metersPerSecond.toFixed(1)}`;
  };

  const mapCsvClubToSimClubLabel = (clubValue: string): string => {
    const value = clubValue.trim();
    const normalized = value.replace(/\s+/g, '').toLowerCase();

    if (/^driver$/i.test(value) || /^minidriver$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Driver', number: '' });
    }

    const woodMatch = normalized.match(/^(\d+)(wood|w)$/i);
    if (woodMatch) {
      return formatSimClubLabel({ type: 'Wood', number: woodMatch[1] });
    }

    const hybridMatch = normalized.match(/^(\d+)(hybrid|h)$/i);
    if (hybridMatch) {
      return formatSimClubLabel({ type: 'Hybrid', number: hybridMatch[1] });
    }

    const ironMatch = normalized.match(/^(\d+)(iron|i)$/i);
    if (ironMatch) {
      return formatSimClubLabel({ type: 'Iron', number: ironMatch[1] });
    }

    // Map "Pitching Wedge" to PW
    if (/^pitchingwedge$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Wedge', number: 'PW' });
    }

    // Map "Gap Wedge" to GW
    if (/^gapwedge$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Wedge', number: 'GW' });
    }

    // Map "Lob Wedge" to LW
    if (/^lobwedge$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Wedge', number: 'LW' });
    }

    if (/^(pw|gw|sw)$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Wedge', number: normalized.toUpperCase() });
    }

    if (/^(putter|p)$/i.test(normalized)) {
      return formatSimClubLabel({ type: 'Putter', number: '' });
    }

    // Already valid simulator label like Driver, 3Wood, 4Hybrid, 7Iron, PW, Putter
    if (/^(Driver|\d+Wood|\d+Hybrid|\d+Iron|PW|GW|SW|Putter)$/i.test(value)) {
      return formatSimClubLabel({ type: /^Driver$/i.test(value) ? 'Driver' : /Putter/i.test(value) ? 'Putter' : /^(PW|GW|SW)$/i.test(value) ? 'Wedge' : (/Wood/i.test(value) ? 'Wood' : /Hybrid/i.test(value) ? 'Hybrid' : 'Iron'),
        number: (() => {
          if (/^Driver$/i.test(value) || /^Putter$/i.test(value)) return '';
          const numberMatch = value.match(/^(\d+)/);
          if (numberMatch) return numberMatch[1];
          return value.toUpperCase();
        })() });
    }

    throw new Error(`クラブ名「${clubValue}」を formatSimClubLabel にマッピングできませんでした。`);
  };

  const parseShotCsvRows = (text: string): ShotRecord[] => {
    const result = Papa.parse<ShotRecord>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (result.errors.length > 0) {
      throw new Error(result.errors.map((error) => error.message).join('; '));
    }

    const rows = result.data
      .filter((row) => {
        const shotNumber = Number(row.Shot);
        return Number.isFinite(shotNumber) && shotNumber > 0;
      })
      .map((row) => {
        const normalizedClub = mapCsvClubToSimClubLabel(row.club);
        return {
          ...row,
          club: normalizedClub,
        };
      });

    if (rows.length === 0) {
      throw new Error('ショットデータが有効な形式ではありませんでした。');
    }

    return rows;
  };

  const loadShotCsvText = async (sourceUrl: string) => {
    setIsLoadingShotData(true);
    setShotLoadError(null);
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`CSVの取得に失敗しました: ${response.status}`);
      }
      const text = await response.text();
      const rows = parseShotCsvRows(text);
      setShotRows(rows);
      await setActualShotRows(rows, activeBag?.id ?? null);
    } catch (error) {
      setShotRows([]);
      await setActualShotRows([], activeBag?.id ?? null);
      setShotLoadError(`CSV読み込みエラー: ${(error as Error).message}`);
    } finally {
      setIsLoadingShotData(false);
    }
  };

  const handleLoadDefaultCsv = async () => {
    await loadShotCsvText('/2026-04-11shots.csv');
  };

  const handleImportShotCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsLoadingShotData(true);
    setShotLoadError(null);
    try {
      const text = await file.text();
      const rows = parseShotCsvRows(text);
      setShotRows(rows);
      await setActualShotRows(rows, activeBag?.id ?? null);
    } catch (error) {
      setShotRows([]);
      await setActualShotRows([], activeBag?.id ?? null);
      setShotLoadError(`CSV読み込みエラー: ${(error as Error).message}`);
    } finally {
      setIsLoadingShotData(false);
    }
  };

  const handleClearShotData = async () => {
    setShotRows([]);
    setShotLoadError(null);
    await setActualShotRows([], activeBag?.id ?? null);
  };

  const shotSummary = useMemo(() => {
    const count = shotRows.length;
    if (count === 0) {
      return null;
    }

    const accumulators = shotRows.reduce(
      (acc, row) => {
        const carry = parseShotValue(row['Carry (yds)']);
        const total = parseShotValue(row['Total (yds)']);
        const ball = parseShotValue(row['Ball (mph)']);
        const smash = parseShotValue(row.Smash);
        const spin = parseShotValue(row['Spin (rpm)']);

        if (carry != null) {
          acc.carrySum += carry;
          acc.carryCount += 1;
        }
        if (total != null) {
          acc.totalSum += total;
          acc.totalCount += 1;
        }
        if (ball != null) {
          acc.ballSum += ball;
          acc.ballCount += 1;
        }
        if (smash != null) {
          acc.smashSum += smash;
          acc.smashCount += 1;
        }
        if (spin != null) {
          acc.spinSum += spin;
          acc.spinCount += 1;
        }
        return acc;
      },
      {
        carrySum: 0,
        carryCount: 0,
        totalSum: 0,
        totalCount: 0,
        ballSum: 0,
        ballCount: 0,
        smashSum: 0,
        smashCount: 0,
        spinSum: 0,
        spinCount: 0,
      },
    );

    return {
      count,
      avgCarry: accumulators.carryCount > 0 ? accumulators.carrySum / accumulators.carryCount : null,
      avgTotal: accumulators.totalCount > 0 ? accumulators.totalSum / accumulators.totalCount : null,
      avgBall: accumulators.ballCount > 0 ? (accumulators.ballSum / accumulators.ballCount) * 0.44704 : null,
      avgSmash: accumulators.smashCount > 0 ? accumulators.smashSum / accumulators.smashCount : null,
      avgSpin: accumulators.spinCount > 0 ? accumulators.spinSum / accumulators.spinCount : null,
    };
  }, [shotRows]);

  const filteredShotRows = useMemo(() => {
    const normalizedSearch = shotSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return shotRows;
    }

    return shotRows.filter((row) => {
      return row.club.toLowerCase().includes(normalizedSearch);
    });
  }, [shotRows, shotSearchText]);

  const compareSimClubLabel = (a: string, b: string) => {
    const getRank = (label: string) => {
      if (/^Driver$/i.test(label)) return { rank: 0, value: 0 };
      const woodMatch = label.match(/^(\d+)Wood$/i);
      if (woodMatch) return { rank: 1, value: Number(woodMatch[1]) };
      const hybridMatch = label.match(/^(\d+)Hybrid$/i);
      if (hybridMatch) return { rank: 2, value: Number(hybridMatch[1]) };
      const ironMatch = label.match(/^(\d+)Iron$/i);
      if (ironMatch) return { rank: 3, value: Number(ironMatch[1]) };
      if (/^PW$/i.test(label)) return { rank: 4, value: 0 };
      if (/^GW$/i.test(label)) return { rank: 4, value: 1 };
      if (/^SW$/i.test(label)) return { rank: 4, value: 2 };
      if (/^Putter$/i.test(label)) return { rank: 5, value: 0 };
      return { rank: 6, value: 0 };
    };

    const left = getRank(a);
    const right = getRank(b);
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    if (left.value !== right.value) {
      return left.value - right.value;
    }
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  };

  const clubSearchOptions = useMemo(() => {
    return clubs
      .map((club) => formatSimClubLabel(toSimClub(club)))
      .filter((label, index, self) => self.indexOf(label) === index)
      .sort(compareSimClubLabel);
  }, [clubs]);

  const appLink = activeBag?.id != null ? `/?bagId=${activeBag.id}` : "/";

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadClubs(),
        loadBags(),
        loadPersonalData(),
        loadPlayerSkillLevel(),
        loadActualShotRows(),
      ]);
      setIsInitialized(true);
    };
    void init();
  }, [loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel, loadActualShotRows]);

  useEffect(() => {
    setShotRows(activeBag?.id != null ? (actualShotRows[String(activeBag.id)] ?? EMPTY_SHOT_RECORDS) as ShotRecord[] : EMPTY_SHOT_RECORDS);
  }, [activeBag?.id, actualShotRows]);

  useEffect(() => {
    const nextDraft: Record<string, DraftRow> = {};
    for (const club of clubs) {
      const simClub = toSimClub(club);
      const existing = resolvePersonalDataForSimClub(simClub, personalData);
      nextDraft[simClub.id] = {
        weaknessFactor: toWeakness(existing?.weaknessFactor ?? 0),
      };
    }
    setDraftByClubId(nextDraft);
  }, [clubs, personalData]);

  const analysisPenaltyByClubId = useMemo(() => {
    const penaltyMap: Record<string, AnalysisPenalty> = {};

    const addPenalty = (clubId: string, points: number, reason: string) => {
      const existing = penaltyMap[clubId] ?? { points: 0, reasons: [] };
      const nextReasons = existing.reasons.includes(reason)
        ? existing.reasons
        : [...existing.reasons, reason];
      penaltyMap[clubId] = {
        points: Math.min(20, existing.points + points),
        reasons: nextReasons,
      };
    };

    const alwaysVisible = () => true;

    // SW分布分析を無効化（SWと長さタブに統合）
    // const { tableClubs: swingTable } = buildSwingWeightAnalysis(
    //   clubs,
    //   swingWeightTarget,
    //   swingGoodTolerance,
    //   swingAdjustThreshold,
    //   alwaysVisible,
    // );
    // for (const club of swingTable) {
    //   const clubId = toSimClub(club).id;
    //   if (club.swingStatus === "調整推奨") {
    //     addPenalty(clubId, 8, "スイングウェイト: 調整推奨");
    //   } else if (club.swingStatus !== "良好") {
    //     addPenalty(clubId, 4, `スイングウェイト: ${club.swingStatus}`);
    //   }
    // }

    const { tableClubs: weightTable } = buildWeightLengthAnalysis(clubs, alwaysVisible);
    for (const club of weightTable) {
      const clubId = toSimClub(club).id;
      const weightClass = classifyWeightDeviation(club.deviation);
      if (weightClass === "heavyOutlier" || weightClass === "lightOutlier") {
        addPenalty(clubId, 6, "重量偏差: 外れ値");
      } else if (weightClass === "outOfBand") {
        addPenalty(clubId, 3, "重量偏差: トレンド外");
      }
    }

    const { tableClubs: lieTable } = buildLieAngleAnalysis(
      clubs,
      userLieAngleStandards,
      alwaysVisible,
    );
    for (const club of lieTable) {
      const clubId = toSimClub(club).id;
      if (club.lieStatus === "Adjust Recommended") {
        addPenalty(clubId, 6, "ライ角: 調整推奨");
      } else if (club.lieStatus === "Slightly Off") {
        addPenalty(clubId, 3, "ライ角: ややズレ");
      }
    }

    return penaltyMap;
  }, [
    clubs,
    // swingWeightTarget,
    // swingGoodTolerance,
    // swingAdjustThreshold,
    userLieAngleStandards,
  ]);

  const rows = useMemo(() => {
    return clubs.map((club) => {
      const simClub = toSimClub(club);
      const draft = draftByClubId[simClub.id] ?? { weaknessFactor: 0 };
      const analysisPenalty = analysisPenaltyByClubId[simClub.id]?.points ?? 0;
      const analysisPenaltyReasons = analysisPenaltyByClubId[simClub.id]?.reasons ?? [];
      // 全クラブ共通の寄与割合を反映
      const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(simClub, analysisPenalty * analysisPenaltyWeight);
      const treatedAsWeakClub = isWeakClubByAnalysisAdjustedRate(simClub, analysisPenalty * analysisPenaltyWeight);
      const effectiveSuccessRate = calculateBaseClubSuccessRate({
        baseSuccessRate: adjustedBaseSuccessRate,
        personalData: {
          clubId: simClub.id,
          weaknessFactor: draft.weaknessFactor,
        },
        isWeakClub: treatedAsWeakClub,
        playerSkillLevel,
      });

      return {
        clubId: simClub.id,
        clubType: club.clubType,
        clubNumber: club.number,
        clubName: club.name ?? '',
        treatedAsWeakClub,
        baseSuccessRate: simClub.successRate,
        adjustedBaseSuccessRate,
        analysisPenalty,
        analysisPenaltyReasons,
        penaltyWeight: analysisPenaltyWeight,
        weaknessFactor: draft.weaknessFactor,
        effectiveSuccessRate,
      };
    });
  }, [clubs, draftByClubId, playerSkillLevel, analysisPenaltyByClubId, analysisPenaltyWeight]);

  const analysisAdjustedRows = useMemo(() => {
    return rows.filter((row) => row.analysisPenalty > 0);
  }, [rows]);

  const updateDraft = async (clubId: string, patch: Partial<DraftRow>) => {
    const nextWeaknessFactor = patch.weaknessFactor ?? draftByClubId[clubId]?.weaknessFactor ?? 0;
    setDraftByClubId((prev) => ({
      ...prev,
      [clubId]: {
        weaknessFactor: nextWeaknessFactor,
      },
    }));
    await setPersonalData({
      clubId,
      weaknessFactor: nextWeaknessFactor,
    });
  };

  const handleResetDefaults = async () => {
    const resetDraft: Record<string, DraftRow> = {};
    for (const club of clubs) {
      const clubId = toSimClub(club).id;
      resetDraft[clubId] = {
        weaknessFactor: 0,
      };
    }
    setDraftByClubId(resetDraft);
    for (const club of clubs) {
      await setPersonalData({
        clubId: toSimClub(club).id,
        weaknessFactor: 0,
      });
    }
  };

  const handleSkillLevelChange = async (level: number) => {
    await setPlayerSkillLevel(toSkillLevel(level));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {!isInitialized && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            データを読み込み中...
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">シミュレーター設定</p>
            <h1 className="text-2xl font-bold text-slate-900">パーソナルデータ</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/range"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition-colors"
            >
              レンジシミュレーターへ
            </Link>
            <Link
              to={appLink}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('actual')}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              activeMode === 'actual'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            実測データ読み込み
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('skill')}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              activeMode === 'skill'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            分析ベースのパーソナルデータ
          </button>
        </div>

        <GolfBagPanel
          bags={bags}
          activeBagId={activeBag?.id ?? null}
          activeBagClubCount={activeBag?.clubIds.length ?? 0}
          onSelectBag={(bagId) => void setActiveBag(bagId)}
          description="ここで表示されるのはアクティブバッグのクラブだけです。複数バッグを使い分ける場合は切り替えて編集します。"
        />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {activeMode === 'actual' && (
          <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">実測データ読み込み</h2>
                <p className="text-sm text-slate-600">
                  FlightscopeのショットCSVを読み込み、実際のショットデータを確認します。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={handleLoadDefaultCsv}
                  disabled={isLoadingShotData}
                >
                  /2026-04-11shots.csv を読み込む
                </button> */}
                <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  ファイル選択
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={handleImportShotCsv}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={handleClearShotData}
                  disabled={isLoadingShotData || shotRows.length === 0}
                >
                  データをクリア
                </button>
              </div>
            </div>

            {shotLoadError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {shotLoadError}
              </div>
            )}

            {isLoadingShotData && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">
                CSVを読み込み中...
              </div>
            )}

            {shotRows.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-900">読み込み結果</p>
                    <div className="club-search-inline" aria-label="クラブ検索">
                      <select
                        value={shotSearchText}
                        onChange={(event) => setShotSearchText(event.target.value)}
                      >
                        <option value="">すべて</option>
                        {clubSearchOptions.map((label) => (
                          <option key={label} value={label}>{label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-clear-filter"
                        onClick={() => setShotSearchText('')}
                        disabled={!shotSearchText}
                      >
                        クリア
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                    <div>
                      <p className="text-xs text-slate-500">ショット数</p>
                      <p className="text-lg font-semibold text-slate-900">{shotSummary?.count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">平均キャリー (yd)</p>
                      <p className="text-lg font-semibold text-slate-900">{shotSummary?.avgCarry?.toFixed(1) ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">平均トータル (yd)</p>
                      <p className="text-lg font-semibold text-slate-900">{shotSummary?.avgTotal?.toFixed(1) ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">平均ボールスピード (m/s)</p>
                      <p className="text-lg font-semibold text-slate-900">{shotSummary?.avgBall?.toFixed(1) ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">平均スマッシュファクター</p>
                      <p className="text-lg font-semibold text-slate-900">{shotSummary?.avgSmash?.toFixed(2) ?? '-'} </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-left">ショット</th>
                          <th className="px-3 py-2 text-left">クラブ</th>
                          <th className="px-3 py-2 text-right">キャリー (yd)</th>
                          <th className="px-3 py-2 text-right">トータル (yd)</th>
                          <th className="px-3 py-2 text-right">ボールスピード (m/s)</th>
                          <th className="px-3 py-2 text-right">左右偏差</th>
                          <th className="px-3 py-2 text-left">ショットタイプ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShotRows.length > 0 ? (
                          filteredShotRows.slice(0, 10).map((row, index) => (
                            <tr key={`${row.club}-${row.Shot}-${index}`} className="border-t border-slate-200">
                              <td className="px-3 py-2">{row.Shot}</td>
                              <td className="px-3 py-2">{row.club}</td>
                              <td className="px-3 py-2 text-right">{parseShotValue(row['Carry (yds)'])?.toFixed(1) ?? '-'}</td>
                              <td className="px-3 py-2 text-right">{parseShotValue(row['Total (yds)'])?.toFixed(1) ?? '-'}</td>
                              <td className="px-3 py-2 text-right">{formatBallSpeed(row['Ball (mph)'])}</td>
                              <td className="px-3 py-2 text-right">{formatLateralValue(row['Lateral (yds)'])}</td>
                              <td className="px-3 py-2">{row['Shot Type']}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                              クラブ名に一致するショットが見つかりません。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredShotRows.length > 10 && (
                    <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
                      最初の 10 行を表示しています。合計 {filteredShotRows.length} 行。
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeMode === 'skill' ? (
          <>
            {analysisAdjustedRows.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">分析結果により基本成功率を下げたクラブがあります。</p>
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                      {analysisAdjustedRows.map((row) => (
                        <li key={`analysis-${row.clubId}`} className="flex flex-wrap items-baseline gap-2">
                          <ClubDisplayName
                            clubType={row.clubType}
                            number={row.clubNumber}
                            name={row.clubName}
                            className="font-medium"
                          />
                          <span className="text-amber-800">
                            -{(row.analysisPenalty * row.penaltyWeight).toFixed(1)}%（{row.analysisPenaltyReasons.join(" / ")}）
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-3 sm:min-w-[200px] sm:pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">寄与割合</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={analysisPenaltyWeight}
                        onChange={e => setAnalysisPenaltyWeight(Number(e.target.value))}
                        className="flex-1 h-2 accent-amber-700"
                      />
                      <input
                        type="number"
                        min={0}
                        max={2}
                        step={0.01}
                        value={analysisPenaltyWeight}
                        onChange={e => setAnalysisPenaltyWeight(Number(e.target.value))}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right text-slate-900 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnalysisPenaltyWeight(1.0)}
                      className="self-end rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      リセット
                    </button>
                  </div>
                </div>
              </div>
            )}


        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-emerald-900">プレイヤースキルレベル設定</h2>
              <p className="text-sm text-emerald-800 mt-1">
                現在: {getSkillLabel(playerSkillLevel)} ({playerSkillLevel.toFixed(2)})
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="w-10 text-xs text-slate-600">0.00</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={playerSkillLevel}
                  onChange={(event) => void handleSkillLevelChange(Number(event.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-emerald-200 accent-emerald-600"
                />
                <span className="w-10 text-right text-xs text-slate-600">1.00</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SKILL_PRESETS.map((preset) => {
                const isActive = Math.abs(playerSkillLevel - preset.value) < 0.01;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => void handleSkillLevelChange(preset.value)}
                    className={[
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100",
                    ].join(" ")}
                    title={`スコア目安: ${preset.score}`}
                  >
                    {preset.label}
                    <span className="ml-1 text-xs text-emerald-900">({preset.score})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">クラブ</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    <span className="relative inline-flex items-center gap-2">
                      <span>弱クラブ扱い</span>
                      <button
                        type="button"
                        aria-label="弱クラブ扱いのヒント"
                        className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-xs font-bold text-amber-700"
                      >
                        ?
                        <span className="help-tooltip-text">
                          弱クラブ扱いは「基本成功率が 65% 未満」の場合に適用されます。
                        </span>
                      </button>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">基本成功率</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <span className="relative inline-flex items-center gap-2">
                      <span>弱点係数</span>
                      <button
                        type="button"
                        aria-label="弱点係数のヒント"
                        className="help-tooltip inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-xs font-bold text-emerald-700"
                      >
                        ?
                        <span className="help-tooltip-text">
                          弱点係数はクラブごとの苦手度です。0.00 は影響なし、1.00 に近いほど成功率が下がります。
                        </span>
                      </button>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">クラブ成功率</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.clubId} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">
                      <ClubDisplayName
                        clubType={row.clubType}
                        number={row.clubNumber}
                        name={row.clubName}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.treatedAsWeakClub ? (
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          対象
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {row.adjustedBaseSuccessRate.toFixed(1)}%
                      {row.analysisPenalty > 0 && (
                        <span className="ml-1 text-xs font-normal text-amber-700">
                          (元 {row.baseSuccessRate.toFixed(1)}% / -{(row.analysisPenalty * row.penaltyWeight).toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[240px] items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={row.weaknessFactor}
                          onChange={(event) => {
                            updateDraft(row.clubId, {
                              weaknessFactor: toWeakness(Number(event.target.value)),
                            });
                          }}
                          className="w-full accent-emerald-600"
                        />
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={row.weaknessFactor}
                          onChange={(event) => {
                            updateDraft(row.clubId, {
                              weaknessFactor: toWeakness(Number(event.target.value)),
                            });
                          }}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-900 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {row.effectiveSuccessRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      バッグにクラブがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          ※ 表示対象は {activeBag?.name ?? 'アクティブバッグ'} のクラブです。
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            デフォルトにリセット
          </button>
        </div>
        </>
        ) : null}
      </div>
      </div>
    </div>
  );
}
