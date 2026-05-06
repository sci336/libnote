import { describe, expect, it } from 'vitest';
import type { Book, Chapter, Page } from '../types/domain';
import {
  buildBacklinkIndex,
  buildPageTitleLookup,
  extractBracketLinks,
  getAmbiguousLinksFromSegments,
  getAmbiguousLinks,
  getBacklinks,
  getBracketLinkMatches,
  getPageTitleAutocompleteSuggestions,
  getBrokenLinks,
  getOutgoingLinks,
  getWikiLinkDestinationLabel,
  replaceTextRangeWithSuggestion,
  parseContentIntoSegments
} from './pageLinks';
import { buildLargeLibraryFixture } from '../test/largeLibrary';

const pages: Page[] = [
  createPage('page-zeus', 'Zeus Notes', 'See [[Athena]] and [[Missing Page]].'),
  createPage('page-athena', 'Athena', 'Back to [[zeus notes]].'),
  createPage('page-duplicate-a', 'Duplicate', ''),
  createPage('page-duplicate-b', 'Duplicate', ''),
  createPage('page-source', 'Source', 'Points at [[duplicate]].'),
  createPage('page-mixed-source', 'Mixed Source', 'See [[Athena]], [[Missing Page]], [[Duplicate]], and [[ duplicate ]].')
];
const books: Book[] = [createBook('book-1', 'Greek Myths')];
const chapters: Chapter[] = [createChapter('chapter-1', 'Olympians', 'book-1')];

describe('pageLinks', () => {
  it('extracts bracket links from page content', () => {
    expect(extractBracketLinks('Read [[Athena]] then [[ Zeus Notes ]].')).toEqual([
      'Athena',
      'Zeus Notes'
    ]);
  });

  it('extracts bracket links from rich HTML content', () => {
    expect(
      extractBracketLinks(
        '<h2>Sources</h2><p>Read <strong>[[Athena]]</strong> and <em>[[ Zeus Notes ]]</em>.</p>'
      )
    ).toEqual(['Athena', 'Zeus Notes']);
  });

  it('resolves page links case-insensitively', () => {
    const lookup = buildPageTitleLookup(pages);
    const segments = parseContentIntoSegments('Open [[athena]].', lookup);
    const link = segments.find((segment) => segment.type === 'link');

    expect(link).toMatchObject({
      type: 'link',
      displayText: 'Athena',
      targetPageId: 'page-athena',
      matchingPageIds: ['page-athena'],
      resolutionStatus: 'resolved'
    });
  });

  it('marks links with zero matches as missing', () => {
    const lookup = buildPageTitleLookup(pages);
    const segments = parseContentIntoSegments('Open [[Missing Page]].', lookup);
    const link = segments.find((segment) => segment.type === 'link');

    expect(link).toMatchObject({
      type: 'link',
      displayText: 'Missing Page',
      targetPageId: null,
      matchingPageIds: [],
      resolutionStatus: 'missing'
    });
  });

  it('finds one matching destination', () => {
    expect(getBracketLinkMatches('athena', pages).map((page) => page.id)).toEqual(['page-athena']);
  });

  it('marks duplicate-title links as ambiguous instead of choosing the first page', () => {
    const lookup = buildPageTitleLookup(pages);
    const segments = parseContentIntoSegments('Open [[duplicate]].', lookup);
    const link = segments.find((segment) => segment.type === 'link');

    expect(link).toMatchObject({
      type: 'link',
      displayText: 'duplicate',
      targetPageId: null,
      matchingPageIds: ['page-duplicate-a', 'page-duplicate-b'],
      resolutionStatus: 'ambiguous'
    });
    expect(getBracketLinkMatches('duplicate', pages).map((page) => page.id)).toEqual([
      'page-duplicate-a',
      'page-duplicate-b'
    ]);
  });

  it('reports outgoing and broken links', () => {
    const zeus = pages[0];

    expect(getOutgoingLinks(zeus, pages)).toEqual([
      {
        key: 'page-athena',
        label: 'Athena',
        targetPageId: 'page-athena',
        matchingPageIds: ['page-athena'],
        resolutionStatus: 'resolved'
      }
    ]);
    expect(getBrokenLinks(zeus, pages)).toEqual([
      {
        key: 'missing:missing page',
        label: 'Missing Page',
        targetPageId: null,
        matchingPageIds: [],
        resolutionStatus: 'missing'
      }
    ]);
  });

  it('detects backlinks from linked pages', () => {
    expect(getBacklinks(pages[0], pages).map((page) => page.id)).toEqual(['page-athena']);
    expect(buildBacklinkIndex(pages)['page-zeus']).toEqual(['page-athena']);
  });

  it('updates backlinks when titles change because links are resolved from current titles', () => {
    const renamedPages = pages.map((page) =>
      page.id === 'page-zeus' ? { ...page, title: 'Storm Notes' } : page
    );

    expect(buildBacklinkIndex(renamedPages)['page-zeus']).toBeUndefined();

    const updatedLinkPages = renamedPages.map((page) =>
      page.id === 'page-athena' ? { ...page, content: 'Back to [[Storm Notes]].' } : page
    );

    expect(buildBacklinkIndex(updatedLinkPages)['page-zeus']).toEqual(['page-athena']);
  });

  it('does not keep backlinks for pages removed from the live link set', () => {
    const livePages = pages.filter((page) => page.id !== 'page-athena');

    expect(buildBacklinkIndex(livePages)['page-zeus']).toBeUndefined();
  });

  it('does not report ambiguous duplicate-title links as outgoing or broken links', () => {
    const links = getOutgoingLinks(pages[4], pages);

    expect(links).toEqual([]);
    expect(getBrokenLinks(pages[4], pages)).toEqual([]);
  });

  it('reports ambiguous links only in the ambiguous metadata collection', () => {
    const mixedSource = pages[5];

    expect(getOutgoingLinks(mixedSource, pages).map((link) => link.label)).toEqual(['Athena']);
    expect(getBrokenLinks(mixedSource, pages).map((link) => link.label)).toEqual(['Missing Page']);
    expect(getAmbiguousLinks(mixedSource, pages)).toEqual([
      {
        key: 'ambiguous:duplicate:page-duplicate-a|page-duplicate-b',
        label: 'Duplicate',
        targetPageId: null,
        matchingPageIds: ['page-duplicate-a', 'page-duplicate-b'],
        resolutionStatus: 'ambiguous'
      }
    ]);
  });

  it('generates destination labels for loose pages', () => {
    const loosePage = createPage('loose-1', 'Inbox', '', { chapterId: null, isLoose: true });

    expect(getWikiLinkDestinationLabel(loosePage, chapters, books)).toBe('Loose Pages / Inbox');
  });

  it('generates destination labels for book chapter pages', () => {
    expect(getWikiLinkDestinationLabel(pages[0], chapters, books)).toBe(
      'Greek Myths / Olympians / Zeus Notes'
    );
  });

  it('ranks page autocomplete suggestions by exact, starts-with, then contains matches', () => {
    const suggestionPages = [
      createPage('page-contains', 'A History Project', ''),
      createPage('page-starts', 'History Timeline', ''),
      createPage('page-exact', 'History', ''),
      createPage('page-miss', 'Math Notes', '')
    ];

    expect(
      getPageTitleAutocompleteSuggestions(suggestionPages, chapters, books, 'history').map(
        (suggestion) => suggestion.title
      )
    ).toEqual(['History', 'History Timeline', 'A History Project']);
  });

  it('keeps duplicate page title autocomplete entries understandable with path labels', () => {
    const duplicatePages = [
      createPage('page-duplicate-a', 'Duplicate', '', { chapterId: 'chapter-1' }),
      createPage('page-duplicate-b', 'Duplicate', '', { chapterId: null, isLoose: true })
    ];
    const suggestions = getPageTitleAutocompleteSuggestions(duplicatePages, chapters, books, 'dup');

    expect(suggestions).toEqual([
      expect.objectContaining({
        title: 'Duplicate',
        pathLabel: 'Greek Myths / Olympians / Duplicate',
        isDuplicateTitle: true
      }),
      expect.objectContaining({
        title: 'Duplicate',
        pathLabel: 'Loose Pages / Duplicate',
        isDuplicateTitle: true
      })
    ]);
  });

  it('formats selected wikilink autocomplete text as normal plain brackets', () => {
    expect(replaceTextRangeWithSuggestion('See [[his later', 4, 9, '[[History Notes]]')).toBe(
      'See [[History Notes]] later'
    );
  });

  it('derives duplicate titles, broken links, ambiguous links, and many backlinks over a generated large library', () => {
    const { data, ids } = buildLargeLibraryFixture({ linkSourceCount: 30 });
    const lookup = buildPageTitleLookup(data.pages.filter((page) => !page.deletedAt));
    const sourcePage = data.pages.find((page) => page.id === ids.backlinkSourcePageIds[0]);
    const targetPage = data.pages.find((page) => page.id === ids.backlinkTargetPageId);

    expect(sourcePage).toBeDefined();
    expect(targetPage).toBeDefined();
    expect(lookup.get('duplicate field note')?.map((page) => page.id)).toEqual(ids.duplicatePageIds);

    const segments = parseContentIntoSegments(sourcePage?.content ?? '', lookup);
    expect(getAmbiguousLinksFromSegments(segments)[0]).toMatchObject({
      label: 'Duplicate Field Note',
      matchingPageIds: ids.duplicatePageIds
    });
    expect(getBrokenLinks(sourcePage as Page, data.pages).map((link) => link.label)).toContain('Missing Field Note');

    const backlinkIndex = buildBacklinkIndex(data.pages.filter((page) => !page.deletedAt));
    expect(backlinkIndex[ids.backlinkTargetPageId]).toHaveLength(31);
    expect(getBacklinks(targetPage as Page, data.pages.filter((page) => !page.deletedAt))).toHaveLength(31);
  });
});

function createPage(
  id: string,
  title: string,
  content: string,
  options?: { chapterId?: string | null; isLoose?: boolean }
): Page {
  return {
    id,
    chapterId: options?.chapterId ?? 'chapter-1',
    title,
    content,
    tags: [],
    textSize: 16,
    isLoose: options?.isLoose ?? false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}

function createBook(id: string, title: string): Book {
  return {
    id,
    title,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}

function createChapter(id: string, title: string, bookId: string): Chapter {
  return {
    id,
    bookId,
    title,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}
