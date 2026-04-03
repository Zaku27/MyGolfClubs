import { useEffect, useMemo, useState } from "react";
import { useUserProfileStore } from "../../store/userProfileStore";
import { Link } from "react-router-dom";
import type { ClubCategory, ClubPersonalData, GolfClub } from "../../types/golf";
import { GolfBagPanel } from "../GolfBagPanel";
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  useClubStore,
} from "../../store/clubStore";
import { useBagIdUrlSync } from "../../hooks/useBagIdUrlSync";
import { toSimClub } from "../../utils/clubSimAdapter";
import { calculateEffectiveSuccessRate } from "../../utils/calculateSuccessRate";
import { resolvePersonalDataForSimClub } from "../../utils/personalData";

type DraftRow = {
  missRate: number;
  weaknessFactor: number;
};

const SKILL_PRESETS = [
  { label: "初心者", value: 0.2 },
  { label: "中級者", value: 0.5 },
  { label: "上級者", value: 0.85 },
] as const;
const BASE_RATE_ADJUSTMENT = 1.1;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const toWeakness = (value: number): number => {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
};

const toMissRate = (value: number): number => {
  return Math.round(clamp(value, 0, 100));
};

const toSkillLevel = (value: number): number => {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
};

const getSkillLabel = (level: number): string => {
  if (level < 0.35) return "初心者";
  if (level < 0.7) return "中級者";
  return "上級者";
};

const CLUB_CATEGORIES: readonly { category: ClubCategory; label: string }[] = [
  { category: "Driver", label: "ドライバー" },
  { category: "Wood", label: "フェアウェイウッド" },
  { category: "Hybrid", label: "ハイブリッド" },
  { category: "Iron", label: "アイアン" },
  { category: "Wedge", label: "ウェッジ" },
  { category: "Putter", label: "パター" },
] as const;

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

  const [draftByClubId, setDraftByClubId] = useState<Record<string, DraftRow>>({});
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<ClubCategory>("Iron");
  const [categorySetMissRateInput, setCategorySetMissRateInput] = useState<string>("0");
  const [categoryAdjustMissRateInput, setCategoryAdjustMissRateInput] = useState<string>("0");
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

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
        missRate: toMissRate(existing?.missRate ?? 0),
        weaknessFactor: toWeakness(existing?.weaknessFactor ?? 0),
      };
    }
    setDraftByClubId(nextDraft);
  }, [clubs, personalData, isSaving]);

  const rows = useMemo(() => {
    return clubs.map((club) => {
      const simClub = toSimClub(club);
      const draft = draftByClubId[simClub.id] ?? { missRate: 0, weaknessFactor: 0 };
      const treatedAsWeakClub = simClub.isWeakClub === true || simClub.successRate < 65;
      const adjustedBaseSuccessRate = Math.max(
        5,
        Math.min(95, Math.round(simClub.successRate * BASE_RATE_ADJUSTMENT)),
      );
      const effectiveSuccessRate = calculateEffectiveSuccessRate(
        simClub.successRate,
        {
          clubId: simClub.id,
          missRate: draft.missRate,
          weaknessFactor: draft.weaknessFactor,
        },
        treatedAsWeakClub,
        playerSkillLevel,
      );

      return {
        clubId: simClub.id,
        clubLabel: `${club.name} ${club.number}`,
        treatedAsWeakClub,
        baseSuccessRate: simClub.successRate,
        adjustedBaseSuccessRate,
        missRate: draft.missRate,
        weaknessFactor: draft.weaknessFactor,
        effectiveSuccessRate,
      };
    });
  }, [clubs, draftByClubId, playerSkillLevel]);

  const updateDraft = (clubId: string, patch: Partial<DraftRow>) => {
    setDraftByClubId((prev) => ({
      ...prev,
      [clubId]: {
        missRate: patch.missRate ?? prev[clubId]?.missRate ?? 0,
        weaknessFactor: patch.weaknessFactor ?? prev[clubId]?.weaknessFactor ?? 0,
      },
    }));
    if (saveMessage) {
      setSaveMessage("");
    }
  };

  const getClubsInCategory = (category: ClubCategory): GolfClub[] => {
    return clubs.filter((club) => club.clubType === category);
  };

  const applyMissRateToCategoryClubs = (
    category: ClubCategory,
    updater: (currentMissRate: number) => number,
  ) => {
    const targetClubs = getClubsInCategory(category);
    const targetClubIds = new Set(targetClubs.map((c) => toSimClub(c).id));

    setDraftByClubId((prev) => {
      const nextDraft: Record<string, DraftRow> = {};
      for (const [clubId, draft] of Object.entries(prev)) {
        if (targetClubIds.has(clubId)) {
          nextDraft[clubId] = {
            ...draft,
            missRate: toMissRate(updater(draft.missRate)),
          };
        } else {
          nextDraft[clubId] = draft;
        }
      }
      return nextDraft;
    });
    if (saveMessage) {
      setSaveMessage("");
    }
  };

  const handleCategorySetMissRate = () => {
    applyMissRateToCategoryClubs(selectedCategory, () =>
      toMissRate(Number(categorySetMissRateInput)),
    );
  };

  const handleCategoryAdjustMissRate = () => {
    const adjustment = Math.round(clamp(Number(categoryAdjustMissRateInput), -100, 100));
    applyMissRateToCategoryClubs(selectedCategory, (currentMissRate) => currentMissRate + adjustment);
  };

  const handleResetDefaults = () => {
    const resetDraft: Record<string, DraftRow> = {};
    for (const club of clubs) {
      const clubId = String(club.id ?? `${club.clubType}-${club.number}`);
      resetDraft[clubId] = {
        missRate: 0,
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
        missRate: row.missRate,
        weaknessFactor: row.weaknessFactor,
        effectiveSuccessRate: row.effectiveSuccessRate,
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
        {/* ユーザーのヘッドスピード入力欄 */}
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 mb-4">
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
        {!isInitialized && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            データを読み込み中...
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">シミュレーター設定</p>
            <h1 className="text-2xl font-bold text-slate-900">個人データ入力</h1>
            <p className="text-sm text-slate-600">
              ミス率 = 実際のミスの割合（%）。弱点係数 = あなたのクセによるクラブ性能の低下度合い（0〜1）。
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
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

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-slate-900">種別別ミス率調整</h2>
            <p className="text-sm text-slate-600">
              クラブの種別（ドライバー、アイアンなど）ごとにミス率を調整できます。
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-3 block text-sm font-medium text-slate-800">調整対象の種別</label>
            <div className="grid gap-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
              {CLUB_CATEGORIES.map((cat) => {
                const countInCategory = getClubsInCategory(cat.category).length;
                const isSelected = selectedCategory === cat.category;
                return (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setSelectedCategory(cat.category)}
                    disabled={countInCategory === 0}
                    className={[
                      "relative rounded-lg border px-2 py-2 text-xs sm:text-sm font-medium transition",
                      "focus:outline-none focus-visible:ring-2",
                      isSelected
                        ? "border-emerald-600 bg-emerald-600 text-white focus-visible:ring-emerald-300"
                        : countInCategory === 0
                          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {cat.label}
                    {countInCategory > 0 && <span className="ml-1 text-xs opacity-70">({countInCategory})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">同じ値にする</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>ミス率</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={categorySetMissRateInput}
                    onChange={(event) => setCategorySetMissRateInput(event.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                  <span>%</span>
                </label>
                <button
                  type="button"
                  onClick={handleCategorySetMissRate}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={rows.length === 0}
                >
                  適用
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">現在値を増減する</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>補正値</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={-100}
                    max={100}
                    step={1}
                    value={categoryAdjustMissRateInput}
                    onChange={(event) => setCategoryAdjustMissRateInput(event.target.value)}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                  <span>%</span>
                </label>
                <button
                  type="button"
                  onClick={handleCategoryAdjustMissRate}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={rows.length === 0}
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">クラブ</th>
                  <th className="px-4 py-3 text-center font-semibold">弱クラブ扱い</th>
                  <th className="px-4 py-3 text-right font-semibold">基本成功率(補正後)</th>
                  <th className="px-4 py-3 text-right font-semibold">ミス率 (%)</th>
                  <th className="px-4 py-3 text-left font-semibold">弱点係数</th>
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
                      <span className="ml-1 text-xs font-normal text-slate-500">(元 {row.baseSuccessRate}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        value={row.missRate}
                        onChange={(event) => {
                          updateDraft(row.clubId, {
                            missRate: toMissRate(Number(event.target.value)),
                          });
                        }}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
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
                      {row.effectiveSuccessRate}%
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      バッグにクラブがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          ※ 表示対象は {activeBag?.name ?? 'アクティブバッグ'} のクラブです。弱クラブ扱いは「クラブが弱点指定」または「基本成功率が65%未満」の場合に適用されます。
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
