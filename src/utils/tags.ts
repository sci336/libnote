import type { Book, Chapter, Page } from '../types/domain';
import { isLoosePage } from './pageState';

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return tag.length > 0;
}

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
  const flattened = content.replace(/\s+/g, ' ').trim();
  if (!flattened) {
    return '';
  }

  return flattened.length > 140 ? `${flattened.slice(0, 140).trim()}...` : flattened;
}
