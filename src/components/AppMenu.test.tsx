import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppMenu } from './AppMenu';
import { DEFAULT_SHORTCUTS } from '../utils/shortcuts';
import type { AppSettings } from '../types/domain';

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
          onPreviewBackupImport={overrides.onPreviewBackupImport ?? vi.fn()}
          onRestoreBackupImport={overrides.onRestoreBackupImport ?? vi.fn()}
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
