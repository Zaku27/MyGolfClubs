import { useEffect, useMemo, useState } from "react";
import { useUserProfileStore } from "../../store/userProfileStore";
import { Link } from "react-router-dom";
import type { ClubPersonalData } from "../../types/golf";
import { GolfBagPanel } from "../GolfBagPanel";
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
import { resolvePersonalDataForSimClub } from "../../utils/personalData";
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

type DraftRow = {
  weaknessFactor: number;
};

type AnalysisPenalty = {
  points: number;
  reasons: string[];
};

const SKILL_PRESETS = [
  { label: "初心者", value: 0.2 },
  { label: "中級者", value: 0.5 },
  { label: "上級者", value: 0.85 },
] as const;

const SWING_TARGET_STORAGE_KEY = "golfbag-swing-weight-target";
const SWING_GOOD_TOLERANCE_STORAGE_KEY = "golfbag-swing-good-tolerance";
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = "golfbag-swing-adjust-threshold";
const LIE_STANDARDS_STORAGE_KEY = "golfbag-user-lie-angle-standards";
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;

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

const getSkillLabel = (level: number): string => {
  if (level < 0.35) return "初心者";
  if (level < 0.7) return "中級者";
  return "上級者";
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
  // ユーザープロフィールストア
  const headSpeed = useUserProfileStore((state) => state.profile.headSpeed);
  const setHeadSpeed = useUserProfileStore((state) => state.setHeadSpeed);
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
  const setPersonalData = useClubStore((state) => state.setPersonalData);
  const setPlayerSkillLevel = useClubStore((state) => state.setPlayerSkillLevel);
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
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [showWeakClubHint, setShowWeakClubHint] = useState<boolean>(false);
  const [showWeaknessHint, setShowWeaknessHint] = useState<boolean>(false);

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });

  const appLink = activeBag?.id != null ? `/?bagId=${activeBag.id}` : "/";

  useEffect(() => {
    const init = async () => {
      await initializeDefaults();
      await Promise.all([loadClubs(), loadBags(), loadPersonalData(), loadPlayerSkillLevel()]);
      setIsInitialized(true);
    };
    void init();
  }, [initializeDefaults, loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel]);

  useEffect(() => {
    if (isSaving) return;
    const nextDraft: Record<string, DraftRow> = {};
    for (const club of clubs) {
      const simClub = toSimClub(club);
      const existing = resolvePersonalDataForSimClub(simClub, personalData);
      nextDraft[simClub.id] = {
        weaknessFactor: toWeakness(existing?.weaknessFactor ?? 0),
      };
    }
    setDraftByClubId(nextDraft);
  }, [clubs, personalData, isSaving]);

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

    const { tableClubs: swingTable } = buildSwingWeightAnalysis(
      clubs,
      swingWeightTarget,
      swingGoodTolerance,
      swingAdjustThreshold,
      alwaysVisible,
    );
    for (const club of swingTable) {
      const clubId = toSimClub(club).id;
      if (club.swingStatus === "調整推奨") {
        addPenalty(clubId, 8, "スイングウェイト: 調整推奨");
      } else if (club.swingStatus !== "良好") {
        addPenalty(clubId, 4, `スイングウェイト: ${club.swingStatus}`);
      }
    }

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
    swingWeightTarget,
    swingGoodTolerance,
    swingAdjustThreshold,
    userLieAngleStandards,
  ]);

  const rows = useMemo(() => {
    return clubs.map((club) => {
      const simClub = toSimClub(club);
      const draft = draftByClubId[simClub.id] ?? { weaknessFactor: 0 };
      const analysisPenalty = analysisPenaltyByClubId[simClub.id]?.points ?? 0;
      const analysisPenaltyReasons = analysisPenaltyByClubId[simClub.id]?.reasons ?? [];
      const adjustedBaseSuccessRate = getAnalysisAdjustedBaseSuccessRate(simClub, analysisPenalty);
      const treatedAsWeakClub = isWeakClubByAnalysisAdjustedRate(simClub, analysisPenalty);
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
        clubLabel: `${club.name} ${club.number}`,
        treatedAsWeakClub,
        baseSuccessRate: simClub.successRate,
        adjustedBaseSuccessRate,
        analysisPenalty,
        analysisPenaltyReasons,
        weaknessFactor: draft.weaknessFactor,
        effectiveSuccessRate,
      };
    });
  }, [clubs, draftByClubId, playerSkillLevel, analysisPenaltyByClubId]);

  const analysisAdjustedRows = useMemo(() => {
    return rows.filter((row) => row.analysisPenalty > 0);
  }, [rows]);

  const updateDraft = (clubId: string, patch: Partial<DraftRow>) => {
    setDraftByClubId((prev) => ({
      ...prev,
      [clubId]: {
        weaknessFactor: patch.weaknessFactor ?? prev[clubId]?.weaknessFactor ?? 0,
      },
    }));
    if (saveMessage) {
      setSaveMessage("");
    }
  };

  const handleResetDefaults = () => {
    const resetDraft: Record<string, DraftRow> = {};
    for (const club of clubs) {
      const clubId = String(club.id ?? `${club.clubType}-${club.number}`);
      resetDraft[clubId] = {
        weaknessFactor: 0,
      };
    }
    setDraftByClubId(resetDraft);
    setSaveMessage("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    for (const row of rows) {
      const payload: ClubPersonalData = {
        clubId: row.clubId,
        weaknessFactor: row.weaknessFactor,
      };
      await setPersonalData(payload);
    }
    setIsSaving(false);
    setSaveMessage("個人データをシミュレーター設定に保存しました。");
  };

  const handleSkillLevelChange = async (level: number) => {
    await setPlayerSkillLevel(toSkillLevel(level));
    if (saveMessage) {
      setSaveMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {!isInitialized && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            データを読み込み中...
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">シミュレーター設定</p>
            <h1 className="text-2xl font-bold text-slate-900">個人データ入力</h1>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Link
              to="/range"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              レンジシミュレーターへ
            </Link>
            <Link
              to={appLink}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              アプリに戻る
            </Link>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={loading || rows.length === 0}
            >
              保存
            </button>
            {saveMessage && <p className="text-sm text-emerald-700 sm:text-right">{saveMessage}</p>}
          </div>
        </div>

        <GolfBagPanel
          bags={bags}
          activeBagId={activeBag?.id ?? null}
          activeBagClubCount={activeBag?.clubIds.length ?? 0}
          totalClubCount={clubs.length}
          onSelectBag={(bagId) => void setActiveBag(bagId)}
          showManagement={false}
          compact
          title="設定対象のバッグ"
          description="ここで表示されるのはアクティブバッグのクラブだけです。複数バッグを使い分ける場合は切り替えて編集します。"
        />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {analysisAdjustedRows.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-semibold">分析結果により基本成功率を下げたクラブがあります。</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {analysisAdjustedRows.map((row) => (
                <li key={`analysis-${row.clubId}`}>
                  {row.clubLabel}: -{row.analysisPenalty}%（{row.analysisPenaltyReasons.join(" / ")}）
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-emerald-900">プレイヤースキルレベル設定</h2>
              <p className="text-sm text-emerald-800">
                現在: {getSkillLabel(playerSkillLevel)} ({playerSkillLevel.toFixed(2)})
              </p>
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
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                      isActive
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100",
                    ].join(" ")}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="w-10 text-xs text-slate-600">0.00</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={playerSkillLevel}
              onChange={(event) => void handleSkillLevelChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-emerald-200 accent-emerald-600"
            />
            <span className="w-10 text-right text-xs text-slate-600">1.00</span>
          </div>
        </section>

        {/* ユーザーのヘッドスピード入力欄 */}
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900 mb-2">ユーザーのヘッドスピード</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span>ヘッドスピード</span>
              <input
                type="number"
                min={20}
                max={60}
                step={0.1}
                value={headSpeed ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setHeadSpeed(v);
                }}
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-900 focus:border-emerald-500 focus:outline-none"
                placeholder="例: 40.5"
              />
              <span>m/s</span>
            </label>
            <span className="text-xs text-slate-500 ml-2">※ あなた自身のヘッドスピード（ドライバー基準）を入力してください</span>
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
                        aria-expanded={showWeakClubHint}
                        onClick={() => setShowWeakClubHint((prev) => !prev)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-xs font-bold text-amber-700"
                      >
                        ?
                      </button>
                      {showWeakClubHint && (
                        <div className="absolute left-0 top-full z-20 mt-2 w-[24rem] max-w-[85vw] rounded-md border border-amber-300 bg-white p-3 text-left text-xs leading-relaxed text-amber-900 shadow-lg">
                          弱クラブ扱いは「クラブが弱点指定」または「基本成功率が 65% 未満」の場合に適用されます。
                        </div>
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">基本成功率</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <span className="relative inline-flex items-center gap-2">
                      <span>弱点係数</span>
                      <button
                        type="button"
                        aria-label="弱点係数のヒント"
                        aria-expanded={showWeaknessHint}
                        onClick={() => setShowWeaknessHint((prev) => !prev)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-xs font-bold text-emerald-700"
                      >
                        ?
                      </button>
                      {showWeaknessHint && (
                        <div className="absolute left-0 top-full z-20 mt-2 w-[22rem] max-w-[85vw] rounded-md border border-emerald-300 bg-white p-3 text-xs leading-relaxed text-emerald-900 shadow-lg">
                          弱点係数はクラブごとの苦手度です。0.00 は影響なし、1.00 に近いほど成功率が下がります。
                        </div>
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">クラブ成功率</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.clubId} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">{row.clubLabel}</td>
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
                      {row.adjustedBaseSuccessRate}%
                      {row.analysisPenalty > 0 && (
                        <span className="ml-1 text-xs font-normal text-amber-700">
                          (元 {row.baseSuccessRate}% / -{row.analysisPenalty}%)
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            デフォルトにリセット
          </button>
        </div>
      </div>
    </div>
  );
}
