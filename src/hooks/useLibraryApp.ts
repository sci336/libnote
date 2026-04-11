import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppMenuSection, LibraryData, Page, ViewState } from '../types/domain';
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
import { buildSearchIndex, normalizeSearchQuery, parseSearchInput, searchPages } from '../utils/search';
import { isLoosePage } from '../utils/pageState';
import { formatTagQuery, normalizeTag, normalizeTagList, parseTagQuery } from '../utils/tags';

const DESKTOP_WIDTH = 920;
const PERSISTENCE_DELAY_MS = 300;

/**
 * Central application controller for the note library.
 * It coordinates view routing, derived navigation context, persistence, search,
 * tag mode, and move/reorder actions so presentational components can stay thin.
 */
export function useLibraryApp() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [view, setView] = useState<ViewState>({ type: 'root' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appMenuSection, setAppMenuSection] = useState<AppMenuSection>('help');
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOriginView, setSearchOriginView] = useState<ViewState>({ type: 'root' });
  const [tagOriginView, setTagOriginView] = useState<ViewState>({ type: 'root' });
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

      // Typing in the editor updates state immediately, then persistence trails
      // behind slightly so edits stay responsive.
      persistLibraryData(data).catch(console.error);
    },
    [data],
    PERSISTENCE_DELAY_MS
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    // `pagehide` catches tab closes/backgrounding where the debounced write has
    // not fired yet, which protects the last few keystrokes from being lost.
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
  // Building the search index is the expensive part of search, so keep it lazy
  // until the user is actively searching or has typed something meaningful.
  const shouldBuildSearchIndex = view.type === 'search' || normalizedSearchQuery.length > 0;
  const searchIndex = useMemo(
    () => (data && shouldBuildSearchIndex ? buildSearchIndex(data) : null),
    [data, shouldBuildSearchIndex]
  );
  const searchResults = useMemo(
    () => (searchIndex ? searchPages(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );
  const searchMode = useMemo(() => parseSearchInput(searchQuery), [searchQuery]);
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

  function openAppMenu(section: AppMenuSection = 'help'): void {
    setAppMenuSection(section);
    setAppMenuOpen(true);
    closeSidebarOnMobile();
  }

  function closeAppMenu(): void {
    setAppMenuOpen(false);
  }

  function navigateAppMenu(section: AppMenuSection): void {
    setAppMenuSection(section);
    setAppMenuOpen(true);
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

    setView(getParentView(data, view, searchOriginView, tagOriginView));
    closeSidebarOnMobile();
  }

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    const parsedTags = parseTagQuery(value);
    if (parsedTags && parsedTags.length > 0) {
      // Route tag-only queries into the dedicated tag view so typed filters,
      // clicked tags, and tag removal all operate on the same source of truth.
      if (view.type !== 'tag') {
        setTagOriginView(view.type === 'search' ? searchOriginView : view);
      }

      setView({ type: 'tag', tags: parsedTags });
      return;
    }

    const normalizedQuery = normalizeSearchQuery(value);

    if (normalizedQuery) {
      // Remember where search started so "back" returns to the prior context
      // instead of treating search like a dead-end screen.
      if (view.type !== 'search') {
        setSearchOriginView(view);
      }
      setView({ type: 'search', query: value });
      return;
    }

    if (view.type === 'tag') {
      setView({ type: 'root' });
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

  function handleOpenTag(tag: string): void {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }

    if (view.type === 'tag') {
      // Clicking an additional tag refines the current intersection instead of
      // throwing away the active tag route.
      const nextTags = normalizeTagList([...view.tags, normalizedTag]);
      setSearchQuery(formatTagQuery(nextTags));
      setView({ type: 'tag', tags: nextTags });
      closeSidebarOnMobile();
      return;
    }

    setTagOriginView(view);
    setSearchQuery(formatTagQuery([normalizedTag]));
    setView({ type: 'tag', tags: [normalizedTag] });
    closeSidebarOnMobile();
  }

  function handleRemoveActiveTag(tag: string): void {
    if (view.type !== 'tag') {
      return;
    }

    const normalizedTag = normalizeTag(tag);
    const nextTags = view.tags.filter((activeTag) => activeTag !== normalizedTag);

    if (nextTags.length === 0) {
      // Clearing the last tag exits tag mode entirely so the search bar and
      // visible route do not drift out of sync.
      setSearchQuery('');
      setView({ type: 'root' });
      closeSidebarOnMobile();
      return;
    }

    setSearchQuery(formatTagQuery(nextTags));
    setView({ type: 'tag', tags: nextTags });
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

  function handleUpdatePageTags(pageId: string, tags: string[]): void {
    if (!data) {
      return;
    }

    updateData(updatePage(data, pageId, { tags }));
  }

  return {
    data,
    view,
    sidebarOpen,
    appMenuOpen,
    appMenuSection,
    shouldAutoFocusEditor,
    movingChapterId,
    movingPageId,
    searchQuery,
    searchOriginView,
    tagOriginView,
    books,
    loosePages,
    chapterList,
    pageList,
    searchResults,
    searchMode,
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
    setAppMenuOpen,
    setAppMenuSection,
    setMovingChapterId,
    setMovingPageId,
    closeSidebarOnMobile,
    openAppMenu,
    closeAppMenu,
    navigateAppMenu,
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
    handleOpenTag,
    handleRemoveActiveTag,
    handleRenameBook,
    handleRenameChapter,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize,
    handleUpdatePageTags
  };
}
