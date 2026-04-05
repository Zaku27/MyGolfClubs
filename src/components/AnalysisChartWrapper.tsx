import type { ReactNode, RefObject } from 'react';

type AnalysisChartWrapperProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  chartSize: { width: number; height: number };
  onMouseLeave?: () => void;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
  tooltip?: ReactNode;
};

export const AnalysisChartWrapper = ({
  containerRef,
  chartSize,
  onMouseLeave,
  className,
  ariaLabel,
  children,
  tooltip,
}: AnalysisChartWrapperProps) => (
  <div
    className="chart-scroll interactive-chart-scroll"
    ref={containerRef}
    onMouseLeave={onMouseLeave}
  >
    <svg
      viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
      className={`analysis-chart ${className ?? ''}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      {children}
    </svg>
    {tooltip}
  </div>
);
