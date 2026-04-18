import { useCallback, useMemo, useRef, useState } from 'react';
import type { GolfClub } from '../types/golf';
import { AnalysisHeader, type AnalysisTab } from './AnalysisHeader';
import { AnalysisLieChart } from './AnalysisLieChart';
import { AnalysisLieLengthChart } from './AnalysisLieLengthChart';
import { AnalysisLieSettingsCard } from './AnalysisLieSettingsCard';
import { AnalysisLieLengthTable } from './AnalysisLieLengthTable';
import { AnalysisLoftTable } from './AnalysisLoftTable';
import { AnalysisLieTable } from './AnalysisLieTable';

import { AnalysisLoftChart } from './AnalysisLoftChart';
import { AnalysisSwingLengthChart } from './AnalysisSwingLengthChart';
import { AnalysisSwingLengthTable } from './AnalysisSwingLengthTable';
import { AnalysisWeightChart } from './AnalysisWeightChart';
import { AnalysisWeightTable } from './AnalysisWeightTable';
import { SummaryTab } from './SummaryTab';
import { useSummary } from '../hooks/useSummary';
import {
  useAnalysisInputHandlers,
  useAnalysisTooltip,
  useResponsiveChartSize,
  useTooltipBoxSize,
} from './analysisHooks';
import {
  type LieTooltipState,
  type LieLengthTooltipState,
  type LoftTooltipState,
  type SwingLengthTooltipState,
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
  MAX_DISTANCE,
  MAX_LOFT,
  MIN_DISTANCE,
  MIN_LOFT,
  SWING_LENGTH_CHART_PADDING,
  WEIGHT_CHART_PADDING,
  WEIGHT_NORMAL_BAND_TOLERANCE,
} from './analysisConfig';
import {
  buildActualDistanceLinePoints,
  buildLieLengthTrendPoints,
  buildLieReferencePoints,
  buildWeightTrendPoints,
  buildSwingLengthTrendPoints,
  createLieChartMappers,
  createLoftChartMappers,
  createWeightChartMappers,
  formatSignedGrams,
  formatSignedDegrees,
  formatSignedSwingWeight,
  getCategoryColor,
  getCategoryLabel,
  getLieLengthDeviationLabel,
  getLieLengthPointStyle,
  getSwingLengthDeviationLabel,
  getSwingLengthPointStyle,
  getTooltipPosition,
  getWeightDeviationLabel,
  getWeightPointStyle,
  isAnalysisClubVisible,
} from '../utils/analysisUtils';
import {
  buildLieAngleAnalysis,
  buildLieLengthAnalysis,
  buildLoftDistanceAnalysis,
  buildSwingLengthAnalysis,
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
  swingGoodTolerance,
  swingAdjustThreshold,
  userLieAngleStandards,
  onSetLieTypeStandard,
  onSetLieClubStandard,
  onClearLieTypeStandard,
  onClearLieClubStandard,
  onResetLieStandards,
}: AnalysisScreenProps) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('loftDistance');

  // Get summary data from useSummary hook
  const summaryData = useSummary();


  const [showLieSettings, setShowLieSettings] = useState(false);
  const loftChartContainerRef = useRef<HTMLDivElement | null>(null);
  const weightChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lieChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lieLengthChartContainerRef = useRef<HTMLDivElement | null>(null);
  const swingLengthChartContainerRef = useRef<HTMLDivElement | null>(null);
  const loftTooltipRef = useRef<HTMLDivElement | null>(null);
  const weightTooltipRef = useRef<HTMLDivElement | null>(null);
  const lieTooltipRef = useRef<HTMLDivElement | null>(null);
  const lieLengthTooltipRef = useRef<HTMLDivElement | null>(null);
  const swingLengthTooltipRef = useRef<HTMLDivElement | null>(null);

  const hiddenClubKeySet = useMemo(() => new Set(hiddenAnalysisClubKeys), [hiddenAnalysisClubKeys]);
  const isClubVisible = useCallback(
    (club: GolfClub) => isAnalysisClubVisible(club, hiddenClubKeySet),
    [hiddenClubKeySet],
  );

  const { tooltip: loftTooltip, setRawTooltip: setLoftTooltip } = useAnalysisTooltip<LoftTooltipState>(isClubVisible);
  const { tooltip: weightTooltip, setRawTooltip: setWeightTooltip } = useAnalysisTooltip<WeightTooltipState>(isClubVisible);
  const { tooltip: lieTooltip, setRawTooltip: setLieTooltip } = useAnalysisTooltip<LieTooltipState>(isClubVisible);
  const { tooltip: lieLengthTooltip, setRawTooltip: setLieLengthTooltip } =
    useAnalysisTooltip<LieLengthTooltipState>(isClubVisible);
  const { tooltip: swingLengthTooltip, setRawTooltip: setSwingLengthTooltip } =
    useAnalysisTooltip<SwingLengthTooltipState>(isClubVisible);
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
  const weightChartSize = useResponsiveChartSize(
    activeTab === 'weightLength',
    weightChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const lieChartSize = useResponsiveChartSize(
    activeTab === 'lieAngle',
    lieChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const lieLengthChartSize = useResponsiveChartSize(
    activeTab === 'lieLength',
    lieLengthChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );
  const swingLengthChartSize = useResponsiveChartSize(
    activeTab === 'swingLength',
    swingLengthChartContainerRef,
    { width: CHART_WIDTH, height: CHART_HEIGHT },
  );

  const loftTooltipBox: TooltipBoxSize = useTooltipBoxSize(loftTooltip, loftTooltipRef, { width: 200, height: 120 });
  const weightTooltipBox: TooltipBoxSize = useTooltipBoxSize(weightTooltip, weightTooltipRef, { width: 200, height: 110 });
  const lieTooltipBox: TooltipBoxSize = useTooltipBoxSize(lieTooltip, lieTooltipRef, { width: 200, height: 110 });
  const lieLengthTooltipBox: TooltipBoxSize = useTooltipBoxSize(lieLengthTooltip, lieLengthTooltipRef, { width: 220, height: 130 });
  const swingLengthTooltipBox: TooltipBoxSize = useTooltipBoxSize(swingLengthTooltip, swingLengthTooltipRef, { width: 220, height: 130 });

  const {
    tableClubs: loftTableClubs,
    chartClubs,
    hasVisibleData: hasLoftData,
  } = buildLoftDistanceAnalysis(clubs, headSpeed, isClubVisible);

  const loftTicks = [10, 20, 30, 40, 50, 60];
  const distanceTicks = [100, 150, 200, 250];


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

  const {
    tableClubs: swingLengthTableClubs,
    chartClubs: swingLengthClubs,
    regression: swingLengthRegression,
    bounds: swingLengthBounds,
    lengthTicks: swingLengthLengthTicks,
    swingWeightTicks,
    hasAnyData: hasAnySwingLengthData,
    hasVisibleData: hasSwingLengthData,
  } = buildSwingLengthAnalysis(clubs, isClubVisible, swingGoodTolerance ?? 1.5, swingAdjustThreshold ?? 2.0);

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

  const { mapX: mapSwingLengthX, mapY: mapSwingLengthY } = createWeightChartMappers(
    swingLengthChartSize,
    SWING_LENGTH_CHART_PADDING,
    {
      minLength: swingLengthBounds.minLength,
      maxLength: swingLengthBounds.maxLength,
      minWeight: swingLengthBounds.minSwingWeight,
      maxWeight: swingLengthBounds.maxSwingWeight,
    },
  );

  const { linePoints: swingLengthTrendLinePoints, bandPoints: swingLengthTrendBandPoints } =
    buildSwingLengthTrendPoints(
      hasSwingLengthData,
      swingLengthBounds,
      swingLengthRegression,
      swingAdjustThreshold ?? 2.0,
      mapSwingLengthX,
      mapSwingLengthY,
    );

  const weightTooltipPos = weightTooltip
    ? getTooltipPosition(weightTooltip.x, weightTooltip.y, weightChartSize, weightTooltipBox)
    : null;

  const loftTooltipPos = loftTooltip
    ? getTooltipPosition(loftTooltip.x, loftTooltip.y, loftChartSize, loftTooltipBox)
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

  const swingLengthTooltipPos = swingLengthTooltip
    ? getTooltipPosition(
      swingLengthTooltip.x,
      swingLengthTooltip.y,
      swingLengthChartSize,
      swingLengthTooltipBox,
    )
    : null;


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
        headSpeed={headSpeed}
        onHeadSpeedChange={handleHeadSpeedChange}
      />
    </div>
  );

  const renderSwingLengthChart = () => (
    <AnalysisSwingLengthChart
      hasAnySwingLengthData={hasAnySwingLengthData}
      hasSwingLengthData={hasSwingLengthData}
      swingLengthChartContainerRef={swingLengthChartContainerRef}
      swingLengthChartSize={swingLengthChartSize}
      swingLengthTrendBandPoints={swingLengthTrendBandPoints}
      swingWeightTicks={swingWeightTicks}
      mapSwingLengthY={mapSwingLengthY}
      lengthTicks={swingLengthLengthTicks}
      mapSwingLengthX={mapSwingLengthX}
      swingLengthTrendLinePoints={swingLengthTrendLinePoints}
      swingLengthClubs={swingLengthClubs}
      getSwingLengthPointStyle={getSwingLengthPointStyle}
      setSwingLengthTooltip={setSwingLengthTooltip}
      swingLengthTooltip={swingLengthTooltip}
      swingLengthTooltipRef={swingLengthTooltipRef}
      swingLengthTooltipPos={swingLengthTooltipPos}
      getCategoryLabel={getCategoryLabel}
      getSwingLengthDeviationLabel={getSwingLengthDeviationLabel}
      formatSignedSwingWeight={formatSignedSwingWeight}
      swingGoodTolerance={swingGoodTolerance ?? 1.5}
      swingAdjustThreshold={swingAdjustThreshold ?? 2.0}
      SWING_LENGTH_CHART_PADDING={SWING_LENGTH_CHART_PADDING}
      regressionSlope={swingLengthRegression.slope}
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
      ) : activeTab === 'swingLength' ? (
        <>
          {renderSwingLengthChart()}
          <AnalysisSwingLengthTable
            hasAnySwingLengthData={hasAnySwingLengthData}
            swingLengthTableClubs={swingLengthTableClubs}
            hiddenClubKeySet={hiddenClubKeySet}
            onSetAnalysisClubVisible={onSetAnalysisClubVisible}
          />
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
      ) : activeTab === 'summary' ? (
        <SummaryTab data={summaryData} />
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
