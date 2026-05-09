import type { Dispatch, SetStateAction } from 'react';
import type { LibraryData, ViewState } from '../types/domain';
import {
  createChapter,
  moveChapterToBook,
  reorderChaptersInBook,
  updateChapter
} from '../store/libraryStore';

interface UseLibraryChapterActionsOptions {
  data: LibraryData | null;
  updateData: (nextData: LibraryData) => void;
  navigateToView: (nextView: ViewState, options?: { shouldCloseSidebar?: boolean }) => void;
  setMovingChapterId: Dispatch<SetStateAction<string | null>>;
}

export function useLibraryChapterActions({
  data,
  updateData,
  navigateToView,
  setMovingChapterId
}: UseLibraryChapterActionsOptions) {
  function handleCreateChapter(bookId: string): void {
    if (!data) {
      return;
    }

    const result = createChapter(data, bookId);
    updateData(result.data);
    navigateToView({ type: 'chapter', chapterId: result.chapter.id }, { shouldCloseSidebar: true });
  }

  function handleReorderChapters(bookId: string, orderedChapterIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderChaptersInBook(data, bookId, orderedChapterIds));
  }

  function handleMoveChapter(chapterId: string, destinationBookId: string): void {
    if (!data) {
      return;
    }

    updateData(moveChapterToBook(data, chapterId, destinationBookId));
    setMovingChapterId(null);
  }

  function handleRenameChapter(chapterId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updateChapter(data, chapterId, title));
  }

  return {
    handleCreateChapter,
    handleReorderChapters,
    handleMoveChapter,
    handleRenameChapter
  };
}
