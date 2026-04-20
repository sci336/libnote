import { useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type {
  AppMenuSection,
  AppSettings,
  LibraryBooksPerRow,
  ShortcutAction,
  ShortcutBinding
} from '../types/domain';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTION_LABELS,
  SHORTCUT_ACTIONS,
  areShortcutBindingsEqual,
  bindingFromKeyboardEvent,
  formatShortcut,
  validateShortcutBinding
} from '../utils/shortcuts';

const LIBRARY_ROW_OPTIONS: LibraryBooksPerRow[] = [2, 3, 4, 5];

interface AppMenuProps {
  isOpen: boolean;
  activeSection: AppMenuSection;
  settings: AppSettings;
  onUpdateLibraryBooksPerRow: (booksPerRow: LibraryBooksPerRow) => void;
  onUpdateShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetAllShortcuts: () => void;
  onClose: () => void;
  onSelectSection: (section: AppMenuSection) => void;
}

const MENU_SECTIONS: Array<{ id: AppMenuSection; label: string; summary: string }> = [
  { id: 'help', label: 'Help', summary: 'How the library, tags, search, and links work.' },
  { id: 'shortcuts', label: 'Shortcuts', summary: 'Current keyboard controls and customizable defaults.' },
  { id: 'settings', label: 'Settings', summary: 'Library density, shortcuts, and app behavior.' },
  { id: 'credits', label: 'Credits', summary: 'A lightweight note about the project.' }
];

export function AppMenu({
  isOpen,
  activeSection,
  settings,
  onUpdateLibraryBooksPerRow,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts,
  onClose,
  onSelectSection
}: AppMenuProps): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="app-menu-layer" role="dialog" aria-modal="true" aria-labelledby="app-menu-title">
      <button
        type="button"
        className="app-menu-backdrop"
        aria-label="Close app menu"
        onClick={onClose}
      />
      <section className="app-menu-panel">
        <div className="app-menu-header">
          <div>
            <p className="eyebrow">App Menu</p>
            <h1 id="app-menu-title">Library Guide</h1>
            <p className="app-menu-subtitle">Find help, quick reference, settings, and project info in one place.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close app menu">
            ×
          </button>
        </div>

        <div className="app-menu-body">
          <nav className="app-menu-nav" aria-label="App menu sections">
            {MENU_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`app-menu-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
                onClick={() => onSelectSection(section.id)}
              >
                <span className="app-menu-nav-label">{section.label}</span>
                <span className="app-menu-nav-summary">{section.summary}</span>
              </button>
            ))}
          </nav>

          <div className="app-menu-content">
            {renderSection(activeSection, {
              settings,
              onUpdateLibraryBooksPerRow,
              onUpdateShortcut,
              onResetShortcut,
              onResetAllShortcuts
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function renderSection(
  section: AppMenuSection,
  settingsProps: Pick<
    AppMenuProps,
    'settings' | 'onUpdateLibraryBooksPerRow' | 'onUpdateShortcut' | 'onResetShortcut' | 'onResetAllShortcuts'
  >
): JSX.Element {
  if (section === 'help') {
    return <HelpSection />;
  }

  if (section === 'shortcuts') {
    return <ShortcutsSection settings={settingsProps.settings} />;
  }

  if (section === 'settings') {
    return <SettingsSection {...settingsProps} />;
  }

  return <CreditsSection />;
}

function HelpSection(): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>How the library is organized</h2>
        <p>
          Books are your top-level containers. Each book can hold chapters, and each chapter holds pages. Open a page to
          write, rename it inline, adjust its text size, and delete it when you no longer need it.
        </p>
        <p>
          Loose pages are pages that are not assigned to any chapter yet. They stay in their own area until you move
          them into a book chapter from the page editor.
        </p>
      </section>

      <section className="menu-card">
        <h2>Search and tags</h2>
        <p>
          The search bar looks through book titles, chapter titles, and page titles or note content. Results are grouped
          by type so you can jump straight to a book, chapter, or page from one search surface.
        </p>
        <p>
          To add tags to a page, open that page and use the <strong>Add tag</strong> field under the title. Type a tag
          and press Enter. Tags are stored in lowercase, and clicking an existing tag pill opens that tag search.
        </p>
        <p>
          To search by tag, type slash tags directly into the search bar like <code>/history</code>. The app treats a
          search as tag search only when every search token starts with <code>/</code>.
        </p>
        <p>
          Multi-tag search works with queries like <code>/history /mythology</code>. Results only include pages that
          contain <strong>all</strong> selected tags, so the list narrows as you add more tags.
        </p>
        <p>
          Tag results show matching pages and any tags already on those pages. If no page has every selected tag, the app
          shows an empty state instead of partial matches.
        </p>
      </section>

      <section className="menu-card">
        <h2>Links and backlinks</h2>
        <p>
          Pages support wiki-style links written as <code>[[Page Title]]</code>. When a title matches another page, the
          editor turns it into a clickable inline link.
        </p>
        <p>
          If a page is linked from somewhere else, a <strong>Referenced by</strong> section appears at the bottom of the
          editor so you can jump back through those backlinks.
        </p>
      </section>

      <section className="menu-card">
        <h2>Current limitations</h2>
        <ul className="menu-list">
          <li>Tag search is exact-match and lowercase-based, so <code>/History</code> becomes <code>/history</code>.</li>
          <li>Mixed queries like text plus slash tags are not combined yet; the search bar currently handles either text search or tag-only search.</li>
          <li>Backlinks only resolve from <code>[[Page Title]]</code> links, and duplicate page titles use the first matching page right now.</li>
          <li>The editor still uses the lightweight plain-text note flow rather than rich text formatting.</li>
          <li>Global shortcuts can be changed in Settings, but browser and system-reserved combinations are blocked.</li>
        </ul>
      </section>
    </div>
  );
}

function ShortcutsSection({ settings }: Pick<AppMenuProps, 'settings'>): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Keyboard controls</h2>
        <p>
          Global shortcuts can be changed in Settings. Some browser and system combinations are unavailable so the app
          does not intercept tab, reload, close, or address-bar commands.
        </p>
        <div className="shortcut-list" aria-label="Current keyboard controls">
          {SHORTCUT_ACTIONS.map((action) => (
            <div className="shortcut-row" key={action}>
              <div>
                <strong>{SHORTCUT_ACTION_LABELS[action]}</strong>
                <p>Default: {formatShortcut(DEFAULT_SHORTCUTS[action])}</p>
              </div>
              <kbd>{formatShortcut(settings.shortcuts[action])}</kbd>
            </div>
          ))}
          <div className="shortcut-row">
            <div>
              <strong>Commit an inline title edit</strong>
              <p>When renaming a book, chapter, or page title inline.</p>
            </div>
            <kbd>Enter</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Cancel an inline title edit</strong>
              <p>Returns the field to its saved value without keeping the draft.</p>
            </div>
            <kbd>Esc</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Add the tag in the page editor</strong>
              <p>Use the tag input under a page title, then press Enter to save the tag.</p>
            </div>
            <kbd>Enter</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Close this menu</strong>
              <p>Works anywhere inside the app menu overlay.</p>
            </div>
            <kbd>Esc</kbd>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsSection({
  settings,
  onUpdateLibraryBooksPerRow,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts
}: Pick<
  AppMenuProps,
  'settings' | 'onUpdateLibraryBooksPerRow' | 'onUpdateShortcut' | 'onResetShortcut' | 'onResetAllShortcuts'
>): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Settings</h2>
        <p>
          Adjust how dense the main books screen feels and customize the global shortcuts that help you move through
          the app. These settings persist across reloads.
        </p>
      </section>

      <section className="menu-card settings-card-grid">
        <article className="settings-placeholder-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Library View</strong>
            <span className="search-result-badge">Live</span>
          </div>
          <p>Choose how many books fit on each shelf. The root books screen now scales card size automatically from this layout setting.</p>

          <div className="settings-control-group">
            <div className="settings-control-copy">
              <strong>Books per row</strong>
              <span>Fewer books per row creates larger cards. More books per row creates a denser, more compact library shelf.</span>
            </div>
            <div className="settings-choice-row" role="group" aria-label="Books per row">
              {LIBRARY_ROW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`settings-choice-button ${
                    settings.libraryView.booksPerRow === option ? 'is-active' : ''
                  }`}
                  onClick={() => onUpdateLibraryBooksPerRow(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="settings-placeholder-card settings-shortcuts-card">
          <div className="settings-placeholder-head">
            <strong>Keyboard Shortcuts</strong>
            <span className="search-result-badge">Live</span>
          </div>
          <p>Change, clear, or reset the global shortcuts used for page creation and navigation.</p>
          <ShortcutEditor
            settings={settings}
            onUpdateShortcut={onUpdateShortcut}
            onResetShortcut={onResetShortcut}
            onResetAllShortcuts={onResetAllShortcuts}
          />
        </article>
        <article className="settings-placeholder-card">
          <div className="settings-placeholder-head">
            <strong>Behavior</strong>
            <span className="search-result-badge">Coming later</span>
          </div>
          <p>Good future fits include startup view, sidebar behavior, search defaults, and editor-wide preferences.</p>
        </article>
      </section>
    </div>
  );
}

function ShortcutEditor({
  settings,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts
}: Pick<AppMenuProps, 'settings' | 'onUpdateShortcut' | 'onResetShortcut' | 'onResetAllShortcuts'>): JSX.Element {
  const [capturingAction, setCapturingAction] = useState<ShortcutAction | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ShortcutAction, string>>>({});

  function setError(action: ShortcutAction, message: string | null): void {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (message) {
        nextErrors[action] = message;
      } else {
        delete nextErrors[action];
      }

      return nextErrors;
    });
  }

  function handleCaptureKeyDown(action: ShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      setCapturingAction(null);
      setError(action, null);
      return;
    }

    const binding = bindingFromKeyboardEvent(event);
    const validationMessage = validateShortcutBinding(action, binding, settings.shortcuts);

    if (validationMessage) {
      setError(action, validationMessage);
      return;
    }

    onUpdateShortcut(action, binding);
    setCapturingAction(null);
    setError(action, null);
  }

  function clearShortcut(action: ShortcutAction): void {
    onUpdateShortcut(action, null);
    setError(action, null);
    if (capturingAction === action) {
      setCapturingAction(null);
    }
  }

  function resetShortcut(action: ShortcutAction): void {
    onResetShortcut(action);
    setError(action, null);
    if (capturingAction === action) {
      setCapturingAction(null);
    }
  }

  function resetAllShortcuts(): void {
    onResetAllShortcuts();
    setCapturingAction(null);
    setErrors({});
  }

  return (
    <div className="shortcut-editor">
      {SHORTCUT_ACTIONS.map((action) => {
        const currentBinding = settings.shortcuts[action];
        const isCapturing = capturingAction === action;
        const isDefault = areShortcutBindingsEqual(currentBinding, DEFAULT_SHORTCUTS[action]);

        return (
          <div className={`shortcut-editor-row ${isCapturing ? 'is-capturing' : ''}`} key={action}>
            <div className="shortcut-editor-copy">
              <strong>{SHORTCUT_ACTION_LABELS[action]}</strong>
              {isCapturing ? (
                <span>Press a new shortcut. Esc to cancel.</span>
              ) : (
                <span>Current: {formatShortcut(currentBinding)}</span>
              )}
              {errors[action] ? <p className="shortcut-error">{errors[action]}</p> : null}
            </div>

            <div className="shortcut-editor-controls">
              {isCapturing ? (
                <button
                  type="button"
                  className="shortcut-capture-button"
                  autoFocus
                  onKeyDown={(event) => handleCaptureKeyDown(action, event)}
                >
                  Press shortcut
                </button>
              ) : (
                <kbd>{formatShortcut(currentBinding)}</kbd>
              )}
              <button
                type="button"
                className="settings-choice-button"
                onClick={() => {
                  setCapturingAction(action);
                  setError(action, null);
                }}
              >
                Change
              </button>
              {currentBinding ? (
                <button type="button" className="settings-choice-button" onClick={() => clearShortcut(action)}>
                  Clear
                </button>
              ) : null}
              {!isDefault ? (
                <button type="button" className="settings-choice-button" onClick={() => resetShortcut(action)}>
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="shortcut-editor-footer">
        <button type="button" className="settings-choice-button" onClick={resetAllShortcuts}>
          Reset all shortcuts
        </button>
      </div>
    </div>
  );
}

function CreditsSection(): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Credits</h2>
        <p>
          This note library is built as a lightweight writing and knowledge-organizing workspace for books, chapters,
          loose pages, tags, and linked notes.
        </p>
        <p>
          The new app menu is designed to make the project feel easier to learn today while leaving a clean path for
          future settings, shortcuts, and companion documentation.
        </p>
      </section>
    </div>
  );
}
