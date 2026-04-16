import { useState, useCallback, useMemo } from 'react';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  normalizeLieStandardKey,
  type UserLieAngleStandards,
} from '../types/lieStandards';
import {
  readStoredJson,
  readStoredNumber,
  writeStoredJson,
  writeStoredValue,
} from '../utils/storage';
import type { AccessoryItem, GolfBag } from '../types/golf';

// Storage keys
const HEAD_SPEED_STORAGE_KEY = 'golfbag-head-speed-ms';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY = 'golfbag-analysis-hidden-clubs';
const CLUB_LIST_SCOPE_STORAGE_KEY = 'golfbag-club-list-scope';
const ACCESSORY_STORAGE_KEY = 'golfbag-accessories';

// Default values
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;
const DEFAULT_ACCESSORIES: AccessoryItem[] = [];

// Parser functions
const parseUserLieAngleStandards = (value: unknown): UserLieAngleStandards => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_USER_LIE_ANGLE_STANDARDS;
  }

  const parsed = value as Partial<UserLieAngleStandards>;
  return {
    byClubType: parsed.byClubType ?? {},
    byClubName: parsed.byClubName ?? {},
  };
};

const parseHiddenAnalysisClubKeys = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const parseClubListScope = (value: unknown): 'bag' | 'all' => {
  return value === 'all' ? 'all' : 'bag';
};

const parseAccessories = (value: unknown): AccessoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is AccessoryItem =>
      item && typeof item === 'object' &&
      typeof (item as any).id === 'string' &&
      typeof (item as any).name === 'string' &&
      typeof (item as any).createdAt === 'string'
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      note: typeof item.note === 'string' ? item.note : undefined,
      imageData: typeof item.imageData === 'string' ? item.imageData : undefined,
      createdAt: item.createdAt,
    }));
};

export const useAppSettings = (activeBag?: GolfBag | null, updateBagSwingSettings?: (id: number, settings: { swingWeightTarget?: number; swingGoodTolerance?: number; swingAdjustThreshold?: number }) => Promise<void>) => {
  // Head speed settings
  const [headSpeed, setHeadSpeed] = useState<number>(() => {
    return readStoredNumber(HEAD_SPEED_STORAGE_KEY, 42, { min: 0.1 });
  });

  // Lie angle standards
  const [userLieAngleStandards, setUserLieAngleStandards] =
    useState<UserLieAngleStandards>(() => {
      return readStoredJson(
        LIE_STANDARDS_STORAGE_KEY,
        DEFAULT_USER_LIE_ANGLE_STANDARDS,
        parseUserLieAngleStandards,
      );
    });

  // Swing weight settings - use per-bag values with fallback to global defaults
  const swingWeightTarget = useMemo(() => {
    return activeBag?.swingWeightTarget ?? 
      readStoredNumber(SWING_TARGET_STORAGE_KEY, DEFAULT_SWING_TARGET, { decimals: 1 });
  }, [activeBag]);

  const swingGoodTolerance = useMemo(() => {
    return activeBag?.swingGoodTolerance ?? 
      readStoredNumber(SWING_GOOD_TOLERANCE_STORAGE_KEY, DEFAULT_SWING_GOOD_TOLERANCE, { decimals: 1 });
  }, [activeBag]);

  const swingAdjustThreshold = useMemo(() => {
    return activeBag?.swingAdjustThreshold ?? 
      readStoredNumber(SWING_ADJUST_THRESHOLD_STORAGE_KEY, DEFAULT_SWING_ADJUST_THRESHOLD, { decimals: 1 });
  }, [activeBag]);

  // Analysis settings
  const [hiddenAnalysisClubKeys, setHiddenAnalysisClubKeys] = useState<string[]>(() => {
    return readStoredJson(
      ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY,
      [],
      parseHiddenAnalysisClubKeys,
    );
  });

  // Club list scope
  const [clubListScope, setClubListScope] = useState<'bag' | 'all'>(() => {
    return readStoredJson(CLUB_LIST_SCOPE_STORAGE_KEY, 'bag', parseClubListScope);
  });

  // Accessories
  const [accessories, setAccessories] = useState<AccessoryItem[]>(() => {
    return readStoredJson(ACCESSORY_STORAGE_KEY, DEFAULT_ACCESSORIES, parseAccessories);
  });

  // Head speed handlers
  const handleHeadSpeedChange = useCallback((value: number) => {
    setHeadSpeed(value);
    writeStoredValue(HEAD_SPEED_STORAGE_KEY, value);
  }, []);

  // Lie angle standards handlers
  const handleSetLieTypeStandard = useCallback((clubType: string, value: number) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => {
      const updated = {
        ...prev,
        byClubType: {
          ...prev.byClubType,
          [key]: value,
        },
      };
      writeStoredJson(LIE_STANDARDS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleSetLieClubStandard = useCallback((clubName: string, value: number) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => {
      const updated = {
        ...prev,
        byClubName: {
          ...prev.byClubName,
          [key]: value,
        },
      };
      writeStoredJson(LIE_STANDARDS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleClearLieTypeStandard = useCallback((clubType: string) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => {
      const nextByType = { ...prev.byClubType };
      delete nextByType[key];
      const updated = {
        ...prev,
        byClubType: nextByType,
      };
      writeStoredJson(LIE_STANDARDS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleClearLieClubStandard = useCallback((clubName: string) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => {
      const nextByName = { ...prev.byClubName };
      delete nextByName[key];
      const keyParts = key.split('|');
      if (keyParts.length >= 3) {
        delete nextByName[keyParts.slice(0, 2).join('|')];
      }
      const updated = {
        ...prev,
        byClubName: nextByName,
      };
      writeStoredJson(LIE_STANDARDS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleResetLieStandards = useCallback(() => {
    setUserLieAngleStandards(DEFAULT_USER_LIE_ANGLE_STANDARDS);
    writeStoredJson(LIE_STANDARDS_STORAGE_KEY, DEFAULT_USER_LIE_ANGLE_STANDARDS);
  }, []);

  // Swing weight handlers - use per-bag settings
  const handleSetSwingWeightTarget = useCallback((value: number) => {
    if (!activeBag?.id || !updateBagSwingSettings) {
      return;
    }
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(-30, Math.min(30, rounded));
    void updateBagSwingSettings(activeBag.id, { swingWeightTarget: clamped });
  }, [activeBag?.id, updateBagSwingSettings]);

  const handleResetSwingWeightTarget = useCallback(() => {
    if (!activeBag?.id || !updateBagSwingSettings) {
      return;
    }
    void updateBagSwingSettings(activeBag.id, { swingWeightTarget: DEFAULT_SWING_TARGET });
  }, [activeBag?.id, updateBagSwingSettings]);

  const handleSetSwingGoodTolerance = useCallback((value: number) => {
    if (!activeBag?.id || !updateBagSwingSettings) {
      return;
    }
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(0.1, Math.min(30, rounded));
    const currentSwingAdjustThreshold = activeBag?.swingAdjustThreshold ?? 
      readStoredNumber(SWING_ADJUST_THRESHOLD_STORAGE_KEY, DEFAULT_SWING_ADJUST_THRESHOLD, { decimals: 1 });
    void updateBagSwingSettings(activeBag.id, { 
      swingGoodTolerance: clamped,
      swingAdjustThreshold: Math.max(clamped, currentSwingAdjustThreshold)
    });
  }, [activeBag?.id, updateBagSwingSettings]);

  const handleSetSwingAdjustThreshold = useCallback((value: number) => {
    if (!activeBag?.id || !updateBagSwingSettings) {
      return;
    }
    const rounded = Math.round(value * 10) / 10;
    const currentSwingGoodTolerance = activeBag?.swingGoodTolerance ?? 
      readStoredNumber(SWING_GOOD_TOLERANCE_STORAGE_KEY, DEFAULT_SWING_GOOD_TOLERANCE, { decimals: 1 });
    const clamped = Math.max(currentSwingGoodTolerance, Math.min(30, rounded));
    void updateBagSwingSettings(activeBag.id, { swingAdjustThreshold: clamped });
  }, [activeBag?.id, updateBagSwingSettings]);

  const handleResetSwingThresholds = useCallback(() => {
    if (!activeBag?.id || !updateBagSwingSettings) {
      return;
    }
    void updateBagSwingSettings(activeBag.id, { 
      swingGoodTolerance: DEFAULT_SWING_GOOD_TOLERANCE,
      swingAdjustThreshold: DEFAULT_SWING_ADJUST_THRESHOLD 
    });
  }, [activeBag?.id, updateBagSwingSettings]);

  // Analysis club visibility handlers
  const handleSetAnalysisClubVisible = useCallback((clubKey: string, visible: boolean) => {
    setHiddenAnalysisClubKeys((prev) => {
      const exists = prev.includes(clubKey);
      let updated: string[];
      
      if (visible) {
        updated = exists ? prev.filter((key) => key !== clubKey) : prev;
      } else {
        updated = exists ? prev : [...prev, clubKey];
      }
      
      writeStoredJson(ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  // Club list scope handlers
  const handleChangeClubListScope = useCallback((scope: 'bag' | 'all') => {
    setClubListScope(scope);
    writeStoredJson(CLUB_LIST_SCOPE_STORAGE_KEY, scope);
  }, []);

  // Accessory handlers
  const handleAddAccessory = useCallback((accessory: Omit<AccessoryItem, 'id' | 'createdAt'>) => {
    setAccessories((prevAccessories) => {
      const updated = [
        ...prevAccessories,
        {
          id: `accessory-${Date.now()}`,
          ...accessory,
          createdAt: new Date().toISOString(),
        },
      ];
      writeStoredJson(ACCESSORY_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleUpdateAccessory = useCallback((updatedAccessory: AccessoryItem) => {
    setAccessories((prevAccessories) => {
      const updated = prevAccessories.map((accessory) =>
        accessory.id === updatedAccessory.id ? updatedAccessory : accessory,
      );
      writeStoredJson(ACCESSORY_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const handleDeleteAccessory = useCallback((id: string) => {
    setAccessories((prevAccessories) => {
      const updated = prevAccessories.filter((accessory) => accessory.id !== id);
      writeStoredJson(ACCESSORY_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  return {
    // State
    headSpeed,
    userLieAngleStandards,
    swingWeightTarget,
    swingGoodTolerance,
    swingAdjustThreshold,
    hiddenAnalysisClubKeys,
    clubListScope,
    accessories,
    
    // Handlers
    handleHeadSpeedChange,
    handleSetLieTypeStandard,
    handleSetLieClubStandard,
    handleClearLieTypeStandard,
    handleClearLieClubStandard,
    handleResetLieStandards,
    handleSetSwingWeightTarget,
    handleResetSwingWeightTarget,
    handleSetSwingGoodTolerance,
    handleSetSwingAdjustThreshold,
    handleResetSwingThresholds,
    handleSetAnalysisClubVisible,
    handleChangeClubListScope,
    handleAddAccessory,
    handleUpdateAccessory,
    handleDeleteAccessory,
  };
};

export type UseAppSettingsReturn = ReturnType<typeof useAppSettings>;
