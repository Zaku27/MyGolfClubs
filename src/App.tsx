import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { APP } from './constants/app';
import { AppHeader } from './components/Header';
import { AppDialogs } from './components/AppDialogs';
import { AppMainContent } from './components/AppMainContent';
import { AppProvider } from './context/AppContext';
import { useBagIdUrlSync } from './hooks/useBagIdUrlSync';
import { useClubListScopeAutoSwitch } from './hooks/useClubListScopeAutoSwitch';
import { useAppSettings } from './hooks/useAppSettings';
import { useUIState } from './hooks/useUIState';
import { useClubActions } from './hooks/useClubActions';
import { useBagHandlers } from './hooks/useBagHandlers';
import { useClubStore, selectActiveGolfBag } from './store/clubStore';
import { shiftItemLeft } from './utils/imageUtils';
import './App.css';

function App() {
  // Initialize custom hooks
  const uiState = useUIState();
  const clubActions = useClubActions(uiState);
  const activeBag = useClubStore(selectActiveGolfBag);
  const appSettings = useAppSettings(activeBag, clubActions.updateBagSwingSettings);

  // Bag management handlers
  const bagHandlers = useBagHandlers(uiState, clubActions, appSettings, activeBag);

  // Store data
  const bags = useClubStore((state) => state.bags);
  
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
  useClubListScopeAutoSwitch(appSettings, clubActions, bags.length);


  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string | null>(null);

  const handleShiftSelectedAccessoryLeft = () => {
    const newAccessories = shiftItemLeft(appSettings.accessories, selectedAccessoryId, a => a.id);
    appSettings.setAccessories(newAccessories);
  };

  return (
    <AppProvider uiState={uiState} clubActions={clubActions} appSettings={appSettings}>
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
      
      <AppHeader showSimulator={uiState.showSimulator} />
      
      <AppDialogs
        error={clubActions.error}
        confirmDialog={uiState.confirmDialog}
        onCloseConfirmDialog={uiState.closeConfirmDialog}
        onConfirmDialogConfirm={uiState.handleConfirmDialogConfirm}
        showCreateBagDialog={uiState.showCreateBagDialog}
        showRenameBagDialog={uiState.showRenameBagDialog}
        renameBagDefaultName={uiState.renameBagDefaultName}
        renameBagDefaultImageData={uiState.renameBagDefaultImageData}
        bags={bags}
        loading={clubActions.loading}
        onCreateBagConfirm={bagHandlers.handleCreateBagConfirm}
        onCancelCreateBag={uiState.handleHideCreateBagDialog}
        onRenameBagConfirm={bagHandlers.handleRenameBagConfirm}
        onCancelRenameBag={uiState.handleHideRenameBagDialog}
      />

      <AppMainContent
        onRenameActiveBag={bagHandlers.handleRenameActiveBag}
        onDeleteActiveBag={bagHandlers.handleDeleteActiveBag}
        onShiftSelectedBagLeft={bagHandlers.handleShiftSelectedBagLeft}
        onShiftSelectedAccessoryLeft={handleShiftSelectedAccessoryLeft}
        selectedAccessoryId={selectedAccessoryId}
        onAccessorySelect={setSelectedAccessoryId}
      />
    </AppProvider>
  );
}

export default App;
