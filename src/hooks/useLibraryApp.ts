import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppMenuSection,
  AppSettings,
  LibraryBooksPerRow,
  LibraryData,
  Page,
  SaveStatus,
  ShortcutAction,
  ShortcutBinding,
  TrashItem,
  ViewState
} from '../types/domain';
import { loadAppSettings, saveAppSettings } from '../db/indexedDb';
import {
  createBook,
  createChapter,
  createPage,
  deleteBookForever,
  deleteChapterForever,
  deletePageForever,
  deleteTagEverywhere,
  emptyTrash,
  getBook,
  hydrateLibraryData,
  mergeTags,
  moveBookToTrash,
  moveChapterToTrash,
  movePageToTrash,
  moveChapterToBook,
  moveLoosePageToChapter,
  movePageToChapter,
  persistLibraryData,
  reorderBooks,
  reorderChaptersInBook,
  reorderPagesInChapter,
  restoreBook,
  restoreChapter,
  restorePage,
  renameTagEverywhere,
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
import { buildSearchIndex, normalizeSearchQuery, parseSearchInput, searchPages, searchTrashedEntities } from '../utils/search';
import { isLoosePage } from '../utils/pageState';
import {
  DEFAULT_SHORTCUTS,
  eventMatchesShortcut,
  isTypingInEditableTarget,
  normalizeShortcutSettings
} from '../utils/shortcuts';
import { formatTagQuery, normalizeTag, normalizeTagList, parseTagQuery } from '../utils/tags';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings, RECENT_PAGES_LIMIT } from '../utils/appSettings';
import {
  createBackupFileName,
  createBackupPayload,
  createPageExportFile,
  downloadJsonFile,
  downloadPlainTextFile,
  readBackupFile,
  validateBackupPayload
} from '../utils/backup';

const DESKTOP_WIDTH = 920;
const PERSISTENCE_DELAY_MS = 300;

interface BackupStatus {
  tone: 'success' | 'error' | 'info';
  message: string;
}

/**
 * Central application controller for the note library.
 * It coordinates view routing, derived navigation context, persistence, search,
 * tag mode, and move/reorder actions so presentational components can stay thin.
 */
export function useLibraryApp() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [view, setView] = useState<ViewState>({ type: 'root' });
  const [navigationHistory, setNavigationHistory] = useState<ViewState[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appMenuSection, setAppMenuSection] = useState<AppMenuSection>('help');
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOriginView, setSearchOriginView] = useState<ViewState>({ type: 'root' });
  const [tagOriginView, setTagOriginView] = useState<ViewState>({ type: 'root' });
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const latestDataRef = useRef<LibraryData | null>(null);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const currentViewRef = useRef<ViewState>({ type: 'root' });
  const navigationHistoryRef = useRef<ViewState[]>([]);
  const latestDataVersionRef = useRef(0);
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    Promise.all([hydrateLibraryData(), hydrateAppSettings()])
      .then(([nextData, nextSettings]) => {
        setData(nextData);
        setSettings(nextSettings);
        setSettingsHydrated(true);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    latestDataRef.current = data;
    if (data) {
      latestDataVersionRef.current += 1;
    }
  }, [data]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentViewRef.current = view;
  }, [view]);

  useEffect(() => {
    navigationHistoryRef.current = navigationHistory;
  }, [navigationHistory]);

  useDebouncedEffect(
    () => {
      if (!data) {
        return;
      }

      // Typing in the editor updates state immediately, then persistence trails
      // behind slightly so edits stay responsive.
      void persistLibrarySnapshot(data, latestDataVersionRef.current);
    },
    [data],
    PERSISTENCE_DELAY_MS
  );

  useDebouncedEffect(
    () => {
      if (!settingsHydrated) {
        return;
      }

      saveAppSettings(settings).catch(console.error);
    },
    [settings, settingsHydrated],
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

      void saveAppSettings(latestSettingsRef.current);
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
    () => {
      const metadata = data
        ? getNavigationMetadata(data, view)
        : { showBack: false, breadcrumbs: [{ label: 'Books', current: true }] };
      return {
        ...metadata,
        showBack: metadata.showBack || navigationHistory.length > 0
      };
    },
    [data, navigationHistory.length, view]
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
  const trashSearchResults = useMemo(
    () => (searchIndex ? searchTrashedEntities(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );
  const searchMode = useMemo(() => parseSearchInput(searchQuery), [searchQuery]);
  const allChapters = useMemo(() => (data ? getAllChapters(data) : []), [data]);
  const initialMoveBookId = books[0]?.id ?? '';
  const trashItems = useMemo(() => (data ? buildTrashItems(data) : []), [data]);

  useEffect(() => {
    if (!activePage) {
      return;
    }

    recordRecentPage(activePage.id);
  }, [activePage?.id]);

  useEffect(() => {
    if (!data || !settingsHydrated) {
      return;
    }

    const existingPageIds = new Set(data.pages.filter((page) => !page.deletedAt).map((page) => page.id));
    const cleanedRecentPageIds = settings.recentPageIds.filter((pageId) => existingPageIds.has(pageId));

    if (!areStringArraysEqual(cleanedRecentPageIds, settings.recentPageIds)) {
      setSettings((currentSettings) => ({
        ...currentSettings,
        recentPageIds: currentSettings.recentPageIds.filter((pageId) => existingPageIds.has(pageId))
      }));
    }
  }, [data, settings.recentPageIds, settingsHydrated]);

  function runIfDataLoaded(callback: (currentData: LibraryData) => void): void {
    if (!data) {
      return;
    }

    callback(data);
  }

  function updateData(nextData: LibraryData): void {
    setData(nextData);
  }

  async function persistLibrarySnapshot(snapshot: LibraryData, dataVersion: number): Promise<void> {
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus({ state: 'saving' });

    try {
      await persistLibraryData(snapshot);

      if (requestId === saveRequestIdRef.current && dataVersion === latestDataVersionRef.current) {
        setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      }
    } catch (error) {
      console.error('Failed to save library data', error);

      if (requestId === saveRequestIdRef.current && dataVersion === latestDataVersionRef.current) {
        setSaveStatus({
          state: 'failed',
          error: error instanceof Error ? error.message : undefined
        });
      }
    }
  }

  function retryLibrarySave(): void {
    const latestData = latestDataRef.current;
    if (!latestData) {
      return;
    }

    void persistLibrarySnapshot(latestData, latestDataVersionRef.current);
  }

  function replaceView(nextView: ViewState, options?: { shouldCloseSidebar?: boolean }): void {
    currentViewRef.current = nextView;
    setView(nextView);

    if (options?.shouldCloseSidebar) {
      closeSidebarOnMobile();
    }
  }

  function navigateToView(
    nextView: ViewState,
    options?: { pushHistory?: boolean; shouldCloseSidebar?: boolean }
  ): void {
    const currentView = currentViewRef.current;
    const shouldPushHistory = options?.pushHistory ?? !areViewsEqual(currentView, nextView);

    if (shouldPushHistory && !areViewsEqual(currentView, nextView)) {
      const nextHistory = [...navigationHistoryRef.current, currentView];
      navigationHistoryRef.current = nextHistory;
      setNavigationHistory(nextHistory);
    }

    replaceView(nextView, { shouldCloseSidebar: options?.shouldCloseSidebar });
  }

  function closeSidebarOnMobile(): void {
    if (window.innerWidth <= DESKTOP_WIDTH) {
      setSidebarOpen(false);
    }
  }

  function rememberRecentTags(tags: string[]): void {
    const normalizedTags = normalizeTagList(tags);
    if (normalizedTags.length === 0) {
      return;
    }

    setRecentTags((currentTags) => {
      const nextTags = [...currentTags];

      for (const tag of [...normalizedTags].reverse()) {
        const existingIndex = nextTags.indexOf(tag);
        if (existingIndex !== -1) {
          nextTags.splice(existingIndex, 1);
        }

        nextTags.unshift(tag);
      }

      return nextTags;
    });
  }

  function recordRecentPage(pageId: string): void {
    setSettings((currentSettings) => {
      const nextRecentPageIds = [
        pageId,
        ...currentSettings.recentPageIds.filter((recentPageId) => recentPageId !== pageId)
      ].slice(0, RECENT_PAGES_LIMIT);

      if (areStringArraysEqual(nextRecentPageIds, currentSettings.recentPageIds)) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        recentPageIds: nextRecentPageIds
      };
    });
  }

  function getTagViewExitTarget(): ViewState {
    return tagOriginView.type === 'tag' ? { type: 'root' } : tagOriginView;
  }

  function getParentNavigationTarget(currentView: ViewState = currentViewRef.current): ViewState {
    if (!data) {
      return { type: 'root' };
    }

    return getParentView(data, currentView, searchOriginView, tagOriginView);
  }

  function navigateBack(): void {
    const history = navigationHistoryRef.current;

    if (history.length > 0) {
      const previousView = history[history.length - 1];
      const nextHistory = history.slice(0, -1);
      navigationHistoryRef.current = nextHistory;
      setNavigationHistory(nextHistory);
      replaceView(previousView, { shouldCloseSidebar: true });
      return;
    }

    replaceView(getParentNavigationTarget(), { shouldCloseSidebar: true });
  }

  function navigateHome(): void {
    navigateToView({ type: 'root' }, { shouldCloseSidebar: true });
  }

  function goToParentView(): void {
    navigateToView(getParentNavigationTarget(), { shouldCloseSidebar: true });
  }

  function applyTagView(nextRawTags: string[], options?: { shouldCloseSidebar?: boolean }): void {
    const nextTags = normalizeTagList(nextRawTags);

    if (nextTags.length === 0) {
      setSearchQuery('');
      replaceView(getTagViewExitTarget());
      if (options?.shouldCloseSidebar) {
        closeSidebarOnMobile();
      }
      return;
    }

    if (view.type !== 'tag') {
      setTagOriginView(view.type === 'search' ? searchOriginView : view);
    }

    rememberRecentTags(nextTags);
    setSearchQuery(formatTagQuery(nextTags));
    if (view.type === 'tag') {
      replaceView({ type: 'tag', tags: nextTags });
    } else {
      navigateToView({ type: 'tag', tags: nextTags }, { pushHistory: true });
    }

    if (options?.shouldCloseSidebar) {
      closeSidebarOnMobile();
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
      navigateToView({ type: 'book', bookId: result.book.id }, { shouldCloseSidebar: true });
    });
  }

  function handleCreateChapter(bookId: string): void {
    runIfDataLoaded((currentData) => {
      const result = createChapter(currentData, bookId);
      updateData(result.data);
      navigateToView({ type: 'chapter', chapterId: result.chapter.id }, { shouldCloseSidebar: true });
    });
  }

  function handleCreatePage(chapterId: string): void {
    runIfDataLoaded((currentData) => {
      const result = createPage(currentData, { chapterId, isLoose: false });
      updateData(result.data);
      setShouldAutoFocusEditor(true);
      navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
    });
  }

  function handleCreateLoosePage(): void {
    runIfDataLoaded((currentData) => {
      const result = createPage(currentData, { chapterId: null, isLoose: true });
      updateData(result.data);
      setShouldAutoFocusEditor(true);
      navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
    });
  }

  function handleCreatePageFromLink(sourcePage: Page, title: string): void {
    runIfDataLoaded((currentData) => {
      const isLoose = isLoosePage(sourcePage);
      const result = createPage(currentData, {
        chapterId: isLoose ? null : sourcePage.chapterId,
        isLoose,
        title
      });

      updateData(result.data);
      setShouldAutoFocusEditor(true);
      navigateToView({ type: 'page', pageId: result.page.id }, { shouldCloseSidebar: true });
    });
  }

  function handleDeleteBook(bookId: string): void {
    if (!data || !window.confirm('Move this book and all of its chapters and pages to Trash?')) {
      return;
    }

    updateData(moveBookToTrash(data, bookId));
    replaceView({ type: 'root' });
  }

  function handleDeleteChapter(chapterId: string, bookId: string): void {
    if (!data || !window.confirm('Move this chapter and all of its pages to Trash?')) {
      return;
    }

    updateData(moveChapterToTrash(data, chapterId));
    replaceView({ type: 'book', bookId });
  }

  function handleDeletePage(page: Page): void {
    if (!data || !window.confirm('Move this page to Trash?')) {
      return;
    }

    updateData(movePageToTrash(data, page.id));
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: currentSettings.recentPageIds.filter((pageId) => pageId !== page.id)
    }));

    if (isLoosePage(page)) {
      replaceView({ type: 'loosePages' });
      return;
    }

    if (page.chapterId) {
      replaceView({ type: 'chapter', chapterId: page.chapterId });
      return;
    }

    replaceView({ type: 'root' });
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

  function handleReorderBooks(orderedBookIds: string[]): void {
    if (!data) {
      return;
    }

    updateData(reorderBooks(data, orderedBookIds));
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

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    const parsedTags = parseTagQuery(value);
    if (parsedTags && parsedTags.length > 0) {
      // Route tag-only queries into the dedicated tag view so typed filters,
      // clicked tags, and tag removal all operate on the same source of truth.
      applyTagView(parsedTags);
      return;
    }

    const normalizedQuery = normalizeSearchQuery(value);

    if (normalizedQuery) {
      // Remember where search started so "back" returns to the prior context
      // instead of treating search like a dead-end screen.
      if (view.type !== 'search') {
        setSearchOriginView(view);
      }

      if (view.type === 'search') {
        replaceView({ type: 'search', query: value });
      } else {
        navigateToView({ type: 'search', query: value }, { pushHistory: true });
      }
      return;
    }

    if (view.type === 'tag') {
      replaceView(getTagViewExitTarget());
    }

    if (view.type === 'search') {
      replaceView({ type: 'search', query: '' });
    }
  }

  function handleSearchFocus(): void {
    if (view.type !== 'search') {
      setSearchOriginView(view);
      navigateToView({ type: 'search', query: searchQuery }, { pushHistory: true });
    }
  }

  function handleOpenBook(bookId: string): void {
    navigateToView({ type: 'book', bookId }, { shouldCloseSidebar: true });
  }

  function handleOpenChapter(chapterId: string): void {
    navigateToView({ type: 'chapter', chapterId }, { shouldCloseSidebar: true });
  }

  function handleOpenPage(pageId: string): void {
    navigateToView({ type: 'page', pageId }, { shouldCloseSidebar: true });
  }

  function handleOpenLoosePages(): void {
    navigateToView({ type: 'loosePages' }, { shouldCloseSidebar: true });
  }

  function handleOpenTrash(): void {
    navigateToView({ type: 'trash' }, { shouldCloseSidebar: true });
  }

  function handleRestoreTrashItem(item: TrashItem): void {
    if (!data) {
      return;
    }

    if (item.type === 'book') {
      updateData(restoreBook(data, item.id));
      return;
    }

    if (item.type === 'chapter') {
      updateData(restoreChapter(data, item.id));
      return;
    }

    updateData(restorePage(data, item.id));
  }

  function handleDeleteTrashItemForever(item: TrashItem): void {
    if (!data || !window.confirm(`Delete "${item.title}" forever? This cannot be undone.`)) {
      return;
    }

    if (item.type === 'book') {
      updateData(deleteBookForever(data, item.id));
      return;
    }

    if (item.type === 'chapter') {
      updateData(deleteChapterForever(data, item.id));
      return;
    }

    updateData(deletePageForever(data, item.id));
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: currentSettings.recentPageIds.filter((pageId) => pageId !== item.id)
    }));
  }

  function handleEmptyTrash(): void {
    if (!data || !window.confirm('Empty Trash? This will permanently delete all trashed items.')) {
      return;
    }

    updateData(emptyTrash(data));
    setSettings((currentSettings) => ({
      ...currentSettings,
      recentPageIds: currentSettings.recentPageIds.filter((pageId) =>
        data.pages.some((page) => page.id === pageId && !page.deletedAt)
      )
    }));
  }

  function handleOpenTag(tag: string): void {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }

    if (view.type === 'tag') {
      // Clicking an additional tag refines the current intersection instead of
      // throwing away the active tag route.
      applyTagView([...view.tags, normalizedTag], { shouldCloseSidebar: true });
      return;
    }

    applyTagView([normalizedTag], { shouldCloseSidebar: true });
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
      applyTagView([], { shouldCloseSidebar: true });
      return;
    }

    applyTagView(nextTags);
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
      replaceView({ type: 'chapter', chapterId: result.chapterId });
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

  function handleRenameTagEverywhere(oldTag: string, newTag: string): void {
    if (!data) {
      return;
    }

    updateData(renameTagEverywhere(data, oldTag, newTag));
  }

  function handleDeleteTagEverywhere(tag: string): void {
    if (!data) {
      return;
    }

    updateData(deleteTagEverywhere(data, tag));
  }

  function handleMergeTags(sourceTag: string, targetTag: string): void {
    if (!data) {
      return;
    }

    updateData(mergeTags(data, sourceTag, targetTag));
  }

  function handleUpdateLibraryBooksPerRow(booksPerRow: LibraryBooksPerRow): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      libraryView: {
        ...currentSettings.libraryView,
        booksPerRow
      }
    }));
  }

  function handleUpdateShortcut(action: ShortcutAction, binding: ShortcutBinding | null): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      shortcuts: {
        ...currentSettings.shortcuts,
        [action]: binding
      }
    }));
  }

  function handleResetShortcut(action: ShortcutAction): void {
    handleUpdateShortcut(action, DEFAULT_SHORTCUTS[action]);
  }

  function handleResetAllShortcuts(): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      shortcuts: normalizeShortcutSettings(DEFAULT_SHORTCUTS)
    }));
  }

  function handleExportLibrary(): void {
    if (!data) {
      setBackupStatus({ tone: 'error', message: 'Library data is still loading. Please try export again in a moment.' });
      return;
    }

    const payload = createBackupPayload(data, latestSettingsRef.current);
    const nextSettings = {
      ...latestSettingsRef.current,
      lastBackupExportedAt: payload.exportedAt
    };
    const payloadWithBackupTimestamp = {
      ...payload,
      settings: nextSettings
    };

    downloadJsonFile(createBackupFileName(payload.exportedAt), payloadWithBackupTimestamp);
    latestSettingsRef.current = nextSettings;
    setSettings(nextSettings);
    saveAppSettings(nextSettings).catch(console.error);
    setBackupStatus({
      tone: 'success',
      message: 'Backup download started. Check your browser downloads or Downloads folder.'
    });
  }

  async function handleImportLibrary(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const rawPayload = await readBackupFile(file);
      const validated = validateBackupPayload(rawPayload);
      const nextData = validated.data;

      if (nextData.books.length === 0 && nextData.chapters.length === 0 && nextData.pages.length === 0) {
        throw new Error('Import failed. The backup does not contain any books, chapters, or pages to restore.');
      }

      if (
        !window.confirm(
          'Importing this backup will replace your current library in this browser. Export a backup first if you want to keep a copy of the current library. Continue?'
        )
      ) {
        setBackupStatus({ tone: 'info', message: 'Import canceled. Your current library was not changed.' });
        return;
      }

      const nextSettings =
        validated.settingsStatus === 'restored'
          ? validated.settings
          : filterRecentPageIdsForLibrary(DEFAULT_APP_SETTINGS, nextData.pages.map((page) => page.id));

      await persistLibraryData(nextData);
      await saveAppSettings(nextSettings);

      latestDataRef.current = nextData;
      latestSettingsRef.current = nextSettings;
      setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      setData(nextData);
      setSettings(nextSettings);
      setSearchQuery('');
      setRecentTags([]);
      setSearchOriginView({ type: 'root' });
      setTagOriginView({ type: 'root' });
      setNavigationHistory([]);
      navigationHistoryRef.current = [];
      setMovingChapterId(null);
      setMovingPageId(null);
      replaceView({ type: 'root' });
      setBackupStatus({
        tone: 'success',
        message:
          validated.settingsStatus === 'restored'
            ? 'Library imported successfully and saved to this browser.'
            : 'Library imported successfully. Backup settings were missing or invalid, so safe defaults were kept.'
      });
    } catch (error) {
      setBackupStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Import failed. Your current library was not changed.'
      });
    }
  }

  function handleExportPage(pageId: string): void {
    if (!data) {
      return;
    }

    const page = getActivePage(data, { type: 'page', pageId });
    if (!page) {
      setBackupStatus({ tone: 'error', message: 'Could not export that page because it is no longer available.' });
      return;
    }

    const exportFile = createPageExportFile(page);
    downloadPlainTextFile(exportFile.filename, exportFile.content);
    setBackupStatus({ tone: 'success', message: `Exported "${page.title || 'Untitled Page'}" as a text file.` });
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || appMenuOpen || isTypingInEditableTarget(event.target)) {
        return;
      }

      const shortcuts = settings.shortcuts;

      if (eventMatchesShortcut(event, shortcuts.newLoosePage)) {
        event.preventDefault();
        handleCreateLoosePage();
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.newChapterPage)) {
        if (sidebarChapterId) {
          event.preventDefault();
          handleCreatePage(sidebarChapterId);
        }
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.toggleSidebar)) {
        event.preventDefault();
        setSidebarOpen((open) => !open);
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.goHome)) {
        event.preventDefault();
        navigateHome();
        return;
      }

      if (eventMatchesShortcut(event, shortcuts.goBack)) {
        event.preventDefault();
        navigateBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [appMenuOpen, handleCreateLoosePage, handleCreatePage, settings.shortcuts, sidebarChapterId]);

  return {
    data,
    settings,
    view,
    navigationHistory,
    sidebarOpen,
    appMenuOpen,
    appMenuSection,
    shouldAutoFocusEditor,
    movingChapterId,
    movingPageId,
    searchQuery,
    searchOriginView,
    tagOriginView,
    recentTags,
    backupStatus,
    saveStatus,
    recentPageIds: settings.recentPageIds,
    books,
    loosePages,
    chapterList,
    pageList,
    searchResults,
    trashSearchResults,
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
    trashItems,
    updateData,
    retryLibrarySave,
    navigateToView,
    replaceView,
    setSidebarOpen,
    setAppMenuOpen,
    setAppMenuSection,
    setMovingChapterId,
    setMovingPageId,
    closeSidebarOnMobile,
    openAppMenu,
    closeAppMenu,
    navigateAppMenu,
    navigateBack,
    navigateHome,
    goToParentView,
    handleSearchChange,
    handleSearchFocus,
    handleCreateBook,
    handleCreateChapter,
    handleCreatePage,
    handleCreateLoosePage,
    handleCreatePageFromLink,
    handleDeleteBook,
    handleDeleteChapter,
    handleDeletePage,
    handleReorderBooks,
    handleReorderChapters,
    handleReorderPages,
    handleMoveChapter,
    handleMovePage,
    handleMoveLoosePage,
    handleOpenBook,
    handleOpenChapter,
    handleOpenPage,
    handleOpenLoosePages,
    handleOpenTrash,
    handleOpenTag,
    handleRemoveActiveTag,
    handleRestoreTrashItem,
    handleDeleteTrashItemForever,
    handleEmptyTrash,
    handleRenameBook,
    handleRenameChapter,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize,
    handleUpdatePageTags,
    handleRenameTagEverywhere,
    handleDeleteTagEverywhere,
    handleMergeTags,
    handleUpdateLibraryBooksPerRow,
    handleUpdateShortcut,
    handleResetShortcut,
    handleResetAllShortcuts,
    handleExportLibrary,
    handleImportLibrary,
    handleExportPage
  };
}

function areViewsEqual(left: ViewState, right: ViewState): boolean {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case 'root':
    case 'loosePages':
    case 'trash':
      return true;
    case 'book':
      return left.bookId === (right as Extract<ViewState, { type: 'book' }>).bookId;
    case 'chapter':
      return left.chapterId === (right as Extract<ViewState, { type: 'chapter' }>).chapterId;
    case 'page':
      return left.pageId === (right as Extract<ViewState, { type: 'page' }>).pageId;
    case 'search':
      return left.query === (right as Extract<ViewState, { type: 'search' }>).query;
    case 'tag':
      return left.tags.join('|') === (right as Extract<ViewState, { type: 'tag' }>).tags.join('|');
    default:
      return false;
  }
}

async function hydrateAppSettings(): Promise<AppSettings> {
  const persistedSettings = await loadAppSettings();
  return normalizeAppSettings(persistedSettings);
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildTrashItems(data: LibraryData): TrashItem[] {
  const bookById = new Map(data.books.map((book) => [book.id, book] as const));
  const chapterById = new Map(data.chapters.map((chapter) => [chapter.id, chapter] as const));
  const items: TrashItem[] = [];

  for (const book of data.books) {
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

  for (const chapter of data.chapters) {
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

  for (const page of data.pages) {
    if (!page.deletedAt) {
      continue;
    }

    const sourceChapterId = page.deletedFrom?.chapterId ?? page.chapterId ?? undefined;
    const sourceChapter = sourceChapterId ? chapterById.get(sourceChapterId) : undefined;
    const sourceBookId = page.deletedFrom?.bookId ?? (sourceChapter ? sourceChapter.bookId : undefined);
    const sourceBook = sourceBookId ? bookById.get(sourceBookId) : undefined;
    const wasLoose = page.deletedFrom?.wasLoose ?? page.isLoose;

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
