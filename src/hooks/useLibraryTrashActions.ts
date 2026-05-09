import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, LibraryData, Page, TrashItem, ViewState } from '../types/domain';
import {
  deleteBookForever,
  deleteChapterForever,
  deletePageForever,
  emptyTrash,
  moveBookToTrash,
  moveChapterToTrash,
  movePageToTrash,
  restoreBook,
  restoreChapter,
  restorePage
} from '../store/libraryStore';
import { isLoosePage } from '../utils/pageState';

interface UseLibraryTrashActionsOptions {
  data: LibraryData | null;
  updateData: (nextData: LibraryData) => void;
  replaceView: (nextView: ViewState) => void;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
}

export function useLibraryTrashActions({
  data,
  updateData,
  replaceView,
  setSettings
}: UseLibraryTrashActionsOptions) {
  function handleDeleteBook(bookId: string): void {
    const bookTitle = data?.books.find((book) => book.id === bookId)?.title ?? 'this book';

    if (
      !data ||
      !window.confirm(`Move "${bookTitle}" and all of its chapters and pages to Trash? You can restore them from Trash.`)
    ) {
      return;
    }

    updateData(moveBookToTrash(data, bookId));
    replaceView({ type: 'root' });
  }

  function handleDeleteChapter(chapterId: string, bookId: string): void {
    const chapterTitle = data?.chapters.find((chapter) => chapter.id === chapterId)?.title ?? 'this chapter';

    if (
      !data ||
      !window.confirm(`Move "${chapterTitle}" and all of its pages to Trash? You can restore them from Trash.`)
    ) {
      return;
    }

    updateData(moveChapterToTrash(data, chapterId));
    replaceView({ type: 'book', bookId });
  }

  function handleDeletePage(page: Page): void {
    if (!data || !window.confirm(`Move "${page.title}" to Trash? You can restore it from Trash.`)) {
      return;
    }

    updateData(movePageToTrash(data, page.id));
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: currentSettings.recentPageIds.filter((pageId) => pageId !== page.id)
    }));

    if (isLoosePage(page)) {
      replaceView({ type: 'loosePages' });
      return;
    }

    if (page.chapterId) {
      replaceView({ type: 'chapter', chapterId: page.chapterId });
      return;
    }

    replaceView({ type: 'root' });
  }

  function handleRestoreTrashItem(item: TrashItem): void {
    if (!data) {
      return;
    }

    if (item.type === 'book') {
      updateData(restoreBook(data, item.id));
      return;
    }

    if (item.type === 'chapter') {
      updateData(restoreChapter(data, item.id));
      return;
    }

    updateData(restorePage(data, item.id));
  }

  function handleDeleteTrashItemForever(item: TrashItem): void {
    if (!data || !window.confirm(`Delete "${item.title}" forever? This cannot be undone.`)) {
      return;
    }

    let nextData: LibraryData;

    if (item.type === 'book') {
      nextData = deleteBookForever(data, item.id);
    } else if (item.type === 'chapter') {
      nextData = deleteChapterForever(data, item.id);
    } else {
      nextData = deletePageForever(data, item.id);
    }

    updateData(nextData);
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: getLiveRecentPageIds(currentSettings.recentPageIds, nextData)
    }));
  }

  function handleEmptyTrash(): void {
    if (!data || !window.confirm('Empty Trash? This will permanently delete all trashed items and cannot be undone.')) {
      return;
    }

    updateData(emptyTrash(data));
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: currentSettings.recentPageIds.filter((pageId) =>
        data.pages.some((page) => page.id === pageId && !page.deletedAt)
      )
    }));
  }

  return {
    handleDeleteBook,
    handleDeleteChapter,
    handleDeletePage,
    handleRestoreTrashItem,
    handleDeleteTrashItemForever,
    handleEmptyTrash
  };
}

function getLiveRecentPageIds(recentPageIds: string[], data: LibraryData): string[] {
  const livePageIds = new Set(data.pages.filter((page) => !page.deletedAt).map((page) => page.id));
  return recentPageIds.filter((pageId) => livePageIds.has(pageId));
}
