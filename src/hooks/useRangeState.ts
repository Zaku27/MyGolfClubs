import { useState, useMemo, useCallback } from 'react';
import { useClubStore } from '../store/clubStore';
import { getSkillLabel } from '../utils/playerSkill';
import {
  loadRangePlayerSettings,
  saveRangePlayerSettings,
  type RangeSeatType,
} from '../utils/rangePlayerSettings';
import type { ShotResult } from '../types/game';
import type { GolfClub } from '../types/golf';
import type { LandingResult, MonteCarloResult } from '../utils/landingPosition';

// Temporary functions until they're moved to utils
function buildMonteCarloResult(rawResults: ShotResult[]): MonteCarloResult {
  const shots = rawResults
    .map((r) => toLandingResult(r))
    .filter((shot): shot is LandingResult => shot !== null);

  if (shots.length === 0) {
    return {
      shots: [],
      stats: {
        meanX: 0,
        meanY: 0,
        stdDevX: 0,
        stdDevY: 0,
        correlation: 0,
      },
    };
  }

  const meanX = shots.reduce((sum, shot) => sum + shot.finalX, 0) / shots.length;
  const meanY = shots.reduce((sum, shot) => sum + shot.finalY, 0) / shots.length;
  const varianceX = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) ** 2, 0) / shots.length;
  const varianceY = shots.reduce((sum, shot) => sum + (shot.finalY - meanY) ** 2, 0) / shots.length;
  const covariance = shots.reduce((sum, shot) => sum + (shot.finalX - meanX) * (shot.finalY - meanY), 0) / shots.length;
  const stdDevX = Math.sqrt(varianceX);
  const stdDevY = Math.sqrt(varianceY);

  const correlation = stdDevX > 0 && stdDevY > 0 ? covariance / (stdDevX * stdDevY) : 0;

  return {
    shots,
    stats: {
      meanX,
      meanY,
      stdDevX,
      stdDevY,
      correlation,
    },
  };
}

function toLandingResult(raw: ShotResult): LandingResult | null {
  const landing = raw?.landing;
  if (!landing) return null;

  return {
    finalX: landing.x,
    finalY: landing.y,
    carryDistance: landing.carryDistance,
    totalDistance: landing.totalDistance,
    deviationFromTarget: landing.deviationFromTarget,
    shotQuality: landing.shotQuality,
  };
}

function getSelectableRangeClubs(
  clubs: GolfClub[],
  seatType: RangeSeatType,
): GolfClub[] {
  const filtered = clubs.filter((club) => seatType !== 'personal' || club.clubType !== 'Putter');
  return filtered;
}

export function useRangeState(allClubs: GolfClub[], activeBagClubs: GolfClub[]) {
  const storedPlayerSkillLevel = useClubStore((state) => state.playerSkillLevel);
  const initialRangePlayerSettings = loadRangePlayerSettings();

  // Player settings
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [seatType, setSeatType] = useState<RangeSeatType>(initialRangePlayerSettings.seatType);
  const [robotHeadSpeed, setRobotHeadSpeed] = useState<number>(initialRangePlayerSettings.robotHeadSpeed);
  const [robotSkillLevel, setRobotSkillLevel] = useState<number>(initialRangePlayerSettings.robotSkillLevel);
  const [reuseLastSeed, setReuseLastSeed] = useState(initialRangePlayerSettings.reuseLastSeed);

  // Simulation settings
  const [numShots, setNumShots] = useState<number>(10);
  const [aimXOffset, setAimXOffset] = useState<number>(0);
  const [shotPowerPercent, setShotPowerPercent] = useState<number>(100);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastSimulationSeedNonce, setLastSimulationSeedNonce] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<ShotResult[]>([]);
  const [flatBaselineResults, setFlatBaselineResults] = useState<ShotResult[]>([]);
  const [summary, setSummary] = useState<RangeSummary | null>(null);

  // Computed values
  const monteCarloResult = useMemo(() => buildMonteCarloResult(results), [results]);
  const personalSkillLevel = storedPlayerSkillLevel;
  const personalSkillLevelLabel = useMemo(() => getSkillLabel(personalSkillLevel), [personalSkillLevel]);
  const displayedSkillLevel = useMemo(() => seatType === 'robot' ? robotSkillLevel : personalSkillLevel, [seatType, robotSkillLevel, personalSkillLevel]);
  const displayedSkillLabel = useMemo(() => getSkillLabel(displayedSkillLevel), [displayedSkillLevel]);
  const skillLevelName = useMemo(() => `適用スキルレベル ${(displayedSkillLevel * 100).toFixed(0)}% (${displayedSkillLabel})`, [displayedSkillLevel, displayedSkillLabel]);
  const displayedSkillLevelName = useMemo(() => seatType === 'actual' ? '' : skillLevelName, [seatType, skillLevelName]);
  const clubs = useMemo(() => seatType === 'robot' ? allClubs : activeBagClubs, [seatType, allClubs, activeBagClubs]);
  const selectableClubs = useMemo(() => getSelectableRangeClubs(clubs, seatType), [clubs, seatType]);

  // Save settings when they change
  const saveSettings = useCallback(() => {
    saveRangePlayerSettings({
      seatType,
      robotHeadSpeed,
      robotSkillLevel,
      reuseLastSeed,
    });
  }, [seatType, robotHeadSpeed, robotSkillLevel, reuseLastSeed]);

  return {
    // State
    selectedClubId,
    setSelectedClubId,
    seatType,
    setSeatType,
    robotHeadSpeed,
    setRobotHeadSpeed,
    robotSkillLevel,
    setRobotSkillLevel,
    reuseLastSeed,
    setReuseLastSeed,
    numShots,
    setNumShots,
    aimXOffset,
    setAimXOffset,
    shotPowerPercent,
    setShotPowerPercent,
    isSimulating,
    setIsSimulating,
    lastSimulationSeedNonce,
    setLastSimulationSeedNonce,
    results,
    setResults,
    flatBaselineResults,
    setFlatBaselineResults,
    summary,
    setSummary,

    // Computed
    monteCarloResult,
    personalSkillLevel,
    personalSkillLevelLabel,
    displayedSkillLevel,
    displayedSkillLabel,
    skillLevelName,
    displayedSkillLevelName,
    clubs,
    selectableClubs,

    // Actions
    saveSettings,
  };
}
