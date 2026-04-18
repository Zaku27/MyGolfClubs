import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { GolfClub } from '../types/golf';

export type ConfirmDialogState = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export const useUIState = () => {
  // Main view states
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Form states
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [showCreateBagDialog, setShowCreateBagDialog] = useState(false);
  const [showRenameBagDialog, setShowRenameBagDialog] = useState(false);
  const [renameBagTargetId, setRenameBagTargetId] = useState<number | null>(null);
  const [renameBagDefaultName, setRenameBagDefaultName] = useState('');
  const [renameBagDefaultImageData, setRenameBagDefaultImageData] = useState<string | undefined>(undefined);

  // Search and filter states
  const [clubNameSearchText, setClubNameSearchText] = useState('');
  const [clubTypeFilter, setClubTypeFilter] = useState<'All' | GolfClub['clubType']>('All');

  const location = useLocation();

  // Main view handlers
  const handleShowForm = useCallback(() => {
    setShowAnalysis(false);
    setEditingClub(undefined);
    setShowForm(true);
  }, []);

  const handleShowFormWithClub = useCallback((club: GolfClub) => {
    setShowAnalysis(false);
    setEditingClub(club);
    setShowForm(true);
  }, []);

  const handleShowAnalysis = useCallback(() => {
    setShowForm(false);
    setEditingClub(undefined);
    setShowAnalysis(true);
  }, []);

  const handleShowSimulator = useCallback(() => {
    setShowSimulator(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setShowAnalysis(false);
  }, []);

  const handleBackFromSimulator = useCallback(() => {
    setShowSimulator(false);
  }, []);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingClub(undefined);
  }, []);

  // Form submission handlers
  const handleFormSubmit = useCallback(() => {
    // This will be handled by the parent component
  }, []);

  const submitClubData = useCallback(async () => {
    // This will be implemented in the parent component
    setShowForm(false);
    setEditingClub(undefined);
  }, []);

  // Confirm dialog handlers
  const openConfirmDialog = useCallback((dialogState: ConfirmDialogState) => {
    setConfirmDialog(dialogState);
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const handleConfirmDialogConfirm = useCallback(async () => {
    if (!confirmDialog) {
      return;
    }

    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    await action();
  }, [confirmDialog, closeConfirmDialog]);

  // Bag dialog handlers
  const handleShowCreateBagDialog = useCallback(() => {
    setShowCreateBagDialog(true);
  }, []);

  const handleHideCreateBagDialog = useCallback(() => {
    setShowCreateBagDialog(false);
  }, []);

  const handleShowRenameBagDialog = useCallback((bagId: number, defaultName: string, defaultImageData?: string) => {
    setRenameBagTargetId(bagId);
    setRenameBagDefaultName(defaultName);
    setRenameBagDefaultImageData(defaultImageData);
    setShowRenameBagDialog(true);
  }, []);

  const handleHideRenameBagDialog = useCallback(() => {
    setShowRenameBagDialog(false);
    setRenameBagTargetId(null);
    setRenameBagDefaultName('');
    setRenameBagDefaultImageData(undefined);
  }, []);

  // Search and filter handlers
  const handleSearchTextChange = useCallback((value: string) => {
    setClubNameSearchText(value);
  }, []);

  const handleSelectedClubTypeChange = useCallback((value: 'All' | GolfClub['clubType']) => {
    setClubTypeFilter(value);
  }, []);

  // Check for simulator in location state
  const checkLocationState = useCallback(() => {
    if (location.state?.openSimulator) {
      setShowSimulator(true);
    }
  }, [location.state]);

  return {
    // State
    showForm,
    showAnalysis,
    showSimulator,
    editingClub,
    confirmDialog,
    showCreateBagDialog,
    showRenameBagDialog,
    renameBagTargetId,
    renameBagDefaultName,
    renameBagDefaultImageData,
    clubNameSearchText,
    clubTypeFilter,

    // Handlers
    handleShowForm,
    handleShowFormWithClub,
    handleShowAnalysis,
    handleShowSimulator,
    handleBackToList,
    handleBackFromSimulator,
    handleFormCancel,
    handleFormSubmit,
    submitClubData,
    openConfirmDialog,
    closeConfirmDialog,
    handleConfirmDialogConfirm,
    handleShowCreateBagDialog,
    handleHideCreateBagDialog,
    handleShowRenameBagDialog,
    handleHideRenameBagDialog,
    handleSearchTextChange,
    handleSelectedClubTypeChange,
    checkLocationState,
  };
};

export type UseUIStateReturn = ReturnType<typeof useUIState>;
