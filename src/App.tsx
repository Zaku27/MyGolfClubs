import { useEffect, useState } from 'react';
import type { GolfClub } from './types/golf';
import { ClubList } from './components/ClubList';
import { ClubForm } from './components/ClubForm';
import { AnalysisScreen } from './components/AnalysisScreen';
import { useClubStore } from './store/clubStore';
import './App.css';

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
      const dataStr = JSON.stringify(clubs, null, 2);
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
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
  const { clubs, loading, error, loadClubs, addClub, updateClub, deleteClub, initializeDefaults, resetToDefaults } = useClubStore();

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
          clubs={clubs}
          onBack={handleBackToList}
          onUpdateActualDistance={handleActualDistanceChange}
          headSpeed={headSpeed}
          onHeadSpeedChange={setHeadSpeed}
        />
      ) : (
        <ClubList
          clubs={clubs}
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
