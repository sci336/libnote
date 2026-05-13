import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { AppSettings, LibraryData, Page, ViewState } from '../types/domain';
import {
  createPage,
  moveLoosePageToChapter,
  movePageToChapter,
  reorderPagesInChapter,
  updatePage
} from '../store/libraryStore';
import { RECENT_PAGES_LIMIT } from '../utils/appSettings';
import { isLoosePage } from '../utils/pageState';

interface UseLibraryPageActionsOptions {
  data: LibraryData | null;
  activePageId: string | undefined;
  livePageById: Map<string, Page> | undefined;
  recentPageIds: string[];
  settingsHydrated: boolean;
  updateData: (nextData: LibraryData) => void;
  navigateToView: (nextView: ViewState, options?: { shouldCloseSidebar?: boolean }) => void;
  replaceView: (nextView: ViewState) => void;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setShouldAutoFocusEditor: Dispatch<SetStateAction<boolean>>;
  setMovingPageId: Dispatch<SetStateAction<string | null>>;
}

export function useLibraryPageActions({
  data,
  activePageId,
  livePageById,
  recentPageIds,
  settingsHydrated,
  updateData,
  navigateToView,
  replaceView,
  setSettings,
  setShouldAutoFocusEditor,
  setMovingPageId
}: UseLibraryPageActionsOptions) {
  useEffect(() => {
    if (!activePageId) {
      return;
    }

    recordRecentPage(activePageId);
  }, [activePageId]);

  useEffect(() => {
    if (!data || !settingsHydrated || !livePageById) {
      return;
    }

    // Recent Pages is user-facing navigation, not durable history. Prune ids
    // after deletes/restores/imports so the sidebar never links to missing pages.
    const cleanedRecentPageIds = recentPageIds.filter((pageId) => livePageById.has(pageId));

    if (!areStringArraysEqual(cleanedRecentPageIds, recentPageIds)) {
      setSettings((currentSettings) => ({
        ...currentSettings,
        recentPageIds: currentSettings.recentPageIds.filter((pageId) => livePageById.has(pageId))
      }));
    }
  }, [data, livePageById, recentPageIds, settingsHydrated]);

  function handleCreatePage(chapterId: string): void {
    if (!data) {
      return;
    }

    const result = createPage(data, { chapterId, isLoose: false });
    updateData(result.data);
    setShouldAutoFocusEditor(true);
    navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
  }

  function handleCreateLoosePage(): void {
    if (!data) {
      return;
    }

    const result = createPage(data, { chapterId: null, isLoose: true });
    updateData(result.data);
    setShouldAutoFocusEditor(true);
    navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
  }

  function handleCreatePageFromLink(sourcePage: Page, title: string): void {
    if (!data) {
      return;
    }

    const isLoose = isLoosePage(sourcePage);
    // Wiki-link page creation inherits the source page's container. Loose notes
    // stay loose, while chapter pages create siblings in the same chapter.
    const result = createPage(data, {
      chapterId: isLoose ? null : sourcePage.chapterId,
      isLoose,
      title
    });

    updateData(result.data);
    setShouldAutoFocusEditor(true);
    navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
  }

  function handleReorderPages(chapterId: string, orderedPageIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderPagesInChapter(data, chapterId, orderedPageIds));
  }

  function handleMovePage(pageId: string, destinationChapterId: string): void {
    if (!data) {
      return;
    }

    updateData(movePageToChapter(data, pageId, destinationChapterId));
    setMovingPageId(null);
  }

  function handleMoveLoosePage(pageId: string, payload: { chapterId: string }): void {
    if (!data) {
      return;
    }

    const result = moveLoosePageToChapter(data, pageId, payload.chapterId);

    updateData(result.data);
    if (result.chapterId) {
      replaceView({ type: 'chapter', chapterId: result.chapterId });
    }
  }

  function handleRenamePage(pageId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { title }));
  }

  function handleUpdatePageContent(pageId: string, content: string): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { content }));
  }

  function handleUpdatePageTextSize(pageId: string, textSize: number): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { textSize }));
  }

  function handleUpdatePageTags(pageId: string, tags: string[]): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { tags }));
  }

  function recordRecentPage(pageId: string): void {
    setSettings((currentSettings) => {
      const nextRecentPageIds = [
        pageId,
        ...currentSettings.recentPageIds.filter((recentPageId) => recentPageId !== pageId)
      ].slice(0, RECENT_PAGES_LIMIT);

      if (areStringArraysEqual(nextRecentPageIds, currentSettings.recentPageIds)) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        recentPageIds: nextRecentPageIds
      };
    });
  }

  return {
    handleCreatePage,
    handleCreateLoosePage,
    handleCreatePageFromLink,
    handleReorderPages,
    handleMovePage,
    handleMoveLoosePage,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize,
    handleUpdatePageTags
  };
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
