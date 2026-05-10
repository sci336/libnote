import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppMenu } from './AppMenu';
import { DEFAULT_SHORTCUTS } from '../utils/shortcuts';
import { DEFAULT_APP_SETTINGS } from '../utils/appSettings';
import { createSafetyBackupSnapshot } from '../utils/backup';
import type { AppSettings, LibraryData } from '../types/domain';

describe('AppMenu accessibility behavior', () => {
  let container: HTMLDivElement;
  let root: Root;
  let requestAnimationFrameSpy: { mockRestore: () => void };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    requestAnimationFrameSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('moves focus into the dialog when opened', () => {
    renderAppMenu({ isOpen: true });

    expect(document.activeElement).toBe(container.querySelector('#app-menu-title'));
  });

  it('keeps Tab focus inside the dialog', () => {
    renderAppMenu({ isOpen: true });

    const panel = container.querySelector<HTMLElement>('.app-menu-panel');
    const buttons = Array.from(panel?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    lastButton.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(firstButton);

    firstButton.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(lastButton);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open menu';
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    renderAppMenu({ isOpen: true, onClose });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);

    renderAppMenu({ isOpen: false, onClose });
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it('keeps icon-only dialog buttons accessible', () => {
    renderAppMenu({ isOpen: true });

    expect(container.querySelector('button[aria-label="Close app menu"]')).not.toBeNull();
  });

  it('makes merge and replace import options clear', () => {
    renderAppMenu({ isOpen: true, activeSection: 'backup' });

    expect(container.textContent).toContain('Import from Backup');
    expect(container.textContent).toContain('Merge or replace');
    expect(container.textContent).toContain('merge it into the current library');
    expect(container.textContent).toContain('replace the current library and saved settings');
    expect(container.textContent).toContain('Export a backup first');
  });

  it('documents installable app behavior without promising app store distribution', () => {
    renderAppMenu({ isOpen: true, activeSection: 'help' });

    expect(container.textContent).toContain('Install LibNote');
    expect(container.textContent).toContain('opens from an icon like an app');
    expect(container.textContent).toContain('Desktop Chrome or Edge');
    expect(container.textContent).toContain('Add to Home Screen');
    expect(container.textContent).toContain('This does not create cloud backup or sync');
    expect(container.textContent).not.toContain('App Store');
    expect(container.textContent).not.toContain('Play Store');
    expect(container.textContent).not.toContain('Quest Store');
  });

  it('shows a safety backup download action after restore failure', () => {
    const onDownloadRestoreSafetySnapshot = vi.fn();

    renderAppMenu({
      isOpen: true,
      activeSection: 'backup',
      backupStatus: {
        tone: 'error',
        message: 'Restore failed while saving. Your previous library is still active in this tab.'
      },
      restoreSafetySnapshot: createSafetyBackupSnapshot(safetyData, DEFAULT_APP_SETTINGS),
      onDownloadRestoreSafetySnapshot
    });

    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Download Safety Backup')
    );

    expect(container.textContent).toContain('Your previous library is still active in this tab.');
    expect(container.textContent).toContain('Safety copy: 1 book, 1 page');

    act(() => {
      button?.click();
    });

    expect(onDownloadRestoreSafetySnapshot).toHaveBeenCalledTimes(1);
  });

  it('shows durable restore recovery actions without auto-recovering', () => {
    const onRecoverRestoreSnapshot = vi.fn();
    const onDismissRestoreRecoverySnapshot = vi.fn();

    renderAppMenu({
      isOpen: true,
      activeSection: 'backup',
      restoreRecoverySnapshot: {
        kind: 'restore-recovery-snapshot',
        createdAt: '2026-05-06T12:00:00.000Z',
        data: safetyData,
        settings: DEFAULT_APP_SETTINGS
      },
      onRecoverRestoreSnapshot,
      onDismissRestoreRecoverySnapshot
    });

    expect(container.textContent).toContain('Restore Recovery Snapshot');
    expect(container.textContent).toContain('interrupted or failed restore');
    expect(container.textContent).toContain('Recover Previous Library');
    expect(container.textContent).toContain('Dismiss Snapshot');

    const recoverButton = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Recover Previous Library')
    );
    const dismissButton = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Dismiss Snapshot')
    );

    act(() => {
      recoverButton?.click();
      dismissButton?.click();
    });

    expect(onRecoverRestoreSnapshot).toHaveBeenCalledTimes(1);
    expect(onDismissRestoreRecoverySnapshot).toHaveBeenCalledTimes(1);
  });

  function renderAppMenu(overrides: Partial<Parameters<typeof AppMenu>[0]> = {}): void {
    act(() => {
      root.render(
        <AppMenu
          isOpen={overrides.isOpen ?? true}
          activeSection={overrides.activeSection ?? 'help'}
          settings={overrides.settings ?? settings}
          backupStatus={overrides.backupStatus ?? null}
          tagSummaries={overrides.tagSummaries ?? []}
          storageStats={overrides.storageStats ?? {
            bookCount: 0,
            chapterCount: 0,
            pageCount: 0,
            loosePageCount: 0,
            trashedItemCount: 0
          }}
          onUpdateTheme={overrides.onUpdateTheme ?? vi.fn()}
          onUpdateLibraryBooksPerRow={overrides.onUpdateLibraryBooksPerRow ?? vi.fn()}
          onUpdateLibraryShelfStyle={overrides.onUpdateLibraryShelfStyle ?? vi.fn()}
          onUpdateShortcut={overrides.onUpdateShortcut ?? vi.fn()}
          onResetShortcut={overrides.onResetShortcut ?? vi.fn()}
          onResetAllShortcuts={overrides.onResetAllShortcuts ?? vi.fn()}
          onRenameTagEverywhere={overrides.onRenameTagEverywhere ?? vi.fn()}
          onDeleteTagEverywhere={overrides.onDeleteTagEverywhere ?? vi.fn()}
          onMergeTags={overrides.onMergeTags ?? vi.fn()}
          onExportLibrary={overrides.onExportLibrary ?? vi.fn()}
          restoreSafetySnapshot={overrides.restoreSafetySnapshot ?? null}
          restoreRecoverySnapshot={overrides.restoreRecoverySnapshot ?? null}
          onDownloadRestoreSafetySnapshot={overrides.onDownloadRestoreSafetySnapshot ?? vi.fn()}
          onRecoverRestoreSnapshot={overrides.onRecoverRestoreSnapshot ?? vi.fn()}
          onDismissRestoreRecoverySnapshot={overrides.onDismissRestoreRecoverySnapshot ?? vi.fn()}
          onPreviewBackupImport={overrides.onPreviewBackupImport ?? vi.fn()}
          onRestoreBackupImport={overrides.onRestoreBackupImport ?? vi.fn()}
          onMergeBackupImport={overrides.onMergeBackupImport ?? vi.fn()}
          onCancelBackupImport={overrides.onCancelBackupImport ?? vi.fn()}
          onClose={overrides.onClose ?? vi.fn()}
          onSelectSection={overrides.onSelectSection ?? vi.fn()}
        />
      );
    });
  }
});

const settings: AppSettings = {
  theme: 'classic-library',
  libraryView: {
    booksPerRow: 3,
    shelfStyle: 'shelf-rows'
  },
  shortcuts: DEFAULT_SHORTCUTS,
  recentPageIds: [],
  lastBackupExportedAt: null
};

const safetyData: LibraryData = {
  books: [
    {
      id: 'book-safety',
      title: 'Current Library',
      sortOrder: 0,
      createdAt: '2026-05-04T12:00:00.000Z',
      updatedAt: '2026-05-04T12:00:00.000Z',
      deletedAt: null,
      deletedFrom: null
    }
  ],
  chapters: [],
  pages: [
    {
      id: 'page-safety',
      chapterId: null,
      title: 'Loose Safety Page',
      content: 'Keep this note safe.',
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
};
