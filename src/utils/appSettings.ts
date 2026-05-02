import type { AppSettings, LibraryShelfStyle } from '../types/domain';
import { DEFAULT_APP_THEME_ID, normalizeAppThemeId } from './appThemes';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from './shortcuts';

export const RECENT_PAGES_LIMIT = 4;
export const LIBRARY_SHELF_STYLES = ['shelf-rows', 'simple-grid', 'compact-shelf', 'large-cover'] as const;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: DEFAULT_APP_THEME_ID,
  libraryView: {
    booksPerRow: 4,
    shelfStyle: 'shelf-rows'
  },
  shortcuts: DEFAULT_SHORTCUTS,
  recentPageIds: [],
  lastBackupExportedAt: null
};

export function normalizeAppSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  const booksPerRow = settings?.libraryView?.booksPerRow;

  return {
    theme: normalizeAppThemeId(settings?.theme),
    libraryView: {
      booksPerRow:
        booksPerRow === 2 || booksPerRow === 3 || booksPerRow === 4 || booksPerRow === 5
          ? booksPerRow
          : DEFAULT_APP_SETTINGS.libraryView.booksPerRow,
      shelfStyle: normalizeLibraryShelfStyle(settings?.libraryView?.shelfStyle)
    },
    shortcuts: normalizeShortcutSettings(settings?.shortcuts),
    recentPageIds: normalizeRecentPageIds(settings?.recentPageIds),
    lastBackupExportedAt: normalizeLastBackupExportedAt(settings?.lastBackupExportedAt)
  };
}

export function normalizeLibraryShelfStyle(shelfStyle: unknown): LibraryShelfStyle {
  return typeof shelfStyle === 'string' && LIBRARY_SHELF_STYLES.includes(shelfStyle as LibraryShelfStyle)
    ? (shelfStyle as LibraryShelfStyle)
    : DEFAULT_APP_SETTINGS.libraryView.shelfStyle;
}

export function filterRecentPageIdsForLibrary(settings: AppSettings, pageIds: string[]): AppSettings {
  const validPageIds = new Set(pageIds);

  return {
    ...settings,
    recentPageIds: settings.recentPageIds.filter((pageId) => validPageIds.has(pageId))
  };
}

function normalizeRecentPageIds(recentPageIds: unknown): string[] {
  if (!Array.isArray(recentPageIds)) {
    return [];
  }

  const normalizedIds: string[] = [];

  for (const pageId of recentPageIds) {
    if (typeof pageId !== 'string' || pageId.length === 0 || normalizedIds.includes(pageId)) {
      continue;
    }

    normalizedIds.push(pageId);

    if (normalizedIds.length === RECENT_PAGES_LIMIT) {
      break;
    }
  }

  return normalizedIds;
}

function normalizeLastBackupExportedAt(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return Number.isNaN(new Date(value).getTime()) ? null : value;
}
