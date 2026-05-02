import type { AppThemeId } from '../types/domain';

export interface AppTheme {
  id: AppThemeId;
  label: string;
  description: string;
}

export const DEFAULT_APP_THEME_ID: AppThemeId = 'classic-library';

export const APP_THEMES: AppTheme[] = [
  {
    id: 'classic-library',
    label: 'Classic Library',
    description: 'Warm paper, soft shelves, and a traditional writing-room feel.'
  },
  {
    id: 'modern-minimal',
    label: 'Modern Minimal',
    description: 'Cooler neutrals, cleaner surfaces, and a quieter workspace.'
  },
  {
    id: 'warm-study',
    label: 'Warm Study',
    description: 'Cream paper, walnut shelves, and muted gold accents for a cozy desk feel.'
  },
  {
    id: 'dark-archive',
    label: 'Dark Archive',
    description: 'Deep archive browns, charcoal surfaces, and antique amber accents.'
  },
  {
    id: 'light-paper',
    label: 'Light Paper',
    description: 'Bright off-white paper, pale gray structure, and calm readable contrast.'
  }
];

const APP_THEME_IDS = new Set<AppThemeId>(APP_THEMES.map((theme) => theme.id));

export function normalizeAppThemeId(themeId: unknown): AppThemeId {
  return typeof themeId === 'string' && APP_THEME_IDS.has(themeId as AppThemeId)
    ? (themeId as AppThemeId)
    : DEFAULT_APP_THEME_ID;
}
