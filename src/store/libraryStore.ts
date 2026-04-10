import { loadLibraryData, saveLibraryData } from '../db/indexedDb';
import type { Book, Chapter, ID, LibraryData, Page } from '../types/domain';
import { nowIso } from '../utils/date';
import { createId } from '../utils/ids';
import { isChapterPage, isLoosePage } from '../utils/pageState';
import { isValidTag, normalizeTag } from '../utils/tags';

export const DEFAULT_TEXT_SIZE = 16;

export const emptyLibraryData: LibraryData = {
  books: [],
  chapters: [],
  pages: []
};

export async function hydrateLibraryData(): Promise<LibraryData> {
  const data = await loadLibraryData();
  return normalizeLibraryData(data ?? emptyLibraryData);
}

export async function persistLibraryData(data: LibraryData): Promise<void> {
  await saveLibraryData(data);
}

export function getBook(data: LibraryData, bookId: ID): Book | undefined {
  return data.books.find((book) => book.id === bookId);
}

export function getChapter(data: LibraryData, chapterId: ID): Chapter | undefined {
  return data.chapters.find((chapter) => chapter.id === chapterId);
}

export function getPage(data: LibraryData, pageId: ID): Page | undefined {
  return data.pages.find((page) => page.id === pageId);
}

export function getChaptersForBook(data: LibraryData, bookId: ID): Chapter[] {
  return [...data.chapters]
    .filter((chapter) => chapter.bookId === bookId)
    .sort(compareBySortOrder);
}

export function getPagesForChapter(data: LibraryData, chapterId: ID): Page[] {
  return [...data.pages]
    .filter((page) => page.chapterId === chapterId && isChapterPage(page))
    .sort(compareBySortOrder);
}

export function getLoosePages(data: LibraryData): Page[] {
  return [...data.pages]
    .filter((page) => isLoosePage(page))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createBook(data: LibraryData): { data: LibraryData; book: Book } {
  const timestamp = nowIso();
  const book: Book = {
    id: createId('book'),
    title: 'Untitled Book',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    data: {
      ...data,
      books: [book, ...data.books]
    },
    book
  };
}

export function updateBook(data: LibraryData, bookId: ID, title: string): LibraryData {
  const timestamp = nowIso();

  return {
    ...data,
    books: data.books.map((book) =>
      book.id === bookId ? { ...book, title: normalizeTitle(title, 'Untitled Book'), updatedAt: timestamp } : book
    )
  };
}

export function deleteBook(data: LibraryData, bookId: ID): LibraryData {
  const chapterIds = new Set(
    data.chapters.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id)
  );

  return {
    books: data.books.filter((book) => book.id !== bookId),
    chapters: data.chapters.filter((chapter) => chapter.bookId !== bookId),
    pages: data.pages.filter((page) => !page.chapterId || !chapterIds.has(page.chapterId))
  };
}

export function createChapter(data: LibraryData, bookId: ID): { data: LibraryData; chapter: Chapter } {
  const timestamp = nowIso();
  const chapter: Chapter = {
    id: createId('chapter'),
    bookId,
    title: 'Untitled Chapter',
    sortOrder: getNextChapterSortOrder(data, bookId),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    data: {
      ...data,
      chapters: [chapter, ...data.chapters],
      books: touchBook(data.books, bookId, timestamp)
    },
    chapter
  };
}

export function updateChapter(data: LibraryData, chapterId: ID, title: string): LibraryData {
  const timestamp = nowIso();
  const chapter = getChapter(data, chapterId);

  return {
    ...data,
    chapters: data.chapters.map((item) =>
      item.id === chapterId ? { ...item, title: normalizeTitle(title, 'Untitled Chapter'), updatedAt: timestamp } : item
    ),
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function deleteChapter(data: LibraryData, chapterId: ID): LibraryData {
  const chapter = getChapter(data, chapterId);
  const timestamp = nowIso();

  return {
    ...data,
    chapters: data.chapters.filter((item) => item.id !== chapterId),
    pages: data.pages.filter((page) => page.chapterId !== chapterId),
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function createPage(
  data: LibraryData,
  options: { chapterId: ID | null; isLoose: boolean }
): { data: LibraryData; page: Page } {
  const timestamp = nowIso();
  const page: Page = {
    id: createId('page'),
    chapterId: options.chapterId,
    title: options.isLoose ? 'Untitled Loose Page' : 'Untitled Page',
    content: '',
    tags: [],
    textSize: DEFAULT_TEXT_SIZE,
    isLoose: options.isLoose,
    sortOrder: getNextPageSortOrder(data, options.chapterId, options.isLoose),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const chapter = options.chapterId ? getChapter(data, options.chapterId) : undefined;

  return {
    data: {
      ...data,
      pages: [page, ...data.pages],
      chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
      books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
    },
    page
  };
}

export function updatePage(
  data: LibraryData,
  pageId: ID,
  updates: Partial<Pick<Page, 'title' | 'content' | 'textSize' | 'tags'>>
): LibraryData {
  const page = getPage(data, pageId);
  if (!page) {
    return data;
  }

  const timestamp = nowIso();
  const nextPage: Page = {
    ...page,
    ...updates,
    title:
      updates.title !== undefined ? normalizeTitle(updates.title, page.isLoose ? 'Untitled Loose Page' : 'Untitled Page') : page.title,
    tags: updates.tags !== undefined ? normalizeTags(updates.tags) : page.tags,
    updatedAt: timestamp
  };

  const chapter = nextPage.chapterId ? getChapter(data, nextPage.chapterId) : undefined;

  return {
    ...data,
    pages: data.pages.map((item) => (item.id === pageId ? nextPage : item)),
    chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function deletePage(data: LibraryData, pageId: ID): LibraryData {
  const page = getPage(data, pageId);
  const chapter = page?.chapterId ? getChapter(data, page.chapterId) : undefined;
  const timestamp = nowIso();

  return {
    ...data,
    pages: data.pages.filter((item) => item.id !== pageId),
    chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function moveLoosePageToChapter(
  data: LibraryData,
  pageId: ID,
  chapterId: ID
): { data: LibraryData; chapterId: ID | null } {
  const page = getPage(data, pageId);
  const chapter = getChapter(data, chapterId);
  if (!page) {
    return { data, chapterId: null };
  }
  if (!chapter) {
    return { data, chapterId: null };
  }

  const timestamp = nowIso();

  return {
    chapterId,
    data: {
      ...data,
      pages: data.pages.map((item) =>
        item.id === pageId
          ? {
              ...item,
              chapterId,
              isLoose: false,
              sortOrder: getNextPageSortOrder(data, chapterId, false),
              updatedAt: timestamp
            }
          : item
      ),
      chapters: touchChapter(data.chapters, chapterId, timestamp),
      books: touchBook(data.books, chapter.bookId, timestamp)
    }
  };
}

export function moveChapterToBook(
  data: LibraryData,
  chapterId: ID,
  destinationBookId: ID
): LibraryData {
  const chapter = getChapter(data, chapterId);
  if (!chapter || chapter.bookId === destinationBookId) {
    return data;
  }

  const timestamp = nowIso();
  const sourceBookId = chapter.bookId;
  const nextChapters = normalizeChapterOrders(
    data.chapters.map((item) =>
      item.id === chapterId
        ? {
            ...item,
            bookId: destinationBookId,
            sortOrder: getNextChapterSortOrder(data, destinationBookId),
            updatedAt: timestamp
          }
        : item
    )
  );

  return {
    ...data,
    chapters: nextChapters,
    books: touchBooks(data.books, [sourceBookId, destinationBookId], timestamp)
  };
}

export function movePageToChapter(
  data: LibraryData,
  pageId: ID,
  destinationChapterId: ID
): LibraryData {
  const page = getPage(data, pageId);
  const destinationChapter = getChapter(data, destinationChapterId);

  if (!page || isLoosePage(page) || !page.chapterId || !destinationChapter || page.chapterId === destinationChapterId) {
    return data;
  }

  const timestamp = nowIso();
  const sourceChapter = getChapter(data, page.chapterId);
  const nextPages = normalizePageOrders(
    data.pages.map((item) =>
      item.id === pageId
        ? {
            ...item,
            chapterId: destinationChapterId,
            isLoose: false,
            sortOrder: getNextPageSortOrder(data, destinationChapterId, false),
            updatedAt: timestamp
          }
        : item
    )
  );

  const touchedBookIds = new Set<ID>([destinationChapter.bookId]);
  if (sourceChapter) {
    touchedBookIds.add(sourceChapter.bookId);
  }

  return {
    ...data,
    pages: nextPages,
    chapters: touchChapters(
      data.chapters,
      [destinationChapterId, ...(page.chapterId ? [page.chapterId] : [])],
      timestamp
    ),
    books: touchBooks(data.books, [...touchedBookIds], timestamp)
  };
}

export function reorderChaptersInBook(
  data: LibraryData,
  bookId: ID,
  orderedChapterIds: ID[]
): LibraryData {
  const timestamp = nowIso();
  const validIds = new Set(
    data.chapters.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id)
  );
  const normalizedIds = orderedChapterIds.filter((id) => validIds.has(id));

  if (normalizedIds.length !== validIds.size) {
    return data;
  }

  return {
    ...data,
    chapters: data.chapters.map((chapter) => {
      if (chapter.bookId !== bookId) {
        return chapter;
      }

      const nextIndex = normalizedIds.indexOf(chapter.id);
      return nextIndex === -1
        ? chapter
        : {
            ...chapter,
            sortOrder: nextIndex
          };
    }),
    books: touchBook(data.books, bookId, timestamp)
  };
}

export function reorderPagesInChapter(
  data: LibraryData,
  chapterId: ID,
  orderedPageIds: ID[]
): LibraryData {
  const timestamp = nowIso();
  const chapter = getChapter(data, chapterId);
  const validIds = new Set(
    data.pages
      .filter((page) => page.chapterId === chapterId && !page.isLoose)
      .map((page) => page.id)
  );
  const normalizedIds = orderedPageIds.filter((id) => validIds.has(id));

  if (normalizedIds.length !== validIds.size) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => {
      if (page.chapterId !== chapterId || page.isLoose) {
        return page;
      }

      const nextIndex = normalizedIds.indexOf(page.id);
      return nextIndex === -1
        ? page
        : {
            ...page,
            sortOrder: nextIndex
          };
    }),
    chapters: touchChapter(data.chapters, chapterId, timestamp),
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

function touchBook(books: Book[], bookId: ID, timestamp: string): Book[] {
  return books.map((book) => (book.id === bookId ? { ...book, updatedAt: timestamp } : book));
}

function touchChapter(chapters: Chapter[], chapterId: ID, timestamp: string): Chapter[] {
  return chapters.map((chapter) =>
    chapter.id === chapterId ? { ...chapter, updatedAt: timestamp } : chapter
  );
}

function touchChapters(chapters: Chapter[], chapterIds: ID[], timestamp: string): Chapter[] {
  const ids = new Set(chapterIds);
  return chapters.map((chapter) =>
    ids.has(chapter.id) ? { ...chapter, updatedAt: timestamp } : chapter
  );
}

function touchBooks(books: Book[], bookIds: ID[], timestamp: string): Book[] {
  const ids = new Set(bookIds);
  return books.map((book) => (ids.has(book.id) ? { ...book, updatedAt: timestamp } : book));
}

function normalizeTitle(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeLibraryData(data: LibraryData): LibraryData {
  return {
    ...data,
    chapters: normalizeChapterOrders(data.chapters),
    pages: normalizePageOrders(
      data.pages.map((page) => ({
        ...page,
        tags: normalizeTags(page.tags)
      }))
    )
  };
}

function normalizeChapterOrders(chapters: Chapter[]): Chapter[] {
  const chaptersByBook = new Map<ID, Chapter[]>();
  for (const chapter of chapters) {
    const chapters = chaptersByBook.get(chapter.bookId) ?? [];
    chapters.push(chapter);
    chaptersByBook.set(chapter.bookId, chapters);
  }

  return chapters.map((chapter) => ({
    ...chapter,
    sortOrder: resolveSortOrder(chapter, chaptersByBook.get(chapter.bookId) ?? [])
  }));
}

function normalizePageOrders(pages: Page[]): Page[] {
  const pagesByParent = new Map<string, Page[]>();
  for (const page of pages) {
    const key = getPageOrderingKey(page.chapterId, page.isLoose);
    const siblingPages = pagesByParent.get(key) ?? [];
    siblingPages.push(page);
    pagesByParent.set(key, siblingPages);
  }

  return pages.map((page) => ({
      ...page,
      sortOrder: resolveSortOrder(
        page,
        pagesByParent.get(getPageOrderingKey(page.chapterId, page.isLoose)) ?? []
      )
    }));
}

function resolveSortOrder<T extends { id: ID; updatedAt: string; createdAt: string; sortOrder?: number }>(
  item: T,
  siblings: T[]
): number {
  if (typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)) {
    return item.sortOrder;
  }

  const sortedSiblings = [...siblings].sort((a, b) => {
    const updatedComparison = b.updatedAt.localeCompare(a.updatedAt);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }

    const createdComparison = b.createdAt.localeCompare(a.createdAt);
    if (createdComparison !== 0) {
      return createdComparison;
    }

    return a.id.localeCompare(b.id);
  });

  return sortedSiblings.findIndex((sibling) => sibling.id === item.id);
}

function compareBySortOrder<T extends { sortOrder: number; createdAt: string; updatedAt: string; id: ID }>(
  left: T,
  right: T
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const createdComparison = left.createdAt.localeCompare(right.createdAt);
  if (createdComparison !== 0) {
    return createdComparison;
  }

  const updatedComparison = left.updatedAt.localeCompare(right.updatedAt);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }

  return left.id.localeCompare(right.id);
}

function getNextChapterSortOrder(data: LibraryData, bookId: ID): number {
  const chapters = getChaptersForBook(data, bookId);
  return chapters.length;
}

function getNextPageSortOrder(
  data: LibraryData,
  chapterId: ID | null,
  isLoose: boolean
): number {
  if (chapterId && !isLoose) {
    return getPagesForChapter(data, chapterId).length;
  }

  return data.pages.filter((page) => isLoosePage(page)).length;
}

function getPageOrderingKey(chapterId: ID | null, isLoose: boolean): string {
  return isLoose || chapterId === null ? 'loose' : chapterId;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => normalizeTag(typeof tag === 'string' ? tag : String(tag ?? '')))
        .filter(isValidTag)
    )
  );
}
