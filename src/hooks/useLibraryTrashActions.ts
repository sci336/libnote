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
    replaceView(getViewAfterPageTrash(page));
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

    const nextData = deleteTrashItemForever(data, item);

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

    const nextData = emptyTrash(data);

    updateData(nextData);
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: getLiveRecentPageIds(currentSettings.recentPageIds, nextData)
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

function getViewAfterPageTrash(page: Page): ViewState {
  if (isLoosePage(page)) {
    return { type: 'loosePages' };
  }

  if (page.chapterId) {
    return { type: 'chapter', chapterId: page.chapterId };
  }

  return { type: 'root' };
}

function deleteTrashItemForever(data: LibraryData, item: TrashItem): LibraryData {
  if (item.type === 'book') {
    return deleteBookForever(data, item.id);
  }

  if (item.type === 'chapter') {
    return deleteChapterForever(data, item.id);
  }

  return deletePageForever(data, item.id);
}

function getLiveRecentPageIds(recentPageIds: string[], data: LibraryData): string[] {
  const livePageIds = new Set(data.pages.filter((page) => !page.deletedAt).map((page) => page.id));
  return recentPageIds.filter((pageId) => livePageIds.has(pageId));
}
