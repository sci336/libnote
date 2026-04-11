import type { ID, LibraryData, Page } from '../types/domain';
import { normalizeTag, parseTagQuery } from './tags';

export interface SearchResult {
  page: Page;
  path: string;
  snippet: string;
  matchLabel: string;
  score: number;
}

export interface SearchIndexedPageRecord {
  pageId: ID;
  page: Page;
  title: string;
  content: string;
  normalizedTitle: string;
  normalizedContent: string;
  normalizedCombined: string;
  titleTokens: string[];
  contentTokens: string[];
  combinedTokens: string[];
  tokenSet: Set<string>;
  isLoose: boolean;
  bookId?: ID;
  chapterId?: ID;
  bookTitle?: string;
  chapterTitle?: string;
  path: string;
}

export interface SearchIndex {
  pagesById: Map<ID, SearchIndexedPageRecord>;
  tokenToPageIds: Map<string, Set<ID>>;
}

export type SearchMode =
  | { type: 'emptyTag' }
  | { type: 'tag'; tags: string[] }
  | { type: 'text'; query: string };

/**
 * Keeps search-bar state and search matching aligned on the same normalized text
 * representation so switching between views does not produce mismatched results.
 */
export function normalizeSearchQuery(query: string): string {
  return normalizeSearchText(query);
}

/**
 * Splits top-bar input into text search vs slash-tag search.
 * The dedicated `emptyTag` mode lets the UI teach the `/tag` syntax without
 * pretending the user is running a normal text search for "/".
 */
export function parseSearchInput(raw: string): SearchMode {
  const trimmed = raw.trim();

  if (trimmed.startsWith('/')) {
    const parsedTags = parseTagQuery(trimmed);

    if (parsedTags && parsedTags.length > 0) {
      return { type: 'tag', tags: parsedTags };
    }

    if (normalizeTag(trimmed.slice(1)).length === 0) {
      return { type: 'emptyTag' };
    }
  }

  return { type: 'text', query: trimmed };
}

export function normalizeSearchText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function tokenizeSearchText(input: string): string[] {
  return normalizeSearchText(input).split(' ').filter(Boolean);
}

/**
 * Precomputes searchable page records and a token lookup table.
 * The index is only built when the user is searching so regular editing flows
 * do not pay for search-specific normalization on every render.
 */
export function buildSearchIndex(data: LibraryData): SearchIndex {
  const pagesById = new Map<ID, SearchIndexedPageRecord>();
  const tokenToPageIds = new Map<string, Set<ID>>();
  const chapterMap = new Map(data.chapters.map((chapter) => [chapter.id, chapter] as const));
  const bookMap = new Map(data.books.map((book) => [book.id, book] as const));

  for (const page of data.pages) {
    const title = flattenText(page.title);
    const content = flattenText(page.content);
    const normalizedTitle = normalizeSearchText(title);
    const normalizedContent = normalizeSearchText(content);
    const normalizedCombined = normalizeSearchText(`${title} ${content}`);
    const titleTokens = tokenizeSearchText(title);
    const contentTokens = tokenizeSearchText(content);
    const combinedTokens = Array.from(new Set([...titleTokens, ...contentTokens]));
    const tokenSet = new Set(combinedTokens);
    const chapter = page.chapterId ? chapterMap.get(page.chapterId) : undefined;
    const book = chapter ? bookMap.get(chapter.bookId) : undefined;

    const record: SearchIndexedPageRecord = {
      pageId: page.id,
      page,
      title,
      content,
      normalizedTitle,
      normalizedContent,
      normalizedCombined,
      titleTokens,
      contentTokens,
      combinedTokens,
      tokenSet,
      isLoose: page.isLoose,
      bookId: book?.id,
      chapterId: chapter?.id,
      bookTitle: book?.title,
      chapterTitle: chapter?.title,
      path: page.isLoose || !chapter ? 'Loose Pages' : `${book?.title ?? 'Book'} / ${chapter.title}`
    };

    pagesById.set(page.id, record);

    for (const token of tokenSet) {
      const pageIds = tokenToPageIds.get(token) ?? new Set<ID>();
      pageIds.add(page.id);
      tokenToPageIds.set(token, pageIds);
    }
  }

  return { pagesById, tokenToPageIds };
}

export function searchPages(query: string, index: SearchIndex): SearchResult[] {
  const mode = parseSearchInput(query);

  if (mode.type === 'emptyTag') {
    return [];
  }

  if (mode.type === 'tag') {
    return [...index.pagesById.values()]
      .filter((record) => mode.tags.every((tag) => record.page.tags.includes(tag)))
      .map((record) => ({
        page: record.page,
        path: record.path,
        snippet: '',
        matchLabel: 'Tag match',
        score: 1
      }))
      .sort((left, right) => left.page.title.localeCompare(right.page.title));
  }

  const normalizedQuery = normalizeSearchText(mode.query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = tokenizeSearchText(mode.query);
  // Start with token hits when possible, but fall back to scanning every page so
  // exact substring matches still work for punctuation-heavy fragments.
  const candidatePageIds = getCandidatePageIds(tokens, index);
  const candidateRecords =
    candidatePageIds.size > 0
      ? [...candidatePageIds]
          .map((pageId) => index.pagesById.get(pageId))
          .filter((record): record is SearchIndexedPageRecord => !!record)
      : [...index.pagesById.values()];

  return candidateRecords
    .map((record) => scoreIndexedPage(record, normalizedQuery, tokens))
    .filter((result): result is SearchResult => result !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return right.page.updatedAt.localeCompare(left.page.updatedAt);
    });
}

export function getHighlightedParts(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
  const displayText = text || 'Untitled Page';
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [{ text: displayText, isMatch: false }];
  }

  const flattened = flattenText(displayText);
  const lower = flattened.toLowerCase();
  const phraseIndex = lower.indexOf(normalizedQuery);

  if (phraseIndex !== -1) {
    return splitByRange(flattened, phraseIndex, phraseIndex + normalizedQuery.length);
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const ranges: Array<{ start: number; end: number }> = [];

  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1) {
      ranges.push({ start: index, end: index + token.length });
    }
  }

  if (ranges.length === 0) {
    return [{ text: flattened, isMatch: false }];
  }

  return splitByRanges(flattened, ranges);
}

function buildSnippet(page: Page, normalizedQuery: string, tokens: string[]): string {
  return buildSnippetFromRecord(
    {
      content: flattenText(page.content),
      normalizedContent: normalizeSearchText(page.content),
      normalizedTitle: normalizeSearchText(page.title)
    },
    normalizedQuery,
    tokens
  );
}

function buildSnippetFromRecord(
  record: Pick<SearchIndexedPageRecord, 'content' | 'normalizedContent' | 'normalizedTitle'>,
  normalizedQuery: string,
  tokens: string[]
): string {
  const flattenedContent = record.content;
  if (!flattenedContent) {
    return 'No content yet.';
  }

  const exactIndex = record.normalizedContent.indexOf(normalizedQuery);

  if (exactIndex !== -1) {
    return clipSnippet(flattenedContent, exactIndex, normalizedQuery.length);
  }

  for (const token of tokens) {
    const index = record.normalizedContent.indexOf(token);
    if (index !== -1) {
      return clipSnippet(flattenedContent, index, token.length);
    }
  }

  // Title-only matches still show a content preview so results remain useful
  // even when the matching words never appear in the body text.
  if (record.normalizedTitle.includes(normalizedQuery)) {
    return clipSnippet(flattenedContent, 0, 0);
  }

  return clipSnippet(flattenedContent, 0, 0);
}

function clipSnippet(text: string, matchStart: number, matchLength: number): string {
  const maxLength = 160;
  const contextBefore = 48;
  const contextAfter = 88;

  let start = Math.max(0, matchStart - contextBefore);
  let end = Math.min(text.length, matchStart + matchLength + contextAfter);

  if (end - start < maxLength && end < text.length) {
    end = Math.min(text.length, start + maxLength);
  }

  if (end - start < maxLength && start > 0) {
    start = Math.max(0, end - maxLength);
  }

  let snippet = text.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < text.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}

function flattenText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getCandidatePageIds(tokens: string[], index: SearchIndex): Set<ID> {
  const candidates = new Set<ID>();

  for (const token of tokens) {
    const pageIds = index.tokenToPageIds.get(token);
    if (!pageIds) {
      continue;
    }

    for (const pageId of pageIds) {
      candidates.add(pageId);
    }
  }

  return candidates;
}

function scoreIndexedPage(
  record: SearchIndexedPageRecord,
  normalizedQuery: string,
  tokens: string[]
): SearchResult | null {
  const titlePhraseIndex = record.normalizedTitle.indexOf(normalizedQuery);
  const contentPhraseIndex = record.normalizedContent.indexOf(normalizedQuery);
  const allWordsInTitle = tokens.length > 0 && tokens.every((token) => record.normalizedTitle.includes(token));
  const allWordsInContent = tokens.length > 0 && tokens.every((token) => record.normalizedContent.includes(token));
  const tokenHits = tokens.reduce((count, token) => {
    return record.tokenSet.has(token) ? count + 1 : count;
  }, 0);

  let score = 0;
  let matchLabel = '';

  if (titlePhraseIndex !== -1) {
    score = 5000 - titlePhraseIndex;
    matchLabel = 'Exact phrase in title';
  } else if (contentPhraseIndex !== -1) {
    score = 4000 - contentPhraseIndex;
    matchLabel = 'Exact phrase in content';
  } else if (allWordsInTitle) {
    score = 3000 + tokenHits;
    matchLabel = 'All words in title';
  } else if (allWordsInContent) {
    score = 2000 + tokenHits;
    matchLabel = 'All words in content';
  } else if (tokenHits > 0) {
    score = 1000 + tokenHits;
    matchLabel = 'Partial match';
  } else {
    return null;
  }

  return {
    page: record.page,
    path: record.path,
    snippet: buildSnippetFromRecord(record, normalizedQuery, tokens),
    matchLabel,
    score
  };
}

function splitByRange(text: string, start: number, end: number): Array<{ text: string; isMatch: boolean }> {
  return splitByRanges(text, [{ start, end }]);
}

function splitByRanges(
  text: string,
  ranges: Array<{ start: number; end: number }>
): Array<{ text: string; isMatch: boolean }> {
  const mergedRanges = [...ranges]
    .sort((left, right) => left.start - right.start)
    .reduce<Array<{ start: number; end: number }>>((result, range) => {
      const previous = result[result.length - 1];
      if (!previous || range.start > previous.end) {
        result.push({ ...range });
      } else {
        previous.end = Math.max(previous.end, range.end);
      }
      return result;
    }, []);

  const parts: Array<{ text: string; isMatch: boolean }> = [];
  let cursor = 0;

  for (const range of mergedRanges) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), isMatch: false });
    }
    parts.push({ text: text.slice(range.start, range.end), isMatch: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), isMatch: false });
  }

  return parts.filter((part) => part.text.length > 0);
}
