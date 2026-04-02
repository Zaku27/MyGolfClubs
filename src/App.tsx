import { useEffect, useState } from 'react';
import type { GolfClub } from './types/golf';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  normalizeLieStandardKey,
  type UserLieAngleStandards,
} from './types/lieStandards';
import { getAnalysisClubKey } from './utils/clubUtils';
import { downloadClubsAsJson, readClubsFromJsonFile } from './utils/clubTransfer';
import {
  readStoredJson,
  readStoredNumber,
  writeStoredJson,
  writeStoredValue,
} from './utils/storage';
import { ClubList } from './components/ClubList';
import { ClubForm } from './components/ClubForm';
import { AnalysisScreen } from './components/AnalysisScreen';
import { SimulatorApp } from './components/simulator/SimulatorApp';
import { selectSortedClubsForDisplay, useClubStore } from './store/clubStore';
import './App.css';

const HEAD_SPEED_STORAGE_KEY = 'golfbag-head-speed-ms';
const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const SWING_GOOD_TOLERANCE_STORAGE_KEY = 'golfbag-swing-good-tolerance';
const SWING_ADJUST_THRESHOLD_STORAGE_KEY = 'golfbag-swing-adjust-threshold';
const ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY = 'golfbag-analysis-hidden-clubs';
const DEFAULT_SWING_TARGET = 2.0;
const DEFAULT_SWING_GOOD_TOLERANCE = 1.5;
const DEFAULT_SWING_ADJUST_THRESHOLD = 2.0;

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

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [headSpeed, setHeadSpeed] = useState<number>(() => {
    return readStoredNumber(HEAD_SPEED_STORAGE_KEY, 42, { min: 0.1 });
  });
  const [userLieAngleStandards, setUserLieAngleStandards] =
    useState<UserLieAngleStandards>(() => {
      return readStoredJson(
        LIE_STANDARDS_STORAGE_KEY,
        DEFAULT_USER_LIE_ANGLE_STANDARDS,
        parseUserLieAngleStandards,
      );
    });
  const [swingWeightTarget, setSwingWeightTarget] = useState<number>(() => {
    return readStoredNumber(SWING_TARGET_STORAGE_KEY, DEFAULT_SWING_TARGET, { decimals: 1 });
  });
  const [swingGoodTolerance, setSwingGoodTolerance] = useState<number>(() => {
    return readStoredNumber(
      SWING_GOOD_TOLERANCE_STORAGE_KEY,
      DEFAULT_SWING_GOOD_TOLERANCE,
      { decimals: 1 },
    );
  });
  const [swingAdjustThreshold, setSwingAdjustThreshold] = useState<number>(() => {
    return readStoredNumber(
      SWING_ADJUST_THRESHOLD_STORAGE_KEY,
      DEFAULT_SWING_ADJUST_THRESHOLD,
      { decimals: 1 },
    );
  });
  const [hiddenAnalysisClubKeys, setHiddenAnalysisClubKeys] = useState<string[]>(() => {
    return readStoredJson(
      ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY,
      [],
      parseHiddenAnalysisClubKeys,
    );
  });
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);
  const visibleAnalysisClubs = sortedClubs.filter(
    (club) => !hiddenAnalysisClubKeys.includes(getAnalysisClubKey(club)),
  );
  const {
    loading,
    error,
    loadClubs,
    loadPersonalData,
    loadPlayerSkillLevel,
    addClub,
    updateClub,
    deleteClub,
    initializeDefaults,
    resetToDefaults,
    clearAllClubs,
  } = useClubStore();

  const handleClearAllClubs = async () => {
    const confirmed = confirm('全てのクラブデータを完全に削除します。よろしいですか？');
    if (!confirmed) return;

    await clearAllClubs();
    setShowForm(false);
    setEditingClub(undefined);
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedClubs = await readClubsFromJsonFile(file);

      await clearAllClubs();
      for (const club of importedClubs) {
        await addClub(club);
      }
      await loadClubs();
      alert('インポートが完了しました');
    } catch (error) {
      alert('インポートに失敗しました: ' + (error as Error).message);
    }

    event.target.value = '';
  };

  const handleExportJSON = () => {
    downloadClubsAsJson(sortedClubs);
  };

  useEffect(() => {
    const initializeApp = async () => {
      await initializeDefaults();
      await loadClubs();
      await Promise.all([loadPersonalData(), loadPlayerSkillLevel()]);
    };
    initializeApp();
  }, [initializeDefaults, loadClubs, loadPersonalData, loadPlayerSkillLevel]);

  useEffect(() => {
    writeStoredValue(HEAD_SPEED_STORAGE_KEY, headSpeed);
  }, [headSpeed]);

  useEffect(() => {
    writeStoredJson(LIE_STANDARDS_STORAGE_KEY, userLieAngleStandards);
  }, [userLieAngleStandards]);

  useEffect(() => {
    writeStoredValue(SWING_TARGET_STORAGE_KEY, swingWeightTarget);
  }, [swingWeightTarget]);

  useEffect(() => {
    writeStoredValue(SWING_GOOD_TOLERANCE_STORAGE_KEY, swingGoodTolerance);
  }, [swingGoodTolerance]);

  useEffect(() => {
    writeStoredValue(SWING_ADJUST_THRESHOLD_STORAGE_KEY, swingAdjustThreshold);
  }, [swingAdjustThreshold]);

  useEffect(() => {
    writeStoredJson(ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY, hiddenAnalysisClubKeys);
  }, [hiddenAnalysisClubKeys]);

  const handleSetSwingWeightTarget = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(-30, Math.min(30, rounded));
    setSwingWeightTarget(clamped);
  };

  const handleResetSwingWeightTarget = () => {
    setSwingWeightTarget(DEFAULT_SWING_TARGET);
  };

  const handleSetSwingGoodTolerance = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(0.1, Math.min(30, rounded));
    setSwingGoodTolerance(clamped);
    setSwingAdjustThreshold((prev) => Math.max(clamped, prev));
  };

  const handleSetSwingAdjustThreshold = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(swingGoodTolerance, Math.min(30, rounded));
    setSwingAdjustThreshold(clamped);
  };

  const handleResetSwingThresholds = () => {
    setSwingGoodTolerance(DEFAULT_SWING_GOOD_TOLERANCE);
    setSwingAdjustThreshold(DEFAULT_SWING_ADJUST_THRESHOLD);
  };

  const handleSetAnalysisClubVisible = (clubKey: string, visible: boolean) => {
    setHiddenAnalysisClubKeys((prev) => {
      const exists = prev.includes(clubKey);
      if (visible) {
        return exists ? prev.filter((key) => key !== clubKey) : prev;
      }

      return exists ? prev : [...prev, clubKey];
    });
  };

  const handleSetLieTypeStandard = (clubType: string, value: number) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => ({
      ...prev,
      byClubType: {
        ...prev.byClubType,
        [key]: value,
      },
    }));
  };

  const handleSetLieClubStandard = (clubName: string, value: number) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => ({
      ...prev,
      byClubName: {
        ...prev.byClubName,
        [key]: value,
      },
    }));
  };

  const handleClearLieTypeStandard = (clubType: string) => {
    const key = normalizeLieStandardKey(clubType);
    setUserLieAngleStandards((prev) => {
      const nextByType = { ...prev.byClubType };
      delete nextByType[key];
      return {
        ...prev,
        byClubType: nextByType,
      };
    });
  };

  const handleClearLieClubStandard = (clubName: string) => {
    const key = normalizeLieStandardKey(clubName);
    setUserLieAngleStandards((prev) => {
      const nextByName = { ...prev.byClubName };
      delete nextByName[key];
      const keyParts = key.split('|');
      if (keyParts.length >= 3) {
        delete nextByName[keyParts.slice(0, 2).join('|')];
      }
      return {
        ...prev,
        byClubName: nextByName,
      };
    });
  };

  const handleResetLieStandards = () => {
    setUserLieAngleStandards(DEFAULT_USER_LIE_ANGLE_STANDARDS);
  };

  const handleAddClub = () => {
    setShowAnalysis(false);
    setEditingClub(undefined);
    setShowForm(true);
  };

  const handleEditClub = (club: GolfClub) => {
    setShowAnalysis(false);
    setEditingClub(club);
    setShowForm(true);
  };

  const handleShowAnalysis = () => {
    setShowForm(false);
    setEditingClub(undefined);
    setShowAnalysis(true);
  };

  const handleBackToList = () => {
    setShowAnalysis(false);
  };

  const handleDeleteClub = async (id: number) => {
    if (confirm('このクラブを削除してもよろしいですか?')) {
      await deleteClub(id);
    }
  };

  const handleActualDistanceChange = async (id: number, distance: number) => {
    await updateClub(id, { distance });
  };

  const handleResetClubs = async () => {
    const confirmed = confirm('全てのクラブが削除され、初期14本に戻ります。よろしいですか？');
    if (!confirmed) return;

    setShowForm(false);
    setEditingClub(undefined);
    await resetToDefaults();
  };

  const handleFormSubmit = async (clubData: Omit<GolfClub, 'id'> | Partial<GolfClub>) => {
    if (editingClub && editingClub.id) {
      await updateClub(editingClub.id, clubData);
    } else {
      await addClub(clubData as Omit<GolfClub, 'id'>);
    }
    setShowForm(false);
    setEditingClub(undefined);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingClub(undefined);
  };

  if (showSimulator) {
    return (
      <SimulatorApp
        onBack={() => setShowSimulator(false)}
        selectedClubs={sortedClubs}
      />
    );
  }

  return (
    <div className="app-container">
      {error && <div className="error-message">{error}</div>}

      {showForm ? (
        <ClubForm
          club={editingClub}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isLoading={loading}
        />
      ) : showAnalysis ? (
        <AnalysisScreen
          clubs={sortedClubs}
          onBack={handleBackToList}
          onUpdateActualDistance={handleActualDistanceChange}
          headSpeed={headSpeed}
          onHeadSpeedChange={setHeadSpeed}
          hiddenAnalysisClubKeys={hiddenAnalysisClubKeys.filter((clubKey) =>
            sortedClubs.some((club) => getAnalysisClubKey(club) === clubKey),
          )}
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
        <ClubList
          clubs={sortedClubs}
          onEdit={handleEditClub}
          onDelete={handleDeleteClub}
          onAdd={handleAddClub}
          onReset={handleResetClubs}
          onClearAll={handleClearAllClubs}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((prev) => (prev === 'full' ? 'compact' : 'full'))}
          onExport={handleExportJSON}
          onImport={handleImportJSON}
          onShowAnalysis={handleShowAnalysis}
          onShowSimulator={() => setShowSimulator(true)}
          loading={loading}
        />
      )}
    </div>
  );
}

export default App;
