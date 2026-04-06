import { useEffect, useMemo, useState } from 'react';
import type { GolfClub } from './types/golf';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  normalizeLieStandardKey,
  type UserLieAngleStandards,
} from './types/lieStandards';
import { getAnalysisClubKey } from './utils/clubUtils';
import {
  downloadAllClubsAsJson,
  downloadBagClubsAsJson,
  readClubsFromJsonFile,
} from './utils/clubTransfer';
import {
  readStoredJson,
  readStoredNumber,
  writeStoredJson,
  writeStoredValue,
} from './utils/storage';
import { ClubList } from './components/ClubList';
import { ClubForm } from './components/ClubForm';
import { AnalysisScreen } from './components/AnalysisScreen';
import { GolfBagPanel } from './components/GolfBagPanel';
import { SimulatorApp } from './components/simulator/SimulatorApp';
import {
  selectActiveGolfBag,
  selectSortedActiveBagClubs,
  selectSortedClubsForDisplay,
  useClubStore,
} from './store/clubStore';
import { useBagIdUrlSync } from './hooks/useBagIdUrlSync';
import './App.css';

const HEAD_SPEED_STORAGE_KEY = 'golfbag-head-speed-ms';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY = 'golfbag-analysis-hidden-clubs';
const CLUB_LIST_SCOPE_STORAGE_KEY = 'golfbag-club-list-scope';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;

const parseUserLieAngleStandards = (value: unknown): UserLieAngleStandards => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_USER_LIE_ANGLE_STANDARDS;
  }

  const parsed = value as Partial<UserLieAngleStandards>;
  return {
    byClubType: parsed.byClubType ?? {},
    byClubName: parsed.byClubName ?? {},
  };
};

const parseHiddenAnalysisClubKeys = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const parseClubListScope = (value: unknown): 'bag' | 'all' => {
  return value === 'all' ? 'all' : 'bag';
};

type ClubTypeFilter = 'All' | GolfClub['clubType'];

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [headSpeed, setHeadSpeed] = useState<number>(() => {
    return readStoredNumber(HEAD_SPEED_STORAGE_KEY, 42, { min: 0.1 });
  });
  const [userLieAngleStandards, setUserLieAngleStandards] =
    useState<UserLieAngleStandards>(() => {
      return readStoredJson(
        LIE_STANDARDS_STORAGE_KEY,
        DEFAULT_USER_LIE_ANGLE_STANDARDS,
        parseUserLieAngleStandards,
      );
    });
  const [swingWeightTarget, setSwingWeightTarget] = useState<number>(() => {
    return readStoredNumber(SWING_TARGET_STORAGE_KEY, DEFAULT_SWING_TARGET, { decimals: 1 });
  });
  const [swingGoodTolerance, setSwingGoodTolerance] = useState<number>(() => {
    return readStoredNumber(
      SWING_GOOD_TOLERANCE_STORAGE_KEY,
      DEFAULT_SWING_GOOD_TOLERANCE,
      { decimals: 1 },
    );
  });
  const [swingAdjustThreshold, setSwingAdjustThreshold] = useState<number>(() => {
    return readStoredNumber(
      SWING_ADJUST_THRESHOLD_STORAGE_KEY,
      DEFAULT_SWING_ADJUST_THRESHOLD,
      { decimals: 1 },
    );
  });
  const [hiddenAnalysisClubKeys, setHiddenAnalysisClubKeys] = useState<string[]>(() => {
    return readStoredJson(
      ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY,
      [],
      parseHiddenAnalysisClubKeys,
    );
  });
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);
  const [showImagePropagationConfirm, setShowImagePropagationConfirm] = useState(false);
  const [pendingClubData, setPendingClubData] = useState<Omit<GolfClub, 'id'> | Partial<GolfClub> | null>(null);
  const [clubListScope, setClubListScope] = useState<'bag' | 'all'>(() => {
    return readStoredJson(CLUB_LIST_SCOPE_STORAGE_KEY, 'bag', parseClubListScope);
  });
  const [clubNameSearchText, setClubNameSearchText] = useState('');
  const [clubTypeFilter, setClubTypeFilter] = useState<ClubTypeFilter>('All');
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const activeBagClubCount = activeBag?.clubIds.length ?? 0;
  const clubsForDisplay = clubListScope === 'bag' ? activeBagClubs : sortedClubs;
  const {
    loading,
    error,
    loadClubs,
    loadBags,
    loadPersonalData,
    loadPlayerSkillLevel,
    addClub,
    updateClub,
    deleteClub,
    initializeDefaults,
    resetToDefaults,
    clearAllClubs,
    createBag,
    renameBag,
    deleteBag,
    setActiveBag,
    toggleClubInActiveBag,
    replaceActiveBagClubIds,
  } = useClubStore();

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });

  const handleClearAllClubs = async () => {
    const confirmed = confirm('全てのクラブデータを完全に削除します。よろしいですか？');
    if (!confirmed) return;

    await clearAllClubs();
    setShowForm(false);
    setEditingClub(undefined);
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedClubs = await readClubsFromJsonFile(file);

      await clearAllClubs();
      for (const club of importedClubs) {
        await addClub(club);
      }
      await loadClubs();
      const nextClubIds = selectSortedClubsForDisplay(useClubStore.getState())
        .slice(0, 14)
        .map((club) => club.id)
        .filter((clubId): clubId is number => typeof clubId === 'number');
      await replaceActiveBagClubIds(nextClubIds);
      setClubListScope('bag');
      alert('インポートが完了しました');
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
    }

    event.target.value = '';
  };

  const handleExportJSON = () => {
    if (clubListScope === 'bag' && activeBag) {
      downloadBagClubsAsJson(activeBag.name, activeBagClubs);
      return;
    }

    downloadAllClubsAsJson(sortedClubs);
  };

  useEffect(() => {
    const initializeApp = async () => {
      await initializeDefaults();
      await loadClubs();
      await loadBags();
      await Promise.all([loadPersonalData(), loadPlayerSkillLevel()]);
    };
    void initializeApp();
  }, [initializeDefaults, loadBags, loadClubs, loadPersonalData, loadPlayerSkillLevel]);

  useEffect(() => {
    writeStoredValue(HEAD_SPEED_STORAGE_KEY, headSpeed);
  }, [headSpeed]);

  useEffect(() => {
    writeStoredJson(LIE_STANDARDS_STORAGE_KEY, userLieAngleStandards);
  }, [userLieAngleStandards]);

  useEffect(() => {
    writeStoredValue(SWING_TARGET_STORAGE_KEY, swingWeightTarget);
  }, [swingWeightTarget]);

  useEffect(() => {
    writeStoredValue(SWING_GOOD_TOLERANCE_STORAGE_KEY, swingGoodTolerance);
  }, [swingGoodTolerance]);

  useEffect(() => {
    writeStoredValue(SWING_ADJUST_THRESHOLD_STORAGE_KEY, swingAdjustThreshold);
  }, [swingAdjustThreshold]);

  useEffect(() => {
    writeStoredJson(ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY, hiddenAnalysisClubKeys);
  }, [hiddenAnalysisClubKeys]);

  useEffect(() => {
    writeStoredJson(CLUB_LIST_SCOPE_STORAGE_KEY, clubListScope);
  }, [clubListScope]);

  useEffect(() => {
    if (clubListScope === 'bag' && activeBagClubCount === 0 && sortedClubs.length > 0 && bags.length === 1) {
      setClubListScope('all');
    }
  }, [activeBagClubCount, bags.length, clubListScope, sortedClubs.length]);

  const handleSetSwingWeightTarget = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(-30, Math.min(30, rounded));
    setSwingWeightTarget(clamped);
  };

  const handleResetSwingWeightTarget = () => {
    setSwingWeightTarget(DEFAULT_SWING_TARGET);
  };

  const handleSetSwingGoodTolerance = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(0.1, Math.min(30, rounded));
    setSwingGoodTolerance(clamped);
    setSwingAdjustThreshold((prev) => Math.max(clamped, prev));
  };

  const handleSetSwingAdjustThreshold = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(swingGoodTolerance, Math.min(30, rounded));
    setSwingAdjustThreshold(clamped);
  };

  const handleResetSwingThresholds = () => {
    setSwingGoodTolerance(DEFAULT_SWING_GOOD_TOLERANCE);
    setSwingAdjustThreshold(DEFAULT_SWING_ADJUST_THRESHOLD);
  };

  const handleSetAnalysisClubVisible = (clubKey: string, visible: boolean) => {
    setHiddenAnalysisClubKeys((prev) => {
      const exists = prev.includes(clubKey);
      if (visible) {
        return exists ? prev.filter((key) => key !== clubKey) : prev;
      }

      return exists ? prev : [...prev, clubKey];
    });
  };

  const handleSetLieTypeStandard = (clubType: string, value: number) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => ({
      ...prev,
      byClubType: {
        ...prev.byClubType,
        [key]: value,
      },
    }));
  };

  const handleSetLieClubStandard = (clubName: string, value: number) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => ({
      ...prev,
      byClubName: {
        ...prev.byClubName,
        [key]: value,
      },
    }));
  };

  const handleClearLieTypeStandard = (clubType: string) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => {
      const nextByType = { ...prev.byClubType };
      delete nextByType[key];
      return {
        ...prev,
        byClubType: nextByType,
      };
    });
  };

  const handleClearLieClubStandard = (clubName: string) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => {
      const nextByName = { ...prev.byClubName };
      delete nextByName[key];
      const keyParts = key.split('|');
      if (keyParts.length >= 3) {
        delete nextByName[keyParts.slice(0, 2).join('|')];
      }
      return {
        ...prev,
        byClubName: nextByName,
      };
    });
  };

  const handleResetLieStandards = () => {
    setUserLieAngleStandards(DEFAULT_USER_LIE_ANGLE_STANDARDS);
  };

  const handleAddClub = () => {
    setShowAnalysis(false);
    setEditingClub(undefined);
    setShowForm(true);
  };

  const handleCreateBag = async () => {
    const suggestedName = `バッグ ${bags.length + 1}`;
    const bagName = window.prompt('新しいゴルフバッグ名を入力してください', suggestedName);
    if (bagName == null) {
      return;
    }

    await createBag(bagName);
    setClubListScope('bag');
  };

  const handleRenameActiveBag = async () => {
    if (!activeBag?.id) {
      return;
    }

    const nextName = window.prompt('バッグ名を入力してください', activeBag.name);
    if (nextName == null) {
      return;
    }

    await renameBag(activeBag.id, nextName);
  };

  const handleDeleteActiveBag = async () => {
    if (!activeBag?.id) {
      return;
    }

    const confirmed = window.confirm(`「${activeBag.name}」を削除します。よろしいですか？`);
    if (!confirmed) {
      return;
    }

    await deleteBag(activeBag.id);
  };

  const handleToggleActiveBagMembership = async (club: GolfClub) => {
    if (typeof club.id !== 'number') {
      return;
    }

    await toggleClubInActiveBag(club.id);
  };

  const handleEditClub = (club: GolfClub) => {
    setShowAnalysis(false);
    setEditingClub(club);
    setShowForm(true);
  };

  const handleShowAnalysis = () => {
    setShowForm(false);
    setEditingClub(undefined);
    setShowAnalysis(true);
  };

  const handleBackToList = () => {
    setShowAnalysis(false);
  };

  const handleDeleteClub = async (id: number) => {
    if (confirm('このクラブを削除してもよろしいですか?')) {
      await deleteClub(id);
    }
  };

  const handleActualDistanceChange = async (id: number, distance: number) => {
    await updateClub(id, { distance });
  };

  const handleResetClubs = async () => {
    const confirmed = confirm('全てのクラブが削除され、初期14本に戻ります。よろしいですか？');
    if (!confirmed) return;

    setShowForm(false);
    setEditingClub(undefined);
    await resetToDefaults();
  };

  const isSameImageData = (a?: string[], b?: string[]) => {
    if (!a || !b) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  };

  const shouldAskImagePropagation = (clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>): boolean => {
    const name = (clubData.name ?? editingClub?.name)?.trim();
    if (!name || !clubData.imageData?.length) {
      return false;
    }

    const imageChanged = !editingClub || !isSameImageData(clubData.imageData, editingClub.imageData);
    if (!imageChanged) {
      return false;
    }

    const sameNameClubs = sortedClubs.filter((club) => {
      if (editingClub && editingClub.id) {
        return club.name === name && club.id !== editingClub.id;
      }
      return club.name === name;
    });
    return sameNameClubs.length > 0;
  };

  const submitClubData = async (
    clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>,
    propagateSameName = true,
  ) => {
    if (editingClub && editingClub.id) {
      await updateClub(editingClub.id, clubData, propagateSameName);
    } else {
      await addClub(clubData as Omit<GolfClub, 'id'>, propagateSameName);
    }
    setShowForm(false);
    setEditingClub(undefined);
    setShowImagePropagationConfirm(false);
    setPendingClubData(null);
  };

  const handleFormSubmit = async (clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>) => {
    const askPropagation = shouldAskImagePropagation(clubData);
    if (askPropagation) {
      setPendingClubData(clubData);
      setShowImagePropagationConfirm(true);
      return;
    }
    await submitClubData(clubData, true);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingClub(undefined);
  };

  const analysisHiddenKeys = useMemo(() => {
    return hiddenAnalysisClubKeys.filter((clubKey) =>
      activeBagClubs.some((club) => getAnalysisClubKey(club) === clubKey),
    );
  }, [activeBagClubs, hiddenAnalysisClubKeys]);

  if (showSimulator) {
    return (
      <SimulatorApp
        onBack={() => setShowSimulator(false)}
        selectedClubs={activeBagClubs}
        allClubs={sortedClubs}
        activeBagName={activeBag?.name}
        bagId={activeBag?.id ?? null}
      />
    );
  }

  const handleConfirmPropagation = async (propagate: boolean) => {
    if (!pendingClubData) {
      setShowImagePropagationConfirm(false);
      return;
    }
    await submitClubData(pendingClubData, propagate);
  };

  return (
    <div className="app-container">
      {error && <div className="error-message">{error}</div>}
      {showImagePropagationConfirm && pendingClubData && (
        <div className="image-propagation-modal" role="dialog" aria-modal="true">
          <div
            className="image-propagation-backdrop"
            onClick={() => {
              setShowImagePropagationConfirm(false);
              setPendingClubData(null);
            }}
          />
          <div className="image-propagation-card">
            <h3>同じクラブ名称の他のクラブにも画像を反映しますか？</h3>
            <p>
              同じクラブ名を持つ他のクラブにも、今回アップロードした画像を適用します。
              反映したくない場合は「いいえ」を選択してください。
            </p>
            <div className="image-propagation-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleConfirmPropagation(false)}
              >
                いいえ
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleConfirmPropagation(true)}
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm ? (
        <ClubForm
          club={editingClub}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isLoading={loading}
        />
      ) : showAnalysis ? (
        <AnalysisScreen
          clubs={activeBagClubs}
          onBack={handleBackToList}
          onUpdateActualDistance={handleActualDistanceChange}
          headSpeed={headSpeed}
          onHeadSpeedChange={setHeadSpeed}
          hiddenAnalysisClubKeys={analysisHiddenKeys}
          onSetAnalysisClubVisible={handleSetAnalysisClubVisible}
          swingWeightTarget={swingWeightTarget}
          swingGoodTolerance={swingGoodTolerance}
          swingAdjustThreshold={swingAdjustThreshold}
          onSetSwingWeightTarget={handleSetSwingWeightTarget}
          onSetSwingGoodTolerance={handleSetSwingGoodTolerance}
          onSetSwingAdjustThreshold={handleSetSwingAdjustThreshold}
          onResetSwingWeightTarget={handleResetSwingWeightTarget}
          onResetSwingThresholds={handleResetSwingThresholds}
          userLieAngleStandards={userLieAngleStandards}
          onSetLieTypeStandard={handleSetLieTypeStandard}
          onSetLieClubStandard={handleSetLieClubStandard}
          onClearLieTypeStandard={handleClearLieTypeStandard}
          onClearLieClubStandard={handleClearLieClubStandard}
          onResetLieStandards={handleResetLieStandards}
        />
      ) : (
        <>
          <GolfBagPanel
            bags={bags}
            activeBagId={activeBag?.id ?? null}
            activeBagClubCount={activeBagClubCount}
            totalClubCount={sortedClubs.length}
            onSelectBag={(bagId) => void setActiveBag(bagId)}
            onCreateBag={() => void handleCreateBag()}
            onRenameActiveBag={() => void handleRenameActiveBag()}
            onDeleteActiveBag={() => void handleDeleteActiveBag()}
            listScope={clubListScope}
            onChangeListScope={setClubListScope}
          />

          <ClubList
            clubs={clubsForDisplay}
            searchText={clubNameSearchText}
            selectedClubType={clubTypeFilter}
            onSearchTextChange={setClubNameSearchText}
            onSelectedClubTypeChange={setClubTypeFilter}
            onEdit={handleEditClub}
            onDelete={handleDeleteClub}
            onAdd={handleAddClub}
            onReset={handleResetClubs}
            onClearAll={handleClearAllClubs}
            onExport={handleExportJSON}
            onImport={handleImportJSON}
            onShowAnalysis={handleShowAnalysis}
            onShowSimulator={() => setShowSimulator(true)}
            activeBagName={activeBag?.name}
            activeBagId={activeBag?.id}
            activeBagClubIds={activeBag?.clubIds ?? []}
            activeBagClubCount={activeBagClubCount}
            isBagView={clubListScope === 'bag'}
            allClubsCount={sortedClubs.length}
            onSwitchToAllClubs={() => setClubListScope('all')}
            onToggleActiveBagMembership={(club) => void handleToggleActiveBagMembership(club)}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}

export default App;
