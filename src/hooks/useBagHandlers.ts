import { useCallback } from 'react';
import type { UseUIStateReturn } from './useUIState';
import type { UseClubActionsReturn } from './useClubActions';
import type { UseAppSettingsReturn } from './useAppSettings';
import type { GolfBag } from '../types/golf';
import { toImageDataArray } from '../utils/imageUtils';

export const useBagHandlers = (
  uiState: UseUIStateReturn,
  clubActions: UseClubActionsReturn,
  appSettings: UseAppSettingsReturn,
  activeBag?: GolfBag | null
) => {
  const handleCreateBagConfirm = useCallback(async (bagName: string, imageData?: string) => {
    await clubActions.handleCreateBag(bagName, toImageDataArray(imageData));
    uiState.handleHideCreateBagDialog();
    appSettings.handleChangeClubListScope('bag');
  }, [clubActions, uiState, appSettings]);

  const handleRenameActiveBag = useCallback(async () => {
    if (!activeBag?.id) {
      return;
    }
    uiState.handleShowRenameBagDialog(activeBag.id, activeBag.name, activeBag.imageData?.[0]);
  }, [activeBag, uiState]);

  const handleRenameBagConfirm = useCallback(async (bagName: string, imageData?: string) => {
    if (!uiState.renameBagTargetId) {
      return;
    }
    await clubActions.handleRenameBag(uiState.renameBagTargetId, bagName, toImageDataArray(imageData));
    uiState.handleHideRenameBagDialog();
  }, [clubActions, uiState]);

  const handleDeleteActiveBag = useCallback(async () => {
    const activeBagId = activeBag?.id;
    const activeBagName = activeBag?.name ?? 'このバッグ';
    if (typeof activeBagId !== 'number') {
      return;
    }
    await clubActions.handleDeleteBag(activeBagId, activeBagName);
  }, [activeBag, clubActions]);

  const handleShiftSelectedBagLeft = useCallback(async () => {
    if (activeBag?.id != null) {
      await clubActions.handleMoveBagLeft(activeBag.id);
    }
  }, [activeBag, clubActions]);

  return {
    handleCreateBagConfirm,
    handleRenameActiveBag,
    handleRenameBagConfirm,
    handleDeleteActiveBag,
    handleShiftSelectedBagLeft,
  };
};
