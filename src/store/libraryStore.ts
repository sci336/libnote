import { loadLibraryData, saveLibraryData } from '../db/indexedDb';
import type { Book, Chapter, DeletedFrom, ID, LibraryData, Page, Trashable } from '../types/domain';
import { nowIso } from '../utils/date';
import { createId } from '../utils/ids';
import { isChapterPage, isLoosePage } from '../utils/pageState';
import { normalizeTagList } from '../utils/tags';

export const DEFAULT_TEXT_SIZE = 16;

export const emptyLibraryData: LibraryData = {
  books: [],
  chapters: [],
  pages: []
};

/**
 * Loads persisted data and repairs fields that older snapshots may omit, such as
 * sort orders or normalized tags. Callers can treat the returned graph as the
 * canonical in-memory shape.
 */
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

export function getSortedBooks(data: LibraryData): Book[] {
  return [...data.books].filter(isLiveRecord).sort(compareBySortOrder);
}

export function getChapter(data: LibraryData, chapterId: ID): Chapter | undefined {
  return data.chapters.find((chapter) => chapter.id === chapterId);
}

export function getPage(data: LibraryData, pageId: ID): Page | undefined {
  return data.pages.find((page) => page.id === pageId);
}

export function getChaptersForBook(data: LibraryData, bookId: ID): Chapter[] {
  return [...data.chapters]
    .filter((chapter) => chapter.bookId === bookId && isLiveRecord(chapter))
    .sort(compareBySortOrder);
}

export function getPagesForChapter(data: LibraryData, chapterId: ID): Page[] {
  return [...data.pages]
    .filter((page) => page.chapterId === chapterId && isChapterPage(page) && isLiveRecord(page))
    .sort(compareBySortOrder);
}

export function getLoosePages(data: LibraryData): Page[] {
  return [...data.pages]
    // Loose pages behave like an inbox, so recency is more useful than a fixed
    // manual order the way chapter pages use.
    .filter((page) => isLoosePage(page) && isLiveRecord(page))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createBook(data: LibraryData): { data: LibraryData; book: Book } {
  const timestamp = nowIso();
  const book: Book = {
    id: createId('book'),
    title: 'Untitled Book',
    sortOrder: getNextBookSortOrder(data),
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
  const book = getBook(data, bookId);
  if (!book || isTrashedRecord(book)) {
    return data;
  }

  return {
    ...data,
    books: data.books.map((book) =>
      book.id === bookId ? { ...book, title: normalizeTitle(title, 'Untitled Book'), updatedAt: timestamp } : book
    )
  };
}

export function moveBookToTrash(data: LibraryData, bookId: ID): LibraryData {
  const book = getBook(data, bookId);
  if (!book || isTrashedRecord(book)) {
    return data;
  }

  const deletedAt = nowIso();
  const chapterIds = new Set(
    data.chapters.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id)
  );

  return {
    ...data,
    books: data.books.map((item) =>
      item.id === bookId
        ? markDeleted(item, deletedAt, null)
        : item
    ),
    chapters: data.chapters.map((chapter) =>
      chapter.bookId === bookId
        ? markDeleted(chapter, deletedAt, { bookId: chapter.bookId })
        : chapter
    ),
    pages: data.pages.map((page) =>
      page.chapterId && chapterIds.has(page.chapterId)
        ? markDeleted(page, deletedAt, { bookId, chapterId: page.chapterId, wasLoose: false })
        : page
    )
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
  if (!chapter || isTrashedRecord(chapter)) {
    return data;
  }

  return {
    ...data,
    chapters: data.chapters.map((item) =>
      item.id === chapterId ? { ...item, title: normalizeTitle(title, 'Untitled Chapter'), updatedAt: timestamp } : item
    ),
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function moveChapterToTrash(data: LibraryData, chapterId: ID): LibraryData {
  const chapter = getChapter(data, chapterId);
  if (!chapter || isTrashedRecord(chapter)) {
    return data;
  }

  const deletedAt = nowIso();

  return {
    ...data,
    chapters: data.chapters.map((item) =>
      item.id === chapterId ? markDeleted(item, deletedAt, { bookId: chapter.bookId }) : item
    ),
    pages: data.pages.map((page) =>
      page.chapterId === chapterId
        ? markDeleted(page, deletedAt, { bookId: chapter.bookId, chapterId, wasLoose: false })
        : page
    ),
    books: touchBook(data.books, chapter.bookId, deletedAt)
  };
}

export function createPage(
  data: LibraryData,
  options: { chapterId: ID | null; isLoose: boolean; title?: string }
): { data: LibraryData; page: Page } {
  const timestamp = nowIso();
  const page: Page = {
    id: createId('page'),
    chapterId: options.chapterId,
    title: normalizeTitle(options.title ?? '', options.isLoose ? 'Untitled Loose Page' : 'Untitled Page'),
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
  if (!page || isTrashedRecord(page)) {
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

  // Any page edit should bubble recency to its container so the root/book views
  // surface recently touched work without storing extra denormalized metadata.
  const chapter = nextPage.chapterId ? getChapter(data, nextPage.chapterId) : undefined;

  return {
    ...data,
    pages: data.pages.map((item) => (item.id === pageId ? nextPage : item)),
    chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function movePageToTrash(data: LibraryData, pageId: ID): LibraryData {
  const page = getPage(data, pageId);
  if (!page || isTrashedRecord(page)) {
    return data;
  }

  const chapter = page?.chapterId ? getChapter(data, page.chapterId) : undefined;
  const timestamp = nowIso();

  return {
    ...data,
    pages: data.pages.map((item) =>
      item.id === pageId
        ? markDeleted(item, timestamp, {
            bookId: chapter?.bookId,
            chapterId: page.chapterId ?? undefined,
            wasLoose: isLoosePage(page)
          })
        : item
    ),
    chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function restoreBook(data: LibraryData, bookId: ID): LibraryData {
  const book = getBook(data, bookId);
  if (!book || isLiveRecord(book)) {
    return data;
  }

  const chapterIds = new Set(
    data.chapters.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id)
  );

  return {
    ...data,
    books: data.books.map((item) => (item.id === bookId ? clearDeleted(item) : item)),
    chapters: data.chapters.map((chapter) =>
      chapter.bookId === bookId ? clearDeleted(chapter) : chapter
    ),
    pages: data.pages.map((page) =>
      page.chapterId && chapterIds.has(page.chapterId) ? clearDeleted(page) : page
    )
  };
}

export function restoreChapter(data: LibraryData, chapterId: ID): LibraryData {
  const chapter = getChapter(data, chapterId);
  if (!chapter || isLiveRecord(chapter)) {
    return data;
  }

  const parentBook = getBook(data, chapter.bookId);
  if (parentBook?.deletedAt) {
    return restoreBook(data, parentBook.id);
  }

  return {
    ...data,
    chapters: data.chapters.map((item) => (item.id === chapterId ? clearDeleted(item) : item)),
    pages: data.pages.map((page) =>
      page.chapterId === chapterId ? clearDeleted(page) : page
    )
  };
}

export function restorePage(data: LibraryData, pageId: ID): LibraryData {
  const page = getPage(data, pageId);
  if (!page || isLiveRecord(page)) {
    return data;
  }

  const deletedFrom = page.deletedFrom ?? null;
  const targetChapterId = deletedFrom?.wasLoose
    ? null
    : deletedFrom?.chapterId ?? page.chapterId;
  const targetChapter = targetChapterId ? getChapter(data, targetChapterId) : undefined;
  const canRestoreToChapter = Boolean(targetChapter && isLiveRecord(targetChapter));

  return {
    ...data,
    pages: data.pages.map((item) =>
      item.id === pageId
        ? {
            ...clearDeleted(item),
            chapterId: canRestoreToChapter ? targetChapterId ?? null : null,
            isLoose: !canRestoreToChapter,
            updatedAt: nowIso()
          }
        : item
    )
  };
}

export function deleteBookForever(data: LibraryData, bookId: ID): LibraryData {
  const chapterIds = new Set(
    data.chapters.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id)
  );

  return {
    books: normalizeBookOrders(data.books.filter((book) => book.id !== bookId)),
    chapters: normalizeChapterOrders(data.chapters.filter((chapter) => chapter.bookId !== bookId)),
    pages: normalizePageOrders(data.pages.filter((page) => !page.chapterId || !chapterIds.has(page.chapterId)))
  };
}

export function deleteChapterForever(data: LibraryData, chapterId: ID): LibraryData {
  const chapter = getChapter(data, chapterId);
  const timestamp = nowIso();

  return {
    ...data,
    chapters: normalizeChapterOrders(data.chapters.filter((item) => item.id !== chapterId)),
    pages: normalizePageOrders(data.pages.filter((page) => page.chapterId !== chapterId)),
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function deletePageForever(data: LibraryData, pageId: ID): LibraryData {
  const page = getPage(data, pageId);
  const chapter = page?.chapterId ? getChapter(data, page.chapterId) : undefined;
  const timestamp = nowIso();

  return {
    ...data,
    pages: normalizePageOrders(data.pages.filter((item) => item.id !== pageId)),
    chapters: chapter ? touchChapter(data.chapters, chapter.id, timestamp) : data.chapters,
    books: chapter ? touchBook(data.books, chapter.bookId, timestamp) : data.books
  };
}

export function emptyTrash(data: LibraryData): LibraryData {
  const trashedBookIds = new Set(data.books.filter(isTrashedRecord).map((book) => book.id));
  const trashedChapterIds = new Set(data.chapters.filter(isTrashedRecord).map((chapter) => chapter.id));

  return {
    books: normalizeBookOrders(data.books.filter(isLiveRecord)),
    chapters: normalizeChapterOrders(
      data.chapters.filter((chapter) => isLiveRecord(chapter) && !trashedBookIds.has(chapter.bookId))
    ),
    pages: normalizePageOrders(
      data.pages.filter(
        (page) =>
          isLiveRecord(page) &&
          !trashedChapterIds.has(page.chapterId ?? '') &&
          !trashedBookIds.has(page.deletedFrom?.bookId ?? '')
      )
    )
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
  if (isTrashedRecord(page)) {
    return { data, chapterId: null };
  }
  if (!chapter) {
    return { data, chapterId: null };
  }
  if (isTrashedRecord(chapter)) {
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
              // Moved loose pages become the newest item in the destination
              // chapter instead of trying to preserve inbox ordering there.
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
  if (isTrashedRecord(chapter)) {
    return data;
  }

  const destinationBook = getBook(data, destinationBookId);
  if (!destinationBook || isTrashedRecord(destinationBook)) {
    return data;
  }

  const timestamp = nowIso();
  const sourceBookId = chapter.bookId;
  // Re-run normalization after the move so the source book closes any sort-order
  // gaps left behind by removing one of its chapters.
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
  if (isTrashedRecord(page) || isTrashedRecord(destinationChapter)) {
    return data;
  }

  const timestamp = nowIso();
  const sourceChapter = getChapter(data, page.chapterId);
  // Pages keep chapter-local ordering, so moving across chapters always appends
  // at the destination and then re-normalizes sibling orders globally.
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
    data.chapters.filter((chapter) => chapter.bookId === bookId && isLiveRecord(chapter)).map((chapter) => chapter.id)
  );
  const normalizedIds = orderedChapterIds.filter((id) => validIds.has(id));

  // Reject partial reorder payloads so a stale drag state cannot accidentally
  // drop chapters from the stored order.
  if (normalizedIds.length !== validIds.size) {
    return data;
  }

  return {
    ...data,
    chapters: data.chapters.map((chapter) => {
      if (chapter.bookId !== bookId || isTrashedRecord(chapter)) {
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

export function reorderBooks(
  data: LibraryData,
  orderedBookIds: ID[]
): LibraryData {
  const validIds = new Set(data.books.filter(isLiveRecord).map((book) => book.id));
  const normalizedIds = orderedBookIds.filter((id) => validIds.has(id));

  if (normalizedIds.length !== validIds.size) {
    return data;
  }

  return {
    ...data,
    books: data.books.map((book) => {
      if (isTrashedRecord(book)) {
        return book;
      }

      const nextIndex = normalizedIds.indexOf(book.id);
      return nextIndex === -1
        ? book
        : {
            ...book,
            sortOrder: nextIndex
          };
    })
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
      .filter(isLiveRecord)
      .map((page) => page.id)
  );
  const normalizedIds = orderedPageIds.filter((id) => validIds.has(id));

  if (normalizedIds.length !== validIds.size) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => {
      if (page.chapterId !== chapterId || page.isLoose || isTrashedRecord(page)) {
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

export function normalizeLibraryData(data: LibraryData): LibraryData {
  return {
    ...data,
    books: normalizeBookOrders(data.books.map((book) => normalizeTrashable(book))),
    // Hydration is the one place we repair legacy or malformed snapshots so the
    // rest of the app can assume normalized sort order and tag data.
    chapters: normalizeChapterOrders(data.chapters.map((chapter) => normalizeTrashable(chapter))),
    pages: normalizePageOrders(
      data.pages.map((page) => ({
        ...normalizeTrashable(page),
        tags: normalizeTags(page.tags)
      }))
    )
  };
}

function normalizeBookOrders(books: Book[]): Book[] {
  return books.map((book) => ({
    ...book,
    sortOrder: resolveSortOrder(book, books)
  }));
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
    // Loose pages share a single pseudo-parent so they can be normalized
    // separately from chapter pages even though they live in the same array.
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

  // Fall back to recency-based ordering for older snapshots that predate explicit
  // drag-and-drop order fields.
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

function getNextBookSortOrder(data: LibraryData): number {
  return getSortedBooks(data).length;
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

  // Normalize unknown persisted values defensively so corrupted snapshots do
  // not break tag filtering or editor chips.
  return normalizeTagList(tags.map((tag) => (typeof tag === 'string' ? tag : String(tag ?? ''))));
}

function isTrashedRecord(record: Trashable): boolean {
  return typeof record.deletedAt === 'string' && record.deletedAt.length > 0;
}

function isLiveRecord<T extends Trashable>(record: T): boolean {
  return !isTrashedRecord(record);
}

function normalizeTrashable<T extends Trashable>(record: T): T {
  return {
    ...record,
    deletedAt: typeof record.deletedAt === 'string' && record.deletedAt.length > 0 ? record.deletedAt : null,
    deletedFrom: normalizeDeletedFrom(record.deletedFrom)
  };
}

function normalizeDeletedFrom(value: DeletedFrom | null | undefined): DeletedFrom | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    bookId: typeof value.bookId === 'string' && value.bookId.length > 0 ? value.bookId : undefined,
    chapterId: typeof value.chapterId === 'string' && value.chapterId.length > 0 ? value.chapterId : undefined,
    wasLoose: typeof value.wasLoose === 'boolean' ? value.wasLoose : undefined
  };
}

function markDeleted<T extends Trashable>(record: T, deletedAt: string, deletedFrom: DeletedFrom | null): T {
  return {
    ...record,
    deletedAt,
    deletedFrom: normalizeDeletedFrom(deletedFrom)
  };
}

function clearDeleted<T extends Trashable>(record: T): T {
  return {
    ...record,
    deletedAt: null,
    deletedFrom: null
  };
}
