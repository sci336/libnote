import type { Book, BreadcrumbItem, Chapter, LibraryData, NavigationMetadata, Page, TrashItem, Trashable, ViewState } from '../types/domain';
import { getBook, getChapter, getChaptersForBook, getLoosePages, getPage, getPagesForChapter, getSortedBooks as getBooksInOrder } from './libraryStore';
import { isChapterPage, isLoosePage } from '../utils/pageState';
import { normalizeTagList, type TagSummary } from '../utils/tags';

export interface LibraryDerivedData {
  liveBooks: Book[];
  liveChapters: Chapter[];
  livePages: Page[];
  trashedBooks: Book[];
  trashedChapters: Chapter[];
  trashedPages: Page[];
  bookById: Map<string, Book>;
  chapterById: Map<string, Chapter>;
  pageById: Map<string, Page>;
  liveBookById: Map<string, Book>;
  liveChapterById: Map<string, Chapter>;
  livePageById: Map<string, Page>;
  chaptersByBookId: Map<string, Chapter[]>;
  pagesByChapterId: Map<string, Page[]>;
  loosePages: Page[];
  chapterCountByBookId: Map<string, number>;
  pageCountByChapterId: Map<string, number>;
  allTags: string[];
  tagSummaries: TagSummary[];
  loosePageCount: number;
  trashedItemCount: number;
  trashItems: TrashItem[];
}

export function buildLibraryDerivedData(data: LibraryData): LibraryDerivedData {
  // Build all lookup maps in one pass per entity type. Most views need the same
  // live/trashed splits, counts, and parent-child lists, so centralizing them
  // keeps components from re-deriving inconsistent library shapes.
  const bookById = new Map<string, Book>();
  const chapterById = new Map<string, Chapter>();
  const pageById = new Map<string, Page>();
  const liveBookById = new Map<string, Book>();
  const liveChapterById = new Map<string, Chapter>();
  const livePageById = new Map<string, Page>();
  const chaptersByBookId = new Map<string, Chapter[]>();
  const pagesByChapterId = new Map<string, Page[]>();
  const tagCounts = new Map<string, number>();
  const liveBooks: Book[] = [];
  const liveChapters: Chapter[] = [];
  const livePages: Page[] = [];
  const trashedBooks: Book[] = [];
  const trashedChapters: Chapter[] = [];
  const trashedPages: Page[] = [];
  const loosePages: Page[] = [];

  for (const book of data.books) {
    bookById.set(book.id, book);
    if (isDeleted(book)) {
      trashedBooks.push(book);
    } else {
      liveBooks.push(book);
      liveBookById.set(book.id, book);
    }
  }

  for (const chapter of data.chapters) {
    chapterById.set(chapter.id, chapter);
    if (isDeleted(chapter)) {
      trashedChapters.push(chapter);
      continue;
    }

    liveChapters.push(chapter);
    liveChapterById.set(chapter.id, chapter);
    const siblings = chaptersByBookId.get(chapter.bookId) ?? [];
    siblings.push(chapter);
    chaptersByBookId.set(chapter.bookId, siblings);
  }

  for (const page of data.pages) {
    pageById.set(page.id, page);
    if (isDeleted(page)) {
      trashedPages.push(page);
      continue;
    }

    livePages.push(page);
    livePageById.set(page.id, page);

    for (const tag of normalizeTagList(page.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    if (isLoosePage(page)) {
      // Loose Pages are first-class pages, but they do not participate in the
      // Books -> Chapters -> Pages hierarchy or chapter-local ordering.
      loosePages.push(page);
      continue;
    }

    if (page.chapterId && isChapterPage(page)) {
      const siblings = pagesByChapterId.get(page.chapterId) ?? [];
      siblings.push(page);
      pagesByChapterId.set(page.chapterId, siblings);
    }
  }

  liveBooks.sort(compareBySortOrder);
  liveChapters.sort(compareBySortOrder);
  livePages.sort(compareBySortOrder);
  loosePages.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const chapters of chaptersByBookId.values()) {
    chapters.sort(compareBySortOrder);
  }

  for (const pages of pagesByChapterId.values()) {
    pages.sort(compareBySortOrder);
  }

  const tagSummaries = [...tagCounts.entries()]
    .map(([tag, pageCount]) => ({ tag, pageCount }))
    .sort((left, right) => left.tag.localeCompare(right.tag));

  return {
    liveBooks,
    liveChapters,
    livePages,
    trashedBooks,
    trashedChapters,
    trashedPages,
    bookById,
    chapterById,
    pageById,
    liveBookById,
    liveChapterById,
    livePageById,
    chaptersByBookId,
    pagesByChapterId,
    loosePages,
    chapterCountByBookId: new Map([...chaptersByBookId.entries()].map(([bookId, chapters]) => [bookId, chapters.length])),
    pageCountByChapterId: new Map([...pagesByChapterId.entries()].map(([chapterId, pages]) => [chapterId, pages.length])),
    allTags: tagSummaries.map((summary) => summary.tag),
    tagSummaries,
    loosePageCount: loosePages.length,
    trashedItemCount: trashedBooks.length + trashedChapters.length + trashedPages.length,
    trashItems: buildTrashItemsFromMaps(trashedBooks, trashedChapters, trashedPages, bookById, chapterById)
  };
}

export function getSortedBooks(data: LibraryData): Book[] {
  return getBooksInOrder(data);
}

export function getSortedBooksFromDerived(derived: LibraryDerivedData): Book[] {
  return derived.liveBooks;
}

export function getActiveBook(data: LibraryData, view: ViewState): Book | undefined {
  return view.type === 'book' ? getBook(data, view.bookId) : undefined;
}

export function getActiveBookFromDerived(derived: LibraryDerivedData, view: ViewState): Book | undefined {
  return view.type === 'book' ? derived.bookById.get(view.bookId) : undefined;
}

export function getActiveChapter(data: LibraryData, view: ViewState): Chapter | undefined {
  return view.type === 'chapter' ? getChapter(data, view.chapterId) : undefined;
}

export function getActiveChapterFromDerived(derived: LibraryDerivedData, view: ViewState): Chapter | undefined {
  return view.type === 'chapter' ? derived.chapterById.get(view.chapterId) : undefined;
}

export function getActivePage(data: LibraryData, view: ViewState): Page | undefined {
  return view.type === 'page' ? getPage(data, view.pageId) : undefined;
}

export function getActivePageFromDerived(derived: LibraryDerivedData, view: ViewState): Page | undefined {
  return view.type === 'page' ? derived.pageById.get(view.pageId) : undefined;
}

export function getDerivedBookForChapter(
  data: LibraryData,
  activeChapter?: Chapter
): Book | undefined {
  return activeChapter ? getBook(data, activeChapter.bookId) : undefined;
}

export function getDerivedBookForChapterFromDerived(
  derived: LibraryDerivedData,
  activeChapter?: Chapter
): Book | undefined {
  return activeChapter ? derived.bookById.get(activeChapter.bookId) : undefined;
}

export function getDerivedChapterForPage(
  data: LibraryData,
  activePage?: Page
): Chapter | undefined {
  return activePage?.chapterId ? getChapter(data, activePage.chapterId) : undefined;
}

export function getDerivedChapterForPageFromDerived(
  derived: LibraryDerivedData,
  activePage?: Page
): Chapter | undefined {
  return activePage?.chapterId ? derived.chapterById.get(activePage.chapterId) : undefined;
}

export function getDerivedBookForPage(
  data: LibraryData,
  derivedChapterForPage?: Chapter
): Book | undefined {
  return derivedChapterForPage ? getBook(data, derivedChapterForPage.bookId) : undefined;
}

export function getDerivedBookForPageFromDerived(
  derived: LibraryDerivedData,
  derivedChapterForPage?: Chapter
): Book | undefined {
  return derivedChapterForPage ? derived.bookById.get(derivedChapterForPage.bookId) : undefined;
}

export function getChapterListForView(
  data: LibraryData,
  view: ViewState,
  activeBook?: Book,
  activeChapter?: Chapter,
  derivedBookForPage?: Book
): Chapter[] {
  // The sidebar mirrors the active reading/editing context, even when that
  // context comes from a page view rather than a direct chapter route.
  if (view.type === 'book' && activeBook) {
    return getChaptersForBook(data, activeBook.id);
  }

  if (view.type === 'chapter' && activeChapter) {
    return getChaptersForBook(data, activeChapter.bookId);
  }

  if (view.type === 'page' && derivedBookForPage) {
    return getChaptersForBook(data, derivedBookForPage.id);
  }

  return [];
}

export function getChapterListForViewFromDerived(
  derived: LibraryDerivedData,
  view: ViewState,
  activeBook?: Book,
  activeChapter?: Chapter,
  derivedBookForPage?: Book
): Chapter[] {
  if (view.type === 'book' && activeBook) {
    return derived.chaptersByBookId.get(activeBook.id) ?? [];
  }

  if (view.type === 'chapter' && activeChapter) {
    return derived.chaptersByBookId.get(activeChapter.bookId) ?? [];
  }

  if (view.type === 'page' && derivedBookForPage) {
    return derived.chaptersByBookId.get(derivedBookForPage.id) ?? [];
  }

  return [];
}

export function getPageListForView(
  data: LibraryData,
  view: ViewState,
  activeChapter?: Chapter,
  derivedChapterForPage?: Chapter
): Page[] {
  if (view.type === 'chapter' && activeChapter) {
    return getPagesForChapter(data, activeChapter.id);
  }

  if (view.type === 'page' && derivedChapterForPage) {
    return getPagesForChapter(data, derivedChapterForPage.id);
  }

  return [];
}

export function getPageListForViewFromDerived(
  derived: LibraryDerivedData,
  view: ViewState,
  activeChapter?: Chapter,
  derivedChapterForPage?: Chapter
): Page[] {
  if (view.type === 'chapter' && activeChapter) {
    return derived.pagesByChapterId.get(activeChapter.id) ?? [];
  }

  if (view.type === 'page' && derivedChapterForPage) {
    return derived.pagesByChapterId.get(derivedChapterForPage.id) ?? [];
  }

  return [];
}

export function getSidebarChapterId(
  view: ViewState,
  activeChapter?: Chapter,
  activePage?: Page
): string | undefined {
  if (view.type === 'chapter') {
    return activeChapter?.id;
  }

  if (view.type === 'page' && activePage?.chapterId) {
    return activePage.chapterId;
  }

  return undefined;
}

export function getSidebarBookId(
  activeBook?: Book,
  derivedBookForChapter?: Book,
  derivedBookForPage?: Book
): string | undefined {
  return activeBook?.id ?? derivedBookForChapter?.id ?? derivedBookForPage?.id;
}

export function getNavigationMetadata(
  data: LibraryData,
  view: ViewState
): NavigationMetadata {
  if (view.type === 'root') {
    return { showBack: false, breadcrumbs: [currentBreadcrumb('Books')] };
  }

  if (view.type === 'book') {
    const book = getBook(data, view.bookId);
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb(book?.title ?? 'Book')
      ]
    };
  }

  if (view.type === 'search') {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb('Search')
      ]
    };
  }

  if (view.type === 'trash') {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb('Trash')
      ]
    };
  }

  if (view.type === 'tag') {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb(view.tags.length > 0 ? view.tags.map((tag) => `/${tag}`).join(' ') : 'Tagged Pages')
      ]
    };
  }

  if (view.type === 'chapter') {
    const chapter = getChapter(data, view.chapterId);
    const book = chapter ? getBook(data, chapter.bookId) : undefined;
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        ...getBookBreadcrumb(book),
        currentBreadcrumb(chapter?.title ?? 'Chapter')
      ]
    };
  }

  if (view.type === 'loosePages') {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb('Loose Pages')
      ]
    };
  }

  const page = getPage(data, view.pageId);
  if (!page) {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        currentBreadcrumb('Page')
      ]
    };
  }

  if (isDeleted(page)) {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        linkedBreadcrumb('Trash', { type: 'trash' }),
        currentBreadcrumb(page.title)
      ]
    };
  }

  if (isLoosePage(page)) {
    return {
      showBack: true,
      breadcrumbs: [
        linkedBreadcrumb('Books', { type: 'root' }),
        linkedBreadcrumb('Loose Pages', { type: 'loosePages' }),
        currentBreadcrumb(page.title)
      ]
    };
  }

  const chapter = page.chapterId ? getChapter(data, page.chapterId) : undefined;
  const book = chapter ? getBook(data, chapter.bookId) : undefined;
  return {
    showBack: true,
    breadcrumbs: [
      linkedBreadcrumb('Books', { type: 'root' }),
      ...getBookBreadcrumb(book),
      ...getChapterBreadcrumb(chapter),
      currentBreadcrumb(page.title)
    ]
  };
}

function linkedBreadcrumb(label: string, view: ViewState): BreadcrumbItem {
  return { label, view };
}

function currentBreadcrumb(label: string): BreadcrumbItem {
  return { label, current: true };
}

function getBookBreadcrumb(book?: Book): BreadcrumbItem[] {
  if (!book || isDeleted(book)) {
    return [];
  }

  return [linkedBreadcrumb(book.title, { type: 'book', bookId: book.id })];
}

function getChapterBreadcrumb(chapter?: Chapter): BreadcrumbItem[] {
  if (!chapter || isDeleted(chapter)) {
    return [];
  }

  return [linkedBreadcrumb(chapter.title, { type: 'chapter', chapterId: chapter.id })];
}

function isDeleted(record: Trashable): boolean {
  return Boolean(record.deletedAt);
}

/**
 * Resolves the "up one level" destination for the current lightweight route.
 * Search and tag views remember where they were entered from so back navigation
 * feels contextual instead of always bouncing to the root library.
 */
export function getParentView(
  data: LibraryData,
  view: ViewState,
  searchOriginView: ViewState,
  tagOriginView: ViewState
): ViewState {
  if (view.type === 'book') {
    return { type: 'root' };
  }

  if (view.type === 'search') {
    return searchOriginView.type === 'search' ? { type: 'root' } : searchOriginView;
  }

  if (view.type === 'tag') {
    return tagOriginView.type === 'tag' ? { type: 'root' } : tagOriginView;
  }

  if (view.type === 'trash') {
    return { type: 'root' };
  }

  if (view.type === 'chapter') {
    const chapter = getChapter(data, view.chapterId);
    return chapter ? { type: 'book', bookId: chapter.bookId } : { type: 'root' };
  }

  if (view.type === 'page') {
    const page = getPage(data, view.pageId);
    if (!page) {
      return { type: 'root' };
    }

    if (isLoosePage(page)) {
      return { type: 'loosePages' };
    }

    return page.chapterId ? { type: 'chapter', chapterId: page.chapterId } : { type: 'root' };
  }

  if (view.type === 'loosePages') {
    return { type: 'root' };
  }

  return { type: 'root' };
}

export function getAllChapters(data: LibraryData): Chapter[] {
  return data.chapters.filter((chapter) => !chapter.deletedAt);
}

export function getAllChaptersFromDerived(derived: LibraryDerivedData): Chapter[] {
  return derived.liveChapters;
}

export function getLoosePagesList(data: LibraryData): Page[] {
  return getLoosePages(data);
}

export function getLoosePagesListFromDerived(derived: LibraryDerivedData): Page[] {
  return derived.loosePages;
}

export function getChapterCountForBook(data: LibraryData, bookId: string): number {
  return data.chapters.filter((chapter) => chapter.bookId === bookId && !chapter.deletedAt).length;
}

export function getChapterCountForBookFromDerived(derived: LibraryDerivedData, bookId: string): number {
  return derived.chapterCountByBookId.get(bookId) ?? 0;
}

export function getPageCountForChapter(data: LibraryData, chapterId: string): number {
  return data.pages.filter((page) => page.chapterId === chapterId && isChapterPage(page) && !page.deletedAt).length;
}

export function getPageCountForChapterFromDerived(derived: LibraryDerivedData, chapterId: string): number {
  return derived.pageCountByChapterId.get(chapterId) ?? 0;
}

function buildTrashItemsFromMaps(
  trashedBooks: Book[],
  trashedChapters: Chapter[],
  trashedPages: Page[],
  bookById: Map<string, Book>,
  chapterById: Map<string, Chapter>
): TrashItem[] {
  const items: TrashItem[] = [];

  // Trash rows are presentation models built from deleted records plus their
  // saved origin metadata. They are not persisted separately.
  for (const book of trashedBooks) {
    if (!book.deletedAt) {
      continue;
    }

    items.push({
      id: book.id,
      type: 'book',
      title: book.title,
      deletedAt: book.deletedAt,
      originalLocation: 'Library'
    });
  }

  for (const chapter of trashedChapters) {
    if (!chapter.deletedAt) {
      continue;
    }

    items.push({
      id: chapter.id,
      type: 'chapter',
      title: chapter.title,
      deletedAt: chapter.deletedAt,
      originalLocation: bookById.get(chapter.deletedFrom?.bookId ?? chapter.bookId)?.title ?? 'Book'
    });
  }

  for (const page of trashedPages) {
    if (!page.deletedAt) {
      continue;
    }

    const sourceChapterId = page.deletedFrom?.chapterId ?? page.chapterId ?? undefined;
    const sourceChapter = sourceChapterId ? chapterById.get(sourceChapterId) : undefined;
    const sourceBookId = page.deletedFrom?.bookId ?? (sourceChapter ? sourceChapter.bookId : undefined);
    const sourceBook = sourceBookId ? bookById.get(sourceBookId) : undefined;
    const wasLoose = page.deletedFrom?.wasLoose ?? page.isLoose;

    // Pages can outlive their original parent in Trash, so labels fall back
    // gracefully when the chapter or book has since been removed.
    items.push({
      id: page.id,
      type: wasLoose ? 'loosePage' : 'page',
      title: page.title,
      deletedAt: page.deletedAt,
      originalLocation: wasLoose
        ? 'Loose Pages'
        : sourceChapter
          ? `${sourceBook?.title ?? 'Book'} / ${sourceChapter.title}`
          : sourceBook?.title ?? 'Original chapter unavailable'
    });
  }

  return items.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

function compareBySortOrder<T extends { sortOrder: number; createdAt: string; updatedAt: string; id: string }>(
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
