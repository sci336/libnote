import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  LibraryData,
  Page,
  SaveStatus,
  ViewState
} from '../types/domain';
import {
  loadAppSettings,
  loadRestoreRecoverySnapshot,
  saveAppSettings,
  type RestoreRecoverySnapshot
} from '../db/indexedDb';
import { hydrateLibraryData, emptyLibraryData, persistLibraryData } from '../store/libraryStore';
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
import { useLibraryAppMenu } from './useLibraryAppMenu';
import { useLibraryBackupActions } from './useLibraryBackupActions';
import { useLibraryBookActions } from './useLibraryBookActions';
import { useLibraryChapterActions } from './useLibraryChapterActions';
import { useLibraryPageActions } from './useLibraryPageActions';
import { useLibrarySearchAndTags } from './useLibrarySearchAndTags';
import { useLibrarySettingsActions } from './useLibrarySettingsActions';
import { useLibraryShortcuts } from './useLibraryShortcuts';
import { useLibraryTagActions } from './useLibraryTagActions';
import { useLibraryTrashActions } from './useLibraryTrashActions';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from '../utils/appSettings';
import { getStorageFailureDetails } from '../utils/storageError';

const DESKTOP_WIDTH = 920;
const PERSISTENCE_DELAY_MS = 300;

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
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const latestDataRef = useRef<LibraryData | null>(null);
  const latestSettingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const currentViewRef = useRef<ViewState>({ type: 'root' });
  const navigationHistoryRef = useRef<ViewState[]>([]);
  const latestDataVersionRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const saveStatusRef = useRef<SaveStatus>({ state: 'idle' });
  const shouldAutosaveDataRef = useRef(false);
  const {
    appMenuOpen,
    appMenuSection,
    setAppMenuOpen,
    setAppMenuSection,
    openAppMenu,
    closeAppMenu,
    navigateAppMenu
  } = useLibraryAppMenu({ closeSidebarOnMobile });
  const {
    searchQuery,
    searchOriginView,
    tagOriginView,
    recentTags,
    searchResults,
    trashSearchResults,
    searchMode,
    resetSearchAndTags,
    handleSearchChange,
    handleSearchFocus,
    handleOpenTag,
    handleRemoveActiveTag,
    renameRecentTag,
    deleteRecentTag,
    mergeRecentTags
  } = useLibrarySearchAndTags({
    data,
    view,
    navigateToView,
    replaceView,
    closeSidebarOnMobile
  });
  const {
    backupStatus,
    restoreSafetySnapshot,
    restoreRecoverySnapshot,
    setBackupStatus,
    setRestoreRecoverySnapshot,
    handleExportLibrary,
    handleDownloadRestoreSafetySnapshot,
    handleRecoverRestoreSnapshot,
    handleDismissRestoreRecoverySnapshot,
    handlePreviewBackupImport,
    handleRestoreBackupImport,
    handleMergeBackupImport,
    handleCancelBackupImport,
    handleExportPage
  } = useLibraryBackupActions({
    data,
    latestDataRef,
    latestSettingsRef,
    shouldAutosaveDataRef,
    setData,
    setSettings,
    setSaveStatus,
    getPageById: getExportablePageById,
    resetAfterLibraryReplacement
  });

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
        // A restore may have replaced IndexedDB before the UI finished cleanup.
        // Surface the recovery copy loudly so the user can roll back instead of
        // discovering the snapshot only after another failed save.
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
  const {
    handleRenameTagEverywhere,
    handleDeleteTagEverywhere,
    handleMergeTags
  } = useLibraryTagActions({
    data,
    updateData,
    renameRecentTag,
    deleteRecentTag,
    mergeRecentTags
  });
  const {
    handleCreatePage,
    handleCreateLoosePage,
    handleCreatePageFromLink,
    handleReorderPages,
    handleMovePage,
    handleMoveLoosePage,
    handleRenamePage,
    handleUpdatePageContent,
    handleUpdatePageTextSize,
    handleUpdatePageTags
  } = useLibraryPageActions({
    data,
    activePageId: activePage?.id,
    livePageById: derivedData?.livePageById,
    recentPageIds: settings.recentPageIds,
    settingsHydrated,
    updateData,
    navigateToView,
    replaceView,
    setSettings,
    setShouldAutoFocusEditor,
    setMovingPageId
  });
  const {
    handleCreateChapter,
    handleReorderChapters,
    handleMoveChapter,
    handleRenameChapter
  } = useLibraryChapterActions({
    data,
    updateData,
    navigateToView,
    setMovingChapterId
  });
  const {
    handleCreateBook,
    handleReorderBooks,
    handleRenameBook,
    handleUpdateBookCover
  } = useLibraryBookActions({
    data,
    updateData,
    navigateToView
  });
  const {
    handleUpdateLibraryBooksPerRow,
    handleUpdateLibraryShelfStyle,
    handleUpdateTheme,
    handleUpdateShortcut,
    handleResetShortcut,
    handleResetAllShortcuts
  } = useLibrarySettingsActions({ setSettings });

  function updateData(nextData: LibraryData): void {
    shouldAutosaveDataRef.current = true;
    // Keep failed save status visible until a current save succeeds, so users
    // do not lose warning context after another edit.
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

      // Older writes can finish after newer edits. Only the latest request for
      // the current data version is allowed to clear the unsaved/failed state.
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

  function resetAfterLibraryReplacement(nextData: LibraryData, nextSettings: AppSettings): void {
    // Restore and recovery replace the whole library graph. Reset route-scoped
    // UI state so stale page/chapter ids from the old graph cannot stay active.
    latestDataRef.current = nextData;
    latestSettingsRef.current = nextSettings;
    shouldAutosaveDataRef.current = false;
    setData(nextData);
    setSettings(nextSettings);
    resetSearchAndTags();
    setNavigationHistory([]);
    navigationHistoryRef.current = [];
    setMovingChapterId(null);
    setMovingPageId(null);
    replaceView({ type: 'root' });
  }

  function getExportablePageById(pageId: string): Page | undefined {
    return derivedData?.pageById.get(pageId);
  }

  function navigateToView(
    nextView: ViewState,
    options?: { pushHistory?: boolean; shouldCloseSidebar?: boolean }
  ): void {
    const currentView = currentViewRef.current;
    const shouldPushHistory = options?.pushHistory ?? !areViewsEqual(currentView, nextView);

    // The app uses lightweight view objects rather than a router. Keep an
    // explicit stack so search/tag flows can still return to their entry point.
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

  useLibraryShortcuts({
    appMenuOpen,
    shortcuts: settings.shortcuts,
    sidebarChapterId,
    handleCreateLoosePage,
    handleCreatePage,
    setSidebarOpen,
    navigateHome,
    navigateBack
  });

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
    handleMergeBackupImport,
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
