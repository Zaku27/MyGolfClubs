import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { UseUIStateReturn } from '../hooks/useUIState';
import type { UseClubActionsReturn } from '../hooks/useClubActions';
import type { UseAppSettingsReturn } from '../hooks/useAppSettings';

interface AppContextValue {
  uiState: UseUIStateReturn;
  clubActions: UseClubActionsReturn;
  appSettings: UseAppSettingsReturn;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ 
  children, 
  uiState, 
  clubActions, 
  appSettings 
}: { 
  children: ReactNode;
  uiState: UseUIStateReturn;
  clubActions: UseClubActionsReturn;
  appSettings: UseAppSettingsReturn;
}) => {
  return (
    <AppContext.Provider value={{ uiState, clubActions, appSettings }}>
      {children}
    </AppContext.Provider>
  );
};
