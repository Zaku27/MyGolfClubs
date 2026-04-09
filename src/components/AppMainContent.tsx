import { ClubList } from './ClubList';
import { ClubForm } from './ClubForm';
import { AnalysisScreen } from './AnalysisScreen';
import { GolfBagPanel } from './GolfBagPanel';
import { SimulatorApp } from './simulator/SimulatorApp';
import type { GolfClub, GolfBag } from '../types/golf';
import type { UserLieAngleStandards } from '../types/lieStandards';

export type AppMainContentProps = {
  showSimulator: boolean;
  showForm: boolean;
  showAnalysis: boolean;
  editingClub?: GolfClub | undefined;
  activeBagClubs: GolfClub[];
  sortedClubs: GolfClub[];
  activeBagName?: string;
  activeBagId: number | null;
  activeBagClubCount: number;
  activeBagClubIds: number[];
  activeBag?: GolfBag | undefined;
  bags: GolfBag[];
  loading: boolean;
  clubListScope: 'bag' | 'all';
  clubNameSearchText: string;
  clubTypeFilter: 'All' | GolfClub['clubType'];
  onSearchTextChange: (value: string) => void;
  onSelectedClubTypeChange: (value: 'All' | GolfClub['clubType']) => void;
  handleFormSubmit: (clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>) => Promise<void>;
  handleFormCancel: () => void;
  handleActualDistanceChange: (id: number, distance: number) => Promise<void>;
  hiddenAnalysisClubKeys: string[];
  handleSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  swingWeightTarget: number;
  swingGoodTolerance: number;
  swingAdjustThreshold: number;
  handleSetSwingWeightTarget: (value: number) => void;
  handleSetSwingGoodTolerance: (value: number) => void;
  handleSetSwingAdjustThreshold: (value: number) => void;
  handleResetSwingWeightTarget: () => void;
  handleResetSwingThresholds: () => void;
  userLieAngleStandards: UserLieAngleStandards;
  handleSetLieTypeStandard: (clubType: string, value: number) => void;
  handleSetLieClubStandard: (clubName: string, value: number) => void;
  handleClearLieTypeStandard: (clubType: string) => void;
  handleClearLieClubStandard: (clubName: string) => void;
  handleResetLieStandards: () => void;
  onSelectBag: (bagId: number) => void;
  onCreateBag: () => void;
  onRenameActiveBag: () => void;
  onDeleteActiveBag: () => void;
  onShiftSelectedBagLeft: () => void;
  onToggleActiveBagMembership: (club: GolfClub) => void;
  onSwitchToAllClubs: () => void;
  onChangeClubListScope: (scope: 'bag' | 'all') => void;
  handleEditClub: (club: GolfClub) => void;
  handleDeleteClub: (id: number) => void;
  handleAddClub: () => void;
  handleResetClubs: () => void;
  handleClearAllClubs: () => void;
  handleExportJSON: () => void;
  handleImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleShowAnalysis: () => void;
  handleBackToList: () => void;
  handleBackFromSimulator: () => void;
  handleShowSimulator: () => void;
  headSpeed: number;
  onHeadSpeedChange: (value: number) => void;
};

export function AppMainContent({
  showSimulator,
  showForm,
  showAnalysis,
  editingClub,
  activeBagClubs,
  sortedClubs,
  activeBagName,
  activeBagId,
  activeBagClubCount,
  activeBagClubIds,
  activeBag,
  bags,
  loading,
  clubListScope,
  clubNameSearchText,
  clubTypeFilter,
  onSearchTextChange,
  onSelectedClubTypeChange,
  handleFormSubmit,
  handleFormCancel,
  handleActualDistanceChange,
  hiddenAnalysisClubKeys,
  handleSetAnalysisClubVisible,
  swingWeightTarget,
  swingGoodTolerance,
  swingAdjustThreshold,
  handleSetSwingWeightTarget,
  handleSetSwingGoodTolerance,
  handleSetSwingAdjustThreshold,
  handleResetSwingWeightTarget,
  handleResetSwingThresholds,
  userLieAngleStandards,
  handleSetLieTypeStandard,
  handleSetLieClubStandard,
  handleClearLieTypeStandard,
  handleClearLieClubStandard,
  handleResetLieStandards,
  onSelectBag,
  onCreateBag,
  onRenameActiveBag,
  onDeleteActiveBag,
  onShiftSelectedBagLeft,
  onToggleActiveBagMembership,
  onSwitchToAllClubs,
  onChangeClubListScope,
  handleEditClub,
  handleDeleteClub,
  handleAddClub,
  handleResetClubs,
  handleClearAllClubs,
  handleExportJSON,
  handleImportJSON,
  handleShowAnalysis,
  handleBackToList,
  handleBackFromSimulator,
  handleShowSimulator,
  headSpeed,
  onHeadSpeedChange,
}: AppMainContentProps) {
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
          onHeadSpeedChange={onHeadSpeedChange}
          hiddenAnalysisClubKeys={hiddenAnalysisClubKeys}
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
            onSelectBag={onSelectBag}
            onCreateBag={onCreateBag}
            onRenameActiveBag={onRenameActiveBag}
            onDeleteActiveBag={onDeleteActiveBag}
            onShiftSelectedBagLeft={onShiftSelectedBagLeft}
            listScope={clubListScope}
            onChangeListScope={onChangeClubListScope}
            compact
          />

          <ClubList
            clubs={clubListScope === 'bag' ? activeBagClubs : sortedClubs}
            searchText={clubNameSearchText}
            selectedClubType={clubTypeFilter}
            onSearchTextChange={onSearchTextChange}
            onSelectedClubTypeChange={onSelectedClubTypeChange}
            onEdit={handleEditClub}
            onDelete={handleDeleteClub}
            onAdd={handleAddClub}
            onReset={handleResetClubs}
            onClearAll={handleClearAllClubs}
            onExport={handleExportJSON}
            onImport={handleImportJSON}
            onShowAnalysis={handleShowAnalysis}
            onShowSimulator={handleShowSimulator}
            activeBagName={activeBagName}
            activeBagId={activeBagId ?? undefined}
            activeBagClubIds={activeBagClubIds}
            activeBagClubCount={activeBagClubCount}
            isBagView={clubListScope === 'bag'}
            allClubsCount={sortedClubs.length}
            onSwitchToAllClubs={onSwitchToAllClubs}
            onToggleActiveBagMembership={onToggleActiveBagMembership}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
