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
  fairway: "/golf-textures/fairway-topdown.webp",
  rough: "/golf-textures/rough-topdown.webp",
  bareground: "/golf-textures/bareground-topdown.webp",
  bunker: "/golf-textures/bunker-topdown.webp",
  green: "/golf-textures/green-topdown.webp",
  water: "/golf-textures/water-topdown.webp",
  ob: "/golf-textures/ob-woods-topdown.webp",
} as const;

export type TextureKey = keyof typeof TEXTURE_PATHS_SEAMLESS;
