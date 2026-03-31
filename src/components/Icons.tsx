// Icon components for consistent styling
import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const AddIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export const ToggleViewIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="22 8 22 4 18 4"></polyline>
    <polyline points="2 16 2 20 6 20"></polyline>
    <path d="M2 9v-5a2 2 0 0 1 2-2h5"></path>
    <path d="M22 15v5a2 2 0 0 1-2 2h-5"></path>
  </svg>
);

export const CompactViewIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
    <line x1="3" y1="9" x2="21" y2="9"></line>
    <line x1="3" y1="15" x2="21" y2="15"></line>
  </svg>
);

export const ExportIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="8 17 12 21 16 17"></polyline>
    <line x1="12" y1="12" x2="12" y2="21"></line>
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
  </svg>
);

export const ImportIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="8 7 12 3 16 7"></polyline>
    <line x1="12" y1="12" x2="12" y2="3"></line>
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
  </svg>
);

export const AnalysisIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 17"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

export const ResetIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

/** Golf flag / pin icon for the Course Simulator button. */
export const SimulatorIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    {/* Flag pole */}
    <line x1="7" y1="2" x2="7" y2="22"></line>
    {/* Flag */}
    <polyline points="7 2 18 6 7 10"></polyline>
    {/* Ground / ball */}
    <circle cx="7" cy="22" r="1.5" fill="currentColor" stroke="none"></circle>
  </svg>
);

/** User-profile style icon for Personal Data settings. */
export const PersonalDataIcon: React.FC<IconProps> = ({ size = 24, className = '', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} width={size} height={size}>
    <circle cx="12" cy="8" r="3.5"></circle>
    <path d="M4 19a8 8 0 0 1 16 0"></path>
  </svg>
);
