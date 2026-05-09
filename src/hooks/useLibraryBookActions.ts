import type { LibraryData, ViewState } from '../types/domain';
import { createBook, reorderBooks, updateBook, updateBookCover } from '../store/libraryStore';

interface UseLibraryBookActionsOptions {
  data: LibraryData | null;
  updateData: (nextData: LibraryData) => void;
  navigateToView: (nextView: ViewState, options?: { shouldCloseSidebar?: boolean }) => void;
}

export function useLibraryBookActions({
  data,
  updateData,
  navigateToView
}: UseLibraryBookActionsOptions) {
  function handleCreateBook(): void {
    if (!data) {
      return;
    }

    const result = createBook(data);
    updateData(result.data);
    navigateToView({ type: 'book', bookId: result.book.id }, { shouldCloseSidebar: true });
  }

  function handleReorderBooks(orderedBookIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderBooks(data, orderedBookIds));
  }

  function handleRenameBook(bookId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updateBook(data, bookId, title));
  }

  function handleUpdateBookCover(bookId: string, coverId: string): void {
    if (!data) {
      return;
    }

    updateData(updateBookCover(data, bookId, coverId));
  }

  return {
    handleCreateBook,
    handleReorderBooks,
    handleRenameBook,
    handleUpdateBookCover
  };
}
