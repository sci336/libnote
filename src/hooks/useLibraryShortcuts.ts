import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ShortcutSettings } from '../types/domain';
import { eventMatchesShortcut, isTypingInEditableTarget } from '../utils/shortcuts';

interface UseLibraryShortcutsOptions {
  appMenuOpen: boolean;
  shortcuts: ShortcutSettings;
  sidebarChapterId: string | undefined;
  handleCreateLoosePage: () => void;
  handleCreatePage: (chapterId: string) => void;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  navigateHome: () => void;
  navigateBack: () => void;
}

export function useLibraryShortcuts({
  appMenuOpen,
  shortcuts,
  sidebarChapterId,
  handleCreateLoosePage,
  handleCreatePage,
  setSidebarOpen,
  navigateHome,
  navigateBack
}: UseLibraryShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || appMenuOpen || isTypingInEditableTarget(event.target)) {
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.newLoosePage)) {
        event.preventDefault();
        handleCreateLoosePage();
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.newChapterPage)) {
        if (sidebarChapterId) {
          event.preventDefault();
          handleCreatePage(sidebarChapterId);
        }
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.toggleSidebar)) {
        event.preventDefault();
        setSidebarOpen((open) => !open);
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.goHome)) {
        event.preventDefault();
        navigateHome();
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.goBack)) {
        event.preventDefault();
        navigateBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    appMenuOpen,
    handleCreateLoosePage,
    handleCreatePage,
    navigateBack,
    navigateHome,
    setSidebarOpen,
    shortcuts,
    sidebarChapterId
  ]);
}
