import type { Book, Chapter, ID, LibraryData, Page } from '../types/domain';
import { contentToPlainText, contentToPreviewText } from './richText';
import { isValidTagToken, normalizeTag, normalizeTagList, parseTagQuery } from './tags';
import { isLoosePage } from './pageState';

export type SearchMatchKind = 'title-exact' | 'title-partial' | 'content-exact' | 'content-partial' | 'tag';

export interface BookSearchResult {
  type: 'book';
  id: ID;
  title: string;
  score: number;
  matchKind: Extract<SearchMatchKind, 'title-exact' | 'title-partial'>;
}

export interface ChapterSearchResult {
  type: 'chapter';
  id: ID;
  title: string;
  parentBookId: ID;
  parentBookTitle: string;
  score: number;
  matchKind: Extract<SearchMatchKind, 'title-exact' | 'title-partial'>;
}

export interface PageSearchResult {
  type: 'page';
  id: ID;
  title: string;
  snippet?: string;
  parentBookId?: ID;
  parentBookTitle?: string;
  parentChapterId?: ID;
  parentChapterTitle?: string;
  path: string;
  isLoosePage: boolean;
  score: number;
  matchKind: SearchMatchKind;
}

export interface TrashSearchResult {
  type: 'trash';
  id: ID;
  trashType: 'book' | 'chapter' | 'page' | 'loosePage';
  title: string;
  snippet?: string;
  path: string;
  isLoosePage: boolean;
  score: number;
  matchKind: SearchMatchKind;
}

export type SearchResult = BookSearchResult | ChapterSearchResult | PageSearchResult | TrashSearchResult;

interface SearchIndexedBookRecord {
  book: Book;
  title: string;
  normalizedTitle: string;
}

interface SearchIndexedChapterRecord {
  chapter: Chapter;
  title: string;
  normalizedTitle: string;
  parentBookId: ID;
  parentBookTitle: string;
}

interface SearchIndexedPageRecord {
  page: Page;
  title: string;
  content: string;
  normalizedTitle: string;
  normalizedContent: string;
  normalizedTags: Set<string>;
  path: string;
  parentBookId?: ID;
  parentBookTitle?: string;
  parentChapterId?: ID;
  parentChapterTitle?: string;
  isLoosePage: boolean;
}

export interface SearchIndex {
  books: SearchIndexedBookRecord[];
  chapters: SearchIndexedChapterRecord[];
  pages: SearchIndexedPageRecord[];
  trashBooks: SearchIndexedBookRecord[];
  trashChapters: SearchIndexedChapterRecord[];
  trashPages: SearchIndexedPageRecord[];
}

export type SearchMode =
  | { type: 'emptyTag' }
  | { type: 'tag'; tags: string[] }
  | { type: 'mixed'; query: string; tags: string[] }
  | { type: 'text'; query: string };

export const SEARCH_RESULT_LIMIT = 200;

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

  const mixedParts = parseMixedSearchInput(trimmed);
  if (mixedParts.tags.length > 0 && mixedParts.query.length > 0) {
    return { type: 'mixed', query: mixedParts.query, tags: mixedParts.tags };
  }

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

function parseMixedSearchInput(raw: string): { query: string; tags: string[] } {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const textTokens: string[] = [];
  const tagTokens: string[] = [];

  for (const token of tokens) {
    if (isValidTagToken(token)) {
      tagTokens.push(token.slice(1));
    } else {
      textTokens.push(token);
    }
  }

  return {
    query: textTokens.join(' '),
    tags: normalizeTagList(tagTokens)
  };
}

export function normalizeSearchText(input: string): string {
  return flattenText(input).toLowerCase();
}

export function tokenizeSearchText(input: string): string[] {
  return normalizeSearchText(input).split(' ').filter(Boolean);
}

/**
 * Precomputes searchable records for books, chapters, and pages.
 * The index is only built when the user is searching so regular editing flows
 * do not pay for search-specific normalization on every render.
 */
export function buildSearchIndex(data: LibraryData): SearchIndex {
  const liveBooks: Book[] = [];
  const liveChapters: Chapter[] = [];
  const livePages: Page[] = [];
  const trashBooks: Book[] = [];
  const trashChapters: Chapter[] = [];
  const trashPages: Page[] = [];
  const bookMap = new Map<ID, Book>();
  const chapterMap = new Map<ID, Chapter>();
  const allBookMap = new Map<ID, Book>();
  const allChapterMap = new Map<ID, Chapter>();

  for (const book of data.books) {
    allBookMap.set(book.id, book);
    if (book.deletedAt) {
      trashBooks.push(book);
    } else {
      liveBooks.push(book);
      bookMap.set(book.id, book);
    }
  }

  for (const chapter of data.chapters) {
    allChapterMap.set(chapter.id, chapter);
    if (chapter.deletedAt) {
      trashChapters.push(chapter);
    } else {
      liveChapters.push(chapter);
      chapterMap.set(chapter.id, chapter);
    }
  }

  for (const page of data.pages) {
    if (page.deletedAt) {
      trashPages.push(page);
    } else {
      livePages.push(page);
    }
  }

  return {
    books: liveBooks.map(indexBook),
    chapters: liveChapters.map((chapter) => indexChapter(chapter, bookMap)),
    pages: livePages.map((page) => indexPage(page, chapterMap, bookMap)),
    trashBooks: trashBooks.map(indexBook),
    trashChapters: trashChapters.map((chapter) => indexChapter(chapter, allBookMap)),
    trashPages: trashPages.map((page) => indexPage(page, allChapterMap, allBookMap, true))
  };
}

export function searchLibraryEntities(query: string, index: SearchIndex): SearchResult[] {
  const mode = parseSearchInput(query);

  if (mode.type === 'emptyTag') {
    return [];
  }

  if (mode.type === 'tag') {
    // Tag-only search is an intersection filter over page tags, not a full-text
    // search for slash-prefixed words in note content.
    return index.pages
      .filter((record) => pageHasAllTags(record, mode.tags))
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, SEARCH_RESULT_LIMIT)
      .map<PageSearchResult>(pageRecordToTagResult);
  }

  const normalizedQuery = normalizeSearchText(mode.query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = tokenizeSearchText(mode.query);
  const results: SearchResult[] = [];

  if (mode.type === 'text') {
    // In plain text mode, books and chapters can rank beside pages. Mixed
    // text+tag mode intentionally limits results to pages because only pages
    // carry tags.
    for (const book of index.books) {
      const score = scoreTitleMatch(book.normalizedTitle, normalizedQuery, tokens);
      if (!score) {
        continue;
      }

      results.push({
        type: 'book',
        id: book.book.id,
        title: book.book.title,
        score: score.value,
        matchKind: score.matchKind
      });
    }

    for (const chapter of index.chapters) {
      const score = scoreTitleMatch(chapter.normalizedTitle, normalizedQuery, tokens);
      if (!score) {
        continue;
      }

      results.push({
        type: 'chapter',
        id: chapter.chapter.id,
        title: chapter.chapter.title,
        parentBookId: chapter.parentBookId,
        parentBookTitle: chapter.parentBookTitle,
        score: score.value,
        matchKind: score.matchKind
      });
    }
  }

  for (const page of index.pages) {
    if (mode.type === 'mixed' && !pageHasAllTags(page, mode.tags)) {
      continue;
    }

    const result = scorePageMatch(page, normalizedQuery, tokens);
    if (result) {
      results.push(result);
    }
  }

  return results.sort(compareSearchResults).slice(0, SEARCH_RESULT_LIMIT);
}

export function searchPages(query: string, index: SearchIndex): SearchResult[] {
  return searchLibraryEntities(query, index);
}

export function searchTrashedEntities(query: string, index: SearchIndex): SearchResult[] {
  const mode = parseSearchInput(query);

  if (mode.type === 'emptyTag') {
    return [];
  }

  if (mode.type === 'tag') {
    return index.trashPages
      .filter((record) => pageHasAllTags(record, mode.tags))
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((record) => pageRecordToTrashResult(record, 1, 'tag', buildPreviewSnippetFromRecord(record)))
  }

  const normalizedQuery = normalizeSearchText(mode.query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = tokenizeSearchText(mode.query);
  const results: SearchResult[] = [];

  if (mode.type === 'text') {
    for (const book of index.trashBooks) {
      const score = scoreTitleMatch(book.normalizedTitle, normalizedQuery, tokens);
      if (!score) {
        continue;
      }

      results.push({
        type: 'trash',
        id: book.book.id,
        trashType: 'book',
        title: book.book.title,
        path: 'Trash / Book',
        isLoosePage: false,
        score: score.value,
        matchKind: score.matchKind
      });
    }

    for (const chapter of index.trashChapters) {
      const score = scoreTitleMatch(chapter.normalizedTitle, normalizedQuery, tokens);
      if (!score) {
        continue;
      }

      results.push({
        type: 'trash',
        id: chapter.chapter.id,
        trashType: 'chapter',
        title: chapter.chapter.title,
        path: `Trash / ${chapter.parentBookTitle}`,
        isLoosePage: false,
        score: score.value,
        matchKind: score.matchKind
      });
    }
  }

  for (const page of index.trashPages) {
    if (mode.type === 'mixed' && !pageHasAllTags(page, mode.tags)) {
      continue;
    }

    const result = scorePageMatch(page, normalizedQuery, tokens);
    if (result) {
      results.push(pageRecordToTrashResult(page, result.score, result.matchKind, result.snippet));
    }
  }

  return results.sort(compareSearchResults).slice(0, SEARCH_RESULT_LIMIT);
}

export function getHighlightedParts(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
  const displayText = text || 'Untitled';
  const mode = parseSearchInput(query);

  if (mode.type !== 'text' && mode.type !== 'mixed') {
    return [{ text: displayText, isMatch: false }];
  }

  const normalizedQuery = normalizeSearchText(mode.query);
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

function pageHasAllTags(record: Pick<SearchIndexedPageRecord, 'normalizedTags'>, tags: string[]): boolean {
  return tags.every((tag) => record.normalizedTags.has(tag));
}

export function getSearchResultBadgeLabel(result: SearchResult): string {
  if (result.type === 'trash') {
    if (result.trashType === 'loosePage') {
      return 'Trash / Loose Page';
    }

    return `Trash / ${capitalizeSearchLabel(result.trashType)}`;
  }

  if (result.type === 'book') {
    return 'Book';
  }

  if (result.type === 'chapter') {
    return 'Chapter';
  }

  return 'Page';
}

export function getSearchResultPath(result: SearchResult): string | undefined {
  if (result.type === 'book') {
    return undefined;
  }

  if (result.type === 'trash') {
    return result.path;
  }

  if (result.type === 'chapter') {
    return `${result.parentBookTitle} / ${result.title}`;
  }

  return result.path;
}

function scorePageMatch(
  record: SearchIndexedPageRecord,
  normalizedQuery: string,
  tokens: string[]
): PageSearchResult | null {
  const titleMatch = scoreTitleMatch(record.normalizedTitle, normalizedQuery, tokens);

  if (titleMatch) {
    return {
      type: 'page',
      id: record.page.id,
      title: record.page.title,
      snippet: buildSnippetFromRecord(record, normalizedQuery, tokens),
      parentBookId: record.parentBookId,
      parentBookTitle: record.parentBookTitle,
      parentChapterId: record.parentChapterId,
      parentChapterTitle: record.parentChapterTitle,
      path: record.path,
      isLoosePage: record.isLoosePage,
      score: titleMatch.value,
      matchKind: titleMatch.matchKind
    };
  }

  const exactContentIndex = record.normalizedContent.indexOf(normalizedQuery);
  if (exactContentIndex !== -1) {
    return {
      type: 'page',
      id: record.page.id,
      title: record.page.title,
      snippet: buildSnippetFromRecord(record, normalizedQuery, tokens),
      parentBookId: record.parentBookId,
      parentBookTitle: record.parentBookTitle,
      parentChapterId: record.parentChapterId,
      parentChapterTitle: record.parentChapterTitle,
      path: record.path,
      isLoosePage: record.isLoosePage,
      score: 3000 - exactContentIndex,
      matchKind: 'content-exact'
    };
  }

  const tokenHits = tokens.reduce((count, token) => {
    return record.normalizedContent.includes(token) ? count + 1 : count;
  }, 0);

  if (tokenHits === 0) {
    return null;
  }

  return {
    type: 'page',
    id: record.page.id,
    title: record.page.title,
    snippet: buildSnippetFromRecord(record, normalizedQuery, tokens),
    parentBookId: record.parentBookId,
    parentBookTitle: record.parentBookTitle,
    parentChapterId: record.parentChapterId,
    parentChapterTitle: record.parentChapterTitle,
    path: record.path,
    isLoosePage: record.isLoosePage,
    score: 2000 + tokenHits,
    matchKind: 'content-partial'
  };
}

function indexBook(book: Book): SearchIndexedBookRecord {
  const title = flattenText(book.title);

  return {
    book,
    title,
    normalizedTitle: normalizeSearchText(title)
  };
}

function indexChapter(chapter: Chapter, bookMap: Map<ID, Book>): SearchIndexedChapterRecord {
  const title = flattenText(chapter.title);
  const parentBook = bookMap.get(chapter.deletedFrom?.bookId ?? chapter.bookId);

  return {
    chapter,
    title,
    normalizedTitle: normalizeSearchText(title),
    parentBookId: chapter.deletedFrom?.bookId ?? chapter.bookId,
    parentBookTitle: parentBook?.title ?? 'Book'
  };
}

function indexPage(
  page: Page,
  chapterMap: Map<ID, Chapter>,
  bookMap: Map<ID, Book>,
  useDeletedFrom = false
): SearchIndexedPageRecord {
  const title = flattenText(page.title);
  const content = flattenText(contentToPlainText(page.content));
  const sourceChapterId = useDeletedFrom ? page.deletedFrom?.chapterId ?? page.chapterId : page.chapterId;
  const chapter = sourceChapterId ? chapterMap.get(sourceChapterId) : undefined;
  const sourceBookId = useDeletedFrom ? page.deletedFrom?.bookId ?? chapter?.bookId : chapter?.bookId;
  const book = sourceBookId ? bookMap.get(sourceBookId) : undefined;
  const loosePage = useDeletedFrom ? page.deletedFrom?.wasLoose ?? isLoosePage(page) : isLoosePage(page) || !chapter;

  return {
    page,
    title,
    content,
    normalizedTitle: normalizeSearchText(title),
    normalizedContent: normalizeSearchText(content),
    normalizedTags: new Set(normalizeTagList(page.tags)),
    path: loosePage ? 'Loose Pages' : `${book?.title ?? 'Book'} / ${chapter?.title ?? 'Chapter'}`,
    parentBookId: book?.id,
    parentBookTitle: book?.title,
    parentChapterId: chapter?.id,
    parentChapterTitle: chapter?.title,
    isLoosePage: loosePage
  };
}

function pageRecordToTagResult(record: SearchIndexedPageRecord): PageSearchResult {
  return {
    type: 'page',
    id: record.page.id,
    title: record.page.title,
    snippet: buildPreviewSnippetFromRecord(record),
    parentBookId: record.parentBookId,
    parentBookTitle: record.parentBookTitle,
    parentChapterId: record.parentChapterId,
    parentChapterTitle: record.parentChapterTitle,
    path: record.path,
    isLoosePage: record.isLoosePage,
    score: 1,
    matchKind: 'tag'
  };
}

function pageRecordToTrashResult(
  record: SearchIndexedPageRecord,
  score: number,
  matchKind: SearchMatchKind,
  snippet = ''
): TrashSearchResult {
  return {
    type: 'trash',
    id: record.page.id,
    trashType: record.isLoosePage ? 'loosePage' : 'page',
    title: record.page.title,
    snippet,
    path: `Trash / ${record.path}`,
    isLoosePage: record.isLoosePage,
    score,
    matchKind
  };
}

function capitalizeSearchLabel(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function scoreTitleMatch(
  normalizedTitle: string,
  normalizedQuery: string,
  tokens: string[]
): { value: number; matchKind: Extract<SearchMatchKind, 'title-exact' | 'title-partial'> } | null {
  if (!normalizedTitle) {
    return null;
  }

  if (normalizedTitle === normalizedQuery) {
    // Ranking favors navigation targets with exact titles, then title phrases,
    // then content hits. Stable tie-breakers are handled after scoring.
    return { value: 5000, matchKind: 'title-exact' };
  }

  const phraseIndex = normalizedTitle.indexOf(normalizedQuery);
  if (phraseIndex !== -1) {
    return { value: 4000 - phraseIndex, matchKind: 'title-partial' };
  }

  const tokenHits = tokens.reduce((count, token) => {
    return normalizedTitle.includes(token) ? count + 1 : count;
  }, 0);

  if (tokens.length > 0 && tokenHits === tokens.length) {
    return { value: 3900 + tokenHits, matchKind: 'title-partial' };
  }

  return null;
}

function compareSearchResults(left: SearchResult, right: SearchResult): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const typeOrder = getSearchResultTypeOrder(left.type) - getSearchResultTypeOrder(right.type);
  if (typeOrder !== 0) {
    return typeOrder;
  }

  const titleOrder = left.title.localeCompare(right.title);
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return left.id.localeCompare(right.id);
}

function getSearchResultTypeOrder(type: SearchResult['type']): number {
  if (type === 'book') {
    return 0;
  }

  if (type === 'chapter') {
    return 1;
  }

  if (type === 'trash') {
    return 3;
  }

  return 2;
}

function buildSnippetFromRecord(
  record: Pick<SearchIndexedPageRecord, 'content' | 'normalizedContent' | 'normalizedTitle'>,
  normalizedQuery: string,
  tokens: string[]
): string {
  if (!record.content) {
    return 'No content yet.';
  }

  const exactIndex = record.normalizedContent.indexOf(normalizedQuery);

  if (exactIndex !== -1) {
    return clipSnippet(record.content, exactIndex, normalizedQuery.length);
  }

  for (const token of tokens) {
    const index = record.normalizedContent.indexOf(token);
    if (index !== -1) {
      return clipSnippet(record.content, index, token.length);
    }
  }

  if (record.normalizedTitle.includes(normalizedQuery)) {
    return clipSnippet(record.content, 0, 0);
  }

  return clipSnippet(record.content, 0, 0);
}

function buildPreviewSnippetFromRecord(record: Pick<SearchIndexedPageRecord, 'page' | 'content'>): string {
  if (!record.content) {
    return 'No content yet.';
  }

  return contentToPreviewText(record.page.content, { maxLength: 160, emptyText: 'No content yet.' });
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
