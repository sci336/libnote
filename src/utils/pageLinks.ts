import type { Book, Chapter, Page } from '../types/domain';
import { contentToPlainText } from './richText';

export type ContentSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'link';
      raw: string;
      displayText: string;
      targetPageId: string | null;
      matchingPageIds: string[];
      normalizedTargetTitle: string;
      resolutionStatus: WikiLinkResolutionStatus;
    };

export type WikiLinkResolutionStatus = 'resolved' | 'missing' | 'ambiguous';
export type PageTitleLookup = Map<string, Page[]>;
export type BacklinkIndex = Record<string, string[]>;
export type WikiPreviewChunk = ContentSegment;

export interface PageConnectionLink {
  key: string;
  label: string;
  targetPageId: string | null;
  matchingPageIds: string[];
  resolutionStatus: WikiLinkResolutionStatus;
}

export interface WikiLinkTriggerMatch {
  query: string;
  start: number;
  end: number;
}

export interface PageTitleAutocompleteSuggestion {
  pageId: string;
  title: string;
  pathLabel: string;
  isDuplicateTitle: boolean;
}

const BRACKET_LINK_PATTERN = /\[\[([\s\S]*?)\]\]/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Normalizes page titles for the `[[Page Title]]` link system.
 * Matching is intentionally case-insensitive and whitespace-insensitive so small
 * title edits do not silently break the reader experience.
 */
export function normalizePageTitle(title: string): string {
  return flattenText(title).toLowerCase();
}

export const normalizeWikiLinkTitle = normalizePageTitle;

export function extractBracketLinks(text: string): string[] {
  const matches: string[] = [];
  const sourceText = toSafeString(contentToPlainText(text));

  for (const match of sourceText.matchAll(BRACKET_LINK_PATTERN)) {
    const linkText = match[1]?.trim() ?? '';
    if (linkText.length > 0) {
      matches.push(linkText);
    }
  }

  return matches;
}

export const extractWikiLinks = extractBracketLinks;

export function buildPageTitleLookup(allPages: Page[]): PageTitleLookup {
  const lookup: PageTitleLookup = new Map();

  for (const page of allPages) {
    const normalizedTitle = normalizePageTitle(page.title);
    if (!normalizedTitle) {
      continue;
    }

    const matchingPages = lookup.get(normalizedTitle) ?? [];
    lookup.set(normalizedTitle, [...matchingPages, page]);
  }

  return lookup;
}

export function getAllPageTitleSuggestions(
  pages: Page[],
  query: string,
  currentPageId?: string,
  options?: { limit?: number }
): string[] {
  const normalizedQuery = normalizeSuggestionQuery(query);
  const limit = options?.limit ?? 6;

  if (!normalizedQuery) {
    return [];
  }

  const seenTitles = new Set<string>();
  const ranked = pages
    .filter((page) => !page.deletedAt && page.id !== currentPageId)
    .map((page) => page.title.trim())
    .filter((title) => {
      const normalizedTitle = normalizePageTitle(title);
      if (!normalizedTitle || seenTitles.has(normalizedTitle)) {
        return false;
      }

      seenTitles.add(normalizedTitle);
      return true;
    })
    .map((title) => {
      const normalizedTitle = normalizeSuggestionQuery(title);

      if (normalizedTitle === normalizedQuery) {
        return { title, score: 0, index: 0 };
      }

      if (normalizedTitle.startsWith(normalizedQuery)) {
        return { title, score: 1, index: 0 };
      }

      const containsIndex = normalizedTitle.indexOf(normalizedQuery);
      if (containsIndex !== -1) {
        return { title, score: 2, index: containsIndex };
      }

      return null;
    })
    .filter((entry): entry is { title: string; score: number; index: number } => entry !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.title.localeCompare(right.title);
    });

  return ranked.slice(0, limit).map((entry) => entry.title);
}

export function getPageTitleAutocompleteSuggestions(
  pages: Page[],
  chapters: Chapter[],
  books: Book[],
  query: string,
  currentPageId?: string,
  options?: { limit?: number }
): PageTitleAutocompleteSuggestion[] {
  const normalizedQuery = normalizeSuggestionQuery(query);
  const limit = options?.limit ?? 6;
  const titleCounts = new Map<string, number>();

  for (const page of pages) {
    if (page.deletedAt || page.id === currentPageId) {
      continue;
    }

    const normalizedTitle = normalizePageTitle(page.title);
    if (!normalizedTitle) {
      continue;
    }

    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
  }

  const ranked = pages
    .filter((page) => !page.deletedAt && page.id !== currentPageId)
    .map((page) => {
      const title = page.title.trim();
      const normalizedTitle = normalizeSuggestionQuery(title);

      if (!normalizedTitle) {
        return null;
      }

      const score = getSuggestionScore(normalizedTitle, normalizedQuery);
      if (score === null) {
        return null;
      }

      return {
        pageId: page.id,
        title,
        pathLabel: getWikiLinkDestinationLabel(page, chapters, books),
        isDuplicateTitle: (titleCounts.get(normalizePageTitle(title)) ?? 0) > 1,
        score: score.score,
        index: score.index
      };
    })
    .filter(
      (
        entry
      ): entry is PageTitleAutocompleteSuggestion & {
        score: number;
        index: number;
      } => entry !== null
    )
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      const titleComparison = left.title.localeCompare(right.title);
      if (titleComparison !== 0) {
        return titleComparison;
      }

      return left.pathLabel.localeCompare(right.pathLabel);
    });

  return ranked.slice(0, limit).map(({ score, index, ...suggestion }) => suggestion);
}

export function detectActiveWikiLinkTrigger(text: string, cursorPosition: number): WikiLinkTriggerMatch | null {
  const safeText = toSafeString(text);
  const cursor = Math.max(0, Math.min(cursorPosition, safeText.length));
  const beforeCursor = safeText.slice(0, cursor);
  const triggerIndex = beforeCursor.lastIndexOf('[[');

  if (triggerIndex === -1) {
    return null;
  }

  const closingBeforeTrigger = beforeCursor.lastIndexOf(']]');
  if (closingBeforeTrigger > triggerIndex) {
    return null;
  }

  const query = safeText.slice(triggerIndex + 2, cursor);
  if (/[\r\n]/.test(query) || query.includes('[') || query.includes(']')) {
    return null;
  }

  return {
    query,
    start: triggerIndex,
    end: cursor
  };
}

export function replaceTextRangeWithSuggestion(
  text: string,
  startIndex: number,
  endIndex: number,
  replacement: string
): string {
  const safeText = toSafeString(text);
  const start = Math.max(0, Math.min(startIndex, safeText.length));
  const end = Math.max(start, Math.min(endIndex, safeText.length));

  return `${safeText.slice(0, start)}${replacement}${safeText.slice(end)}`;
}

export function resolveBracketLink(linkText: string, allPages: Page[]): Page | null {
  const lookup = buildPageTitleLookup(allPages);
  return resolveUniqueBracketLinkFromLookup(linkText, lookup);
}

export function getBracketLinkMatches(linkText: string, allPages: Page[]): Page[] {
  const lookup = buildPageTitleLookup(allPages);
  return getBracketLinkMatchesFromLookup(linkText, lookup);
}

export function getWikiLinkDestinationLabel(page: Page, allChapters: Chapter[], allBooks: Book[]): string {
  if (page.isLoose || !page.chapterId) {
    return `Loose Pages / ${page.title}`;
  }

  const chapter = allChapters.find((candidate) => candidate.id === page.chapterId);
  if (!chapter) {
    return `Loose Pages / ${page.title}`;
  }

  const book = allBooks.find((candidate) => candidate.id === chapter.bookId);
  return book
    ? `${book.title} / ${chapter.title} / ${page.title}`
    : `${chapter.title} / ${page.title}`;
}

export function parseContentIntoSegments(
  text: string,
  titleLookup: PageTitleLookup
): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const sourceText = toSafeString(contentToPlainText(text));
  let cursor = 0;

  for (const match of sourceText.matchAll(BRACKET_LINK_PATTERN)) {
    const raw = match[0];
    const innerText = match[1] ?? '';
    const displayText = innerText.trim();
    const normalizedTargetTitle = normalizePageTitle(displayText);
    const matchIndex = match.index ?? cursor;

    if (matchIndex > cursor) {
      segments.push({
        type: 'text',
        text: sourceText.slice(cursor, matchIndex)
      });
    }

    const matchingPages = getBracketLinkMatchesFromLookup(displayText, titleLookup);
    const targetPage = matchingPages.length === 1 ? matchingPages[0] : null;
    segments.push({
      type: 'link',
      raw,
      displayText: targetPage?.title ?? displayText,
      targetPageId: targetPage?.id ?? null,
      matchingPageIds: matchingPages.map((page) => page.id),
      normalizedTargetTitle,
      resolutionStatus: getResolutionStatus(matchingPages.length)
    });

    cursor = matchIndex + raw.length;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: 'text',
      text: sourceText.slice(cursor)
    });
  }

  if (segments.length === 0) {
    return [
      {
        type: 'text',
        text: sourceText
      }
    ];
  }

  return segments;
}

export const parseContentWithWikiLinks = parseContentIntoSegments;

export function getOutgoingLinks(currentPage: Page, allPages: Page[]): PageConnectionLink[] {
  const titleLookup = buildPageTitleLookup(allPages);
  return getConnectionLinksFromSegments(parseContentIntoSegments(currentPage.content, titleLookup))
    .filter((link) => link.resolutionStatus === 'resolved');
}

export function getBrokenLinks(currentPage: Page, allPages: Page[]): PageConnectionLink[] {
  const titleLookup = buildPageTitleLookup(allPages);
  return getConnectionLinksFromSegments(parseContentIntoSegments(currentPage.content, titleLookup))
    .filter((link) => link.resolutionStatus === 'missing');
}

export function getAmbiguousLinks(currentPage: Page, allPages: Page[]): PageConnectionLink[] {
  const titleLookup = buildPageTitleLookup(allPages);
  return getAmbiguousLinksFromSegments(parseContentIntoSegments(currentPage.content, titleLookup));
}

export function getAmbiguousLinksFromSegments(contentSegments: ContentSegment[]): PageConnectionLink[] {
  return getConnectionLinksFromSegments(contentSegments)
    .filter((link) => link.resolutionStatus === 'ambiguous');
}

export function getBacklinks(currentPage: Page, allPages: Page[]): Page[] {
  const backlinkIndex = buildBacklinkIndex(allPages);
  const pageById = new Map(allPages.map((page) => [page.id, page]));

  return (backlinkIndex[currentPage.id] ?? [])
    .map((pageId) => pageById.get(pageId))
    .filter((page): page is Page => Boolean(page));
}

export function getConnectionLinksFromSegments(contentSegments: ContentSegment[]): PageConnectionLink[] {
  const seen = new Set<string>();
  const links: PageConnectionLink[] = [];

  for (const segment of contentSegments) {
    if (segment.type !== 'link' || segment.displayText.length === 0) {
      continue;
    }

    const key = getConnectionLinkKey(segment);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push({
      key,
      label: segment.displayText,
      targetPageId: segment.targetPageId,
      matchingPageIds: segment.matchingPageIds,
      resolutionStatus: segment.resolutionStatus
    });
  }

  return links;
}

/**
 * Builds a reverse lookup of "which pages reference this page".
 * Backlinks are derived at render time from raw page content rather than stored,
 * which keeps editing simple and avoids synchronization bugs.
 */
export function buildBacklinkIndex(allPages: Page[]): BacklinkIndex {
  const backlinkIndex: BacklinkIndex = Object.create(null);
  const titleLookup = buildPageTitleLookup(allPages);

  for (const sourcePage of allPages) {
    const linkedTargetIds = new Set<string>();

    for (const linkText of extractBracketLinks(sourcePage.content)) {
      const targetPage = resolveUniqueBracketLinkFromLookup(linkText, titleLookup);
      if (targetPage && targetPage.id !== sourcePage.id) {
        linkedTargetIds.add(targetPage.id);
      }
    }

    for (const targetPageId of linkedTargetIds) {
      const backlinks = backlinkIndex[targetPageId] ?? [];
      backlinkIndex[targetPageId] = [...backlinks, sourcePage.id];
    }
  }

  return backlinkIndex;
}

function resolveUniqueBracketLinkFromLookup(
  linkText: string,
  titleLookup: PageTitleLookup
): Page | null {
  const matches = getBracketLinkMatchesFromLookup(linkText, titleLookup);
  return matches.length === 1 ? matches[0] : null;
}

function getBracketLinkMatchesFromLookup(
  linkText: string,
  titleLookup: PageTitleLookup
): Page[] {
  const normalizedTitle = normalizePageTitle(linkText);
  if (!normalizedTitle) {
    return [];
  }

  return titleLookup.get(normalizedTitle) ?? [];
}

function getResolutionStatus(matchCount: number): WikiLinkResolutionStatus {
  if (matchCount === 0) {
    return 'missing';
  }

  return matchCount === 1 ? 'resolved' : 'ambiguous';
}

function getConnectionLinkKey(segment: Extract<ContentSegment, { type: 'link' }>): string {
  if (segment.targetPageId) {
    return segment.targetPageId;
  }

  if (segment.resolutionStatus === 'ambiguous') {
    return `ambiguous:${segment.normalizedTargetTitle}:${segment.matchingPageIds.join('|')}`;
  }

  return `missing:${segment.normalizedTargetTitle}`;
}

function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function flattenText(value: unknown): string {
  return toSafeString(value).trim().replace(WHITESPACE_PATTERN, ' ');
}

function normalizeSuggestionQuery(value: string): string {
  return flattenText(value).toLowerCase();
}

function getSuggestionScore(
  normalizedValue: string,
  normalizedQuery: string
): { score: number; index: number } | null {
  if (!normalizedQuery) {
    return { score: 3, index: 0 };
  }

  if (normalizedValue === normalizedQuery) {
    return { score: 0, index: 0 };
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return { score: 1, index: 0 };
  }

  const containsIndex = normalizedValue.indexOf(normalizedQuery);
  if (containsIndex !== -1) {
    return { score: 2, index: containsIndex };
  }

  return null;
}
