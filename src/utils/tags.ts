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
