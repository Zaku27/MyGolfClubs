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
    clearAllBags,
    createBag,
    renameBag,
    deleteBag,
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
    if (!file) return [];

    try {
      const { clubs: importedClubs, bags: importedBags, accessories: importedAccessories } = await readCompleteDataFromJsonFile(file);

      await clearAllClubs();

      // Create clubs and build mapping from exportId to new database ID
      const exportIdToDbIdMap = new Map<string, number>();
      for (const club of importedClubs) {
        const { exportId, ...clubData } = club as { exportId?: string; [key: string]: unknown };
        const newId = await addClub(clubData as Omit<GolfClub, 'id'>);
        if (exportId && typeof newId === 'number') {
          exportIdToDbIdMap.set(exportId, newId);
        }
      }
      await loadClubs();

      // Import bags if available
      if (importedBags.length > 0) {
        for (const bag of importedBags) {
          await createBag(bag.name);
        }
        await loadBags();

        // Update bags with translated clubIds and other properties
        const currentBags = useClubStore.getState().bags;
        for (let i = 0; i < importedBags.length && i < currentBags.length; i++) {
          const importedBag = importedBags[i];
          const currentBag = currentBags[i];
          if (currentBag.id) {
            // Translate exportIds to database IDs
            // Handle both new format (string[] exportIds) and old format (number[] database IDs)
            let translatedClubIds: number[];
            const clubIds = importedBag.clubIds as unknown;
            if (Array.isArray(clubIds) && clubIds.length > 0 && typeof clubIds[0] === 'string') {
              // New format: convert exportIds to database IDs
              translatedClubIds = (clubIds as string[])
                .map((exportId) => exportIdToDbIdMap.get(exportId))
                .filter((id): id is number => id != null);
            } else {
              // Old format: use database IDs directly (but filter to ensure they exist)
              const allClubIds = useClubStore.getState().clubs.map(c => c.id).filter((id): id is number => id != null);
              translatedClubIds = (clubIds as number[])
                .filter((id) => allClubIds.includes(id));
            }
            
            // Update clubIds with translated IDs
            await updateBagClubIds(currentBag.id, translatedClubIds);
            
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

        // Set active bag to first imported bag
        if (currentBags.length > 0 && currentBags[0].id) {
          await setActiveBag(currentBags[0].id);
        }
      } else {
        // If no bags were imported, create default bag with first 14 clubs
        const allClubs = useClubStore.getState().clubs;
        const first14ClubIds = allClubs
          .slice(0, 14)
          .map((club) => club.id)
          .filter((clubId): clubId is number => typeof clubId === 'number');
        
        if (first14ClubIds.length > 0) {
          await createBag('メインバッグ');
          await loadBags();
          const bags = useClubStore.getState().bags;
          if (bags.length > 0 && bags[0].id) {
            await updateBagClubIds(bags[0].id, first14ClubIds);
            await setActiveBag(bags[0].id);
          }
        }
      }

      alert('インポートが完了しました');
      return importedAccessories;
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
      return [];
    }

    event.target.value = '';
  }, [clearAllClubs, addClub, loadClubs, createBag, loadBags, updateBagImage, updateBagSwingSettings, updateBagClubIds, setActiveBag]);

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
  };
};

export type UseClubActionsReturn = ReturnType<typeof useClubActions>;
