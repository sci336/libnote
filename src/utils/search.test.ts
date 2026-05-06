import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import {
  buildSearchIndex,
  getHighlightedParts,
  SEARCH_RESULT_LIMIT,
  searchPages,
  searchTrashedEntities,
  type SearchResult
} from './search';
import { buildLargeLibraryFixture } from '../test/largeLibrary';

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
    const { data: largeData, ids } = buildLargeLibraryFixture();
    const largeIndex = buildSearchIndex(largeData);

    const rankedResults = searchPages('needle', largeIndex);
    expect(rankedResults[0]).toMatchObject({
      id: ids.rareTitlePageId,
      type: 'page',
      matchKind: 'title-partial'
    });
    expect(rankedResults.map((result) => result.id)).toContain(ids.rareContentPageId);
    expect(searchPages('volume 12', largeIndex).some((result) => result.id === 'book-12')).toBe(true);
    expect(searchPages('section 12 3', largeIndex).some((result) => result.id === 'chapter-12-3')).toBe(true);

    expect(pageResultIds(searchPages('/focus /research', largeIndex))).toEqual([
      ids.rareTitlePageId,
      ids.rareContentPageId
    ]);
    expect(pageResultIds(searchPages('loose keyword /inbox', largeIndex))).toEqual([ids.looseRarePageId]);

    expect(searchPages('graveyardonly', largeIndex)).toEqual([]);
    expect(searchTrashedEntities('graveyardonly', largeIndex)[0]).toMatchObject({
      id: ids.trashedPageId,
      type: 'trash'
    });
  });

  it('caps broad large-library searches to keep result rendering bounded', () => {
    const { data: largeData } = buildLargeLibraryFixture();
    const largeIndex = buildSearchIndex(largeData);

    expect(searchPages('research', largeIndex)).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(searchPages('/research', largeIndex)).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(searchTrashedEntities('/deleted', largeIndex)).toHaveLength(80);
  });
});

function pageResultIds(results: SearchResult[]): string[] {
  return results
    .filter((result): result is Extract<SearchResult, { type: 'page' }> => result.type === 'page')
    .map((result) => result.id);
}
