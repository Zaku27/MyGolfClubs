export const APP = {
  name: import.meta.env.VITE_APP_NAME as string,
  short: import.meta.env.VITE_APP_SHORT as string,
  tagline: import.meta.env.VITE_APP_TAGLINE as string,
} as const;

// Future i18n keys for translation
export const APP_I18N_KEYS = {
  name: 'app.name',
  short: 'app.short',
  tagline: 'app.tagline',
} as const;

// Social media hashtags and handles
export const SOCIAL = {
  hashtag: '#MyGolfRoom',
  handle: '@mygolfroom',
} as const;
