import { useEffect } from 'react';
import type { UseAppSettingsReturn } from './useAppSettings';
import type { UseClubActionsReturn } from './useClubActions';

/**
 * Automatically switches club list scope from 'bag' to 'all' when:
 * - Current scope is 'bag'
 * - Active bag has no clubs
 * - There are clubs available
 * - Only one bag exists
 */
export const useClubListScopeAutoSwitch = (
  appSettings: UseAppSettingsReturn,
  clubActions: UseClubActionsReturn,
  bagsLength: number
) => {
  useEffect(() => {
    if (
      appSettings.clubListScope === 'bag' &&
      clubActions.activeBagClubCount === 0 &&
      clubActions.sortedClubs.length > 0 &&
      bagsLength === 1
    ) {
      appSettings.handleChangeClubListScope('all');
    }
  }, [
    appSettings.clubListScope,
    clubActions.activeBagClubCount,
    clubActions.sortedClubs.length,
    bagsLength,
    appSettings.handleChangeClubListScope
  ]);
};
