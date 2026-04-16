import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GolfClub } from '../types/golf';
import { AnalysisHeader, type AnalysisTab } from './AnalysisHeader';
import { AnalysisLieChart } from './AnalysisLieChart';
import { AnalysisLieLengthChart } from './AnalysisLieLengthChart';
import { AnalysisLieSettingsCard } from './AnalysisLieSettingsCard';
import { AnalysisLieLengthTable } from './AnalysisLieLengthTable';
import { AnalysisLoftTable } from './AnalysisLoftTable';
import { AnalysisLieTable } from './AnalysisLieTable';

import { AnalysisLoftChart } from './AnalysisLoftChart';
import { AnalysisLoftLengthChart } from './AnalysisLoftLengthChart';
import { AnalysisSwingChart } from './AnalysisSwingChart';
import { AnalysisSwingTable } from './AnalysisSwingTable';
import { AnalysisWeightChart } from './AnalysisWeightChart';
import { AnalysisWeightTable } from './AnalysisWeightTable';
import {
  useAnalysisInputHandlers,
  useAnalysisTooltip,
  useResponsiveChartSize,
  useTooltipBoxSize,
} from './analysisHooks';
import {
  type LieTooltipState,
  type LieLengthTooltipState,
  type LoftLengthTooltipState,
  type LoftTooltipState,
  type SwingTooltipState,
  type TooltipBoxSize,
  type WeightTooltipState,
} from './analysisTypes';
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  LIE_GOOD_TOLERANCE,
  LIE_LENGTH_CHART_PADDING,
  LIE_LENGTH_TREND_BAND_TOLERANCE,
  LIE_MAX,
  LIE_MIN,
  LIE_PADDING,
  LOFT_CHART_PADDING,
  LOFT_LENGTH_CHART_PADDING,
  MAX_DISTANCE,
  MAX_LOFT,
  MIN_DISTANCE,
  MIN_LOFT,
  SWING_PADDING,
  WEIGHT_CHART_PADDING,
  WEIGHT_NORMAL_BAND_TOLERANCE,
} from './analysisConfig';
import {
  buildActualDistanceLinePoints,
  buildLieLengthTrendPoints,
  buildLieReferencePoints,
  buildWeightTrendPoints,
  createLieChartMappers,
  createLoftChartMappers,
  createSwingChartMappers,
  createWeightChartMappers,
  formatSignedGrams,
  formatSignedDegrees,
  getCategoryColor,
  getCategoryLabel,
  getLieLengthDeviationLabel,
  getLieLengthPointStyle,
  getTooltipPosition,
  getWeightDeviationLabel,
  getWeightPointStyle,
  isAnalysisClubVisible,
  type ClubCategory,
} from '../utils/analysisUtils';
import {
  buildLieAngleAnalysis,
  buildLieLengthAnalysis,
  buildLoftDistanceAnalysis,
  buildLoftLengthComparisonAnalysis,
  buildSwingWeightAnalysis,
  buildWeightLengthAnalysis,
} from '../utils/analysisBuilders';
import {
  type UserLieAngleStandards,
} from '../types/lieStandards';
import './AnalysisScreen.css';

type AnalysisScreenProps = {
  clubs: GolfClub[];
  onBack: () => void;
  onUpdateActualDistance: (clubId: number, distance: number) => void;
  headSpeed: number;
  onHeadSpeedChange: (value: number) => void;
  hiddenAnalysisClubKeys: string[];
  onSetAnalysisClubVisible: (clubKey: string, visible: boolean) => void;
  swingWeightTarget?: number;
  swingGoodTolerance?: number;
  swingAdjustThreshold?: number;
  onSetSwingWeightTarget?: (value: number) => void;
  onSetSwingGoodTolerance?: (value: number) => void;
  onSetSwingAdjustThreshold?: (value: number) => void;
  onResetSwingWeightTarget?: () => void;
  onResetSwingThresholds?: () => void;
  userLieAngleStandards: UserLieAngleStandards;
  onSetLieTypeStandard: (clubType: string, value: number) => void;
  onSetLieClubStandard: (clubName: string, value: number) => void;
  onClearLieTypeStandard: (clubType: string) => void;
  onClearLieClubStandard: (clubName: string) => void;
  onResetLieStandards: () => void;
};

export const AnalysisScreen = ({
  clubs,
  onBack,
  onUpdateActualDistance,
  headSpeed,
  onHeadSpeedChange,
  hiddenAnalysisClubKeys,
  onSetAnalysisClubVisible,
  swingWeightTarget,
  swingGoodTolerance,
  swingAdjustThreshold,
  onSetSwingWeightTarget,
  onSetSwingGoodTolerance,
  onSetSwingAdjustThreshold,
  onResetSwingWeightTarget,
  onResetSwingThresholds,
  userLieAngleStandards,
  onSetLieTypeStandard,
  onSetLieClubStandard,
  onClearLieTypeStandard,
  onClearLieClubStandard,
  onResetLieStandards,
}: AnalysisScreenProps) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('loftDistance');
  const [localSwingWeightTarget, setLocalSwingWeightTarget] = useState(swingWeightTarget);

  // Sync local state with DB value when prop changes (bag switch, DB load, etc.)
  useEffect(() => {
    setLocalSwingWeightTarget(swingWeightTarget);
  }, [swingWeightTarget]);

  const [showLieSettings, setShowLieSettings] = useState(false);
  const loftChartContainerRef = useRef<HTMLDivElement | null>(null);
  const loftLengthChartContainerRef = useRef<HTMLDivElement | null>(null);
  const weightChartContainerRef = useRef<HTMLDivElement | null>(null);
  const swingChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lieChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lieLengthChartContainerRef = useRef<HTMLDivElement | null>(null);
  const loftTooltipRef = useRef<HTMLDivElement | null>(null);
  const loftLengthTooltipRef = useRef<HTMLDivElement | null>(null);
  const weightTooltipRef = useRef<HTMLDivElement | null>(null);
  const swingTooltipRef = useRef<HTMLDivElement | null>(null);
  const lieTooltipRef = useRef<HTMLDivElement | null>(null);
  const lieLengthTooltipRef = useRef<HTMLDivElement | null>(null);

  const hiddenClubKeySet = useMemo(() => new Set(hiddenAnalysisClubKeys), [hiddenAnalysisClubKeys]);
  const isClubVisible = useCallback(
    (club: GolfClub) => isAnalysisClubVisible(club, hiddenClubKeySet),
    [hiddenClubKeySet],
  );

  const { tooltip: loftTooltip, setRawTooltip: setLoftTooltip } = useAnalysisTooltip<LoftTooltipState>(isClubVisible);
  const { tooltip: loftLengthTooltip, setRawTooltip: setLoftLengthTooltip } =
    useAnalysisTooltip<LoftLengthTooltipState>(isClubVisible);
  const { tooltip: weightTooltip, setRawTooltip: setWeightTooltip } = useAnalysisTooltip<WeightTooltipState>(isClubVisible);
  const { tooltip: swingTooltip, setRawTooltip: setSwingTooltip } = useAnalysisTooltip<SwingTooltipState>(isClubVisible);
  const { tooltip: lieTooltip, setRawTooltip: setLieTooltip } = useAnalysisTooltip<LieTooltipState>(isClubVisible);
  const { tooltip: lieLengthTooltip, setRawTooltip: setLieLengthTooltip } =
    useAnalysisTooltip<LieLengthTooltipState>(isClubVisible);
  const { handleActualDistanceChange, handleHeadSpeedChange } = useAnalysisInputHandlers({
    onUpdateActualDistance,
    onHeadSpeedChange,
  });

  const handleReflectAllEstimatedToActual = () => {
    loftTableClubs.forEach((club) => {
      if (club.id && club.estimatedDistance > 0) {
        onUpdateActualDistance(club.id, club.estimatedDistance);
      }
    });
  };

  const loftChartSize = useResponsiveChartSize(
    activeTab === 'loftDistance',
    loftChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const loftLengthChartSize = useResponsiveChartSize(
    activeTab === 'specComparison',
    loftLengthChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const weightChartSize = useResponsiveChartSize(
    activeTab === 'weightLength' || activeTab === 'specComparison',
    weightChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const swingChartSize = useResponsiveChartSize(
    activeTab === 'swingWeight',
    swingChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const lieChartSize = useResponsiveChartSize(
    activeTab === 'lieAngle' || activeTab === 'specComparison',
    lieChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const lieLengthChartSize = useResponsiveChartSize(
    activeTab === 'lieLength',
    lieLengthChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );

  const loftTooltipBox: TooltipBoxSize = useTooltipBoxSize(loftTooltip, loftTooltipRef, { width: 200, height: 120 });
  const loftLengthTooltipBox: TooltipBoxSize = useTooltipBoxSize(loftLengthTooltip, loftLengthTooltipRef, { width: 240, height: 140 });
  const weightTooltipBox: TooltipBoxSize = useTooltipBoxSize(weightTooltip, weightTooltipRef, { width: 200, height: 110 });
  const swingTooltipBox: TooltipBoxSize = useTooltipBoxSize(swingTooltip, swingTooltipRef, { width: 220, height: 130 });
  const lieTooltipBox: TooltipBoxSize = useTooltipBoxSize(lieTooltip, lieTooltipRef, { width: 200, height: 110 });
  const lieLengthTooltipBox: TooltipBoxSize = useTooltipBoxSize(lieLengthTooltip, lieLengthTooltipRef, { width: 220, height: 130 });

  const {
    tableClubs: loftTableClubs,
    chartClubs,
    hasVisibleData: hasLoftData,
  } = buildLoftDistanceAnalysis(clubs, headSpeed, isClubVisible);

  const loftTicks = [10, 20, 30, 40, 50, 60];
  const distanceTicks = [0, 50, 100, 150, 200, 250, 300];

  const {
    chartClubs: loftLengthClubs,
    regression: loftLengthRegression,
    categoryRegressions: loftLengthCategoryRegressions,
    bounds: loftLengthBounds,
    lengthTicks: loftLengthLengthTicks,
    loftTicks: loftLengthLoftTicks,
    hasAnyData: hasAnyLoftLengthData,
    hasVisibleData: hasLoftLengthData,
  } = buildLoftLengthComparisonAnalysis(clubs, isClubVisible);

  const {
    tableClubs: weightLengthTableClubs,
    chartClubs: weightLengthClubs,
    regression: weightRegression,
    bounds: weightBounds,
    lengthTicks,
    weightTicks,
    hasAnyData: hasAnyWeightLengthData,
    hasVisibleData: hasWeightLengthData,
  } = buildWeightLengthAnalysis(clubs, isClubVisible);

  // Sync local state with prop when it changes from outside
  const effectiveSwingWeightTarget = localSwingWeightTarget ?? swingWeightTarget ?? 2.0;

  const handleLocalSwingWeightTargetChange = useCallback((value: number) => {
    setLocalSwingWeightTarget(value);
    onSetSwingWeightTarget?.(value);
  }, [onSetSwingWeightTarget]);

  const {
    tableClubs: swingWeightTableClubs,
    chartClubs: swingWeightClubs,
    chartMin: swingChartMin,
    chartMax: swingChartMax,
    hasAnyData: hasAnySwingWeightData,
    hasVisibleData: hasSwingWeightData,
  } = buildSwingWeightAnalysis(
    clubs,
    effectiveSwingWeightTarget,
    swingGoodTolerance ?? 1.5,
    swingAdjustThreshold ?? 2.0,
    isClubVisible,
  );

  const swingTicks = Array.from({ length: Math.ceil(swingChartMax) - Math.floor(swingChartMin) + 1 }, 
    (_, i) => Math.floor(swingChartMin) + i);

  const {
    tableClubs: lieAngleTableClubs,
    chartClubs: lieAngleClubs,
    hasAnyData: hasAnyLieAngleData,
  } = buildLieAngleAnalysis(clubs, userLieAngleStandards, isClubVisible);

  const {
    tableClubs: lieLengthTableClubs,
    chartClubs: lieLengthClubs,
    regression: lieLengthRegression,
    bounds: lieLengthBounds,
    lengthTicks: lieLengthLengthTicks,
    lieAngleTicks,
    hasAnyData: hasAnyLieLengthData,
    hasVisibleData: hasLieLengthData,
  } = buildLieLengthAnalysis(clubs, LIE_LENGTH_TREND_BAND_TOLERANCE, isClubVisible);

  const { mapX: mapLoftX, mapY: mapLoftY } = createLoftChartMappers(
    loftChartSize,
    LOFT_CHART_PADDING,
    {
      minLoft: MIN_LOFT,
      maxLoft: MAX_LOFT,
      minDistance: MIN_DISTANCE,
      maxDistance: MAX_DISTANCE,
    },
  );

  const { mapX: mapLoftLengthX, mapY: mapLoftLengthY } = createWeightChartMappers(
    loftLengthChartSize,
    LOFT_LENGTH_CHART_PADDING,
    {
      minLength: loftLengthBounds.minLength,
      maxLength: loftLengthBounds.maxLength,
      minWeight: loftLengthBounds.minLoft,
      maxWeight: loftLengthBounds.maxLoft,
    },
  );

  const loftLengthCategoryRanges = loftLengthClubs.reduce<Partial<Record<ClubCategory, { minLength: number; maxLength: number }>>>(
    (ranges, club) => {
      const category = club.category as ClubCategory;
      const current = ranges[category];
      if (!current) {
        ranges[category] = { minLength: club.length, maxLength: club.length };
      } else {
        ranges[category] = {
          minLength: Math.min(current.minLength, club.length),
          maxLength: Math.max(current.maxLength, club.length),
        };
      }
      return ranges;
    },
    {},
  );

  const loftLengthTrendLines = (Object.entries(loftLengthCategoryRegressions) as [ClubCategory, typeof loftLengthRegression][]).flatMap(
    ([category, regression]) => {
      const range = loftLengthCategoryRanges[category];
      if (!range) return [];
      const startLength = Math.max(range.minLength, loftLengthBounds.minLength);
      const endLength = Math.min(range.maxLength, loftLengthBounds.maxLength);
      return [
        {
          category,
          points: `${mapLoftLengthX(startLength)},${mapLoftLengthY(
            regression.slope * startLength + regression.intercept,
          )} ${mapLoftLengthX(endLength)},${mapLoftLengthY(
            regression.slope * endLength + regression.intercept,
          )}`,
        },
      ];
    },
  );

  const actualLinePoints = buildActualDistanceLinePoints(chartClubs, mapLoftX, mapLoftY);

  const { mapX: mapWeightLengthX, mapY: mapWeightLengthY } = createWeightChartMappers(
    weightChartSize,
    WEIGHT_CHART_PADDING,
    weightBounds,
  );

  const { linePoints: weightTrendLinePoints, bandPoints: weightTrendBandPoints } =
    buildWeightTrendPoints(
      hasWeightLengthData,
      weightBounds,
      weightRegression,
      WEIGHT_NORMAL_BAND_TOLERANCE,
      mapWeightLengthX,
      mapWeightLengthY,
    );

  const { mapX: mapLieLengthX, mapY: mapLieLengthY } = createWeightChartMappers(
    lieLengthChartSize,
    LIE_LENGTH_CHART_PADDING,
    {
      minLength: lieLengthBounds.minLength,
      maxLength: lieLengthBounds.maxLength,
      minWeight: lieLengthBounds.minLieAngle,
      maxWeight: lieLengthBounds.maxLieAngle,
    },
  );

  const { linePoints: lieLengthTrendLinePoints, bandPoints: lieLengthTrendBandPoints } =
    buildLieLengthTrendPoints(
      hasLieLengthData,
      lieLengthBounds,
      lieLengthRegression,
      LIE_LENGTH_TREND_BAND_TOLERANCE,
      mapLieLengthX,
      mapLieLengthY,
    );

  const weightTooltipPos = weightTooltip
    ? getTooltipPosition(weightTooltip.x, weightTooltip.y, weightChartSize, weightTooltipBox)
    : null;

  const swingTooltipPos = swingTooltip
    ? getTooltipPosition(swingTooltip.x, swingTooltip.y, swingChartSize, swingTooltipBox)
    : null;

  const loftTooltipPos = loftTooltip
    ? getTooltipPosition(loftTooltip.x, loftTooltip.y, loftChartSize, loftTooltipBox)
    : null;

  const loftLengthTooltipPos = loftLengthTooltip
    ? getTooltipPosition(
      loftLengthTooltip.x,
      loftLengthTooltip.y,
      loftLengthChartSize,
      loftLengthTooltipBox,
    )
    : null;

  const lieTooltipPos = lieTooltip
    ? getTooltipPosition(lieTooltip.x, lieTooltip.y, lieChartSize, lieTooltipBox)
    : null;

  const lieLengthTooltipPos = lieLengthTooltip
    ? getTooltipPosition(
      lieLengthTooltip.x,
      lieLengthTooltip.y,
      lieLengthChartSize,
      lieLengthTooltipBox,
    )
    : null;

  const { mapX: mapSwingX, mapY: mapSwingY, barWidth: swingBarWidth } = createSwingChartMappers(
    swingChartSize,
    SWING_PADDING,
    swingChartMin,
    swingChartMax,
    swingWeightClubs.length,
  );

  const { mapX: mapLieX, mapY: mapLieY, barWidth: lieBarWidth } = createLieChartMappers(
    lieChartSize,
    LIE_PADDING,
    LIE_MIN,
    LIE_MAX,
    lieAngleClubs.length,
  );

  const { standardLinePoints: standardLieLinePoints, goodRangePolygonPoints } =
    buildLieReferencePoints(
      lieAngleClubs,
      mapLieX,
      mapLieY,
      LIE_MIN,
      LIE_MAX,
      LIE_GOOD_TOLERANCE,
    );

  const renderLoftChart = () => (
    <div className="analysis-card chart-card loft-chart-frame">
      <AnalysisLoftChart
        hasLoftData={hasLoftData}
        loftChartContainerRef={loftChartContainerRef}
        loftChartSize={loftChartSize}
        distanceTicks={distanceTicks}
        loftTicks={loftTicks}
        actualLinePoints={actualLinePoints}
        chartClubs={chartClubs}
        mapLoftX={mapLoftX}
        mapLoftY={mapLoftY}
        loftTooltip={loftTooltip}
        loftTooltipRef={loftTooltipRef}
        loftTooltipPos={loftTooltipPos}
        setLoftTooltip={setLoftTooltip}
        getCategoryColor={getCategoryColor}
        LOFT_CHART_PADDING={LOFT_CHART_PADDING}
        CHART_WIDTH={CHART_WIDTH}
      />
      <div className="loft-chart-footer">
        <label className="headspeed-control">
          <span>ヘッドスピード</span>
          <div className="headspeed-input-wrap">
            <input
              type="number"
              min="30"
              max="60"
              step="0.1"
              value={headSpeed}
              onChange={handleHeadSpeedChange}
              className="analysis-input headspeed-input"
            />
            <em>m/s</em>
          </div>
        </label>
      </div>
    </div>
  );

  const renderSwingChart = () => (
    <AnalysisSwingChart
      hasAnySwingWeightData={hasAnySwingWeightData}
      hasSwingWeightData={hasSwingWeightData}
      swingGoodTolerance={swingGoodTolerance}
      swingWeightTarget={effectiveSwingWeightTarget}
      onSetSwingWeightTarget={handleLocalSwingWeightTargetChange}
      swingChartContainerRef={swingChartContainerRef}
      swingChartSize={swingChartSize}
      swingTicks={swingTicks}
      mapSwingY={mapSwingY}
      mapSwingX={mapSwingX}
      swingBarWidth={swingBarWidth}
      swingChartMin={swingChartMin}
      swingWeightClubs={swingWeightClubs}
      swingAdjustThreshold={swingAdjustThreshold}
      swingTooltip={swingTooltip}
      swingTooltipRef={swingTooltipRef}
      swingTooltipPos={swingTooltipPos}
      setSwingTooltip={setSwingTooltip}
    />
  );

  const renderWeightChart = () => (
    <AnalysisWeightChart
      hasAnyWeightLengthData={hasAnyWeightLengthData}
      hasWeightLengthData={hasWeightLengthData}
      weightChartContainerRef={weightChartContainerRef}
      weightChartSize={weightChartSize}
      weightTrendBandPoints={weightTrendBandPoints}
      weightTicks={weightTicks}
      mapWeightLengthY={mapWeightLengthY}
      lengthTicks={lengthTicks}
      mapWeightLengthX={mapWeightLengthX}
      weightTrendLinePoints={weightTrendLinePoints}
      weightLengthClubs={weightLengthClubs}
      getWeightPointStyle={getWeightPointStyle}
      setWeightTooltip={setWeightTooltip}
      weightTooltip={weightTooltip}
      weightTooltipRef={weightTooltipRef}
      weightTooltipPos={weightTooltipPos}
      getCategoryLabel={getCategoryLabel}
      getWeightDeviationLabel={getWeightDeviationLabel}
      formatSignedGrams={formatSignedGrams}
      WEIGHT_CHART_PADDING={WEIGHT_CHART_PADDING}
    />
  );

  const renderLieLengthChart = () => (
    <AnalysisLieLengthChart
      hasAnyLieLengthData={hasAnyLieLengthData}
      hasLieLengthData={hasLieLengthData}
      lieLengthChartContainerRef={lieLengthChartContainerRef}
      lieLengthChartSize={lieLengthChartSize}
      lieLengthTrendBandPoints={lieLengthTrendBandPoints}
      lieAngleTicks={lieAngleTicks}
      mapLieLengthY={mapLieLengthY}
      lengthTicks={lieLengthLengthTicks}
      mapLieLengthX={mapLieLengthX}
      lieLengthTrendLinePoints={lieLengthTrendLinePoints}
      lieLengthClubs={lieLengthClubs}
      getLieLengthPointStyle={getLieLengthPointStyle}
      setLieLengthTooltip={setLieLengthTooltip}
      lieLengthTooltip={lieLengthTooltip}
      lieLengthTooltipRef={lieLengthTooltipRef}
      lieLengthTooltipPos={lieLengthTooltipPos}
      getCategoryLabel={getCategoryLabel}
      getLieLengthDeviationLabel={getLieLengthDeviationLabel}
      formatSignedDegrees={formatSignedDegrees}
      LIE_LENGTH_CHART_PADDING={LIE_LENGTH_CHART_PADDING}
      trendBandTolerance={LIE_LENGTH_TREND_BAND_TOLERANCE}
    />
  );

  const renderSpecComparisonCharts = () => (
    <div className="comparison-grid">
      <div className="comparison-chart-item">
        <AnalysisLoftLengthChart
          hasAnyLoftLengthData={hasAnyLoftLengthData}
          hasLoftLengthData={hasLoftLengthData}
          loftLengthChartContainerRef={loftLengthChartContainerRef}
          loftLengthChartSize={loftLengthChartSize}
          loftLengthTrendLines={loftLengthTrendLines}
          lengthTicks={loftLengthLengthTicks}
          loftTicks={loftLengthLoftTicks}
          mapLoftLengthX={mapLoftLengthX}
          mapLoftLengthY={mapLoftLengthY}
          loftLengthClubs={loftLengthClubs}
          getCategoryColor={getCategoryColor}
          setLoftLengthTooltip={setLoftLengthTooltip}
          loftLengthTooltip={loftLengthTooltip}
          loftLengthTooltipRef={loftLengthTooltipRef}
          loftLengthTooltipPos={loftLengthTooltipPos}
          LOFT_LENGTH_CHART_PADDING={LOFT_LENGTH_CHART_PADDING}
        />
      </div>
      <div className="comparison-chart-item">{renderWeightChart()}</div>
      <div className="comparison-chart-item">
        <AnalysisLieChart
          hasAnyLieAngleData={hasAnyLieAngleData}
          lieAngleClubs={lieAngleClubs}
          lieChartContainerRef={lieChartContainerRef}
          lieChartSize={lieChartSize}
          mapLieX={mapLieX}
          mapLieY={mapLieY}
          lieBarWidth={lieBarWidth}
          goodRangePolygonPoints={goodRangePolygonPoints}
          standardLieLinePoints={standardLieLinePoints}
          lieTooltip={lieTooltip}
          lieTooltipRef={lieTooltipRef}
          lieTooltipPos={lieTooltipPos}
          setLieTooltip={setLieTooltip}
        />
      </div>
    </div>
  );

  return (
    <div className="analysis-screen">
      <AnalysisHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showLieSettings={showLieSettings}
        onToggleLieSettings={() => setShowLieSettings((prev) => !prev)}
        onBack={onBack}
      />

      {activeTab === 'loftDistance' ? (
        <>
          {renderLoftChart()}
          <AnalysisLoftTable
            loftTableClubs={loftTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
            onActualDistanceChange={handleActualDistanceChange}
            onReflectAllEstimatedToActual={handleReflectAllEstimatedToActual}
          />
        </>
      ) : activeTab === 'lieAngle' ? (
        <>
          {showLieSettings && (
            <AnalysisLieSettingsCard
              clubs={clubs}
              lieAngleTableClubs={lieAngleTableClubs}
              userLieAngleStandards={userLieAngleStandards}
              onSetLieTypeStandard={onSetLieTypeStandard}
              onSetLieClubStandard={onSetLieClubStandard}
              onClearLieTypeStandard={onClearLieTypeStandard}
              onClearLieClubStandard={onClearLieClubStandard}
              onResetLieStandards={onResetLieStandards}
            />
          )}

          <AnalysisLieChart
            hasAnyLieAngleData={hasAnyLieAngleData}
            lieAngleClubs={lieAngleClubs}
            lieChartContainerRef={lieChartContainerRef}
            lieChartSize={lieChartSize}
            mapLieX={mapLieX}
            mapLieY={mapLieY}
            lieBarWidth={lieBarWidth}
            goodRangePolygonPoints={goodRangePolygonPoints}
            standardLieLinePoints={standardLieLinePoints}
            lieTooltip={lieTooltip}
            lieTooltipRef={lieTooltipRef}
            lieTooltipPos={lieTooltipPos}
            setLieTooltip={setLieTooltip}
          />

          <AnalysisLieTable
            lieAngleTableClubs={lieAngleTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
          />
        </>
      ) : activeTab === 'swingWeight' ? (
        <>
          {renderSwingChart()}
          <AnalysisSwingTable
            hasAnySwingWeightData={hasAnySwingWeightData}
            swingWeightTableClubs={swingWeightTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
            swingWeightTarget={effectiveSwingWeightTarget}
          />
        </>
      ) : activeTab === 'specComparison' ? (
        <>
          {renderSpecComparisonCharts()}
        </>
      ) : activeTab === 'lieLength' ? (
        <>
          <div className="analysis-card chart-card lie-length-frame">
            {renderLieLengthChart()}
          </div>
          <AnalysisLieLengthTable
            hasAnyLieLengthData={hasAnyLieLengthData}
            lieLengthTableClubs={lieLengthTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
            getLieLengthPointStyle={getLieLengthPointStyle}
            formatSignedDegrees={formatSignedDegrees}
          />
        </>
      ) : (
        <>
          <div className="analysis-card chart-card weight-length-frame">
            {renderWeightChart()}
          </div>
          <AnalysisWeightTable
            hasAnyWeightLengthData={hasAnyWeightLengthData}
            weightLengthTableClubs={weightLengthTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
          />
        </>
      )}
    </div>
  );
};
