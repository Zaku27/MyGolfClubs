import { useEffect, useState } from 'react';
import type { GolfClub } from './types/golf';
import {
  DEFAULT_USER_LIE_ANGLE_STANDARDS,
  normalizeLieStandardKey,
  type UserLieAngleStandards,
} from './types/lieStandards';
import { getAnalysisClubKey } from './utils/clubUtils';
import { ClubList } from './components/ClubList';
import { ClubForm } from './components/ClubForm';
import { AnalysisScreen } from './components/AnalysisScreen';
import { selectSortedClubsForDisplay, useClubStore } from './store/clubStore';
import './App.css';

const LIE_STANDARDS_STORAGE_KEY = 'golfbag-user-lie-angle-standards';
const SWING_TARGET_STORAGE_KEY = 'golfbag-swing-weight-target';
const ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY = 'golfbag-analysis-hidden-clubs';
const DEFAULT_SWING_TARGET = 2.0;

function App() {
        const { clearAllClubs } = useClubStore();

        const handleClearAllClubs = async () => {
          const confirmed = confirm('全てのクラブデータを完全に削除します。よろしいですか？');
          if (!confirmed) return;
          await clearAllClubs();
          setShowForm(false);
          setEditingClub(undefined);
        };
      // JSONインポート
      const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const importedClubs: Omit<GolfClub, 'id'>[] = JSON.parse(text);
          // ファイルのデータだけを読み込む（初期データは追加しない）
          await useClubStore.getState().clearAllClubs(); // 全クラブ削除
          for (const club of importedClubs) {
            await addClub(club);
          }
          await loadClubs();
          alert('インポートが完了しました');
        } catch (e) {
          alert('インポートに失敗しました: ' + (e as Error).message);
        }
        event.target.value = '';
      };
    // クラブデータをJSONでエクスポート
    const handleExportJSON = () => {
      const dataStr = JSON.stringify(sortedClubs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'golf_clubs.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [headSpeed, setHeadSpeed] = useState<number>(() => {
    const saved = window.localStorage.getItem('golfbag-head-speed-ms');
    const parsed = saved ? Number(saved) : 42;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 42;
  });
  const [userLieAngleStandards, setUserLieAngleStandards] =
    useState<UserLieAngleStandards>(() => {
      const raw = window.localStorage.getItem(LIE_STANDARDS_STORAGE_KEY);
      if (!raw) return DEFAULT_USER_LIE_ANGLE_STANDARDS;
      try {
        const parsed = JSON.parse(raw) as Partial<UserLieAngleStandards>;
        return {
          byClubType: parsed.byClubType ?? {},
          byClubName: parsed.byClubName ?? {},
        };
      } catch {
        return DEFAULT_USER_LIE_ANGLE_STANDARDS;
      }
    });
  const [swingWeightTarget, setSwingWeightTarget] = useState<number>(() => {
    const saved = window.localStorage.getItem(SWING_TARGET_STORAGE_KEY);
    const parsed = saved ? Number(saved) : DEFAULT_SWING_TARGET;
    if (!Number.isFinite(parsed)) return DEFAULT_SWING_TARGET;
    return Math.round(parsed * 10) / 10;
  });
  const [hiddenAnalysisClubKeys, setHiddenAnalysisClubKeys] = useState<string[]>(() => {
    const raw = window.localStorage.getItem(ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [];
    } catch {
      return [];
    }
  });
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
  const sortedClubs = useClubStore(selectSortedClubsForDisplay);
  const {
    loading,
    error,
    loadClubs,
    addClub,
    updateClub,
    deleteClub,
    initializeDefaults,
    resetToDefaults,
  } = useClubStore();

  useEffect(() => {
    const initializeApp = async () => {
      await initializeDefaults();
      await loadClubs();
    };
    initializeApp();
  }, [initializeDefaults, loadClubs]);

  useEffect(() => {
    window.localStorage.setItem('golfbag-head-speed-ms', String(headSpeed));
  }, [headSpeed]);

  useEffect(() => {
    window.localStorage.setItem(
      LIE_STANDARDS_STORAGE_KEY,
      JSON.stringify(userLieAngleStandards),
    );
  }, [userLieAngleStandards]);

  useEffect(() => {
    window.localStorage.setItem(
      SWING_TARGET_STORAGE_KEY,
      String(swingWeightTarget),
    );
  }, [swingWeightTarget]);

  useEffect(() => {
    window.localStorage.setItem(
      ANALYSIS_HIDDEN_CLUBS_STORAGE_KEY,
      JSON.stringify(hiddenAnalysisClubKeys),
    );
  }, [hiddenAnalysisClubKeys]);

  const handleSetSwingWeightTarget = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const clamped = Math.max(-30, Math.min(30, rounded));
    setSwingWeightTarget(clamped);
  };

  const handleResetSwingWeightTarget = () => {
    setSwingWeightTarget(DEFAULT_SWING_TARGET);
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
          onSetSwingWeightTarget={handleSetSwingWeightTarget}
          onResetSwingWeightTarget={handleResetSwingWeightTarget}
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
          loading={loading}
        />
      )}
    </div>
  );
}

export default App;
