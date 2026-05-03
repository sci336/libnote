import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import {
  createBook,
  createChapter,
  createPage,
  deleteBookForever,
  deleteChapterForever,
  deletePageForever,
  emptyLibraryData,
  emptyTrash,
  getChaptersForBook,
  getLoosePages,
  getPagesForChapter,
  getSortedBooks,
  moveBookToTrash,
  moveChapterToBook,
  moveChapterToTrash,
  moveLoosePageToChapter,
  movePageToChapter,
  movePageToTrash,
  reorderBooks,
  reorderChaptersInBook,
  reorderPagesInChapter,
  restoreBook,
  restoreChapter,
  restorePage
} from './libraryStore';

describe('libraryStore', () => {
  it('creates books, chapters, chapter pages, and loose pages', () => {
    const { data: withBook, book } = createBook(emptyLibraryData);
    const { data: withChapter, chapter } = createChapter(withBook, book.id);
    const { data: withPage, page } = createPage(withChapter, { chapterId: chapter.id, isLoose: false });
    const { data: withLoosePage, page: loosePage } = createPage(withPage, { chapterId: null, isLoose: true });

    expect(book.title).toBe('Untitled Book');
    expect(chapter.bookId).toBe(book.id);
    expect(page).toMatchObject({ chapterId: chapter.id, isLoose: false, title: 'Untitled Page' });
    expect(loosePage).toMatchObject({ chapterId: null, isLoose: true, title: 'Untitled Loose Page' });
    expect(withLoosePage.books).toHaveLength(1);
    expect(withLoosePage.chapters).toHaveLength(1);
    expect(withLoosePage.pages).toHaveLength(2);
  });

  it('moves pages between chapters and loose pages into chapters', () => {
    const { data, chapterA, chapterB, pageA, loosePage } = buildLibrary();

    const movedPageData = movePageToChapter(data, pageA.id, chapterB.id);
    expect(movedPageData.pages.find((page) => page.id === pageA.id)).toMatchObject({
      chapterId: chapterB.id,
      isLoose: false
    });

    const movedLooseResult = moveLoosePageToChapter(movedPageData, loosePage.id, chapterA.id);
    expect(movedLooseResult.chapterId).toBe(chapterA.id);
    expect(movedLooseResult.data.pages.find((page) => page.id === loosePage.id)).toMatchObject({
      chapterId: chapterA.id,
      isLoose: false
    });
  });

  it('reorders books, chapters, and pages using complete ordered id lists', () => {
    const { data, bookA, bookB, chapterA, chapterB, pageA, pageB } = buildLibrary();

    const reorderedBooks = reorderBooks(data, [bookB.id, bookA.id]);
    expect(getSortedBooks(reorderedBooks).map((book) => book.id)).toEqual([bookB.id, bookA.id]);

    const reorderedChapters = reorderChaptersInBook(data, bookA.id, [chapterB.id, chapterA.id]);
    expect(getChaptersForBook(reorderedChapters, bookA.id).map((chapter) => chapter.id)).toEqual([
      chapterB.id,
      chapterA.id
    ]);

    const reorderedPages = reorderPagesInChapter(data, chapterA.id, [pageB.id, pageA.id]);
    expect(getPagesForChapter(reorderedPages, chapterA.id).map((page) => page.id)).toEqual([
      pageB.id,
      pageA.id
    ]);

    expect(reorderPagesInChapter(data, chapterA.id, [pageB.id])).toBe(data);
  });

  it('soft-deletes and restores pages', () => {
    const { data, pageA } = buildLibrary();
    const trashed = movePageToTrash(data, pageA.id);

    expect(trashed.pages.find((page) => page.id === pageA.id)?.deletedAt).toEqual(expect.any(String));
    expect(getPagesForChapter(trashed, pageA.chapterId ?? '')).not.toContainEqual(
      expect.objectContaining({ id: pageA.id })
    );

    const restored = restorePage(trashed, pageA.id);
    expect(restored.pages.find((page) => page.id === pageA.id)).toMatchObject({
      deletedAt: null,
      chapterId: pageA.chapterId,
      isLoose: false
    });
  });

  it('restores pages as loose when their original chapter is unavailable', () => {
    const { data, pageA, chapterA } = buildLibrary();
    const trashedPage = movePageToTrash(data, pageA.id);
    const trashedChapter = moveChapterToTrash(trashedPage, chapterA.id);
    const restoredPage = restorePage(trashedChapter, pageA.id);

    expect(restoredPage.pages.find((page) => page.id === pageA.id)).toMatchObject({
      chapterId: null,
      isLoose: true,
      deletedAt: null
    });
  });

  it('cascades book trash and restore to chapters and pages', () => {
    const { data, bookA, chapterA, pageA } = buildLibrary();
    const trashed = moveBookToTrash(data, bookA.id);

    expect(trashed.books.find((book) => book.id === bookA.id)?.deletedAt).toEqual(expect.any(String));
    expect(trashed.chapters.find((chapter) => chapter.id === chapterA.id)?.deletedAt).toEqual(expect.any(String));
    expect(trashed.pages.find((page) => page.id === pageA.id)?.deletedAt).toEqual(expect.any(String));

    const restored = restoreBook(trashed, bookA.id);
    expect(restored.books.find((book) => book.id === bookA.id)?.deletedAt).toBeNull();
    expect(restored.chapters.find((chapter) => chapter.id === chapterA.id)?.deletedAt).toBeNull();
    expect(restored.pages.find((page) => page.id === pageA.id)?.deletedAt).toBeNull();
  });

  it('cascades chapter trash and restore to pages', () => {
    const { data, chapterA, pageA } = buildLibrary();
    const trashed = moveChapterToTrash(data, chapterA.id);

    expect(trashed.chapters.find((chapter) => chapter.id === chapterA.id)?.deletedAt).toEqual(expect.any(String));
    expect(trashed.pages.find((page) => page.id === pageA.id)?.deletedAt).toEqual(expect.any(String));

    const restored = restoreChapter(trashed, chapterA.id);
    expect(restored.chapters.find((chapter) => chapter.id === chapterA.id)?.deletedAt).toBeNull();
    expect(restored.pages.find((page) => page.id === pageA.id)?.deletedAt).toBeNull();
  });

  it('deletes items forever and empties trash', () => {
    const { data, bookA, chapterA, pageA, loosePage } = buildLibrary();

    expect(deletePageForever(data, pageA.id).pages.some((page) => page.id === pageA.id)).toBe(false);
    expect(deleteChapterForever(data, chapterA.id).chapters.some((chapter) => chapter.id === chapterA.id)).toBe(false);
    expect(deleteBookForever(data, bookA.id).books.some((book) => book.id === bookA.id)).toBe(false);

    const trashedPage = movePageToTrash(data, loosePage.id);
    const emptied = emptyTrash(trashedPage);
    expect(emptied.pages.some((page) => page.id === loosePage.id)).toBe(false);
    expect(getLoosePages(emptied).some((page) => page.id === loosePage.id)).toBe(false);
  });

  it('moves chapters between books', () => {
    const { data, bookB, chapterA } = buildLibrary();
    const moved = moveChapterToBook(data, chapterA.id, bookB.id);

    expect(moved.chapters.find((chapter) => chapter.id === chapterA.id)).toMatchObject({
      bookId: bookB.id
    });
  });
});

function buildLibrary(): {
  data: LibraryData;
  bookA: LibraryData['books'][number];
  bookB: LibraryData['books'][number];
  chapterA: LibraryData['chapters'][number];
  chapterB: LibraryData['chapters'][number];
  pageA: LibraryData['pages'][number];
  pageB: LibraryData['pages'][number];
  loosePage: LibraryData['pages'][number];
} {
  const firstBook = createBook(emptyLibraryData);
  const secondBook = createBook(firstBook.data);
  const firstChapter = createChapter(secondBook.data, firstBook.book.id);
  const secondChapter = createChapter(firstChapter.data, firstBook.book.id);
  const firstPage = createPage(secondChapter.data, { chapterId: firstChapter.chapter.id, isLoose: false, title: 'A' });
  const secondPage = createPage(firstPage.data, { chapterId: firstChapter.chapter.id, isLoose: false, title: 'B' });
  const loose = createPage(secondPage.data, { chapterId: null, isLoose: true, title: 'Loose' });

  return {
    data: loose.data,
    bookA: firstBook.book,
    bookB: secondBook.book,
    chapterA: firstChapter.chapter,
    chapterB: secondChapter.chapter,
    pageA: firstPage.page,
    pageB: secondPage.page,
    loosePage: loose.page
  };
}
