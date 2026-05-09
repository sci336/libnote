import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppMenuSection,
  AppSettings,
  AppThemeId,
  LibraryBooksPerRow,
  LibraryShelfStyle,
  LibraryData,
  Page,
  SaveStatus,
  ShortcutAction,
  ShortcutBinding,
  ViewState
} from '../types/domain';
import {
  clearRestoreRecoverySnapshot,
  loadAppSettings,
  loadRestoreRecoverySnapshot,
  saveAppSettings,
  saveRestoreRecoverySnapshot,
  type RestoreRecoverySnapshot
} from '../db/indexedDb';
import {
  createBook,
  createChapter,
  createPage,
  deleteTagEverywhere,
  hydrateLibraryData,
  mergeTags,
  moveChapterToBook,
  moveLoosePageToChapter,
  movePageToChapter,
  emptyLibraryData,
  persistLibraryData,
  reorderBooks,
  reorderChaptersInBook,
  reorderPagesInChapter,
  renameTagEverywhere,
  updateBook,
  updateBookCover,
  updateChapter,
  updatePage
} from '../store/libraryStore';
import {
  buildLibraryDerivedData,
  getActiveBookFromDerived,
  getActiveChapterFromDerived,
  getActivePageFromDerived,
  getAllChaptersFromDerived,
  getChapterListForViewFromDerived,
  getDerivedBookForChapterFromDerived,
  getDerivedBookForPageFromDerived,
  getDerivedChapterForPageFromDerived,
  getLoosePagesListFromDerived,
  getNavigationMetadata,
  getPageListForViewFromDerived,
  getParentView,
  getSidebarBookId,
  getSidebarChapterId,
  getSortedBooksFromDerived
} from '../store/librarySelectors';
import { useDebouncedEffect } from './useDebouncedEffect';
import { useLibraryTrashActions } from './useLibraryTrashActions';
import { buildSearchIndex, normalizeSearchQuery, parseSearchInput, searchPages, searchTrashedEntities } from '../utils/search';
import { isLoosePage } from '../utils/pageState';
import {
  DEFAULT_SHORTCUTS,
  eventMatchesShortcut,
  isTypingInEditableTarget,
  normalizeShortcutSettings
} from '../utils/shortcuts';
import { formatTagQuery, normalizeTag, normalizeTagList, parseSingleTagInput, parseTagQuery } from '../utils/tags';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings, RECENT_PAGES_LIMIT } from '../utils/appSettings';
import {
  createBackupFileName,
  createBackupPayload,
  createBackupSummary,
  createSafetyBackupSnapshot,
  createPageExportFile,
  downloadJsonFile,
  downloadPlainTextFile,
  readBackupFile,
  validateBackupPayload,
  type BackupImportPreview,
  type BackupSafetySnapshot,
  type ValidatedBackupPayload
} from '../utils/backup';
import { getStorageFailureDetails } from '../utils/storageError';

const DESKTOP_WIDTH = 920;
const PERSISTENCE_DELAY_MS = 300;

interface BackupStatus {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
  warnings?: string[];
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
  const [restoreSafetySnapshot, setRestoreSafetySnapshot] = useState<BackupSafetySnapshot | null>(null);
  const [restoreRecoverySnapshot, setRestoreRecoverySnapshot] = useState<RestoreRecoverySnapshot | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const latestDataRef = useRef<LibraryData | null>(null);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const currentViewRef = useRef<ViewState>({ type: 'root' });
  const navigationHistoryRef = useRef<ViewState[]>([]);
  const latestDataVersionRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const saveStatusRef = useRef<SaveStatus>({ state: 'idle' });
  const shouldAutosaveDataRef = useRef(false);

  useEffect(() => {
    let canceled = false;

    async function hydrateApp(): Promise<void> {
      let nextData = emptyLibraryData;
      let nextSettings = DEFAULT_APP_SETTINGS;
      let storageFailure: SaveStatus | null = null;

      try {
        nextData = await hydrateLibraryData();
      } catch (error) {
        console.error('Failed to load library data', error);
        storageFailure = { state: 'failed', error: getStorageFailureDetails(error), canRetry: false };
      }

      try {
        nextSettings = await hydrateAppSettings();
      } catch (error) {
        console.error('Failed to load app settings', error);
        storageFailure = { state: 'failed', error: getStorageFailureDetails(error), canRetry: false };
      }

      let recoverySnapshot: RestoreRecoverySnapshot | null = null;
      try {
        recoverySnapshot = await loadRestoreRecoverySnapshot();
      } catch (error) {
        console.error('Failed to load restore recovery snapshot', error);
        storageFailure = { state: 'failed', error: getStorageFailureDetails(error), canRetry: false };
      }

      if (canceled) {
        return;
      }

      setData(nextData);
      setSettings(nextSettings);
      setSettingsHydrated(true);
      setRestoreRecoverySnapshot(recoverySnapshot);

      if (recoverySnapshot) {
        setBackupStatus({
          tone: 'warning',
          message:
            'LibNote found a previous library snapshot from an interrupted or failed restore. Review it in Backup & Restore before deleting it.'
        });
        setAppMenuSection('backup');
      }

      if (storageFailure) {
        setSaveStatus(storageFailure);
      }
    }

    void hydrateApp();

    return () => {
      canceled = true;
    };
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
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

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

      if (!shouldAutosaveDataRef.current) {
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
        void persistLibrarySnapshot(latestData, latestDataVersionRef.current, { includeSettings: true });
        return;
      }

      void saveAppSettings(latestSettingsRef.current);
    };

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, [data]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeLeaving(saveStatusRef.current)) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, []);

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

  const derivedData = useMemo(() => (data ? buildLibraryDerivedData(data) : null), [data]);
  const books = useMemo(() => (derivedData ? getSortedBooksFromDerived(derivedData) : []), [derivedData]);
  const loosePages = useMemo(() => (derivedData ? getLoosePagesListFromDerived(derivedData) : []), [derivedData]);
  const activeBook = useMemo(() => (derivedData ? getActiveBookFromDerived(derivedData, view) : undefined), [derivedData, view]);
  const activeChapter = useMemo(
    () => (derivedData ? getActiveChapterFromDerived(derivedData, view) : undefined),
    [derivedData, view]
  );
  const activePage = useMemo(() => (derivedData ? getActivePageFromDerived(derivedData, view) : undefined), [derivedData, view]);
  const derivedBookForChapter = useMemo(
    () => (derivedData ? getDerivedBookForChapterFromDerived(derivedData, activeChapter) : undefined),
    [activeChapter, derivedData]
  );
  const derivedChapterForPage = useMemo(
    () => (derivedData ? getDerivedChapterForPageFromDerived(derivedData, activePage) : undefined),
    [activePage, derivedData]
  );
  const derivedBookForPage = useMemo(
    () => (derivedData ? getDerivedBookForPageFromDerived(derivedData, derivedChapterForPage) : undefined),
    [derivedData, derivedChapterForPage]
  );
  const chapterList = useMemo(
    () =>
      derivedData
        ? getChapterListForViewFromDerived(derivedData, view, activeBook, activeChapter, derivedBookForPage)
        : [],
    [activeBook, activeChapter, derivedBookForPage, derivedData, view]
  );
  const pageList = useMemo(
    () => (derivedData ? getPageListForViewFromDerived(derivedData, view, activeChapter, derivedChapterForPage) : []),
    [activeChapter, derivedChapterForPage, derivedData, view]
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
  const allChapters = useMemo(() => (derivedData ? getAllChaptersFromDerived(derivedData) : []), [derivedData]);
  const initialMoveBookId = books[0]?.id ?? '';
  const trashItems = derivedData?.trashItems ?? [];
  const {
    handleDeleteBook,
    handleDeleteChapter,
    handleDeletePage,
    handleRestoreTrashItem,
    handleDeleteTrashItemForever,
    handleEmptyTrash
  } = useLibraryTrashActions({ data, updateData, replaceView, setSettings });

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

    const livePageById = derivedData?.livePageById;
    if (!livePageById) {
      return;
    }

    const cleanedRecentPageIds = settings.recentPageIds.filter((pageId) => livePageById.has(pageId));

    if (!areStringArraysEqual(cleanedRecentPageIds, settings.recentPageIds)) {
      setSettings((currentSettings) => ({
        ...currentSettings,
        recentPageIds: currentSettings.recentPageIds.filter((pageId) => livePageById.has(pageId))
      }));
    }
  }, [data, derivedData, settings.recentPageIds, settingsHydrated]);

  function runIfDataLoaded(callback: (currentData: LibraryData) => void): void {
    if (!data) {
      return;
    }

    callback(data);
  }

  function updateData(nextData: LibraryData): void {
    shouldAutosaveDataRef.current = true;
    setSaveStatus((currentStatus) => (currentStatus.state === 'failed' ? currentStatus : { state: 'unsaved' }));
    setData(nextData);
  }

  async function persistLibrarySnapshot(
    snapshot: LibraryData,
    dataVersion: number,
    options?: { includeSettings?: boolean; isRetry?: boolean }
  ): Promise<void> {
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaveStatus({ state: options?.isRetry ? 'retrying' : 'saving' });

    try {
      await persistLibraryData(snapshot);
      if (options?.includeSettings) {
        await saveAppSettings(latestSettingsRef.current);
      }

      if (requestId === saveRequestIdRef.current && dataVersion === latestDataVersionRef.current) {
        shouldAutosaveDataRef.current = false;
        setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      }
    } catch (error) {
      console.error('Failed to save library data', error);

      if (requestId === saveRequestIdRef.current && dataVersion === latestDataVersionRef.current) {
        setSaveStatus({
          state: 'failed',
          error: getStorageFailureDetails(error)
        });
      }
    }
  }

  function retryLibrarySave(): void {
    const latestData = latestDataRef.current;
    if (!latestData) {
      return;
    }

    void persistLibrarySnapshot(latestData, latestDataVersionRef.current, { includeSettings: true, isRetry: true });
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

  function handleUpdateBookCover(bookId: string, coverId: string): void {
    if (!data) {
      return;
    }

    updateData(updateBookCover(data, bookId, coverId));
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

    const normalizedOldTag = parseSingleTagInput(oldTag);
    const normalizedNewTag = parseSingleTagInput(newTag);

    updateData(renameTagEverywhere(data, oldTag, newTag));
    if (normalizedOldTag && normalizedNewTag) {
      setRecentTags((currentTags) =>
        normalizeTagList(currentTags.map((tag) => (tag === normalizedOldTag ? normalizedNewTag : tag)))
      );
    }
  }

  function handleDeleteTagEverywhere(tag: string): void {
    if (!data) {
      return;
    }

    const normalizedTag = parseSingleTagInput(tag);

    updateData(deleteTagEverywhere(data, tag));
    if (normalizedTag) {
      setRecentTags((currentTags) => currentTags.filter((currentTag) => currentTag !== normalizedTag));
    }
  }

  function handleMergeTags(sourceTag: string, targetTag: string): void {
    if (!data) {
      return;
    }

    const normalizedSourceTag = parseSingleTagInput(sourceTag);
    const normalizedTargetTag = parseSingleTagInput(targetTag);

    updateData(mergeTags(data, sourceTag, targetTag));
    if (normalizedSourceTag && normalizedTargetTag) {
      setRecentTags((currentTags) =>
        normalizeTagList(currentTags.map((tag) => (tag === normalizedSourceTag ? normalizedTargetTag : tag)))
      );
    }
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

  function handleUpdateLibraryShelfStyle(shelfStyle: LibraryShelfStyle): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      libraryView: {
        ...currentSettings.libraryView,
        shelfStyle
      }
    }));
  }

  function handleUpdateTheme(theme: AppThemeId): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      theme
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
      message: 'Backup created successfully. Check your browser downloads or Downloads folder.'
    });
  }

  function handleDownloadRestoreSafetySnapshot(): void {
    if (!restoreSafetySnapshot) {
      setBackupStatus({
        tone: 'info',
        message: 'No restore safety backup is available yet. Export the current library before restoring if you want a copy.'
      });
      return;
    }

    downloadJsonFile(restoreSafetySnapshot.filename, restoreSafetySnapshot.payload);
    setBackupStatus({
      tone: 'success',
      message: 'Safety backup downloaded. This is a copy of the library that was active before the restore attempt.'
    });
  }

  async function handlePreviewBackupImport(file: File | null): Promise<BackupImportPreview | null> {
    if (!file) {
      setBackupStatus({ tone: 'info', message: 'No file selected.' });
      return null;
    }

    try {
      const rawPayload = await readBackupFile(file);
      const validated = validateBackupPayload(rawPayload);
      const preview = {
        fileName: file.name,
        summary: createBackupSummary(validated),
        validated,
        warnings: validated.warnings
      };

      setBackupStatus({
        tone: validated.warnings.length > 0 ? 'warning' : 'info',
        message:
          validated.warnings.length > 0
            ? 'Backup parsed with warnings. Review the preview before restoring.'
            : 'Backup parsed successfully. Review the preview before restoring.',
        warnings: validated.warnings
      });
      setRestoreSafetySnapshot(null);

      return preview;
    } catch (error) {
      setBackupStatus({
        tone: 'error',
        message: `Backup import failed: ${error instanceof Error ? error.message : 'invalid backup file.'}`
      });
      return null;
    }
  }

  async function handleRestoreBackupImport(validated: ValidatedBackupPayload): Promise<boolean> {
    const previousData = latestDataRef.current;
    const previousSettings = latestSettingsRef.current;
    const safetySnapshot = previousData ? createSafetyBackupSnapshot(previousData, previousSettings) : null;
    const recoverySnapshot: RestoreRecoverySnapshot | null = previousData
      ? {
          kind: 'restore-recovery-snapshot',
          createdAt: new Date().toISOString(),
          data: previousData,
          settings: previousSettings
        }
      : null;

    setRestoreSafetySnapshot(safetySnapshot);

    try {
      const nextData = validated.data;
      const nextSettings =
        validated.settingsStatus === 'restored'
          ? validated.settings
          : filterRecentPageIdsForLibrary(DEFAULT_APP_SETTINGS, nextData.pages.map((page) => page.id));

      if (recoverySnapshot) {
        await saveRestoreRecoverySnapshot(recoverySnapshot);
        setRestoreRecoverySnapshot(recoverySnapshot);
      }

      try {
        await persistLibraryData(nextData);
      } catch (error) {
        throw createRestoreStageError('library', error);
      }

      try {
        await saveAppSettings(nextSettings);
      } catch (error) {
        throw createRestoreStageError('settings', error);
      }

      if (recoverySnapshot) {
        try {
          await clearRestoreRecoverySnapshot();
        } catch (error) {
          throw createRestoreStageError('cleanup', error);
        }
      }

      latestDataRef.current = nextData;
      latestSettingsRef.current = nextSettings;
      shouldAutosaveDataRef.current = false;
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
      setRestoreSafetySnapshot(null);
      setRestoreRecoverySnapshot(null);
      replaceView({ type: 'root' });
      setBackupStatus({
        tone: validated.warnings.length > 0 ? 'warning' : 'success',
        message:
          validated.warnings.length > 0
            ? 'Restore completed with warnings.'
            : 'Restore completed successfully.',
        warnings: validated.warnings
      });
      return true;
    } catch (error) {
      if (previousData) {
        latestDataRef.current = previousData;
        shouldAutosaveDataRef.current = false;
        setData(previousData);
      }

      latestSettingsRef.current = previousSettings;
      setSettings(previousSettings);
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(getRestoreStageCause(error))
      });
      setBackupStatus({
        tone: 'error',
        message:
          `${getRestoreFailureMessage(error)} ` +
          'A restore recovery snapshot is saved in this browser so you can recover the previous library after refresh.'
      });
      return false;
    }
  }

  async function handleRecoverRestoreSnapshot(): Promise<boolean> {
    const snapshot = restoreRecoverySnapshot;
    if (!snapshot) {
      setBackupStatus({ tone: 'info', message: 'No restore recovery snapshot is available.' });
      return false;
    }

    if (
      !window.confirm(
        'Recover the previous library from the restore recovery snapshot? This will replace the library currently open in this browser.'
      )
    ) {
      return false;
    }

    try {
      const recoverySettings = filterRecentPageIdsForLibrary(
        normalizeAppSettings(snapshot.settings),
        snapshot.data.pages.map((page) => page.id)
      );

      try {
        await persistLibraryData(snapshot.data);
      } catch (error) {
        throw createRestoreStageError('library', error);
      }

      try {
        await saveAppSettings(recoverySettings);
      } catch (error) {
        throw createRestoreStageError('settings', error);
      }

      await clearRestoreRecoverySnapshot();

      latestDataRef.current = snapshot.data;
      latestSettingsRef.current = recoverySettings;
      shouldAutosaveDataRef.current = false;
      setData(snapshot.data);
      setSettings(recoverySettings);
      setSearchQuery('');
      setRecentTags([]);
      setSearchOriginView({ type: 'root' });
      setTagOriginView({ type: 'root' });
      setNavigationHistory([]);
      navigationHistoryRef.current = [];
      setMovingChapterId(null);
      setMovingPageId(null);
      setRestoreRecoverySnapshot(null);
      setRestoreSafetySnapshot(null);
      setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      replaceView({ type: 'root' });
      setBackupStatus({ tone: 'success', message: 'Previous library recovered from the restore recovery snapshot.' });
      return true;
    } catch (error) {
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(getRestoreStageCause(error))
      });
      setBackupStatus({
        tone: 'error',
        message: `${getRestoreRecoveryFailureMessage(error)} The recovery snapshot was kept so you can try again.`
      });
      return false;
    }
  }

  async function handleDismissRestoreRecoverySnapshot(): Promise<boolean> {
    const snapshot = restoreRecoverySnapshot;
    if (!snapshot) {
      setBackupStatus({ tone: 'info', message: 'No restore recovery snapshot is available.' });
      return false;
    }

    if (
      !window.confirm(
        'Delete the restore recovery snapshot? This only removes the saved recovery copy; it will not change your current library.'
      )
    ) {
      return false;
    }

    try {
      await clearRestoreRecoverySnapshot();
      setRestoreRecoverySnapshot(null);
      setBackupStatus({ tone: 'info', message: 'Restore recovery snapshot dismissed. Your current library was not changed.' });
      return true;
    } catch (error) {
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(error)
      });
      setBackupStatus({
        tone: 'error',
        message: `Could not delete the restore recovery snapshot: ${error instanceof Error ? error.message : 'unknown storage error.'}`
      });
      return false;
    }
  }

  function handleCancelBackupImport(): void {
    setRestoreSafetySnapshot(null);
    setBackupStatus({ tone: 'info', message: 'Restore canceled. Your current library was not changed.' });
  }

  function handleExportPage(pageId: string): void {
    if (!data) {
      return;
    }

    const page = derivedData?.pageById.get(pageId);
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
    restoreSafetySnapshot,
    restoreRecoverySnapshot,
    saveStatus,
    recentPageIds: settings.recentPageIds,
    derivedData,
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
    handleUpdateBookCover,
    handleRenameChapter,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize,
    handleUpdatePageTags,
    handleRenameTagEverywhere,
    handleDeleteTagEverywhere,
    handleMergeTags,
    handleUpdateTheme,
    handleUpdateLibraryBooksPerRow,
    handleUpdateLibraryShelfStyle,
    handleUpdateShortcut,
    handleResetShortcut,
    handleResetAllShortcuts,
    handleExportLibrary,
    handleDownloadRestoreSafetySnapshot,
    handleRecoverRestoreSnapshot,
    handleDismissRestoreRecoverySnapshot,
    handlePreviewBackupImport,
    handleRestoreBackupImport,
    handleCancelBackupImport,
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

type RestoreStage = 'library' | 'settings' | 'cleanup';

interface RestoreStageError extends Error {
  stage: RestoreStage;
  cause: unknown;
}

function createRestoreStageError(stage: RestoreStage, cause: unknown): RestoreStageError {
  const stageLabel =
    stage === 'library'
      ? 'library data'
      : stage === 'settings'
        ? 'settings'
        : 'restore recovery cleanup';
  const causeMessage = cause instanceof Error ? cause.message : 'unknown storage error';
  const error = new Error(`Restore failed while saving ${stageLabel}: ${causeMessage}`) as RestoreStageError;
  error.stage = stage;
  error.cause = cause;
  return error;
}

function isRestoreStageError(error: unknown): error is RestoreStageError {
  return error instanceof Error && 'stage' in error && 'cause' in error;
}

function getRestoreStageCause(error: unknown): unknown {
  return isRestoreStageError(error) ? error.cause : error;
}

function getRestoreFailureMessage(error: unknown): string {
  if (!isRestoreStageError(error)) {
    return `Restore failed while saving: ${error instanceof Error ? error.message : 'unknown storage error.'}`;
  }

  if (error.stage === 'library') {
    return `Restore failed before the library replacement was saved: ${getCauseMessage(error.cause)}`;
  }

  if (error.stage === 'settings') {
    return `Restore saved the library data but failed before settings were saved: ${getCauseMessage(error.cause)}`;
  }

  return `Restore saved the library and settings, but could not clear the recovery snapshot: ${getCauseMessage(error.cause)}`;
}

function getRestoreRecoveryFailureMessage(error: unknown): string {
  if (!isRestoreStageError(error)) {
    return `Recovery failed: ${error instanceof Error ? error.message : 'unknown storage error.'}`;
  }

  if (error.stage === 'library') {
    return `Recovery failed before the previous library was saved: ${getCauseMessage(error.cause)}`;
  }

  if (error.stage === 'settings') {
    return `Recovery saved the previous library but failed before settings were saved: ${getCauseMessage(error.cause)}`;
  }

  return `Recovery restored the previous library but could not delete the recovery snapshot: ${getCauseMessage(error.cause)}`;
}

function getCauseMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'unknown storage error.';
}

async function hydrateAppSettings(): Promise<AppSettings> {
  const persistedSettings = await loadAppSettings();
  return normalizeAppSettings(persistedSettings);
}

function shouldWarnBeforeLeaving(saveStatus: SaveStatus): boolean {
  return (
    saveStatus.state === 'unsaved' ||
    saveStatus.state === 'saving' ||
    saveStatus.state === 'retrying' ||
    saveStatus.state === 'failed'
  );
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
