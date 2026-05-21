import { useCallback, useMemo } from 'react';
import { useClubStore, selectSortedActiveBagClubs, selectActiveGolfBag, selectSortedClubsForDisplay } from '../store/clubStore';
import { getClubTypeDisplay } from '../utils/clubUtils';
import {
  downloadCompleteDataAsJson,
  readCompleteDataFromJsonFile,
} from '../utils/clubTransfer';
import type { GolfClub, AccessoryItem } from '../types/golf';
import type { UseUIStateReturn } from './useUIState';

export const useClubActions = (uiState: UseUIStateReturn) => {
  const {
    loading,
    error,
    loadClubs,
    loadBags,
    addClub,
    updateClub,
    deleteClub,
    toggleClubLock,
    toggleBagLock,
    initializeDefaults,
    resetToDefaults,
    clearAllClubs,
    clearAllBags,
    createBag,
    renameBag,
    deleteBag,
    copyBag,
    setActiveBag,
    toggleClubInActiveBag,
    updateBagImage,
    updateBagSwingSettings,
    updateBagClubIds,
    moveBagLeft,
    moveBagRight,
  } = useClubStore();

  const {
    openConfirmDialog,
    handleFormCancel,
  } = uiState;

  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubCount = activeBagClubs.length;

  // Club CRUD operations
  const handleAddClub = useCallback(() => {
    // This will be handled by the UI state hook
    // Just a placeholder for consistency
  }, []);

  const handleEditClub = useCallback((_club: GolfClub) => {
    // This will be handled by the UI state hook
    // Just a placeholder for consistency
    void _club; // eslint-disable-line @typescript-eslint/no-unused-vars
  }, []);

  const handleDeleteClub = useCallback(async (id: number) => {
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
  }, [sortedClubs, openConfirmDialog, deleteClub]);

  const handleActualDistanceChange = useCallback(async (id: number, distance: number) => {
    await updateClub(id, { distance });
  }, [updateClub]);

  // Club form submission
  const submitClubData = useCallback(async (
    clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>,
    editingClub?: GolfClub | undefined,
  ) => {
    if (editingClub && editingClub.id) {
      await updateClub(editingClub.id, clubData);
    } else {
      await addClub(clubData as Omit<GolfClub, 'id'>);
    }
    handleFormCancel();
  }, [updateClub, addClub, handleFormCancel]);

  const handleFormSubmit = useCallback(async (
    clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>,
    editingClub?: GolfClub | undefined
  ) => {
    await submitClubData(clubData, editingClub);
  }, [submitClubData]);

  // Club management operations
  const handleResetClubs = useCallback(() => {
    openConfirmDialog({
      title: 'クラブの初期化',
      message: '全てのクラブが削除され、初期14本に戻ります。よろしいですか？',
      confirmLabel: '戻す',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        handleFormCancel();
        await resetToDefaults();
      },
    });
  }, [openConfirmDialog, resetToDefaults, handleFormCancel]);

  const handleClearAllClubs = useCallback(() => {
    openConfirmDialog({
      title: 'クラブデータの削除',
      message: '全てのクラブデータを完全に削除します。よろしいですか？',
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await clearAllClubs();
        handleFormCancel();
      },
    });
  }, [openConfirmDialog, clearAllClubs, handleFormCancel]);

  const handleDeleteAll = useCallback((clearAllAccessories: () => void) => {
    openConfirmDialog({
      title: '全データの削除',
      message: 'クラブ、バッグ、アクセサリーの全てのデータを削除して初期状態に戻します。よろしいですか？',
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await clearAllBags();
        await clearAllClubs();
        clearAllAccessories();
        handleFormCancel();
      },
    });
  }, [openConfirmDialog, clearAllClubs, clearAllBags, handleFormCancel]);

  // Import/Export operations
  const handleImportJSON = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<Omit<AccessoryItem, 'id' | 'createdAt'>[]> => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return [];
    }

    try {
      const { clubs: importedClubs, bags: importedBags, accessories: importedAccessories } = await readCompleteDataFromJsonFile(file);

      // Clear all bag and club data first to avoid stale relationships from the current browser state.
      await clearAllBags();
      await clearAllClubs();

      // Create clubs and build mapping from exportId to new database ID.
      const exportIdToDbIdMap = new Map<string, number>();
      const importedClubIds: number[] = [];
      for (const club of importedClubs) {
        const { exportId, ...clubData } = club as { exportId?: string; [key: string]: unknown };
        const newId = await addClub(clubData as Omit<GolfClub, 'id'>);
        if (typeof newId === 'number') {
          importedClubIds.push(newId);
          if (exportId) {
            exportIdToDbIdMap.set(exportId, newId);
          }
        }
      }
      await loadClubs();

      let firstBagId: number | undefined;
      if (importedBags.length > 0) {
        for (const importedBag of importedBags) {
          const newBagId = await createBag(importedBag.name, importedBag.imageData);
          if (firstBagId === undefined) {
            firstBagId = newBagId;
          }

          const clubIds = Array.isArray(importedBag.clubIds) ? importedBag.clubIds : [];
          const translatedClubIds = clubIds
            .map((clubId) => (typeof clubId === 'string' ? exportIdToDbIdMap.get(clubId) : undefined))
            .filter((id): id is number => id != null);

          await updateBagClubIds(newBagId, translatedClubIds);

          if (
            importedBag.swingWeightTarget != null ||
            importedBag.swingGoodTolerance != null ||
            importedBag.swingAdjustThreshold != null
          ) {
            await updateBagSwingSettings(newBagId, {
              swingWeightTarget: importedBag.swingWeightTarget,
              swingGoodTolerance: importedBag.swingGoodTolerance,
              swingAdjustThreshold: importedBag.swingAdjustThreshold,
            });
          }
        }
        await loadBags();

        if (firstBagId !== undefined) {
          await setActiveBag(firstBagId);
        }
      } else if (importedClubIds.length > 0) {
        const newBagId = await createBag('メインバッグ');
        await updateBagClubIds(newBagId, importedClubIds.slice(0, 14));
        await loadBags();
        await setActiveBag(newBagId);
      }

      alert('インポートが完了しました');
      return importedAccessories;
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
      return [];
    } finally {
      event.target.value = '';
    }
  }, [clearAllBags, clearAllClubs, addClub, loadClubs, createBag, loadBags, updateBagSwingSettings, updateBagClubIds, setActiveBag]);

  const handleExportJSON = useCallback((_clubListScope: 'bag' | 'all', accessories: AccessoryItem[] = []) => {
    downloadCompleteDataAsJson(sortedClubs, bags, accessories);
  }, [sortedClubs, bags]);

  // Bag operations
  const handleCreateBag = useCallback(async (bagName: string, imageData?: string[]) => {
    await createBag(bagName, imageData);
  }, [createBag]);

  const handleRenameBag = useCallback(async (bagId: number, bagName: string, imageData?: string[]) => {
    await renameBag(bagId, bagName, imageData);
  }, [renameBag]);

  const handleDeleteBag = useCallback(async (bagId: number, bagName: string) => {
    openConfirmDialog({
      title: 'バッグの削除',
      message: `「${bagName}」を削除します。よろしいですか？`,
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await deleteBag(bagId);
      },
    });
  }, [openConfirmDialog, deleteBag]);

  const handleCopyBag = useCallback(async (bagId: number) => {
    await copyBag(bagId);
  }, [copyBag]);

  const handleToggleActiveBagMembership = useCallback(async (clubItem: GolfClub) => {
    if (typeof clubItem.id !== 'number') {
      return;
    }

    await toggleClubInActiveBag(clubItem.id);
  }, [toggleClubInActiveBag]);

  const handleToggleClubLock = useCallback(async (clubItem: GolfClub) => {
    if (typeof clubItem.id !== 'number') {
      return;
    }

    await toggleClubLock(clubItem.id);
  }, [toggleClubLock]);

  const handleToggleBagLock = useCallback(async (bagId: number) => {
    await toggleBagLock(bagId);
  }, [toggleBagLock]);

  const handleAddBagImage = useCallback(async (bagId: number, imageData: string[]) => {
    await updateBagImage(bagId, imageData);
  }, [updateBagImage]);

  const handleMoveBagLeft = useCallback(async (bagId: number) => {
    await moveBagLeft(bagId);
  }, [moveBagLeft]);

  const handleMoveBagRight = useCallback(async (bagId: number) => {
    await moveBagRight(bagId);
  }, [moveBagRight]);

  // Analysis club visibility
  const analysisHiddenKeys = useMemo(() => {
    // This will be handled by the useAppSettings hook
    return [];
  }, []);

  // Initialize app data
  const initializeApp = useCallback(async () => {
    await initializeDefaults();
  }, [initializeDefaults]);

  return {
    // State
    loading,
    error,
    activeBagClubs,
    activeBag,
    bags,
    sortedClubs,
    activeBagClubCount,
    analysisHiddenKeys,

    // Club operations
    handleAddClub,
    handleEditClub,
    handleDeleteClub,
    handleActualDistanceChange,
    handleFormSubmit,
    handleResetClubs,
    handleClearAllClubs,
    handleDeleteAll,

    // Import/Export
    handleImportJSON,
    handleExportJSON,

    // Bag operations
    handleCreateBag,
    handleRenameBag,
    handleDeleteBag,
    handleCopyBag,
    handleToggleActiveBagMembership,
    handleToggleClubLock,
    handleToggleBagLock,
    handleAddBagImage,
    setActiveBag,
    updateBagSwingSettings,
    handleMoveBagLeft,
    handleMoveBagRight,

    // App initialization
    initializeApp,

    // Utility functions
    submitClubData,
  };
};

export type UseClubActionsReturn = ReturnType<typeof useClubActions>;
