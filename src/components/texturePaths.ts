export const TEXTURE_PATHS_SEAMLESS = {
  fairway: "/golf-textures/fairway-seamless.webp",
  rough: "/golf-textures/rough-seamless.webp",
  bareground: "/golf-textures/bareground-seamless.webp",
  bunker: "/golf-textures/bunker-seamless.webp",
  green: "/golf-textures/green-seamless.webp",
  water: "/golf-textures/water-seamless.webp",
  ob: "/golf-textures/ob-woods-seamless.webp",
} as const;

export const TEXTURE_PATHS_TOPDOWN = {
  fairway: "/golf-textures/fairway.webp",
  rough: "/golf-textures/rough.webp",
  bareground: "/golf-textures/bareground.webp",
  bunker: "/golf-textures/bunker.webp",
  green: "/golf-textures/green.webp",
  water: "/golf-textures/water.webp",
  ob: "/golf-textures/ob-woods.webp",
} as const;

export type TextureKey = keyof typeof TEXTURE_PATHS_SEAMLESS;
