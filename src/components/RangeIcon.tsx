import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/**
 * Golf practice range icon (flag + mat)
 */
export const RangeIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    {/* Flag pole */}
    <line x1="12" y1="3" x2="12" y2="17" />
    {/* Flag */}
    <polyline points="12 3 18 6 12 9" />
    {/* Mat */}
    <ellipse cx="12" cy="20" rx="7" ry="2" fill="#a7f3d0" stroke="none" />
    {/* Ball */}
    <circle cx="12" cy="18.5" r="1" fill="#fff" stroke="#16a34a" strokeWidth="0.5" />
  </svg>
);
