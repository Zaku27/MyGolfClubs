import React from 'react';

type LieGoodRangePolygonProps = {
  points: string | null;
};

export const LieGoodRangePolygon: React.FC<LieGoodRangePolygonProps> = ({ points }) => {
  if (!points) return null;
  return (
    <polygon
      points={points}
      fill="#2e7d32"
      fillOpacity="0.16"
    />
  );
};
