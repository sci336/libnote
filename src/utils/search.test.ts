import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import {
  buildSearchIndex,
  getHighlightedParts,
  searchPages,
  searchTrashedEntities,
  type SearchResult
} from './search';

const data: LibraryData = {
  books: [
    {
      id: 'book-history',
      title: 'Ancient History',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'book-trash',
      title: 'Discarded Archive',
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: '2026-01-03T00:00:00.000Z'
    }
  ],
  chapters: [
    {
      id: 'chapter-myths',
      bookId: 'book-history',
      title: 'Greek Mythology',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'chapter-trash',
      bookId: 'book-history',
      title: 'Trashed Chapter',
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: '2026-01-03T00:00:00.000Z',
      deletedFrom: { bookId: 'book-history' }
    }
  ],
  pages: [
    {
      id: 'page-zeus',
      chapterId: 'chapter-myths',
      title: 'Zeus Notes',
      content: 'Zeus ruled from Olympus and appears in many school history notes.',
      tags: ['mythology', 'school'],
      textSize: 16,
      isLoose: false,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'page-athena',
      chapterId: 'chapter-myths',
      title: 'Athena',
      content: 'Wisdom and strategy notes.',
      tags: ['mythology'],
      textSize: 16,
      isLoose: false,
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'page-loose',
      chapterId: null,
      title: 'Loose Research',
      content: 'A loose page about field research and interviews.',
      tags: ['research'],
      textSize: 16,
      isLoose: true,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'page-trash',
      chapterId: 'chapter-myths',
      title: 'Deleted Oracle',
      content: 'A removed prophecy note.',
      tags: ['mythology'],
      textSize: 16,
      isLoose: false,
      sortOrder: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: '2026-01-03T00:00:00.000Z',
      deletedFrom: { bookId: 'book-history', chapterId: 'chapter-myths', wasLoose: false }
    }
  ]
};

describe('search', () => {
  const index = buildSearchIndex(data);

  it('finds books, chapters, page titles, and page content', () => {
    expect(searchPages('ancient', index).map((result) => result.id)).toContain('book-history');
    expect(searchPages('greek', index).map((result) => result.id)).toContain('chapter-myths');
    expect(searchPages('zeus', index).map((result) => result.id)).toContain('page-zeus');
    expect(searchPages('olympus', index).map((result) => result.id)).toContain('page-zeus');
  });

  it('marks loose page results with Loose Pages context', () => {
    const result = searchPages('field research', index).find((item) => item.id === 'page-loose');

    expect(result?.type).toBe('page');
    expect(result && result.type === 'page' ? result.isLoosePage : false).toBe(true);
    expect(result && result.type === 'page' ? result.path : '').toBe('Loose Pages');
  });

  it('searches trashed entities separately', () => {
    expect(searchPages('deleted oracle', index)).toEqual([]);

    const trashResults = searchTrashedEntities('deleted oracle', index);
    expect(trashResults).toHaveLength(1);
    expect(trashResults[0]).toMatchObject({
      type: 'trash',
      id: 'page-trash',
      title: 'Deleted Oracle'
    });
  });

  it('supports tag-only and multi-tag AND searches', () => {
    expect(pageResultIds(searchPages('/mythology', index))).toEqual(['page-athena', 'page-zeus']);
    expect(pageResultIds(searchPages('/mythology /school', index))).toEqual(['page-zeus']);
  });

  it('shows readable snippets for tag-only page and trash searches', () => {
    const liveResult = searchPages('/school', index).find((item) => item.id === 'page-zeus');
    const trashResult = searchTrashedEntities('/mythology', index).find((item) => item.id === 'page-trash');

    expect(liveResult && liveResult.type === 'page' ? liveResult.snippet : '').toContain('Zeus ruled from Olympus');
    expect(trashResult && trashResult.type === 'trash' ? trashResult.snippet : '').toContain('removed prophecy');
  });

  it('supports mixed text plus slash-tag searches', () => {
    expect(pageResultIds(searchPages('zeus /mythology /school', index))).toEqual(['page-zeus']);
    expect(pageResultIds(searchPages('athena /school', index))).toEqual([]);
  });

  it('ranks exact title matches above content matches when practical', () => {
    const results = searchPages('zeus', index);
    expect(results[0]).toMatchObject({ id: 'page-zeus', matchKind: 'title-partial' });
  });

  it('builds snippets and highlighted parts for text matches', () => {
    const result = searchPages('olympus', index).find((item) => item.id === 'page-zeus');
    expect(result && result.type === 'page' ? result.snippet : '').toContain('Olympus');

    const highlighted = getHighlightedParts('Zeus ruled from Olympus', 'zeus olympus');
    expect(highlighted.filter((part) => part.isMatch).map((part) => part.text.toLowerCase())).toEqual([
      'zeus',
      'olympus'
    ]);
  });

  it('builds search snippets from rich HTML as plain text', () => {
    const richData: LibraryData = {
      ...data,
      pages: [
        ...data.pages,
        {
          id: 'page-rich',
          chapterId: 'chapter-myths',
          title: 'Rich Content',
          content:
            '<h1>Heading</h1><p><strong>Bold</strong> <em>italic</em> <u>under</u> <mark>highlight</mark> /history</p><ul><li>Bullet</li></ul><ol><li>First</li></ol><ul data-list-type="task"><li data-task-item="true" data-checked="false">Todo</li></ul>',
          tags: ['history'],
          textSize: 16,
          isLoose: false,
          sortOrder: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        }
      ]
    };

    const result = searchPages('highlight', buildSearchIndex(richData)).find((item) => item.id === 'page-rich');
    const snippet = result && result.type === 'page' ? result.snippet : '';

    expect(snippet).toContain('Heading Bold italic under highlight /history - Bullet 1. First - [ ] Todo');
    expect(snippet).not.toContain('<');
    expect(snippet).not.toContain('>');
  });

  it('searches a large generated library while preserving ranking, tags, loose pages, and trash separation', () => {
    const largeData = buildLargeSearchLibrary();
    const largeIndex = buildSearchIndex(largeData);

    const rankedResults = searchPages('needle', largeIndex);
    expect(rankedResults[0]).toMatchObject({
      id: 'needle-title-page',
      type: 'page',
      matchKind: 'title-partial'
    });
    expect(rankedResults.map((result) => result.id)).toContain('needle-content-page');
    expect(searchPages('volume 12', largeIndex).some((result) => result.id === 'book-12')).toBe(true);
    expect(searchPages('section 12 3', largeIndex).some((result) => result.id === 'chapter-12-3')).toBe(true);

    expect(pageResultIds(searchPages('/focus /research', largeIndex))).toEqual([
      'needle-title-page',
      'needle-content-page'
    ]);
    expect(pageResultIds(searchPages('loose keyword /inbox', largeIndex))).toEqual(['loose-needle-page']);

    expect(searchPages('graveyardonly', largeIndex)).toEqual([]);
    expect(searchTrashedEntities('graveyardonly', largeIndex)[0]).toMatchObject({
      id: 'trash-needle-page',
      type: 'trash'
    });
  });
});

function pageResultIds(results: SearchResult[]): string[] {
  return results
    .filter((result): result is Extract<SearchResult, { type: 'page' }> => result.type === 'page')
    .map((result) => result.id);
}

function buildLargeSearchLibrary(): LibraryData {
  const books: LibraryData['books'] = [];
  const chapters: LibraryData['chapters'] = [];
  const pages: LibraryData['pages'] = [];

  for (let bookIndex = 0; bookIndex < 30; bookIndex += 1) {
    books.push({
      id: `book-${bookIndex}`,
      title: `Volume ${bookIndex}`,
      sortOrder: bookIndex,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    });

    for (let chapterIndex = 0; chapterIndex < 5; chapterIndex += 1) {
      const chapterId = `chapter-${bookIndex}-${chapterIndex}`;
      chapters.push({
        id: chapterId,
        bookId: `book-${bookIndex}`,
        title: `Section ${bookIndex} ${chapterIndex}`,
        sortOrder: chapterIndex,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      });

      for (let pageIndex = 0; pageIndex < 12; pageIndex += 1) {
        const id =
          bookIndex === 12 && chapterIndex === 3 && pageIndex === 4
            ? 'needle-title-page'
            : bookIndex === 12 && chapterIndex === 3 && pageIndex === 5
              ? 'needle-content-page'
              : `page-${bookIndex}-${chapterIndex}-${pageIndex}`;
        pages.push({
          id,
          chapterId,
          title: id === 'needle-title-page' ? 'Needle Field Notes' : `Page ${bookIndex}-${chapterIndex}-${pageIndex}`,
          content: id === 'needle-content-page' ? 'This ordinary page contains the needle phrase.' : 'General notes.',
          tags: id.includes('needle') ? ['focus', 'research'] : pageIndex % 3 === 0 ? ['archive'] : [],
          textSize: 16,
          isLoose: false,
          sortOrder: pageIndex,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        });
      }
    }
  }

  pages.push({
    id: 'loose-needle-page',
    chapterId: null,
    title: 'Loose Keyword',
    content: 'loose keyword appears here',
    tags: ['inbox'],
    textSize: 16,
    isLoose: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  });
  pages.push({
    id: 'trash-needle-page',
    chapterId: 'chapter-12-3',
    title: 'Trashed Needle',
    content: 'graveyardonly',
    tags: ['focus'],
    textSize: 16,
    isLoose: false,
    sortOrder: 99,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-01-03T00:00:00.000Z',
    deletedFrom: { bookId: 'book-12', chapterId: 'chapter-12-3', wasLoose: false }
  });

  return { books, chapters, pages };
}
