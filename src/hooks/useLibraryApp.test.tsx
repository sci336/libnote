import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibraryApp } from './useLibraryApp';
import type { AppSettings, LibraryData } from '../types/domain';
import { DEFAULT_APP_SETTINGS } from '../utils/appSettings';
import { createBackupPayload, validateBackupPayload } from '../utils/backup';
import { buildLargeLibraryFixture } from '../test/largeLibrary';

const dbMocks = vi.hoisted(() => ({
  loadLibraryDataMock: vi.fn<() => Promise<LibraryData | null>>(),
  saveLibraryDataMock: vi.fn<(data: LibraryData) => Promise<void>>(),
  loadAppSettingsMock: vi.fn<() => Promise<AppSettings | null>>(),
  saveAppSettingsMock: vi.fn<() => Promise<void>>(),
  loadRestoreRecoverySnapshotMock: vi.fn(),
  saveRestoreRecoverySnapshotMock: vi.fn(),
  clearRestoreRecoverySnapshotMock: vi.fn()
}));

vi.mock('../db/indexedDb', () => ({
  loadLibraryData: dbMocks.loadLibraryDataMock,
  saveLibraryData: dbMocks.saveLibraryDataMock,
  loadAppSettings: dbMocks.loadAppSettingsMock,
  saveAppSettings: dbMocks.saveAppSettingsMock,
  loadRestoreRecoverySnapshot: dbMocks.loadRestoreRecoverySnapshotMock,
  saveRestoreRecoverySnapshot: dbMocks.saveRestoreRecoverySnapshotMock,
  clearRestoreRecoverySnapshot: dbMocks.clearRestoreRecoverySnapshotMock
}));

type LibraryAppApi = ReturnType<typeof useLibraryApp>;

describe('useLibraryApp persistence', () => {
  let container: HTMLDivElement;
  let root: Root;
  let app: LibraryAppApi | null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    dbMocks.loadLibraryDataMock.mockResolvedValue(null);
    dbMocks.saveLibraryDataMock.mockResolvedValue(undefined);
    dbMocks.loadAppSettingsMock.mockResolvedValue(null);
    dbMocks.saveAppSettingsMock.mockResolvedValue(undefined);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue(null);
    dbMocks.saveRestoreRecoverySnapshotMock.mockResolvedValue(undefined);
    dbMocks.clearRestoreRecoverySnapshotMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    app = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('surfaces IndexedDB open failures instead of staying stuck on load', async () => {
    dbMocks.loadLibraryDataMock.mockRejectedValue(new DOMException('IndexedDB blocked', 'SecurityError'));

    await renderHarness();

    expect(app?.data).toEqual({ books: [], chapters: [], pages: [] });
    expect(app?.saveStatus).toMatchObject({
      state: 'failed',
      canRetry: false,
      error: {
        title: 'LibNote could not save locally.',
        recovery: 'If these changes are important, export a backup before closing or refreshing.'
      }
    });
    expect(app?.saveStatus.state === 'failed' ? app.saveStatus.error.suggestion : '').toContain('leave private browsing');

    await advanceAutosave();

    expect(dbMocks.saveLibraryDataMock).not.toHaveBeenCalled();
  });

  it('moves from unsaved to failed when an autosave write fails', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValue(new Error('Write failed'));
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });

    expect(app?.saveStatus).toEqual({ state: 'unsaved' });

    await advanceAutosave();

    expect(app?.saveStatus).toMatchObject({
      state: 'failed',
      error: {
        title: 'LibNote could not save locally.',
        message: 'Your latest changes are still open here, but they may not be saved in this browser yet.'
      }
    });
    expect(app?.data?.pages).toEqual([expect.objectContaining({ title: 'Untitled Loose Page' })]);
  });

  it('maps quota autosave failures to quota guidance', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'));
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });

    await advanceAutosave();

    expect(app?.saveStatus.state).toBe('failed');
    expect(app?.saveStatus.state === 'failed' ? app.saveStatus.error.message : '').toContain('storage appears to be full');
    expect(app?.saveStatus.state === 'failed' ? app.saveStatus.error.suggestion : '').toContain('free browser storage');
  });

  it('supports retrying a failed save', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValueOnce(new Error('Write failed')).mockResolvedValue(undefined);
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();
    expect(app?.saveStatus.state).toBe('failed');

    await act(async () => {
      app?.retryLibrarySave();
      await Promise.resolve();
    });

    expect(app?.saveStatus).toEqual({ state: 'saved', lastSavedAt: expect.any(Number) });
    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledTimes(2);
  });

  it('does not let a stale successful save overwrite newer unsaved changes', async () => {
    const firstSave = createDeferred<void>();
    dbMocks.saveLibraryDataMock.mockImplementationOnce(() => firstSave.promise).mockResolvedValue(undefined);
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();
    expect(app?.saveStatus.state).toBe('saving');

    act(() => {
      app?.handleCreateLoosePage();
    });
    expect(app?.saveStatus).toEqual({ state: 'unsaved' });

    await act(async () => {
      firstSave.resolve();
      await firstSave.promise;
      await Promise.resolve();
    });

    expect(app?.saveStatus).toEqual({ state: 'unsaved' });

    await advanceAutosave();

    expect(app?.saveStatus).toEqual({ state: 'saved', lastSavedAt: expect.any(Number) });
    expect(dbMocks.saveLibraryDataMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pages: [
          expect.objectContaining({ title: 'Untitled Loose Page' }),
          expect.objectContaining({ title: 'Untitled Loose Page' })
        ]
      })
    );
  });

  it('keeps failed save state visible across more edits until retry saves the latest data and settings', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValueOnce(new Error('Write failed')).mockResolvedValue(undefined);
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();
    expect(app?.saveStatus.state).toBe('failed');

    const pageId = app?.data?.pages[0].id;
    act(() => {
      if (pageId) {
        app?.handleUpdatePageContent(pageId, '<p>Latest after failure</p>');
      }
      app?.handleUpdateTheme('dark-archive');
    });

    expect(app?.saveStatus.state).toBe('failed');

    dbMocks.saveAppSettingsMock.mockClear();
    await act(async () => {
      app?.retryLibrarySave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(app?.saveStatus).toEqual({ state: 'saved', lastSavedAt: expect.any(Number) });
    expect(dbMocks.saveLibraryDataMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pages: [expect.objectContaining({ content: '<p>Latest after failure</p>' })]
      })
    );
    expect(dbMocks.saveAppSettingsMock).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark-archive' }));
  });

  it('does not clear failed save state on navigation or view changes', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValue(new Error('Write failed'));
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();
    expect(app?.saveStatus.state).toBe('failed');

    act(() => {
      app?.handleOpenLoosePages();
      app?.navigateHome();
      app?.openAppMenu('backup');
      app?.closeAppMenu();
    });

    expect(app?.saveStatus.state).toBe('failed');
  });

  it('pushes book, chapter, and page openings into history and walks back in order', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleOpenBook('book-a');
    });

    expect(app?.view).toEqual({ type: 'book', bookId: 'book-a' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }]);

    act(() => {
      app?.handleOpenChapter('chapter-a');
    });

    expect(app?.view).toEqual({ type: 'chapter', chapterId: 'chapter-a' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'book', bookId: 'book-a' }]);

    act(() => {
      app?.handleOpenPage('page-a');
    });

    expect(app?.view).toEqual({ type: 'page', pageId: 'page-a' });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: 'book-a' },
      { type: 'chapter', chapterId: 'chapter-a' }
    ]);

    act(() => {
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'chapter', chapterId: 'chapter-a' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'book', bookId: 'book-a' }]);

    act(() => {
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'book', bookId: 'book-a' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }]);

    act(() => {
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'root' });
    expect(app?.navigationHistory).toEqual([]);
  });

  it('keeps home, loose pages, and trash navigation behavior unchanged', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleOpenLoosePages();
    });

    expect(app?.view).toEqual({ type: 'loosePages' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }]);

    act(() => {
      app?.handleOpenTrash();
    });

    expect(app?.view).toEqual({ type: 'trash' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'loosePages' }]);

    act(() => {
      app?.navigateHome();
    });

    expect(app?.view).toEqual({ type: 'root' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'loosePages' }, { type: 'trash' }]);

    act(() => {
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'trash' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'loosePages' }]);
  });

  it('navigates after creating books, chapters, and pages with the current history behavior', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleCreateBook();
    });

    const createdBookId = app?.data?.books.find((book) => book.title === 'Untitled Book')?.id;
    expect(app?.view).toEqual({ type: 'book', bookId: createdBookId });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }]);

    act(() => {
      app?.handleCreateChapter('book-a');
    });

    const createdChapterId = app?.data?.chapters.find((chapter) => chapter.title === 'Untitled Chapter')?.id;
    expect(app?.view).toEqual({ type: 'chapter', chapterId: createdChapterId });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'book', bookId: createdBookId }]);

    act(() => {
      app?.handleCreatePage('chapter-a');
    });

    const createdPageId = app?.data?.pages.find((page) => page.title === 'Untitled Page')?.id;
    expect(app?.view).toEqual({ type: 'page', pageId: createdPageId });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: createdBookId },
      { type: 'chapter', chapterId: createdChapterId }
    ]);
    expect(app?.shouldAutoFocusEditor).toBe(false);
  });

  it('moves a loose page into a chapter with replaceView and does not add a history entry', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleOpenLoosePages();
      app?.handleOpenPage('loose-page');
    });

    expect(app?.view).toEqual({ type: 'page', pageId: 'loose-page' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'loosePages' }]);

    act(() => {
      app?.handleMoveLoosePage('loose-page', { chapterId: 'chapter-b' });
    });

    expect(app?.view).toEqual({ type: 'chapter', chapterId: 'chapter-b' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'loosePages' }]);

    act(() => {
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'loosePages' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }]);
  });

  it('trashing active pages uses current fallback views without adding history', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleOpenBook('book-a');
      app?.handleOpenChapter('chapter-a');
      app?.handleOpenPage('page-a');
    });

    const chapterPageHistory = app?.navigationHistory;

    act(() => {
      const page = app?.activePage;
      if (page) {
        app?.handleDeletePage(page);
      }
    });

    expect(app?.view).toEqual({ type: 'chapter', chapterId: 'chapter-a' });
    expect(app?.navigationHistory).toEqual(chapterPageHistory);

    act(() => {
      app?.handleOpenLoosePages();
      app?.handleOpenPage('loose-page');
    });

    const loosePageHistory = app?.navigationHistory;

    act(() => {
      const page = app?.activePage;
      if (page) {
        app?.handleDeletePage(page);
      }
    });

    expect(app?.view).toEqual({ type: 'loosePages' });
    expect(app?.navigationHistory).toEqual(loosePageHistory);

    confirmSpy.mockRestore();
  });

  it('preserves search and tag origin history when opening results and going back', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue(buildNavigationLibraryData());
    await renderHarness();

    act(() => {
      app?.handleOpenBook('book-a');
    });

    act(() => {
      app?.handleOpenChapter('chapter-a');
    });

    act(() => {
      app?.handleSearchFocus();
    });

    act(() => {
      app?.handleSearchChange('Page A');
    });

    expect(app?.view).toEqual({ type: 'search', query: 'Page A' });
    expect(app?.searchOriginView).toEqual({ type: 'chapter', chapterId: 'chapter-a' });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: 'book-a' },
      { type: 'chapter', chapterId: 'chapter-a' }
    ]);

    act(() => {
      app?.handleOpenPage('page-a');
    });

    expect(app?.view).toEqual({ type: 'page', pageId: 'page-a' });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: 'book-a' },
      { type: 'chapter', chapterId: 'chapter-a' },
      { type: 'search', query: 'Page A' }
    ]);

    act(() => {
      app?.navigateBack();
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'chapter', chapterId: 'chapter-a' });
    expect(app?.navigationHistory).toEqual([{ type: 'root' }, { type: 'book', bookId: 'book-a' }]);

    act(() => {
      app?.handleOpenPage('page-a');
    });

    act(() => {
      app?.handleOpenTag('history');
    });

    expect(app?.view).toEqual({ type: 'tag', tags: ['history'] });
    expect(app?.tagOriginView).toEqual({ type: 'page', pageId: 'page-a' });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: 'book-a' },
      { type: 'chapter', chapterId: 'chapter-a' },
      { type: 'page', pageId: 'page-a' }
    ]);

    act(() => {
      app?.handleOpenPage('page-b');
      app?.navigateBack();
    });

    expect(app?.view).toEqual({ type: 'tag', tags: ['history'] });
    expect(app?.navigationHistory).toEqual([
      { type: 'root' },
      { type: 'book', bookId: 'book-a' },
      { type: 'chapter', chapterId: 'chapter-a' },
      { type: 'page', pageId: 'page-a' }
    ]);
  });

  it('warns before unload while dirty changes are waiting for autosave', async () => {
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });

    const dirtyUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyUnload);

    expect(dirtyUnload.defaultPrevented).toBe(true);
  });

  it('pagehide flush attempts to save the latest data and settings immediately', async () => {
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
      app?.handleUpdateTheme('warm-study');
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: [expect.objectContaining({ title: 'Untitled Loose Page' })]
      })
    );
    expect(dbMocks.saveAppSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ theme: 'warm-study' }));
  });

  it('pagehide flush failures leave the app in failed save state', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValue(new Error('Pagehide write failed'));
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(app?.saveStatus.state).toBe('failed');
  });

  it('warns before unload after a failed save and clears the warning after a successful retry', async () => {
    dbMocks.saveLibraryDataMock.mockRejectedValueOnce(new Error('Write failed')).mockResolvedValue(undefined);
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();

    const failedSaveUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(failedSaveUnload);
    expect(failedSaveUnload.defaultPrevented).toBe(true);

    await act(async () => {
      app?.retryLibrarySave();
      await Promise.resolve();
    });

    const savedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedUnload);
    expect(savedUnload.defaultPrevented).toBe(false);
  });

  it('still autosaves normal edits', async () => {
    await renderHarness();

    act(() => {
      app?.handleCreateLoosePage();
    });
    await advanceAutosave();

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: [expect.objectContaining({ title: 'Untitled Loose Page' })]
      })
    );
    expect(app?.saveStatus).toEqual({ state: 'saved', lastSavedAt: expect.any(Number) });
  });

  it('creates a safety snapshot and restores a valid backup', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const restoreData = buildLibraryData('restored', 'Restored Library');
    const validatedRestore = validateBackupPayload(createBackupPayload(restoreData, DEFAULT_APP_SETTINGS));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    await renderHarness();
    const activeCurrentData = app?.data;
    const activeCurrentSettings = app?.settings;

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.saveRestoreRecoverySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'restore-recovery-snapshot',
        data: activeCurrentData,
        settings: activeCurrentSettings
      })
    );
    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(validatedRestore.data);
    expect(dbMocks.clearRestoreRecoverySnapshotMock).toHaveBeenCalledTimes(1);
    expect(app?.data?.books[0].title).toBe('Restored Library');
    expect(app?.restoreRecoverySnapshot).toBeNull();
    expect(app?.restoreSafetySnapshot).toBeNull();
    expect(app?.backupStatus).toMatchObject({
      tone: 'success',
      message: 'Restore completed successfully.'
    });
  });

  it('restores only live recent pages from backup settings', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const restoreData = buildLibraryData('restored', 'Restored Library');
    const restoreSettings = {
      ...DEFAULT_APP_SETTINGS,
      recentPageIds: ['restored-page', 'missing-page']
    };
    const validatedRestore = validateBackupPayload(createBackupPayload(restoreData, restoreSettings));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    await renderHarness();

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.saveAppSettingsMock).toHaveBeenCalledWith({
      ...restoreSettings,
      recentPageIds: ['restored-page']
    });
    expect(app?.recentPageIds).toEqual(['restored-page']);
  });

  it('merges a backup into the current library without replacing settings or recent pages', async () => {
    const currentData = buildLibraryData('current', 'Math');
    const importData = buildLibraryData('import', 'Photography');
    const currentSettings = {
      ...DEFAULT_APP_SETTINGS,
      recentPageIds: ['current-page'],
      theme: 'dark-archive' as const
    };
    const importSettings = {
      ...DEFAULT_APP_SETTINGS,
      recentPageIds: ['import-page'],
      theme: 'warm-study' as const
    };
    const validatedImport = validateBackupPayload(createBackupPayload(importData, importSettings));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadAppSettingsMock.mockResolvedValue(currentSettings);
    await renderHarness();
    const activeCurrentData = app?.data;

    await act(async () => {
      const merged = await app?.handleMergeBackupImport(validatedImport);
      expect(merged).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.saveRestoreRecoverySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'restore-recovery-snapshot',
        data: activeCurrentData,
        settings: currentSettings
      })
    );
    expect(dbMocks.saveAppSettingsMock).not.toHaveBeenCalledWith(validatedImport.settings);
    expect(app?.data?.books.map((book) => book.title).sort()).toEqual(['Math', 'Photography']);
    expect(app?.settings).toMatchObject({
      theme: 'dark-archive',
      recentPageIds: ['current-page']
    });
    expect(app?.backupStatus?.message).toContain('Merge completed.');
  });

  it('keeps the previous library active and exposes a safety snapshot when restore persistence fails', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const restoreData = buildLibraryData('restored', 'Restored Library');
    const validatedRestore = validateBackupPayload(createBackupPayload(restoreData, DEFAULT_APP_SETTINGS));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.saveLibraryDataMock.mockRejectedValueOnce(new Error('Write failed'));
    await renderHarness();
    const activeCurrentData = app?.data;

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(false);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(validatedRestore.data);
    expect(dbMocks.saveAppSettingsMock).not.toHaveBeenCalled();
    expect(dbMocks.saveRestoreRecoverySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: activeCurrentData
      })
    );
    expect(dbMocks.clearRestoreRecoverySnapshotMock).not.toHaveBeenCalled();
    expect(app?.data).toEqual(activeCurrentData);
    expect(app?.restoreRecoverySnapshot?.data).toEqual(activeCurrentData);
    expect(app?.restoreSafetySnapshot?.payload.data).toEqual(activeCurrentData);
    expect(app?.restoreSafetySnapshot?.summary).toMatchObject({
      bookCount: 1,
      pageCount: 1
    });
    expect(app?.saveStatus.state).toBe('failed');
    expect(app?.backupStatus?.tone).toBe('error');
    expect(app?.backupStatus?.message).toContain('Restore failed before the library replacement was saved');
    expect(app?.backupStatus?.message).toContain('restore recovery snapshot is saved');
  });

  it('keeps the recovery snapshot when settings fail after library restore is written', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const restoreData = buildLibraryData('restored', 'Restored Library');
    const validatedRestore = validateBackupPayload(createBackupPayload(restoreData, DEFAULT_APP_SETTINGS));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.saveAppSettingsMock.mockRejectedValueOnce(new Error('Settings write failed'));
    await renderHarness();
    const activeCurrentData = app?.data;

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(false);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(validatedRestore.data);
    expect(dbMocks.saveAppSettingsMock).toHaveBeenCalledWith(validatedRestore.settings);
    expect(dbMocks.clearRestoreRecoverySnapshotMock).not.toHaveBeenCalled();
    expect(app?.data).toEqual(activeCurrentData);
    expect(app?.restoreRecoverySnapshot?.data).toEqual(activeCurrentData);
    expect(app?.backupStatus?.message).toContain('Restore saved the library data but failed before settings were saved');
  });

  it('keeps the recovery snapshot available when restore cleanup fails after writes', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const restoreData = buildLibraryData('restored', 'Restored Library');
    const validatedRestore = validateBackupPayload(createBackupPayload(restoreData, DEFAULT_APP_SETTINGS));
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.clearRestoreRecoverySnapshotMock.mockRejectedValueOnce(new Error('Cleanup failed'));
    await renderHarness();
    const activeCurrentData = app?.data;

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(false);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(validatedRestore.data);
    expect(dbMocks.saveAppSettingsMock).toHaveBeenCalledWith(validatedRestore.settings);
    expect(app?.data).toEqual(activeCurrentData);
    expect(app?.restoreRecoverySnapshot?.data).toEqual(activeCurrentData);
    expect(app?.backupStatus?.message).toContain('could not clear the recovery snapshot');
  });

  it('loads a durable restore recovery snapshot after refresh', async () => {
    const currentData = buildLibraryData('current', 'Current Library');
    const recoveryData = buildLibraryData('previous', 'Previous Library');
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue({
      kind: 'restore-recovery-snapshot',
      createdAt: '2026-05-06T12:00:00.000Z',
      data: recoveryData,
      settings: DEFAULT_APP_SETTINGS
    });

    await renderHarness();

    expect(app?.data?.books[0].title).toBe('Current Library');
    expect(app?.restoreRecoverySnapshot?.data).toEqual(recoveryData);
    expect(app?.appMenuSection).toBe('backup');
    expect(app?.backupStatus).toMatchObject({
      tone: 'warning',
      message: expect.stringContaining('previous library snapshot')
    });
  });

  it('recovers the previous library from the durable snapshot and cleans stale recent pages', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const currentData = buildLibraryData('current', 'Current Library');
    const recoveryData = buildLibraryData('previous', 'Previous Library');
    const recoverySettings = {
      ...DEFAULT_APP_SETTINGS,
      recentPageIds: ['previous-page', 'missing-page']
    };
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue({
      kind: 'restore-recovery-snapshot',
      createdAt: '2026-05-06T12:00:00.000Z',
      data: recoveryData,
      settings: recoverySettings
    });
    await renderHarness();

    await act(async () => {
      const recovered = await app?.handleRecoverRestoreSnapshot();
      expect(recovered).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(recoveryData);
    expect(dbMocks.saveAppSettingsMock).toHaveBeenCalledWith({
      ...recoverySettings,
      recentPageIds: ['previous-page']
    });
    expect(dbMocks.clearRestoreRecoverySnapshotMock).toHaveBeenCalledTimes(1);
    expect(app?.data?.books[0].title).toBe('Previous Library');
    expect(app?.recentPageIds).toEqual(['previous-page']);
    expect(app?.restoreRecoverySnapshot).toBeNull();
    expect(app?.backupStatus).toMatchObject({
      tone: 'success',
      message: 'Previous library recovered from the restore recovery snapshot.'
    });

    confirmSpy.mockRestore();
  });

  it('keeps the durable snapshot when recovery settings fail after the library write', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const currentData = buildLibraryData('current', 'Current Library');
    const recoveryData = buildLibraryData('previous', 'Previous Library');
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue({
      kind: 'restore-recovery-snapshot',
      createdAt: '2026-05-06T12:00:00.000Z',
      data: recoveryData,
      settings: DEFAULT_APP_SETTINGS
    });
    dbMocks.saveAppSettingsMock.mockRejectedValueOnce(new Error('Recovery settings failed'));
    await renderHarness();

    await act(async () => {
      const recovered = await app?.handleRecoverRestoreSnapshot();
      expect(recovered).toBe(false);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(recoveryData);
    expect(dbMocks.clearRestoreRecoverySnapshotMock).not.toHaveBeenCalled();
    expect(app?.data?.books[0].title).toBe('Current Library');
    expect(app?.restoreRecoverySnapshot?.data).toEqual(recoveryData);
    expect(app?.saveStatus.state).toBe('failed');
    expect(app?.backupStatus?.message).toContain('Recovery saved the previous library but failed before settings were saved');

    confirmSpy.mockRestore();
  });

  it('dismisses a stale restore recovery snapshot without changing the current library', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const currentData = buildLibraryData('current', 'Current Library');
    const recoveryData = buildLibraryData('previous', 'Previous Library');
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue({
      kind: 'restore-recovery-snapshot',
      createdAt: '2026-05-06T12:00:00.000Z',
      data: recoveryData,
      settings: DEFAULT_APP_SETTINGS
    });
    await renderHarness();
    const activeCurrentData = app?.data;

    await act(async () => {
      const dismissed = await app?.handleDismissRestoreRecoverySnapshot();
      expect(dismissed).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.clearRestoreRecoverySnapshotMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.saveLibraryDataMock).not.toHaveBeenCalled();
    expect(app?.data).toEqual(activeCurrentData);
    expect(app?.restoreRecoverySnapshot).toBeNull();
    expect(app?.backupStatus?.message).toContain('dismissed');

    confirmSpy.mockRestore();
  });

  it('keeps a stale recovery snapshot when dismiss cleanup fails', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const currentData = buildLibraryData('current', 'Current Library');
    const recoveryData = buildLibraryData('previous', 'Previous Library');
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadRestoreRecoverySnapshotMock.mockResolvedValue({
      kind: 'restore-recovery-snapshot',
      createdAt: '2026-05-06T12:00:00.000Z',
      data: recoveryData,
      settings: DEFAULT_APP_SETTINGS
    });
    dbMocks.clearRestoreRecoverySnapshotMock.mockRejectedValueOnce(new Error('Delete failed'));
    await renderHarness();

    await act(async () => {
      const dismissed = await app?.handleDismissRestoreRecoverySnapshot();
      expect(dismissed).toBe(false);
      await Promise.resolve();
    });

    expect(app?.data?.books[0].title).toBe('Current Library');
    expect(app?.restoreRecoverySnapshot?.data).toEqual(recoveryData);
    expect(app?.saveStatus.state).toBe('failed');
    expect(app?.backupStatus?.message).toContain('Could not delete the restore recovery snapshot');

    confirmSpy.mockRestore();
  });

  it('uses clear destructive confirmation copy before moving a book to Trash', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    dbMocks.loadLibraryDataMock.mockResolvedValue({
      books: [
        {
          id: 'book-a',
          title: 'Field Notes',
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: null,
          deletedFrom: null
        }
      ],
      chapters: [],
      pages: []
    });

    await renderHarness();

    act(() => {
      app?.handleDeleteBook('book-a');
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'Move "Field Notes" and all of its chapters and pages to Trash? You can restore them from Trash.'
    );

    confirmSpy.mockRestore();
  });

  it('removes recent-page references when deleting a trashed book forever', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const currentData = {
      books: [
        {
          id: 'book-a',
          title: 'Field Notes',
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: '2026-05-05T12:00:00.000Z',
          deletedFrom: null
        }
      ],
      chapters: [
        {
          id: 'chapter-a',
          bookId: 'book-a',
          title: 'Chapter',
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: '2026-05-05T12:00:00.000Z',
          deletedFrom: { bookId: 'book-a' }
        }
      ],
      pages: [
        {
          id: 'page-a',
          chapterId: 'chapter-a',
          title: 'Deleted Page',
          content: 'Deleted content',
          tags: [],
          textSize: 16,
          isLoose: false,
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: '2026-05-05T12:00:00.000Z',
          deletedFrom: { bookId: 'book-a', chapterId: 'chapter-a', wasLoose: false }
        },
        {
          id: 'page-live',
          chapterId: null,
          title: 'Live Page',
          content: 'Keep me',
          tags: [],
          textSize: 16,
          isLoose: true,
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: null,
          deletedFrom: null
        }
      ]
    } satisfies LibraryData;
    dbMocks.loadLibraryDataMock.mockResolvedValue(currentData);
    dbMocks.loadAppSettingsMock.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      recentPageIds: ['page-a', 'page-live']
    });

    await renderHarness();

    act(() => {
      app?.handleDeleteTrashItemForever({
        id: 'book-a',
        type: 'book',
        title: 'Field Notes',
        deletedAt: '2026-05-05T12:00:00.000Z'
      });
    });

    expect(app?.data?.pages.map((page) => page.id)).toEqual(['page-live']);
    expect(app?.recentPageIds).toEqual(['page-live']);

    confirmSpy.mockRestore();
  });

  it('keeps recent tag shortcuts normalized after tag rename, delete, and merge', async () => {
    dbMocks.loadLibraryDataMock.mockResolvedValue({
      books: [],
      chapters: [],
      pages: [
        {
          id: 'page-a',
          chapterId: null,
          title: 'Tagged Page',
          content: '',
          tags: ['school', 'draft', 'archive'],
          textSize: 16,
          isLoose: true,
          sortOrder: 0,
          createdAt: '2026-05-04T12:00:00.000Z',
          updatedAt: '2026-05-04T12:00:00.000Z',
          deletedAt: null,
          deletedFrom: null
        }
      ]
    });

    await renderHarness();

    act(() => {
      app?.handleOpenTag('school');
      app?.handleOpenTag('draft');
      app?.handleOpenTag('archive');
    });

    expect(app?.recentTags).toEqual(['archive', 'draft', 'school']);

    act(() => {
      app?.handleRenameTagEverywhere('/school', '/class');
    });

    expect(app?.recentTags).toEqual(['archive', 'draft', 'class']);

    act(() => {
      app?.handleMergeTags('/draft', '/class');
    });

    expect(app?.recentTags).toEqual(['archive', 'class']);

    act(() => {
      app?.handleDeleteTagEverywhere('/archive');
    });

    expect(app?.recentTags).toEqual(['class']);
  });

  it('cleans recent-page ids from a generated large library without losing live recent pages', async () => {
    const { data, recentPageIds, ids } = buildLargeLibraryFixture();
    dbMocks.loadLibraryDataMock.mockResolvedValue(data);
    dbMocks.loadAppSettingsMock.mockResolvedValue({
      ...DEFAULT_APP_SETTINGS,
      recentPageIds
    });

    await renderHarness();

    expect(app?.recentPageIds).toEqual([
      ids.rareTitlePageId,
      ids.rareContentPageId,
      ids.looseRarePageId,
      ids.backlinkTargetPageId
    ]);
  });

  async function renderHarness(): Promise<void> {
    await act(async () => {
      root.render(<Harness onRender={(nextApp) => { app = nextApp; }} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function advanceAutosave(): Promise<void> {
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
});

function Harness({ onRender }: { onRender: (app: LibraryAppApi) => void }): null {
  const app = useLibraryApp();
  onRender(app);
  return null;
}

function buildLibraryData(idPrefix: string, bookTitle: string): LibraryData {
  return {
    books: [
      {
        id: `${idPrefix}-book`,
        title: bookTitle,
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ],
    chapters: [
      {
        id: `${idPrefix}-chapter`,
        bookId: `${idPrefix}-book`,
        title: 'Chapter',
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ],
    pages: [
      {
        id: `${idPrefix}-page`,
        chapterId: `${idPrefix}-chapter`,
        title: 'Page',
        content: `${bookTitle} page content`,
        tags: ['restore'],
        textSize: 16,
        isLoose: false,
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ]
  };
}

function buildNavigationLibraryData(): LibraryData {
  return {
    books: [
      {
        id: 'book-a',
        title: 'Book A',
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      },
      {
        id: 'book-b',
        title: 'Book B',
        sortOrder: 1,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ],
    chapters: [
      {
        id: 'chapter-a',
        bookId: 'book-a',
        title: 'Chapter A',
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      },
      {
        id: 'chapter-b',
        bookId: 'book-b',
        title: 'Chapter B',
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ],
    pages: [
      {
        id: 'page-a',
        chapterId: 'chapter-a',
        title: 'Page A',
        content: 'Searchable page A content',
        tags: ['history'],
        textSize: 16,
        isLoose: false,
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      },
      {
        id: 'page-b',
        chapterId: 'chapter-b',
        title: 'Page B',
        content: 'Second page content',
        tags: ['history'],
        textSize: 16,
        isLoose: false,
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      },
      {
        id: 'loose-page',
        chapterId: null,
        title: 'Loose Page',
        content: 'Loose content',
        tags: ['inbox'],
        textSize: 16,
        isLoose: true,
        sortOrder: 0,
        createdAt: '2026-05-04T12:00:00.000Z',
        updatedAt: '2026-05-04T12:00:00.000Z',
        deletedAt: null,
        deletedFrom: null
      }
    ]
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}
