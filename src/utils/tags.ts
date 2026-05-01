import type { Book, Chapter, Page } from '../types/domain';
import { isLoosePage } from './pageState';

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return tag.length > 0;
}

export function isValidTagToken(token: string): boolean {
  return /^\/[^\s/#,]+$/.test(token);
}

export function isValidTagValue(tag: string): boolean {
  return /^[^\s/#,]+$/.test(tag);
}

/**
 * Normalizes user-entered tags into the canonical stored form.
 * This keeps typed input, clicked tags, persisted tags, and multi-tag filters
 * aligned on the same lowercase deduplicated representation.
 */
export function normalizeTagList(tags: string[]): string[] {
  const normalizedTags: string[] = [];

  for (const rawTag of tags) {
    const normalizedTag = normalizeTag(rawTag);
    if (!isValidTag(normalizedTag) || normalizedTags.includes(normalizedTag)) {
      continue;
    }

    normalizedTags.push(normalizedTag);
  }

  return normalizedTags;
}

/**
 * Accepts a single tag from lightweight UI inputs and keeps it aligned with the
 * slash-search format while still being forgiving about leading "/" or "#".
 */
export function parseSingleTagInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedTag = normalizeTag(trimmed.replace(/^[/#]+/, ''));
  if (!isValidTag(normalizedTag) || !isValidTagValue(normalizedTag)) {
    return null;
  }

  return normalizedTag;
}

export interface TagTokenMatch {
  token: string;
  normalizedQuery: string;
  start: number;
  end: number;
}

export interface SlashTagTriggerMatch {
  query: string;
  start: number;
  end: number;
}

export function getActiveSlashTagToken(raw: string, caret: number): TagTokenMatch | null {
  const safeCaret = Math.max(0, Math.min(caret, raw.length));
  let start = safeCaret;
  let end = safeCaret;

  while (start > 0 && !/\s/.test(raw[start - 1])) {
    start -= 1;
  }

  while (end < raw.length && !/\s/.test(raw[end])) {
    end += 1;
  }

  const token = raw.slice(start, end);
  if (!token.startsWith('/')) {
    return null;
  }

  return {
    token,
    normalizedQuery: normalizeTag(token.slice(1)),
    start,
    end
  };
}

export function detectActiveSlashTagTrigger(raw: string, cursorPosition: number): SlashTagTriggerMatch | null {
  const match = getActiveSlashTagToken(raw, cursorPosition);
  if (!match || match.token.includes('#') || match.token.includes(',')) {
    return null;
  }

  return {
    query: match.normalizedQuery,
    start: match.start,
    end: cursorPosition
  };
}

export function getAllTagSuggestions(
  pages: Page[],
  query: string,
  options?: { excludeTags?: string[]; limit?: number }
): string[] {
  return getTagSuggestions(getAllTags(pages), query, options);
}

export function getTagSuggestions(
  allTags: string[],
  rawQuery: string,
  options?: { excludeTags?: string[]; limit?: number }
): string[] {
  const query = normalizeTag(rawQuery);
  const excluded = new Set(normalizeTagList(options?.excludeTags ?? []));
  const limit = options?.limit ?? 6;

  const ranked = allTags
    .filter((tag) => !excluded.has(tag))
    .map((tag) => {
      if (!query) {
        return { tag, score: 3, index: 0 };
      }

      if (tag === query) {
        return { tag, score: 0, index: 0 };
      }

      if (tag.startsWith(query)) {
        return { tag, score: 1, index: 0 };
      }

      const containsIndex = tag.indexOf(query);
      if (containsIndex !== -1) {
        return { tag, score: 2, index: containsIndex };
      }

      return null;
    })
    .filter((entry): entry is { tag: string; score: number; index: number } => entry !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.tag.localeCompare(right.tag);
    });

  return ranked.slice(0, limit).map((entry) => entry.tag);
}

export function replaceSlashTagToken(raw: string, caret: number, tag: string): string {
  const match = getActiveSlashTagToken(raw, caret);
  const replacement = `/${normalizeTag(tag)}`;

  if (!match) {
    return raw;
  }

  return `${raw.slice(0, match.start)}${replacement}${raw.slice(match.end)}`;
}

/**
 * Parses slash-prefixed search input into tag filters.
 * Returning `null` instead of an empty array lets callers distinguish "not a tag
 * query" from "tag mode with no usable tags yet".
 */
export function parseTagQuery(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  if (!tokens.every(isValidTagToken)) {
    return null;
  }

  return normalizeTagList(tokens.map((token) => token.slice(1)));
}

export function isTagOnlyQuery(raw: string): boolean {
  const parsedTags = parseTagQuery(raw);
  return Array.isArray(parsedTags) && parsedTags.length > 0;
}

export function formatTagQuery(tags: string[]): string {
  return normalizeTagList(tags)
    .map((tag) => `/${tag}`)
    .join(' ');
}

export function getAllTags(pages: Page[]): string[] {
  return [...new Set(pages.flatMap((page) => normalizeTagList(page.tags)))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export interface TagSummary {
  tag: string;
  pageCount: number;
}

export function getTagSummaries(pages: Page[]): TagSummary[] {
  const counts = new Map<string, number>();

  for (const page of pages) {
    for (const tag of normalizeTagList(page.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, pageCount]) => ({ tag, pageCount }))
    .sort((left, right) => left.tag.localeCompare(right.tag));
}

export interface TagResult {
  pageId: string;
  pageTitle: string;
  path: string;
  snippet: string;
  tags: string[];
  isLoose: boolean;
  bookId?: string;
  bookTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
}

export function getTagResults(
  pages: Page[],
  chapters: Chapter[],
  books: Book[],
  rawTags: string[]
): TagResult[] {
  const tags = normalizeTagList(rawTags);
  if (tags.length === 0) {
    return [];
  }

  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter] as const));
  const bookById = new Map(books.map((book) => [book.id, book] as const));

  return pages
    // Tag view is an intersection filter: every active tag must be present.
    .filter((page) => tags.every((tag) => page.tags.includes(tag)))
    .map((page) => {
      const chapter = page.chapterId ? chapterById.get(page.chapterId) : undefined;
      const book = chapter ? bookById.get(chapter.bookId) : undefined;
      const loose = isLoosePage(page) || !chapter;

      return {
        pageId: page.id,
        pageTitle: page.title || 'Untitled Page',
        path: loose ? 'Loose Pages' : book ? `${book.title} / ${chapter.title}` : chapter.title,
        snippet: buildTagSnippet(page.content),
        tags: page.tags,
        isLoose: loose,
        bookId: book?.id,
        bookTitle: book?.title,
        chapterId: chapter?.id,
        chapterTitle: chapter?.title
      };
    })
    .sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
}

function buildTagSnippet(content: string): string {
  // Flatten aggressively so snippets from multi-line notes remain scannable in
  // the compact tag result cards.
  const flattened = content.replace(/\s+/g, ' ').trim();
  if (!flattened) {
    return '';
  }

  return flattened.length > 140 ? `${flattened.slice(0, 140).trim()}...` : flattened;
}
