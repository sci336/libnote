import { useEffect, useMemo, useRef, useState } from 'react';
import type { LibraryData, Page, ViewState } from '../types/domain';
import {
  createBook,
  createChapter,
  createPage,
  deleteBook,
  deleteChapter,
  deletePage,
  getBook,
  hydrateLibraryData,
  moveChapterToBook,
  moveLoosePageToChapter,
  movePageToChapter,
  persistLibraryData,
  reorderChaptersInBook,
  reorderPagesInChapter,
  updateBook,
  updateChapter,
  updatePage
} from '../store/libraryStore';
import {
  getActiveBook,
  getActiveChapter,
  getActivePage,
  getAllChapters,
  getChapterListForView,
  getDerivedBookForChapter,
  getDerivedBookForPage,
  getDerivedChapterForPage,
  getLoosePagesList,
  getNavigationMetadata,
  getPageListForView,
  getParentView,
  getSidebarBookId,
  getSidebarChapterId,
  getSortedBooks
} from '../store/librarySelectors';
import { useDebouncedEffect } from './useDebouncedEffect';
import { buildSearchIndex, normalizeSearchQuery, searchPages } from '../utils/search';
import { isLoosePage } from '../utils/pageState';

const DESKTOP_WIDTH = 920;
const PERSISTENCE_DELAY_MS = 300;

export function useLibraryApp() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [view, setView] = useState<ViewState>({ type: 'root' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOriginView, setSearchOriginView] = useState<ViewState>({ type: 'root' });
  const latestDataRef = useRef<LibraryData | null>(null);

  useEffect(() => {
    hydrateLibraryData().then(setData).catch(console.error);
  }, []);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useDebouncedEffect(
    () => {
      if (!data) {
        return;
      }

      persistLibraryData(data).catch(console.error);
    },
    [data],
    PERSISTENCE_DELAY_MS
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    const flush = () => {
      const latestData = latestDataRef.current;
      if (latestData) {
        void persistLibraryData(latestData);
      }
    };

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, [data]);

  useEffect(() => {
    const syncSidebar = () => {
      setSidebarOpen(window.innerWidth > DESKTOP_WIDTH);
    };

    syncSidebar();
    window.addEventListener('resize', syncSidebar);
    return () => window.removeEventListener('resize', syncSidebar);
  }, []);

  useEffect(() => {
    if (view.type === 'page' && shouldAutoFocusEditor) {
      setShouldAutoFocusEditor(false);
    }
  }, [view, shouldAutoFocusEditor]);

  useEffect(() => {
    setMovingChapterId(null);
    setMovingPageId(null);
  }, [view]);

  const books = useMemo(() => (data ? getSortedBooks(data) : []), [data]);
  const loosePages = useMemo(() => (data ? getLoosePagesList(data) : []), [data]);
  const activeBook = useMemo(() => (data ? getActiveBook(data, view) : undefined), [data, view]);
  const activeChapter = useMemo(() => (data ? getActiveChapter(data, view) : undefined), [data, view]);
  const activePage = useMemo(() => (data ? getActivePage(data, view) : undefined), [data, view]);
  const derivedBookForChapter = useMemo(
    () => (data ? getDerivedBookForChapter(data, activeChapter) : undefined),
    [activeChapter, data]
  );
  const derivedChapterForPage = useMemo(
    () => (data ? getDerivedChapterForPage(data, activePage) : undefined),
    [activePage, data]
  );
  const derivedBookForPage = useMemo(
    () => (data ? getDerivedBookForPage(data, derivedChapterForPage) : undefined),
    [data, derivedChapterForPage]
  );
  const chapterList = useMemo(
    () =>
      data
        ? getChapterListForView(data, view, activeBook, activeChapter, derivedBookForPage)
        : [],
    [activeBook, activeChapter, data, derivedBookForPage, view]
  );
  const pageList = useMemo(
    () => (data ? getPageListForView(data, view, activeChapter, derivedChapterForPage) : []),
    [activeChapter, data, derivedChapterForPage, view]
  );
  const sidebarBookId = useMemo(
    () => getSidebarBookId(activeBook, derivedBookForChapter, derivedBookForPage),
    [activeBook, derivedBookForChapter, derivedBookForPage]
  );
  const sidebarChapterId = useMemo(
    () => getSidebarChapterId(view, activeChapter, activePage),
    [activeChapter, activePage, view]
  );
  const nav = useMemo(
    () => (data ? getNavigationMetadata(data, view) : { showBack: false, currentLabel: 'Books' }),
    [data, view]
  );
  const normalizedSearchQuery = useMemo(() => normalizeSearchQuery(searchQuery), [searchQuery]);
  const shouldBuildSearchIndex = view.type === 'search' || normalizedSearchQuery.length > 0;
  const searchIndex = useMemo(
    () => (data && shouldBuildSearchIndex ? buildSearchIndex(data) : null),
    [data, shouldBuildSearchIndex]
  );
  const searchResults = useMemo(
    () => (searchIndex ? searchPages(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );
  const allChapters = useMemo(() => (data ? getAllChapters(data) : []), [data]);
  const initialMoveBookId = books[0]?.id ?? '';

  function runIfDataLoaded(callback: (currentData: LibraryData) => void): void {
    if (!data) {
      return;
    }

    callback(data);
  }

  function updateData(nextData: LibraryData): void {
    setData(nextData);
  }

  function closeSidebarOnMobile(): void {
    if (window.innerWidth <= DESKTOP_WIDTH) {
      setSidebarOpen(false);
    }
  }

  function handleCreateBook(): void {
    runIfDataLoaded((currentData) => {
      const result = createBook(currentData);
      updateData(result.data);
      setView({ type: 'book', bookId: result.book.id });
      closeSidebarOnMobile();
    });
  }

  function handleCreateChapter(bookId: string): void {
    runIfDataLoaded((currentData) => {
      const result = createChapter(currentData, bookId);
      updateData(result.data);
      setView({ type: 'chapter', chapterId: result.chapter.id });
      closeSidebarOnMobile();
    });
  }

  function handleCreatePage(chapterId: string): void {
    runIfDataLoaded((currentData) => {
      const result = createPage(currentData, { chapterId, isLoose: false });
      updateData(result.data);
      setShouldAutoFocusEditor(true);
      setView({ type: 'page', pageId: result.page.id });
      closeSidebarOnMobile();
    });
  }

  function handleCreateLoosePage(): void {
    runIfDataLoaded((currentData) => {
      const result = createPage(currentData, { chapterId: null, isLoose: true });
      updateData(result.data);
      setShouldAutoFocusEditor(true);
      setView({ type: 'page', pageId: result.page.id });
      closeSidebarOnMobile();
    });
  }

  function handleDeleteBook(bookId: string): void {
    if (!data || !window.confirm('Delete this book and all of its chapters and pages?')) {
      return;
    }

    updateData(deleteBook(data, bookId));
    setView({ type: 'root' });
  }

  function handleDeleteChapter(chapterId: string, bookId: string): void {
    if (!data || !window.confirm('Delete this chapter and all of its pages?')) {
      return;
    }

    updateData(deleteChapter(data, chapterId));
    setView({ type: 'book', bookId });
  }

  function handleDeletePage(page: Page): void {
    if (!data || !window.confirm('Delete this page?')) {
      return;
    }

    updateData(deletePage(data, page.id));

    if (isLoosePage(page)) {
      setView({ type: 'loosePages' });
      return;
    }

    if (page.chapterId) {
      setView({ type: 'chapter', chapterId: page.chapterId });
      return;
    }

    setView({ type: 'root' });
  }

  function handleReorderChapters(bookId: string, orderedChapterIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderChaptersInBook(data, bookId, orderedChapterIds));
  }

  function handleReorderPages(chapterId: string, orderedPageIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderPagesInChapter(data, chapterId, orderedPageIds));
  }

  function handleMoveChapter(chapterId: string, destinationBookId: string): void {
    if (!data) {
      return;
    }

    updateData(moveChapterToBook(data, chapterId, destinationBookId));
    setMovingChapterId(null);
  }

  function handleMovePage(pageId: string, destinationChapterId: string): void {
    if (!data) {
      return;
    }

    updateData(movePageToChapter(data, pageId, destinationChapterId));
    setMovingPageId(null);
  }

  function goUpOneLevel(): void {
    if (!data) {
      return;
    }

    setView(getParentView(data, view, searchOriginView));
    closeSidebarOnMobile();
  }

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    const normalizedQuery = normalizeSearchQuery(value);

    if (normalizedQuery) {
      if (view.type !== 'search') {
        setSearchOriginView(view);
      }
      setView({ type: 'search', query: value });
      return;
    }

    if (view.type === 'search') {
      setView({ type: 'search', query: '' });
    }
  }

  function handleSearchFocus(): void {
    if (view.type !== 'search') {
      setSearchOriginView(view);
      setView({ type: 'search', query: searchQuery });
    }
  }

  function handleOpenBook(bookId: string): void {
    setView({ type: 'book', bookId });
    closeSidebarOnMobile();
  }

  function handleOpenChapter(chapterId: string): void {
    setView({ type: 'chapter', chapterId });
    closeSidebarOnMobile();
  }

  function handleOpenPage(pageId: string): void {
    setView({ type: 'page', pageId });
    closeSidebarOnMobile();
  }

  function handleOpenLoosePages(): void {
    setView({ type: 'loosePages' });
    closeSidebarOnMobile();
  }

  function handleMoveLoosePage(
    pageId: string,
    payload: { chapterId: string }
  ): void {
    if (!data) {
      return;
    }

    const result = moveLoosePageToChapter(data, pageId, payload.chapterId);

    updateData(result.data);
    if (result.chapterId) {
      setView({ type: 'chapter', chapterId: result.chapterId });
    }
  }

  function handleRenameBook(bookId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updateBook(data, bookId, title));
  }

  function handleRenameChapter(chapterId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updateChapter(data, chapterId, title));
  }

  function handleRenamePage(pageId: string, title: string): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { title }));
  }

  function handleUpdatePageContent(pageId: string, content: string): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { content }));
  }

  function handleUpdatePageTextSize(pageId: string, textSize: number): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { textSize }));
  }

  return {
    data,
    view,
    sidebarOpen,
    shouldAutoFocusEditor,
    movingChapterId,
    movingPageId,
    searchQuery,
    searchOriginView,
    books,
    loosePages,
    chapterList,
    pageList,
    searchResults,
    activeBook,
    activeChapter,
    activePage,
    derivedBookForChapter,
    derivedChapterForPage,
    derivedBookForPage,
    sidebarBookId,
    sidebarChapterId,
    nav,
    allChapters,
    initialMoveBookId,
    updateData,
    setView,
    setSidebarOpen,
    setMovingChapterId,
    setMovingPageId,
    closeSidebarOnMobile,
    goUpOneLevel,
    handleSearchChange,
    handleSearchFocus,
    handleCreateBook,
    handleCreateChapter,
    handleCreatePage,
    handleCreateLoosePage,
    handleDeleteBook,
    handleDeleteChapter,
    handleDeletePage,
    handleReorderChapters,
    handleReorderPages,
    handleMoveChapter,
    handleMovePage,
    handleMoveLoosePage,
    handleOpenBook,
    handleOpenChapter,
    handleOpenPage,
    handleOpenLoosePages,
    handleRenameBook,
    handleRenameChapter,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize
  };
}
