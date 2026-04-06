import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { GolfClub } from '../types/golf';

type Size = {
  width: number;
  height: number;
};

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const useResponsiveChartSize = (
  enabled: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  initialSize: Size,
) => {
  const [size, setSize] = useState<Size>(initialSize);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const updateSize = (nextWidth: number) => {
      const width = clampValue(Math.round(nextWidth), 320, 1120);
      const height = clampValue(Math.round(width * 0.43), 260, 430);
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [enabled, containerRef.current]);

  return size;
};

export const useTooltipBoxSize = <T,>(
  tooltip: T | null,
  tooltipRef: RefObject<HTMLDivElement | null>,
  initialSize: Size,
) => {
  const [boxSize, setBoxSize] = useState<Size>(initialSize);

  useEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width <= 0 || height <= 0) return;

    setBoxSize((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [tooltip, tooltipRef]);

  return boxSize;
};

export const useVisibleTooltip = <T extends { club: GolfClub }>(
  rawTooltip: T | null,
  isClubVisible: (club: GolfClub) => boolean,
) => useMemo(() => {
  if (!rawTooltip) return null;
  return isClubVisible(rawTooltip.club) ? rawTooltip : null;
}, [rawTooltip, isClubVisible]);

type UseAnalysisTooltipResult<T extends { club: GolfClub }> = {
  rawTooltip: T | null;
  setRawTooltip: Dispatch<SetStateAction<T | null>>;
  tooltip: T | null;
};

export const useAnalysisTooltip = <T extends { club: GolfClub }>(
  isClubVisible: (club: GolfClub) => boolean,
): UseAnalysisTooltipResult<T> => {
  const [rawTooltip, setRawTooltip] = useState<T | null>(null);
  const tooltip = useVisibleTooltip(rawTooltip, isClubVisible);

  return {
    rawTooltip,
    setRawTooltip,
    tooltip,
  };
};

type UseAnalysisInputHandlersParams = {
  onUpdateActualDistance: (clubId: number, distance: number) => void;
  onHeadSpeedChange: (value: number) => void;
};

export const useAnalysisInputHandlers = ({
  onUpdateActualDistance,
  onHeadSpeedChange,
}: UseAnalysisInputHandlersParams) => {
  const handleActualDistanceChange = useCallback(
    (clubId: number | undefined, event: ChangeEvent<HTMLInputElement>) => {
      if (clubId == null) return;
      const nextValue = Number(event.target.value);
      onUpdateActualDistance(clubId, Number.isFinite(nextValue) ? nextValue : 0);
    },
    [onUpdateActualDistance],
  );

  const handleHeadSpeedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      if (!Number.isFinite(nextValue)) {
        onHeadSpeedChange(42);
        return;
      }
      onHeadSpeedChange(Math.max(30, Math.min(60, nextValue)));
    },
    [onHeadSpeedChange],
  );

  return {
    handleActualDistanceChange,
    handleHeadSpeedChange,
  };
};