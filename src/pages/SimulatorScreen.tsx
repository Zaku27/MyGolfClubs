import { useNavigate } from 'react-router-dom';
import { SimulatorApp } from '../components/simulator/SimulatorApp';
import { useClubStore, selectSortedActiveBagClubs, selectSortedClubsForDisplay, selectActiveGolfBag } from '../store/clubStore';

export function SimulatorScreen() {
  const navigate = useNavigate();
  const selectedClubs = useClubStore(selectSortedActiveBagClubs);
  const allClubs = useClubStore(selectSortedClubsForDisplay);
  const activeBag = useClubStore(selectActiveGolfBag);
  const activeBagId = useClubStore((state) => state.activeBagId);

  const handleBack = () => {
    navigate('/');
  };

  return (
    <SimulatorApp
      onBack={handleBack}
      selectedClubs={selectedClubs}
      allClubs={allClubs}
      activeBagName={activeBag?.name}
      bagId={activeBagId}
    />
  );
}
