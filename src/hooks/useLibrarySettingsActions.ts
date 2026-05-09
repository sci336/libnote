import type { Dispatch, SetStateAction } from 'react';
import type {
  AppSettings,
  AppThemeId,
  LibraryBooksPerRow,
  LibraryShelfStyle,
  ShortcutAction,
  ShortcutBinding
} from '../types/domain';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from '../utils/shortcuts';

interface UseLibrarySettingsActionsOptions {
  setSettings: Dispatch<SetStateAction<AppSettings>>;
}

export function useLibrarySettingsActions({ setSettings }: UseLibrarySettingsActionsOptions) {
  function handleUpdateLibraryBooksPerRow(booksPerRow: LibraryBooksPerRow): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      libraryView: {
        ...currentSettings.libraryView,
        booksPerRow
      }
    }));
  }

  function handleUpdateLibraryShelfStyle(shelfStyle: LibraryShelfStyle): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      libraryView: {
        ...currentSettings.libraryView,
        shelfStyle
      }
    }));
  }

  function handleUpdateTheme(theme: AppThemeId): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      theme
    }));
  }

  function handleUpdateShortcut(action: ShortcutAction, binding: ShortcutBinding | null): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      shortcuts: {
        ...currentSettings.shortcuts,
        [action]: binding
      }
    }));
  }

  function handleResetShortcut(action: ShortcutAction): void {
    handleUpdateShortcut(action, DEFAULT_SHORTCUTS[action]);
  }

  function handleResetAllShortcuts(): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      shortcuts: normalizeShortcutSettings(DEFAULT_SHORTCUTS)
    }));
  }

  return {
    handleUpdateLibraryBooksPerRow,
    handleUpdateLibraryShelfStyle,
    handleUpdateTheme,
    handleUpdateShortcut,
    handleResetShortcut,
    handleResetAllShortcuts
  };
}
