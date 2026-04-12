import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { AccessoryItem, GolfClub } from './types/golf';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  normalizeLieStandardKey,
  type UserLieAngleStandards,
} from './types/lieStandards';
import { getAnalysisClubKey, getClubTypeDisplay } from './utils/clubUtils';
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
import { AppDialogs } from './components/AppDialogs';
import { AppMainContent } from './components/AppMainContent';
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
const ACCESSORY_STORAGE_KEY = 'golfbag-accessories';
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

const parseAccessories = (value: unknown): AccessoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is AccessoryItem =>
      item && typeof item === 'object' &&
      typeof (item as any).id === 'string' &&
      typeof (item as any).name === 'string' &&
      typeof (item as any).createdAt === 'string'
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      note: typeof item.note === 'string' ? item.note : undefined,
      imageData: typeof item.imageData === 'string' ? item.imageData : undefined,
      createdAt: item.createdAt,
    }));
};

const DEFAULT_ACCESSORIES: AccessoryItem[] = [];

type ClubTypeFilter = 'All' | GolfClub['clubType'];

type ConfirmDialogState = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const location = useLocation();
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [showCreateBagDialog, setShowCreateBagDialog] = useState(false);
  const [showRenameBagDialog, setShowRenameBagDialog] = useState(false);
  const [renameBagTargetId, setRenameBagTargetId] = useState<number | null>(null);
  const [renameBagDefaultName, setRenameBagDefaultName] = useState('');
  
  const [clubListScope, setClubListScope] = useState<'bag' | 'all'>(() => {
    return readStoredJson(CLUB_LIST_SCOPE_STORAGE_KEY, 'bag', parseClubListScope);
  });
  const [accessories, setAccessories] = useState<AccessoryItem[]>(() => {
    return readStoredJson(ACCESSORY_STORAGE_KEY, DEFAULT_ACCESSORIES, parseAccessories);
  });
  const [clubNameSearchText, setClubNameSearchText] = useState('');
  const [clubTypeFilter, setClubTypeFilter] = useState<ClubTypeFilter>('All');
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);

  const openConfirmDialog = (dialogState: ConfirmDialogState) => {
    setConfirmDialog(dialogState);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const handleConfirmDialogConfirm = async () => {
    if (!confirmDialog) {
      return;
    }

    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  };
  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const activeBagClubCount = activeBag?.clubIds.length ?? 0;
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
    moveBagLeft,
    toggleClubInActiveBag,
    replaceActiveBagClubIds,
    updateBagImage,
  } = useClubStore();

  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag,
  });

  const handleClearAllClubs = () => {
    openConfirmDialog({
      title: 'クラブデータの削除',
      message: '全てのクラブデータを完全に削除します。よろしいですか？',
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await clearAllClubs();
        setShowForm(false);
        setEditingClub(undefined);
      },
    });
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
    writeStoredJson(ACCESSORY_STORAGE_KEY, accessories);
  }, [accessories]);

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

  const handleAddAccessory = (accessory: Omit<AccessoryItem, 'id' | 'createdAt'>) => {
    setAccessories((prevAccessories) => [
      ...prevAccessories,
      {
        id: `accessory-${Date.now()}`,
        ...accessory,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleUpdateAccessory = (updatedAccessory: AccessoryItem) => {
    setAccessories((prevAccessories) =>
      prevAccessories.map((accessory) =>
        accessory.id === updatedAccessory.id ? updatedAccessory : accessory,
      ),
    );
  };

  const handleDeleteAccessory = (id: string) => {
    setAccessories((prevAccessories) => prevAccessories.filter((accessory) => accessory.id !== id));
  };

  const handleCreateBag = () => {
    setShowCreateBagDialog(true);
  };

  const handleCreateBagConfirm = async (bagName: string) => {
    await createBag(bagName);
    setShowCreateBagDialog(false);
    setClubListScope('bag');
  };

  const handleAddBagImage = async (bagId: number, imageData: string[]) => {
    await updateBagImage(bagId, imageData);
  };

  const handleRenameActiveBag = async () => {
    if (!activeBag?.id) {
      return;
    }

    setRenameBagTargetId(activeBag.id);
    setRenameBagDefaultName(activeBag.name);
    setShowRenameBagDialog(true);
  };

  const handleRenameBagConfirm = async (bagName: string) => {
    if (!renameBagTargetId) {
      return;
    }

    await renameBag(renameBagTargetId, bagName);
    setShowRenameBagDialog(false);
    setRenameBagTargetId(null);
    setRenameBagDefaultName('');
  };

  const handleDeleteActiveBag = async () => {
    const activeBagId = activeBag?.id;
    const activeBagName = activeBag?.name ?? 'このバッグ';
    if (typeof activeBagId !== 'number') {
      return;
    }

    openConfirmDialog({
      title: 'バッグの削除',
      message: `「${activeBagName}」を削除します。よろしいですか？`,
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await deleteBag(activeBagId);
      },
    });
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

  const handleDeleteClub = async (id: number) => {
    const targetClub = sortedClubs.find((club) => club.id === id);
    const deleteMessage = targetClub?.name
      ? `${getClubTypeDisplay(targetClub.clubType, targetClub.number)}「${targetClub.name}」を削除してもよろしいですか?`
      : 'このクラブを削除してもよろしいですか?';

    openConfirmDialog({
      title: 'クラブの削除',
      message: deleteMessage,
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await deleteClub(id);
      },
    });
  };

  const handleActualDistanceChange = async (id: number, distance: number) => {
    await updateClub(id, { distance });
  };

  const handleResetClubs = () => {
    openConfirmDialog({
      title: 'クラブの初期化',
      message: '全てのクラブが削除され、初期14本に戻ります。よろしいですか？',
      confirmLabel: '戻す',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        setShowForm(false);
        setEditingClub(undefined);
        await resetToDefaults();
      },
    });
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

  useEffect(() => {
    if (location.state?.openSimulator) {
      setShowSimulator(true);
    }
  }, [location.state]);

  const handleConfirmPropagation = async (propagate: boolean) => {
    if (!pendingClubData) {
      setShowImagePropagationConfirm(false);
      return;
    }
    await submitClubData(pendingClubData, propagate);
  };

  const analysisHiddenKeys = useMemo(() => {
    return hiddenAnalysisClubKeys.filter((clubKey) =>
      activeBagClubs.some((club) => getAnalysisClubKey(club) === clubKey),
    );
  }, [activeBagClubs, hiddenAnalysisClubKeys]);

  return (
    <>
      <AppDialogs
        error={error}
        showImagePropagationConfirm={showImagePropagationConfirm}
        pendingClubData={pendingClubData}
        onCancelImagePropagation={() => {
          setShowImagePropagationConfirm(false);
          setPendingClubData(null);
        }}
        onConfirmPropagation={handleConfirmPropagation}
        confirmDialog={confirmDialog}
        onCloseConfirmDialog={closeConfirmDialog}
        onConfirmDialogConfirm={handleConfirmDialogConfirm}
        showCreateBagDialog={showCreateBagDialog}
        showRenameBagDialog={showRenameBagDialog}
        renameBagDefaultName={renameBagDefaultName}
        bags={bags}
        loading={loading}
        onCreateBagConfirm={handleCreateBagConfirm}
        onCancelCreateBag={() => {
          setShowCreateBagDialog(false);
        }}
        onRenameBagConfirm={handleRenameBagConfirm}
        onCancelRenameBag={() => {
          setShowRenameBagDialog(false);
          setRenameBagTargetId(null);
          setRenameBagDefaultName('');
        }}
      />

      <AppMainContent
        showSimulator={showSimulator}
        showForm={showForm}
        showAnalysis={showAnalysis}
        editingClub={editingClub}
        activeBagClubs={activeBagClubs}
        sortedClubs={sortedClubs}
        activeBagName={activeBag?.name}
        activeBagId={activeBag?.id ?? null}
        activeBagClubCount={activeBagClubCount}
        activeBagClubIds={activeBag?.clubIds ?? []}
        activeBag={activeBag ?? undefined}
        bags={bags}
        loading={loading}
        clubListScope={clubListScope}
        clubNameSearchText={clubNameSearchText}
        clubTypeFilter={clubTypeFilter}
        onSearchTextChange={setClubNameSearchText}
        onSelectedClubTypeChange={setClubTypeFilter}
        handleFormSubmit={handleFormSubmit}
        handleFormCancel={handleFormCancel}
        handleActualDistanceChange={handleActualDistanceChange}
        hiddenAnalysisClubKeys={analysisHiddenKeys}
        handleSetAnalysisClubVisible={handleSetAnalysisClubVisible}
        swingWeightTarget={swingWeightTarget}
        swingGoodTolerance={swingGoodTolerance}
        swingAdjustThreshold={swingAdjustThreshold}
        handleSetSwingWeightTarget={handleSetSwingWeightTarget}
        handleSetSwingGoodTolerance={handleSetSwingGoodTolerance}
        handleSetSwingAdjustThreshold={handleSetSwingAdjustThreshold}
        handleResetSwingWeightTarget={handleResetSwingWeightTarget}
        handleResetSwingThresholds={handleResetSwingThresholds}
        userLieAngleStandards={userLieAngleStandards}
        handleSetLieTypeStandard={handleSetLieTypeStandard}
        handleSetLieClubStandard={handleSetLieClubStandard}
        handleClearLieTypeStandard={handleClearLieTypeStandard}
        handleClearLieClubStandard={handleClearLieClubStandard}
        handleResetLieStandards={handleResetLieStandards}
        onSelectBag={(bagId) => void setActiveBag(bagId)}
        onCreateBag={() => void handleCreateBag()}
        onAddBagImage={(bagId, imageData) => void handleAddBagImage(bagId, imageData)}
        onRenameActiveBag={() => void handleRenameActiveBag()}
        onDeleteActiveBag={() => void handleDeleteActiveBag()}
        onShiftSelectedBagLeft={() => {
          if (activeBag?.id != null) {
            void moveBagLeft(activeBag.id);
          }
        }}
        onToggleActiveBagMembership={(club) => void handleToggleActiveBagMembership(club)}
        onSwitchToAllClubs={() => setClubListScope('all')}
        onChangeClubListScope={(scope) => setClubListScope(scope)}
        handleEditClub={handleEditClub}
        handleDeleteClub={handleDeleteClub}
        handleAddClub={handleAddClub}
        handleResetClubs={handleResetClubs}
        handleClearAllClubs={handleClearAllClubs}
        handleExportJSON={handleExportJSON}
        handleImportJSON={handleImportJSON}
        handleShowAnalysis={handleShowAnalysis}
        handleBackToList={() => setShowAnalysis(false)}
        handleBackFromSimulator={() => setShowSimulator(false)}
        handleShowSimulator={() => setShowSimulator(true)}
        accessories={accessories}
        onAddAccessory={handleAddAccessory}
        onUpdateAccessory={handleUpdateAccessory}
        onDeleteAccessory={handleDeleteAccessory}
        headSpeed={headSpeed}
        onHeadSpeedChange={setHeadSpeed}
      />
    </>
  );
}

export default App;
