export type ClubCategory = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export type SwingStatus = '良好' | 'やや重い' | 'やや軽い' | '調整推奨';

type CategoryVisualConfig = {
  label: string;
  color: string;
  lieBarColor: string;
};

type DistanceModel = {
  base: number;
  speedCoeff: number;
  loftCoeff: number;
  min: number;
  max: number;
  standardLoft: number;
};

export const WEIGHT_NORMAL_BAND_TOLERANCE = 12;
export const WEIGHT_HEAVY_OUTLIER_THRESHOLD = 15;
export const WEIGHT_LIGHT_OUTLIER_THRESHOLD = 15;

// Distance gap thresholds (in yards)
export const DISTANCE_GAP_NARROW_THRESHOLD = 8;
export const DISTANCE_GAP_WIDE_THRESHOLD = 18;

// Distance gap coefficient calculation
export const DISTANCE_GAP_COEFFICIENT_AT_45 = 3.5;
export const DISTANCE_GAP_COEFFICIENT_AT_30 = 2.5;
export const DEFAULT_HEAD_SPEED = 45;

// Distance gap thresholds by club category transition (based on actual distance data)
// Driver → 3W: 20-30yd ideal, max 35yd OK, wide gaps are acceptable
export const DRIVER_TO_WOOD_IDEAL_MIN = 20;
export const DRIVER_TO_WOOD_IDEAL_MAX = 30;
export const DRIVER_TO_WOOD_MAX_ACCEPTABLE = 35;

// 3W → Hybrid/5W: 15-25yd ideal, ±8yd tolerance, prioritize this
export const WOOD_TO_HYBRID_IDEAL_MIN = 15;
export const WOOD_TO_HYBRID_IDEAL_MAX = 25;
export const WOOD_TO_HYBRID_TOLERANCE = 8;

// Irons (3I-PW): 10-15yd ideal, ±3yd tolerance, most strict
export const IRON_GAP_IDEAL_MIN = 10;
export const IRON_GAP_IDEAL_MAX = 15;
export const IRON_GAP_TOLERANCE = 3;

// Wedges (PW-LW): 8-12yd ideal, ±2yd tolerance, precision priority
export const WEDGE_GAP_IDEAL_MIN = 8;
export const WEDGE_GAP_IDEAL_MAX = 12;
export const WEDGE_GAP_TOLERANCE = 2;

export const SWING_WEIGHT_FULL_PATTERN = /^([A-F])([0-9](?:\.[0-9])?)$/;
export const SWING_WEIGHT_LEGACY_PATTERN = /^([0-9](?:\.[0-9])?)$/;
export const SWING_WEIGHT_BASE_LETTER_CODE = 'A'.charCodeAt(0);

export const CATEGORY_VISUAL_CONFIG: Record<ClubCategory, CategoryVisualConfig> = {
  driver: { label: 'ドライバー', color: '#1976d2', lieBarColor: '#1976d2' },
  wood: { label: 'ウッド', color: '#0d47a1', lieBarColor: '#0d47a1' },
  hybrid: { label: 'ハイブリッド', color: '#00acc1', lieBarColor: '#26c6da' },
  iron: { label: 'アイアン', color: '#0b8f5b', lieBarColor: '#2e7d32' },
  wedge: { label: 'ウェッジ', color: '#9acd32', lieBarColor: '#9acd32' },
  putter: { label: 'パター', color: '#616161', lieBarColor: '#424242' },
};

export const CLUB_TYPE_CATEGORY_MAP: Record<string, ClubCategory> = {
  DRIVER: 'driver',
  PUTTER: 'putter',
  WOOD: 'wood',
  HYBRID: 'hybrid',
  IRON: 'iron',
  WEDGE: 'wedge',
  D: 'wood',
  P: 'putter',
  PW: 'iron',
};

export const DISTANCE_MODELS: Record<ClubCategory, DistanceModel> = {
  driver: {
    base: 255,
    speedCoeff: 4.8,
    loftCoeff: -4.25,
    min: 170,
    max: 350,
    standardLoft: 10.5,
  },
  wood: {
    base: 225,
    speedCoeff: 4.3,
    loftCoeff: -4.25,
    min: 130,
    max: 290,
    standardLoft: 15,
  },
  hybrid: {
    base: 195,
    speedCoeff: 3.8,
    loftCoeff: -3.25,
    min: 110,
    max: 250,
    standardLoft: 22,
  },
  iron: {
    base: 165,
    speedCoeff: 3.0,
    loftCoeff: -2.75,
    min: 70,
    max: 220,
    standardLoft: 30,
  },
  wedge: {
    base: 115,
    speedCoeff: 2.1,
    loftCoeff: -2.75,
    min: 40,
    max: 150,
    standardLoft: 46,
  },
  putter: {
    base: 10,
    speedCoeff: 0,
    loftCoeff: 0,
    min: 1,
    max: 20,
    standardLoft: 0,
  },
};

export const SWING_STATUS_COLOR_MAP: Record<SwingStatus, string> = {
  良好: '#2e7d32',
  やや重い: '#ef6c00',
  やや軽い: '#ef6c00',
  調整推奨: '#c62828',
};
