// Future i18n structure for react-i18next
// This file prepares the translation keys for future internationalization

export const TRANSLATION_KEYS = {
  app: {
    name: 'app.name',
    short: 'app.short',
    tagline: 'app.tagline',
  },
  header: {
    share: 'header.share',
    shareLabel: 'header.shareLabel',
  },
  common: {
    loading: 'common.loading',
    error: 'common.error',
    save: 'common.save',
    cancel: 'common.cancel',
    delete: 'common.delete',
    edit: 'common.edit',
    add: 'common.add',
  },
} as const;

// English translations (fallback)
export const EN_TRANSLATIONS = {
  [TRANSLATION_KEYS.app.name]: 'MyGolfRoom',
  [TRANSLATION_KEYS.app.short]: 'MGR',
  [TRANSLATION_KEYS.app.tagline]: 'Your Clean & Fun Swing Gear Room',
  [TRANSLATION_KEYS.header.share]: 'Share',
  [TRANSLATION_KEYS.header.shareLabel]: 'Share your golf room',
  [TRANSLATION_KEYS.common.loading]: 'Loading...',
  [TRANSLATION_KEYS.common.error]: 'Error',
  [TRANSLATION_KEYS.common.save]: 'Save',
  [TRANSLATION_KEYS.common.cancel]: 'Cancel',
  [TRANSLATION_KEYS.common.delete]: 'Delete',
  [TRANSLATION_KEYS.common.edit]: 'Edit',
  [TRANSLATION_KEYS.common.add]: 'Add',
} as const;

// Japanese translations (for future use)
export const JA_TRANSLATIONS = {
  [TRANSLATION_KEYS.app.name]: 'MyGolfRoom',
  [TRANSLATION_KEYS.app.short]: 'MGR',
  [TRANSLATION_KEYS.app.tagline]: 'Your Clean & Fun Swing Gear Room',
  [TRANSLATION_KEYS.header.share]: 'Share',
  [TRANSLATION_KEYS.header.shareLabel]: 'Share your golf room',
  [TRANSLATION_KEYS.common.loading]: 'Loading...',
  [TRANSLATION_KEYS.common.error]: 'Error',
  [TRANSLATION_KEYS.common.save]: 'Save',
  [TRANSLATION_KEYS.common.cancel]: 'Cancel',
  [TRANSLATION_KEYS.common.delete]: 'Delete',
  [TRANSLATION_KEYS.common.edit]: 'Edit',
  [TRANSLATION_KEYS.common.add]: 'Add',
} as const;
