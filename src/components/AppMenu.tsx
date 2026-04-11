import { useEffect } from 'react';
import type { AppMenuSection } from '../types/domain';

interface AppMenuProps {
  isOpen: boolean;
  activeSection: AppMenuSection;
  onClose: () => void;
  onSelectSection: (section: AppMenuSection) => void;
}

const MENU_SECTIONS: Array<{ id: AppMenuSection; label: string; summary: string }> = [
  { id: 'help', label: 'Help', summary: 'How the library, tags, search, and links work.' },
  { id: 'shortcuts', label: 'Shortcuts', summary: 'Current keyboard controls and future room to grow.' },
  { id: 'settings', label: 'Settings', summary: 'A small shell for preferences and app behavior.' },
  { id: 'credits', label: 'Credits', summary: 'A lightweight note about the project.' }
];

export function AppMenu({
  isOpen,
  activeSection,
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

          <div className="app-menu-content">{renderSection(activeSection)}</div>
        </div>
      </section>
    </div>
  );
}

function renderSection(section: AppMenuSection): JSX.Element {
  if (section === 'help') {
    return <HelpSection />;
  }

  if (section === 'shortcuts') {
    return <ShortcutsSection />;
  }

  if (section === 'settings') {
    return <SettingsSection />;
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
          The search bar looks through page titles and note content across books, chapters, and loose pages. Text search
          highlights matching words or phrases and shows the page path so you know where each result lives.
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
          <li>Shared app settings and global keyboard shortcuts are still minimal, but the new menu is ready for those additions.</li>
        </ul>
      </section>
    </div>
  );
}

function ShortcutsSection(): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Current keyboard controls</h2>
        <div className="shortcut-list" aria-label="Current keyboard controls">
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

      <section className="menu-card">
        <h2>What will live here later</h2>
        <p>
          This section is ready for future global shortcuts like quick search focus, page creation, navigation jumps, and
          editor commands. Right now the app only exposes a small set of field-level keyboard actions.
        </p>
      </section>
    </div>
  );
}

function SettingsSection(): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Settings</h2>
        <p>
          App-wide preferences are intentionally minimal right now. Per-page text size already lives in each page editor,
          and broader display or behavior settings can be added here without restructuring the app.
        </p>
      </section>

      <section className="menu-card settings-card-grid">
        <article className="settings-placeholder-card">
          <div className="settings-placeholder-head">
            <strong>Display</strong>
            <span className="search-result-badge">Coming later</span>
          </div>
          <p>Theme, density, and layout preferences can plug into this section once shared settings are introduced.</p>
        </article>
        <article className="settings-placeholder-card">
          <div className="settings-placeholder-head">
            <strong>Behavior</strong>
            <span className="search-result-badge">Coming later</span>
          </div>
          <p>Good future fits include startup view, sidebar behavior, and search defaults.</p>
        </article>
        <article className="settings-placeholder-card">
          <div className="settings-placeholder-head">
            <strong>Editor</strong>
            <span className="search-result-badge">Coming later</span>
          </div>
          <p>Editor-wide preferences can live here when settings need to apply across every page instead of one note at a time.</p>
        </article>
      </section>
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
