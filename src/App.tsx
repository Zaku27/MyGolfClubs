import { useEffect, useState } from 'react';
import type { GolfClub } from './types/golf';
import { ClubList } from './components/ClubList';
import { ClubForm } from './components/ClubForm';
import { useClubStore } from './store/clubStore';
import './App.css';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<GolfClub | undefined>(undefined);
  const { clubs, loading, error, loadClubs, addClub, updateClub, deleteClub, initializeDefaults } = useClubStore();

  useEffect(() => {
    const initializeApp = async () => {
      await initializeDefaults();
      await loadClubs();
    };
    initializeApp();
  }, [initializeDefaults, loadClubs]);

  const handleAddClub = () => {
    setEditingClub(undefined);
    setShowForm(true);
  };

  const handleEditClub = (club: GolfClub) => {
    setEditingClub(club);
    setShowForm(true);
  };

  const handleDeleteClub = async (id: number) => {
    if (confirm('このクラブを削除してもよろしいですか?')) {
      await deleteClub(id);
    }
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
      ) : (
        <ClubList
          clubs={clubs}
          onEdit={handleEditClub}
          onDelete={handleDeleteClub}
          onAdd={handleAddClub}
          loading={loading}
        />
      )}
    </div>
  );
}

export default App;
