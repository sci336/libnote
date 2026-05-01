import type { Book, BreadcrumbItem, Chapter, LibraryData, NavigationMetadata, Page, Trashable, ViewState } from '../types/domain';
import { getBook, getChapter, getChaptersForBook, getLoosePages, getPage, getPagesForChapter, getSortedBooks as getBooksInOrder } from './libraryStore';
import { isChapterPage, isLoosePage } from '../utils/pageState';

export function getSortedBooks(data: LibraryData): Book[] {
  return getBooksInOrder(data);
}

export function getActiveBook(data: LibraryData, view: ViewState): Book | undefined {
  return view.type === 'book' ? getBook(data, view.bookId) : undefined;
}

export function getActiveChapter(data: LibraryData, view: ViewState): Chapter | undefined {
  return view.type === 'chapter' ? getChapter(data, view.chapterId) : undefined;
}

export function getActivePage(data: LibraryData, view: ViewState): Page | undefined {
  return view.type === 'page' ? getPage(data, view.pageId) : undefined;
}

export function getDerivedBookForChapter(
  data: LibraryData,
  activeChapter?: Chapter
): Book | undefined {
  return activeChapter ? getBook(data, activeChapter.bookId) : undefined;
}

export function getDerivedChapterForPage(
  data: LibraryData,
  activePage?: Page
): Chapter | undefined {
  return activePage?.chapterId ? getChapter(data, activePage.chapterId) : undefined;
}

export function getDerivedBookForPage(
  data: LibraryData,
  derivedChapterForPage?: Chapter
): Book | undefined {
  return derivedChapterForPage ? getBook(data, derivedChapterForPage.bookId) : undefined;
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

export function getLoosePagesList(data: LibraryData): Page[] {
  return getLoosePages(data);
}

export function getChapterCountForBook(data: LibraryData, bookId: string): number {
  return data.chapters.filter((chapter) => chapter.bookId === bookId && !chapter.deletedAt).length;
}

export function getPageCountForChapter(data: LibraryData, chapterId: string): number {
  return data.pages.filter((page) => page.chapterId === chapterId && isChapterPage(page) && !page.deletedAt).length;
}
