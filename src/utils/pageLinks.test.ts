import { describe, expect, it } from 'vitest';
import type { Book, Chapter, Page } from '../types/domain';
import {
  buildBacklinkIndex,
  buildPageTitleLookup,
  extractBracketLinks,
  getBacklinks,
  getBracketLinkMatches,
  getBrokenLinks,
  getOutgoingLinks,
  getWikiLinkDestinationLabel,
  parseContentIntoSegments
} from './pageLinks';

const pages: Page[] = [
  createPage('page-zeus', 'Zeus Notes', 'See [[Athena]] and [[Missing Page]].'),
  createPage('page-athena', 'Athena', 'Back to [[zeus notes]].'),
  createPage('page-duplicate-a', 'Duplicate', ''),
  createPage('page-duplicate-b', 'Duplicate', ''),
  createPage('page-source', 'Source', 'Points at [[duplicate]].')
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

  it('does not report ambiguous duplicate-title links as outgoing or broken links', () => {
    const links = getOutgoingLinks(pages[4], pages);

    expect(links).toEqual([]);
    expect(getBrokenLinks(pages[4], pages)).toEqual([]);
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
