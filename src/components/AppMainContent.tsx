import { ClubList } from './ClubList';
import { ClubForm } from './ClubForm';
import { AnalysisScreen } from './AnalysisScreen';
import { AccessoryPanel } from './AccessoryPanel';
import { GolfBagPanel } from './GolfBagPanel';
import { SimulatorApp } from './simulator/SimulatorApp';
import { useAppContext } from '../context/AppContext';

export type AppMainContentProps = {
  // Bag management handlers that are defined in App.tsx
  onRenameActiveBag: () => void;
  onDeleteActiveBag: () => void;
  onShiftSelectedBagLeft: () => void;
  onShiftSelectedAccessoryLeft: () => void;
  selectedAccessoryId: string | null;
  onAccessorySelect: (id: string | null) => void;
};

export function AppMainContent({
  onRenameActiveBag,
  onDeleteActiveBag,
  onShiftSelectedBagLeft,
  onShiftSelectedAccessoryLeft,
  selectedAccessoryId,
  onAccessorySelect,
}: AppMainContentProps) {
  const { uiState, clubActions, appSettings } = useAppContext();

  const {
    showSimulator,
    showForm,
    showAnalysis,
    editingClub,
    clubNameSearchText,
    clubTypeFilter,
  } = uiState;

  const {
    activeBagClubs,
    sortedClubs,
    activeBag,
    bags,
    loading,
    activeBagClubCount,
  } = clubActions;

  const {
    clubListScope,
    hiddenAnalysisClubKeys,
    swingGoodTolerance,
    swingAdjustThreshold,
    userLieAngleStandards,
    accessories,
    headSpeed,
    handleSetAnalysisClubVisible,
    handleSetSwingGoodTolerance,
    handleSetSwingAdjustThreshold,
    handleResetSwingWeightTarget,
    handleResetSwingThresholds,
    handleSetLieTypeStandard,
    handleSetLieClubStandard,
    handleClearLieTypeStandard,
    handleClearLieClubStandard,
    handleResetLieStandards,
    handleChangeClubListScope,
    handleAddAccessory,
    handleUpdateAccessory,
    handleDeleteAccessory,
    handleHeadSpeedChange,
  } = appSettings;

  const {
    handleFormSubmit,
    handleDeleteClub,
    handleActualDistanceChange,
    handleResetClubs,
    handleClearAllClubs,
    handleDeleteAll,
    handleExportJSON,
    handleImportJSON,
    setActiveBag,
    handleToggleActiveBagMembership,
  } = clubActions;

  const {
    handleShowForm,
    handleShowFormWithClub,
    handleBackToList,
    handleBackFromSimulator,
    handleShowAnalysis,
    handleShowSimulator,
    handleSearchTextChange,
    handleSelectedClubTypeChange,
    handleShowCreateBagDialog,
    handleFormCancel,
  } = uiState;

  const activeBagName = activeBag?.name;
  const activeBagId = activeBag?.id ?? null;
  const activeBagClubIds = activeBag?.clubIds ?? [];

  const handleDeleteAllWrapper = () => {
    handleDeleteAll(appSettings.handleClearAllAccessories);
  };

  const handleExportJSONWrapper = () => {
    handleExportJSON(clubListScope, accessories);
  };

  const handleImportJSONWrapper = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const importedAccessories = await handleImportJSON(event);
    // Restore imported accessories
    for (const accessory of importedAccessories) {
      handleAddAccessory(accessory);
    }
    handleChangeClubListScope('bag');
  };
  if (showSimulator) {
    return (
      <SimulatorApp
        onBack={handleBackFromSimulator}
        selectedClubs={activeBagClubs}
        allClubs={sortedClubs}
        activeBagName={activeBagName}
        bagId={activeBagId}
      />
    );
  }

  return (
    <div className="app-container">
      {showForm ? (
        <ClubForm
          club={editingClub}
          onSubmit={(clubData) => handleFormSubmit(clubData, editingClub)}
          onCancel={handleFormCancel}
          isLoading={loading}
        />
      ) : showAnalysis ? (
        <AnalysisScreen
          clubs={activeBagClubs}
          onBack={handleBackToList}
          onUpdateActualDistance={handleActualDistanceChange}
          headSpeed={headSpeed}
          onHeadSpeedChange={handleHeadSpeedChange}
          hiddenAnalysisClubKeys={hiddenAnalysisClubKeys}
          onSetAnalysisClubVisible={handleSetAnalysisClubVisible}
          swingGoodTolerance={swingGoodTolerance}
          swingAdjustThreshold={swingAdjustThreshold}
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
          <div className="app-top-panel-row">
            <GolfBagPanel
              bags={bags}
              activeBagId={activeBag?.id ?? null}
              activeBagClubCount={activeBagClubCount}
              onSelectBag={(bagId) => setActiveBag(bagId)}
              onCreateBag={handleShowCreateBagDialog}
              onRenameActiveBag={onRenameActiveBag}
              onDeleteActiveBag={onDeleteActiveBag}
              onShiftSelectedBagLeft={onShiftSelectedBagLeft}
              listScope={clubListScope}
              onChangeListScope={handleChangeClubListScope}
              compact
            />

            <AccessoryPanel
              accessories={accessories}
              onAddAccessory={handleAddAccessory}
              onUpdateAccessory={handleUpdateAccessory}
              onDeleteAccessory={handleDeleteAccessory}
              onShiftSelectedAccessoryLeft={onShiftSelectedAccessoryLeft}
              selectedAccessoryId={selectedAccessoryId}
              onAccessorySelect={onAccessorySelect}
            />
          </div>

          <ClubList
            clubs={clubListScope === 'bag' ? activeBagClubs : sortedClubs}
            searchText={clubNameSearchText}
            selectedClubType={clubTypeFilter}
            onSearchTextChange={handleSearchTextChange}
            onSelectedClubTypeChange={handleSelectedClubTypeChange}
            onEdit={handleShowFormWithClub}
            onDelete={handleDeleteClub}
            onAdd={handleShowForm}
            onReset={handleResetClubs}
            onClearAll={handleClearAllClubs}
            onDeleteAll={handleDeleteAllWrapper}
            onExport={handleExportJSONWrapper}
            onImport={handleImportJSONWrapper}
            onShowAnalysis={handleShowAnalysis}
            onShowSimulator={handleShowSimulator}
            activeBagName={activeBagName}
            activeBagId={activeBagId ?? undefined}
            activeBagClubIds={activeBagClubIds}
            activeBagClubCount={activeBagClubCount}
            isBagView={clubListScope === 'bag'}
            allClubsCount={sortedClubs.length}
            listScope={clubListScope}
            onChangeListScope={handleChangeClubListScope}
            onSwitchToAllClubs={() => handleChangeClubListScope('all')}
            onToggleActiveBagMembership={handleToggleActiveBagMembership}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
