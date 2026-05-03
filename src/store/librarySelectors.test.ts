import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import {
  buildLibraryDerivedData,
  getChapterCountForBookFromDerived,
  getPageCountForChapterFromDerived
} from './librarySelectors';

describe('library selectors', () => {
  it('builds large-library derived maps, groups, counts, tags, and trash in one reusable snapshot', () => {
    const data = buildLargeLibrary();
    const derived = buildLibraryDerivedData(data);

    expect(derived.liveBooks).toHaveLength(12);
    expect(derived.liveChapters).toHaveLength(48);
    expect(derived.livePages).toHaveLength(505);
    expect(derived.loosePages).toHaveLength(25);
    expect(derived.trashedItemCount).toBe(3);
    expect(derived.trashItems.map((item) => item.id)).toEqual(['trash-page-1', 'trash-chapter-1', 'trash-book-1']);
    expect(derived.allTags).toEqual(['archive', 'focus', 'project', 'research']);
    expect(derived.tagSummaries.find((summary) => summary.tag === 'project')?.pageCount).toBeGreaterThan(100);

    expect(getChapterCountForBookFromDerived(derived, 'book-0')).toBe(4);
    expect(derived.chaptersByBookId.get('book-0')?.map((chapter) => chapter.id)).toEqual([
      'chapter-0-0',
      'chapter-0-1',
      'chapter-0-2',
      'chapter-0-3'
    ]);
    expect(getPageCountForChapterFromDerived(derived, 'chapter-0-0')).toBe(10);
    expect(derived.pagesByChapterId.get('chapter-0-0')?.map((page) => page.sortOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);
  });
});

function buildLargeLibrary(): LibraryData {
  const books: LibraryData['books'] = [];
  const chapters: LibraryData['chapters'] = [];
  const pages: LibraryData['pages'] = [];

  for (let bookIndex = 0; bookIndex < 12; bookIndex += 1) {
    books.push({
      id: `book-${bookIndex}`,
      title: `Book ${bookIndex}`,
      sortOrder: bookIndex,
      createdAt: timestamp(bookIndex),
      updatedAt: timestamp(bookIndex)
    });

    for (let chapterIndex = 0; chapterIndex < 4; chapterIndex += 1) {
      const chapterId = `chapter-${bookIndex}-${chapterIndex}`;
      chapters.push({
        id: chapterId,
        bookId: `book-${bookIndex}`,
        title: `Chapter ${bookIndex}.${chapterIndex}`,
        sortOrder: chapterIndex,
        createdAt: timestamp(chapterIndex),
        updatedAt: timestamp(chapterIndex)
      });

      for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
        pages.push({
          id: `page-${bookIndex}-${chapterIndex}-${pageIndex}`,
          chapterId,
          title: `Page ${bookIndex}.${chapterIndex}.${pageIndex}`,
          content: `Research note ${pageIndex}`,
          tags: pageIndex % 2 === 0 ? ['project', 'research'] : ['archive'],
          textSize: 16,
          isLoose: false,
          sortOrder: pageIndex,
          createdAt: timestamp(pageIndex),
          updatedAt: timestamp(pageIndex)
        });
      }
    }
  }

  for (let pageIndex = 0; pageIndex < 25; pageIndex += 1) {
    pages.push({
      id: `loose-${pageIndex}`,
      chapterId: null,
      title: `Loose ${pageIndex}`,
      content: `Loose page ${pageIndex}`,
      tags: ['focus'],
      textSize: 16,
      isLoose: true,
      sortOrder: pageIndex,
      createdAt: timestamp(pageIndex),
      updatedAt: timestamp(100 - pageIndex)
    });
  }

  books.push({
    id: 'trash-book-1',
    title: 'Trashed Book',
    sortOrder: 99,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    deletedAt: '2026-02-01T00:00:00.000Z'
  });
  chapters.push({
    id: 'trash-chapter-1',
    bookId: 'book-0',
    title: 'Trashed Chapter',
    sortOrder: 99,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    deletedAt: '2026-02-02T00:00:00.000Z',
    deletedFrom: { bookId: 'book-0' }
  });
  pages.push({
    id: 'trash-page-1',
    chapterId: 'chapter-0-0',
    title: 'Trashed Page',
    content: 'Removed',
    tags: ['project'],
    textSize: 16,
    isLoose: false,
    sortOrder: 99,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    deletedAt: '2026-02-03T00:00:00.000Z',
    deletedFrom: { bookId: 'book-0', chapterId: 'chapter-0-0', wasLoose: false }
  });

  return { books, chapters, pages };
}

function timestamp(offset: number): string {
  return `2026-01-${String((offset % 28) + 1).padStart(2, '0')}T00:00:00.000Z`;
}
