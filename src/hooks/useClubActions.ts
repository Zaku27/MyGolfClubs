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
    initializeDefaults,
    resetToDefaults,
    clearAllClubs,
    createBag,
    renameBag,
    deleteBag,
    setActiveBag,
    toggleClubInActiveBag,
    replaceActiveBagClubIds,
    updateBagImage,
    updateBagSwingSettings,
    updateBagClubIds,
    moveBagLeft,
    moveBagRight,
  } = useClubStore();

  const {
    openConfirmDialog,
    handleFormCancel,
    handleShowImagePropagationConfirm,
  } = uiState;

  const activeBagClubs = useClubStore(selectSortedActiveBagClubs);
  const activeBag = useClubStore(selectActiveGolfBag);
  const bags = useClubStore((state) => state.bags);
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBagClubCount = activeBagClubs.length;

  // Helper function to check if image data is the same
  const isSameImageData = useCallback((a?: string[], b?: string[]): boolean => {
    if (!a || !b) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }, []);

  // Helper function to check if we should ask about image propagation
  const shouldAskImagePropagation = useCallback((
    clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>,
    editingClub?: GolfClub | undefined
  ): boolean => {
    const name = (clubData.name ?? editingClub?.name)?.trim();
    if (!name || !clubData.imageData?.length) {
      return false;
    }

    const imageChanged = !editingClub || !isSameImageData(clubData.imageData, editingClub.imageData);
    if (!imageChanged) {
      return false;
    }

    const sameNameClubs = sortedClubs.filter((clubItem) => {
      if (editingClub && editingClub.id) {
        return clubItem.name === name && clubItem.id !== editingClub.id;
      }
      return clubItem.name === name;
    });
    return sameNameClubs.length > 0;
  }, [sortedClubs, isSameImageData]);

  // Club CRUD operations
  const handleAddClub = useCallback(() => {
    // This will be handled by the UI state hook
    // Just a placeholder for consistency
  }, []);

  const handleEditClub = useCallback((_club: GolfClub) => {
    // This will be handled by the UI state hook
    // Just a placeholder for consistency
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
    propagateSameName = true,
  ) => {
    if (editingClub && editingClub.id) {
      await updateClub(editingClub.id, clubData, propagateSameName);
    } else {
      await addClub(clubData as Omit<GolfClub, 'id'>, propagateSameName);
    }
    handleFormCancel();
  }, [updateClub, addClub, handleFormCancel]);

  const handleFormSubmit = useCallback(async (
    clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>,
    editingClub?: GolfClub | undefined
  ) => {
    const askPropagation = shouldAskImagePropagation(clubData, editingClub);
    if (askPropagation) {
      handleShowImagePropagationConfirm(clubData);
      return;
    }
    await submitClubData(clubData, editingClub, true);
  }, [shouldAskImagePropagation, handleShowImagePropagationConfirm, submitClubData]);

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

  // Import/Export operations
  const handleImportJSON = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<Omit<AccessoryItem, 'id' | 'createdAt'>[]> => {
    const file = event.target.files?.[0];
    if (!file) return [];

    try {
      const { clubs: importedClubs, bags: importedBags, accessories: importedAccessories } = await readCompleteDataFromJsonFile(file);

      await clearAllClubs();
      for (const club of importedClubs) {
        await addClub(club);
      }
      await loadClubs();

      // Import bags if available
      if (importedBags.length > 0) {
        for (const bag of importedBags) {
          await createBag(bag.name);
        }
        await loadBags();

        // Update bags with clubIds and other properties
        const currentBags = useClubStore.getState().bags;
        for (let i = 0; i < importedBags.length && i < currentBags.length; i++) {
          const importedBag = importedBags[i];
          const currentBag = currentBags[i];
          if (currentBag.id) {
            // Update clubIds
            await updateBagClubIds(currentBag.id, importedBag.clubIds);
            // Update imageData if present
            if (importedBag.imageData) {
              await updateBagImage(currentBag.id, importedBag.imageData);
            }
            // Update swing settings if present
            if (importedBag.swingWeightTarget || importedBag.swingGoodTolerance || importedBag.swingAdjustThreshold) {
              await updateBagSwingSettings(currentBag.id, {
                swingWeightTarget: importedBag.swingWeightTarget,
                swingGoodTolerance: importedBag.swingGoodTolerance,
                swingAdjustThreshold: importedBag.swingAdjustThreshold,
              });
            }
          }
        }
        await loadBags();
      }

      // Set active bag to first imported bag or default
      const nextClubIds = sortedClubs
        .slice(0, 14)
        .map((club) => club.id)
        .filter((clubId): clubId is number => typeof clubId === 'number');
      await replaceActiveBagClubIds(nextClubIds);
      alert('インポートが完了しました');
      return importedAccessories;
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
      return [];
    }

    event.target.value = '';
  }, [clearAllClubs, addClub, loadClubs, sortedClubs, replaceActiveBagClubIds, createBag, loadBags, updateBagImage, updateBagSwingSettings, updateBagClubIds]);

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

  const handleToggleActiveBagMembership = useCallback(async (clubItem: GolfClub) => {
    if (typeof clubItem.id !== 'number') {
      return;
    }

    await toggleClubInActiveBag(clubItem.id);
  }, [toggleClubInActiveBag]);

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
    await loadClubs();
    await loadBags();
  }, [initializeDefaults, loadClubs, loadBags]);

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

    // Import/Export
    handleImportJSON,
    handleExportJSON,

    // Bag operations
    handleCreateBag,
    handleRenameBag,
    handleDeleteBag,
    handleToggleActiveBagMembership,
    handleAddBagImage,
    setActiveBag,
    updateBagSwingSettings,
    handleMoveBagLeft,
    handleMoveBagRight,

    // App initialization
    initializeApp,

    // Utility functions
    submitClubData,
    shouldAskImagePropagation,
  };
};

export type UseClubActionsReturn = ReturnType<typeof useClubActions>;
