import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibraryApp } from './useLibraryApp';
import type { LibraryData } from '../types/domain';

const dbMocks = vi.hoisted(() => ({
  loadLibraryDataMock: vi.fn<() => Promise<LibraryData | null>>(),
  saveLibraryDataMock: vi.fn<(data: LibraryData) => Promise<void>>(),
  loadAppSettingsMock: vi.fn<() => Promise<null>>(),
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
      error: {
        title: 'Changes could not be saved.',
        recovery: 'Export a backup before closing or refreshing.'
      }
    });
    expect(app?.saveStatus.state === 'failed' ? app.saveStatus.error.suggestion : '').toContain('Leave private browsing');

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
        title: 'Changes could not be saved.',
        message: 'Your latest edits may only exist in this open tab.'
      }
    });
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
    expect(app?.saveStatus.state === 'failed' ? app.saveStatus.error.suggestion : '').toContain('Free browser storage');
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
