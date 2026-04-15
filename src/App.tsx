import { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { APP } from './constants/app';
import { Header } from './components/Header';
import { AppDialogs } from './components/AppDialogs';
import { AppMainContent } from './components/AppMainContent';
import { useBagIdUrlSync } from './hooks/useBagIdUrlSync';
import { useAppSettings } from './hooks/useAppSettings';
import { useUIState } from './hooks/useUIState';
import { useClubActions } from './hooks/useClubActions';
import { useClubStore, selectActiveGolfBag } from './store/clubStore';
import { getAnalysisClubKey } from './utils/clubUtils';
import type { GolfClub } from './types/golf';
import './App.css';

function App() {
  // Initialize custom hooks
  const appSettings = useAppSettings();
  const uiState = useUIState();
  const clubActions = useClubActions(uiState);
  
  // Store data
  const bags = useClubStore((state) => state.bags);
  const activeBag = useClubStore(selectActiveGolfBag);
  
  // URL sync for bag ID
  useBagIdUrlSync({
    bags,
    activeBagId: activeBag?.id ?? null,
    setActiveBag: clubActions.setActiveBag || (() => {}),
  });

  // Initialize app data
  useEffect(() => {
    clubActions.initializeApp();
  }, [clubActions.initializeApp]);

  // Check location state for simulator
  useEffect(() => {
    uiState.checkLocationState();
  }, [uiState.checkLocationState]);

  // Handle club list scope auto-switch
  useEffect(() => {
    if (
      appSettings.clubListScope === 'bag' && 
      clubActions.activeBagClubCount === 0 && 
      clubActions.sortedClubs.length > 0 && 
      bags.length === 1
    ) {
      appSettings.handleChangeClubListScope('all');
    }
  }, [
    appSettings.clubListScope,
    clubActions.activeBagClubCount,
    clubActions.sortedClubs.length,
    bags.length,
    appSettings.handleChangeClubListScope
  ]);

  // Filter analysis hidden keys for current bag
  const analysisHiddenKeys = useMemo(() => {
    return appSettings.hiddenAnalysisClubKeys.filter((clubKey) =>
      clubActions.activeBagClubs.some((club) => getAnalysisClubKey(club) === clubKey),
    );
  }, [clubActions.activeBagClubs, appSettings.hiddenAnalysisClubKeys]);

  // Image propagation confirmation handler
  const handleConfirmPropagation = async (propagate: boolean) => {
    if (!uiState.pendingClubData) {
      uiState.handleCancelImagePropagation();
      return;
    }
    await clubActions.submitClubData(uiState.pendingClubData, uiState.editingClub, propagate);
  };

  // Bag management handlers
  const handleCreateBagConfirm = async (bagName: string) => {
    await clubActions.handleCreateBag(bagName);
    uiState.handleHideCreateBagDialog();
    appSettings.handleChangeClubListScope('bag');
  };

  const handleRenameActiveBag = async () => {
    if (!activeBag?.id) {
      return;
    }
    uiState.handleShowRenameBagDialog(activeBag.id, activeBag.name);
  };

  const handleRenameBagConfirm = async (bagName: string) => {
    if (!uiState.renameBagTargetId) {
      return;
    }
    await clubActions.handleRenameBag(uiState.renameBagTargetId, bagName);
    uiState.handleHideRenameBagDialog();
  };

  const handleDeleteActiveBag = async () => {
    const activeBagId = activeBag?.id;
    const activeBagName = activeBag?.name ?? 'このバッグ';
    if (typeof activeBagId !== 'number') {
      return;
    }
    await clubActions.handleDeleteBag(activeBagId, activeBagName);
  };

  const handleShiftSelectedBagLeft = () => {
    if (activeBag?.id != null) {
      // This would need to be implemented in the store
      // clubActions.moveBagLeft(activeBag.id);
    }
  };

  const handleToggleActiveBagMembership = async (club: GolfClub) => {
    await clubActions.handleToggleActiveBagMembership(club);
  };

  const handleFormSubmit = async (clubData: Partial<GolfClub>) => {
    await clubActions.handleFormSubmit(clubData, uiState.editingClub);
  };

  const handleExportJSON = () => {
    clubActions.handleExportJSON(appSettings.clubListScope);
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await clubActions.handleImportJSON(event);
    appSettings.handleChangeClubListScope('bag');
  };

  const handleShowAnalysis = () => {
    uiState.handleShowAnalysis();
  };

  const handleBackToList = () => {
    uiState.handleBackToList();
  };

  const handleBackFromSimulator = () => {
    uiState.handleBackFromSimulator();
  };

  const handleShowSimulator = () => {
    uiState.handleShowSimulator();
  };

  const handleAddClub = () => {
    uiState.handleShowForm();
  };

  const handleEditClub = (club: GolfClub) => {
    uiState.handleShowFormWithClub(club);
  };

  const handleAddBagImage = async (bagId: number, imageData: string[]) => {
    await clubActions.handleAddBagImage(bagId, imageData);
  };

  return (
    <>
      <Helmet>
        <title>{`${APP.short} - ${APP.name}`}</title>
        <meta name="description" content={APP.tagline} />
        <meta property="og:title" content={`${APP.short} - ${APP.name}`} />
        <meta property="og:description" content={APP.tagline} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${APP.short} - ${APP.name}`} />
        <meta name="twitter:description" content={APP.tagline} />
      </Helmet>
      
      <Header />
      
      <AppDialogs
        error={clubActions.error}
        showImagePropagationConfirm={uiState.showImagePropagationConfirm}
        pendingClubData={uiState.pendingClubData}
        onCancelImagePropagation={uiState.handleCancelImagePropagation}
        onConfirmPropagation={handleConfirmPropagation}
        confirmDialog={uiState.confirmDialog}
        onCloseConfirmDialog={uiState.closeConfirmDialog}
        onConfirmDialogConfirm={uiState.handleConfirmDialogConfirm}
        showCreateBagDialog={uiState.showCreateBagDialog}
        showRenameBagDialog={uiState.showRenameBagDialog}
        renameBagDefaultName={uiState.renameBagDefaultName}
        bags={bags}
        loading={clubActions.loading}
        onCreateBagConfirm={handleCreateBagConfirm}
        onCancelCreateBag={uiState.handleHideCreateBagDialog}
        onRenameBagConfirm={handleRenameBagConfirm}
        onCancelRenameBag={uiState.handleHideRenameBagDialog}
      />

      <AppMainContent
        showSimulator={uiState.showSimulator}
        showForm={uiState.showForm}
        showAnalysis={uiState.showAnalysis}
        editingClub={uiState.editingClub}
        activeBagClubs={clubActions.activeBagClubs}
        sortedClubs={clubActions.sortedClubs}
        activeBagName={activeBag?.name}
        activeBagId={activeBag?.id ?? null}
        activeBagClubCount={clubActions.activeBagClubCount}
        activeBagClubIds={activeBag?.clubIds ?? []}
        activeBag={activeBag ?? undefined}
        bags={bags}
        loading={clubActions.loading}
        clubListScope={appSettings.clubListScope}
        clubNameSearchText={uiState.clubNameSearchText}
        clubTypeFilter={uiState.clubTypeFilter}
        onSearchTextChange={uiState.handleSearchTextChange}
        onSelectedClubTypeChange={uiState.handleSelectedClubTypeChange}
        handleFormSubmit={handleFormSubmit}
        handleFormCancel={uiState.handleFormCancel}
        handleActualDistanceChange={clubActions.handleActualDistanceChange}
        hiddenAnalysisClubKeys={analysisHiddenKeys}
        handleSetAnalysisClubVisible={appSettings.handleSetAnalysisClubVisible}
        swingWeightTarget={appSettings.swingWeightTarget}
        swingGoodTolerance={appSettings.swingGoodTolerance}
        swingAdjustThreshold={appSettings.swingAdjustThreshold}
        handleSetSwingWeightTarget={appSettings.handleSetSwingWeightTarget}
        handleSetSwingGoodTolerance={appSettings.handleSetSwingGoodTolerance}
        handleSetSwingAdjustThreshold={appSettings.handleSetSwingAdjustThreshold}
        handleResetSwingWeightTarget={appSettings.handleResetSwingWeightTarget}
        handleResetSwingThresholds={appSettings.handleResetSwingThresholds}
        userLieAngleStandards={appSettings.userLieAngleStandards}
        handleSetLieTypeStandard={appSettings.handleSetLieTypeStandard}
        handleSetLieClubStandard={appSettings.handleSetLieClubStandard}
        handleClearLieTypeStandard={appSettings.handleClearLieTypeStandard}
        handleClearLieClubStandard={appSettings.handleClearLieClubStandard}
        handleResetLieStandards={appSettings.handleResetLieStandards}
        onSelectBag={(bagId) => {
          // This would need to be implemented in the store
          // clubActions.setActiveBag(bagId);
        }}
        onCreateBag={uiState.handleShowCreateBagDialog}
        onAddBagImage={handleAddBagImage}
        onRenameActiveBag={handleRenameActiveBag}
        onDeleteActiveBag={handleDeleteActiveBag}
        onShiftSelectedBagLeft={handleShiftSelectedBagLeft}
        onToggleActiveBagMembership={handleToggleActiveBagMembership}
        onSwitchToAllClubs={() => appSettings.handleChangeClubListScope('all')}
        onChangeClubListScope={appSettings.handleChangeClubListScope}
        handleEditClub={handleEditClub}
        handleDeleteClub={clubActions.handleDeleteClub}
        handleAddClub={handleAddClub}
        handleResetClubs={clubActions.handleResetClubs}
        handleClearAllClubs={clubActions.handleClearAllClubs}
        handleExportJSON={handleExportJSON}
        handleImportJSON={handleImportJSON}
        handleShowAnalysis={handleShowAnalysis}
        handleBackToList={handleBackToList}
        handleBackFromSimulator={handleBackFromSimulator}
        handleShowSimulator={handleShowSimulator}
        accessories={appSettings.accessories}
        onAddAccessory={appSettings.handleAddAccessory}
        onUpdateAccessory={appSettings.handleUpdateAccessory}
        onDeleteAccessory={appSettings.handleDeleteAccessory}
        headSpeed={appSettings.headSpeed}
        onHeadSpeedChange={appSettings.handleHeadSpeedChange}
      />
    </>
  );
}

export default App;
