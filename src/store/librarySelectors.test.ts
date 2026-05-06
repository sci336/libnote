import { describe, expect, it } from 'vitest';
import {
  buildLibraryDerivedData,
  getChapterCountForBookFromDerived,
  getPageCountForChapterFromDerived
} from './librarySelectors';
import { buildLargeLibraryFixture } from '../test/largeLibrary';

describe('library selectors', () => {
  it('builds large-library derived maps, groups, counts, tags, and trash in one reusable snapshot', () => {
    const { data, ids } = buildLargeLibraryFixture({
      bookCount: 12,
      chaptersPerBook: 4,
      pagesPerChapter: 10,
      loosePageCount: 25,
      trashedPageCount: 1,
      linkSourceCount: 4
    });
    const derived = buildLibraryDerivedData(data);

    expect(derived.liveBooks).toHaveLength(12);
    expect(derived.liveChapters).toHaveLength(48);
    expect(derived.livePages).toHaveLength(505);
    expect(derived.loosePages).toHaveLength(25);
    expect(derived.trashedItemCount).toBe(3);
    expect(derived.trashItems.map((item) => item.id)).toEqual([
      ids.trashedChapterId,
      ids.trashedPageId,
      ids.trashedBookId
    ]);
    expect(derived.allTags).toContain('research');
    expect(derived.allTags).toContain('inbox');
    expect(derived.tagSummaries.find((summary) => summary.tag === 'research')?.pageCount).toBeGreaterThan(100);

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
