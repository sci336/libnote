import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibraryApp } from './useLibraryApp';
import type { AppSettings, LibraryData } from '../types/domain';
import { DEFAULT_APP_SETTINGS } from '../utils/appSettings';
import { createBackupPayload, validateBackupPayload } from '../utils/backup';

const dbMocks = vi.hoisted(() => ({
  loadLibraryDataMock: vi.fn<() => Promise<LibraryData | null>>(),
  saveLibraryDataMock: vi.fn<(data: LibraryData) => Promise<void>>(),
  loadAppSettingsMock: vi.fn<() => Promise<AppSettings | null>>(),
  saveAppSettingsMock: vi.fn<() => Promise<void>>()
}));

vi.mock('../db/indexedDb', () => ({
  loadLibraryData: dbMocks.loadLibraryDataMock,
  saveLibraryData: dbMocks.saveLibraryDataMock,
  loadAppSettings: dbMocks.loadAppSettingsMock,
  saveAppSettings: dbMocks.saveAppSettingsMock
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

    await act(async () => {
      const restored = await app?.handleRestoreBackupImport(validatedRestore);
      expect(restored).toBe(true);
      await Promise.resolve();
    });

    expect(dbMocks.saveLibraryDataMock).toHaveBeenCalledWith(validatedRestore.data);
    expect(app?.data?.books[0].title).toBe('Restored Library');
    expect(app?.restoreSafetySnapshot).toBeNull();
    expect(app?.backupStatus).toMatchObject({
      tone: 'success',
      message: 'Restore completed successfully.'
    });
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
    expect(app?.data).toEqual(activeCurrentData);
    expect(app?.restoreSafetySnapshot?.payload.data).toEqual(activeCurrentData);
    expect(app?.restoreSafetySnapshot?.summary).toMatchObject({
      bookCount: 1,
      pageCount: 1
    });
    expect(app?.saveStatus.state).toBe('failed');
    expect(app?.backupStatus?.tone).toBe('error');
    expect(app?.backupStatus?.message).toContain('Your previous library is still active in this tab.');
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
