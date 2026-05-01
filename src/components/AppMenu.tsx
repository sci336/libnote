import { useEffect, useState, type ReactNode } from 'react';
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
import { RECENT_PAGES_LIMIT } from '../utils/appSettings';
import { formatLastBackupTime, getBackupReminderState } from '../utils/backupReminder';
import { parseSingleTagInput, type TagSummary } from '../utils/tags';

const LIBRARY_ROW_OPTIONS: LibraryBooksPerRow[] = [2, 3, 4, 5];

interface StorageStats {
  bookCount: number;
  chapterCount: number;
  pageCount: number;
  loosePageCount: number;
  trashedItemCount: number;
}

interface AppMenuProps {
  isOpen: boolean;
  activeSection: AppMenuSection;
  settings: AppSettings;
  backupStatus: { tone: 'success' | 'error' | 'info'; message: string } | null;
  tagSummaries: TagSummary[];
  storageStats: StorageStats;
  onUpdateLibraryBooksPerRow: (booksPerRow: LibraryBooksPerRow) => void;
  onUpdateShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetAllShortcuts: () => void;
  onRenameTagEverywhere: (oldTag: string, newTag: string) => void;
  onDeleteTagEverywhere: (tag: string) => void;
  onMergeTags: (sourceTag: string, targetTag: string) => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File | null) => void | Promise<void>;
  onClose: () => void;
  onSelectSection: (section: AppMenuSection) => void;
}

const MENU_SECTIONS: Array<{ id: AppMenuSection; label: string; summary: string }> = [
  { id: 'help', label: 'Help', summary: 'How the library, tags, search, and links work.' },
  { id: 'shortcuts', label: 'Shortcuts', summary: 'Current keyboard controls and customizable defaults.' },
  { id: 'settings', label: 'Settings', summary: 'Library density, shortcuts, and app behavior.' },
  { id: 'tagManagement', label: 'Tag Management', summary: 'Rename, delete, and merge slash tags across pages.' },
  { id: 'backup', label: 'Backup & Restore', summary: 'Download a full library backup and restore it later.' },
  { id: 'credits', label: 'Credits', summary: 'A lightweight note about the project.' }
];

export function AppMenu({
  isOpen,
  activeSection,
  settings,
  backupStatus,
  tagSummaries,
  storageStats,
  onUpdateLibraryBooksPerRow,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts,
  onRenameTagEverywhere,
  onDeleteTagEverywhere,
  onMergeTags,
  onExportLibrary,
  onImportLibrary,
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
              backupStatus,
              tagSummaries,
              storageStats,
              onUpdateLibraryBooksPerRow,
              onUpdateShortcut,
              onResetShortcut,
              onResetAllShortcuts,
              onRenameTagEverywhere,
              onDeleteTagEverywhere,
              onMergeTags,
              onExportLibrary,
              onImportLibrary,
              onSelectSection
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
    | 'settings'
    | 'backupStatus'
    | 'tagSummaries'
    | 'storageStats'
    | 'onUpdateLibraryBooksPerRow'
    | 'onUpdateShortcut'
    | 'onResetShortcut'
    | 'onResetAllShortcuts'
    | 'onRenameTagEverywhere'
    | 'onDeleteTagEverywhere'
    | 'onMergeTags'
    | 'onExportLibrary'
    | 'onImportLibrary'
    | 'onSelectSection'
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

  if (section === 'tagManagement') {
    return <TagManagementSection {...settingsProps} />;
  }

  if (section === 'backup') {
    return <BackupSection {...settingsProps} />;
  }

  return <CreditsSection />;
}

function HelpSection(): JSX.Element {
  return (
    <div className="menu-section-stack">
      <GuideSection title="How the library is organized" defaultOpen>
        <p>
          LibNote is organized like a small personal library. Books contain chapters, and chapters contain pages.
          The sidebar helps you move between those places, while the main writing area is where you edit the page
          you have open.
        </p>
        <p>
          Loose Pages are pages that are not inside a book or chapter yet. They are useful for quick notes, drafts,
          or ideas you want to file later. Open a loose page and use <strong>Move to Chapter</strong> when you are
          ready to put it into a book.
        </p>
        <p>
          Your library is saved locally in this browser using browser storage. It is not automatically synced to
          other browsers or devices, so regular backups are important.
        </p>
      </GuideSection>

      <GuideSection title="Creating, renaming, and deleting">
        <ul className="menu-list">
          <li>Create a book from the main Books screen with <strong>New Book</strong>.</li>
          <li>Create a chapter from a book card with <strong>Add Chapter</strong>, or from the sidebar while you are in a book.</li>
          <li>Create a page from the page list while you are inside a chapter, or use the new-page shortcut in a chapter.</li>
          <li>Create a loose page from the sidebar's <strong>Loose Pages</strong> section or with the new loose page shortcut.</li>
          <li>Rename books, chapters, and pages by clicking their title text, typing the new name, and pressing Enter.</li>
          <li>Delete actions move items to Trash first. Restore them from Trash if you change your mind.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Moving around">
        <p>
          Use the top bar to go home, go back, open the sidebar, search, or open this guide. The sidebar shows the
          parts of the library that matter for your current view, including books, chapters, pages, loose pages,
          Trash, and Recent Pages.
        </p>
        <p>
          Books, chapters, and pages can be reordered by dragging their handles in the lists where reordering is
          available.
        </p>
      </GuideSection>

      <GuideSection title="Recent Pages">
        <p>
          Recent Pages appears in the sidebar after you open or edit pages. It is a quick-access list for getting back
          to active work, not a replacement for the full page list.
        </p>
        <p>
          The app currently keeps up to {RECENT_PAGES_LIMIT} recent pages. Clicking a recent page opens it. The limit
          is fixed right now and is not configurable in Settings.
        </p>
      </GuideSection>

      <GuideSection title="Trash and restore">
        <p>
          Deleting a book, chapter, or page moves it to Trash instead of deleting it forever. This helps protect you
          from accidental deletion.
        </p>
        <p>
          Open Trash from the sidebar to restore an item, delete one item forever, or empty all Trash. Restoring a page
          tries to put it back in its original chapter when that chapter still exists; otherwise the page comes back as
          a loose page. Restoring a trashed chapter also restores its pages. Restoring a trashed book also restores its
          chapters and pages.
        </p>
        <p>
          Emptying Trash or using <strong>Delete Forever</strong> permanently removes items. Permanent deletion cannot
          be undone.
        </p>
      </GuideSection>

      <GuideSection title="Writing and formatting">
        <p>
          Pages use a rich text editor. The toolbar can apply bold, italic, underline, highlight, heading, bullet list,
          numbered list, and checkbox list formatting. Formatting applies to selected text when text is selected, or to
          what you type next when the cursor is active.
        </p>
        <p>
          The editor also supports common formatting shortcuts for bold, italic, underline, highlight, bullet lists,
          and numbered lists. Checkbox items can be checked or unchecked by clicking the checkbox area at the start of
          the list item.
        </p>
        <p>
          Formatting is rich text stored with the page, not Markdown conversion. The single-page text export turns the
          visible writing into a plain <code>.txt</code> file.
        </p>
      </GuideSection>

      <GuideSection title="Search and tags" defaultOpen>
        <p>
          The search bar finds live book titles, chapter titles, page titles, and page content. Results show the
          matching title, path or context, and a page snippet when content exists.
        </p>
        <p>
          Normal text searches work like <code>zeus</code> or <code>history notes</code>. These use the existing
          title and content ranking so strong title matches usually appear above content matches.
        </p>
        <p>
          Tag search uses forward slash syntax in the search bar, like <code>/history</code>. Multi-tag search works
          with queries like <code>/history /mythology</code>. Results only include pages that contain
          <strong> all</strong> selected tags, so the list narrows as you add more tags.
        </p>
        <p>
          You can combine normal text with slash tags, such as <code>zeus /mythology /school</code>,
          <code> history notes /school</code>, or <code>project plan /work /important</code>. The text part must
          match the page title or content, and the page must include every slash tag in the query.
        </p>
        <p>
          To add tags to a page, open that page and use the <strong>Add tag</strong> field under the title. Type a tag
          and press Enter. Tags are stored in lowercase. Clicking a tag pill on a page or in Page Info opens a tag
          search for that tag.
        </p>
        <p>
          In the tag results view, you can add another existing tag with the Add tag field, use recent tag suggestions,
          remove active tags, or click other tag pills to narrow the filter.
        </p>
        <h3>Search manual checks</h3>
        <ul className="menu-list">
          <li><strong>Text-only:</strong> <code>zeus</code> should preserve the existing book, chapter, title, and content search behavior.</li>
          <li><strong>Tag-only:</strong> <code>/mythology /school</code> should show pages containing both tags.</li>
          <li><strong>Mixed one tag:</strong> <code>history notes /school</code> should match the text and require <code>/school</code>.</li>
          <li><strong>Mixed multiple tags:</strong> <code>zeus /mythology /school</code> should match the text and require both tags.</li>
          <li><strong>No results:</strong> a missing text query with an existing tag should still show no matches.</li>
          <li><strong>Loose pages:</strong> matching loose pages should show <code>Loose Pages</code> as their path.</li>
          <li><strong>Books and chapters:</strong> matching chapter pages should show <code>Book Title / Chapter Title</code>.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Links and backlinks">
        <p>
          Pages support wiki-style links written as <code>[[Page Title]]</code>. When the title matches another page,
          Page Info shows it as an outgoing link you can click.
        </p>
        <p>
          If another page links to the page you are reading, Page Info shows it in the <strong>Backlinks</strong>{' '}
          section. Broken links are listed separately when a <code>[[Page Title]]</code> link does not match an
          existing page.
        </p>
      </GuideSection>

      <GuideSection title="Current limitations">
        <ul className="menu-list">
          <li>Tag search is exact-match and lowercase-based, so <code>/History</code> becomes <code>/history</code>.</li>
          <li>Links and backlinks only resolve from <code>[[Page Title]]</code> links, and duplicate page titles use the first matching page right now.</li>
          <li>Global shortcuts can be changed in Settings, but browser and system-reserved combinations are blocked.</li>
          <li>Recent Pages is limited to {RECENT_PAGES_LIMIT} pages and does not have a setting yet.</li>
        </ul>
      </GuideSection>
    </div>
  );
}

function GuideSection({
  title,
  defaultOpen = false,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className="menu-card guide-disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="guide-disclosure-summary">
        <h2>{title}</h2>
        <span className="guide-disclosure-icon" aria-hidden="true">v</span>
      </summary>
      <div className="guide-disclosure-content">{children}</div>
    </details>
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
              <strong>Bold selected text</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+B</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Italic selected text</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+I</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Underline selected text</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+U</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Highlight selected text</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+Shift+H</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Start or toggle a bullet list</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+Shift+8</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Start or toggle a numbered list</strong>
              <p>Works while the page editor is focused.</p>
            </div>
            <kbd>Ctrl/Cmd+Shift+7</kbd>
          </div>
          <div className="shortcut-row">
            <div>
              <strong>Use tag suggestions</strong>
              <p>In the tag results Add tag field, move through suggestions and choose one.</p>
            </div>
            <kbd>↑ / ↓ / Enter</kbd>
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
  storageStats,
  onUpdateLibraryBooksPerRow,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts,
  onSelectSection
}: Pick<
  AppMenuProps,
  | 'settings'
  | 'storageStats'
  | 'onUpdateLibraryBooksPerRow'
  | 'onUpdateShortcut'
  | 'onResetShortcut'
  | 'onResetAllShortcuts'
  | 'onSelectSection'
>): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Settings</h2>
        <p>
          Use Settings as LibNote's control center. The live controls below keep their existing behavior, while the
          other cards explain how automatic or dedicated areas of the app work.
        </p>
      </section>

      <div className="settings-category-grid">
        <section className="settings-category-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Library View</strong>
            <span className="search-result-badge">Live</span>
          </div>
          <p>
            Choose how many books fit on each shelf. Fewer books per row makes larger book cards, while more books per
            row makes the library denser.
          </p>

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
        </section>

        <section className="settings-category-card">
          <div className="settings-placeholder-head">
            <strong>Editor</strong>
            <span className="search-result-badge">Page tools</span>
          </div>
          <p>
            Pages use rich text editing with toolbar formatting for bold, italic, underline, highlight, headings,
            lists, and checkbox lists.
          </p>
          <ul className="settings-mini-list">
            <li>Text size controls live in each page editor and save with the page content.</li>
            <li>Edit and Preview modes let you switch between writing and reading resolved page links.</li>
            <li>Saved page content stays rich text; single-page text export creates a plain text copy.</li>
          </ul>
        </section>

        <section className="settings-category-card settings-shortcuts-card">
          <div className="settings-placeholder-head">
            <strong>Shortcuts</strong>
            <span className="search-result-badge">Live</span>
          </div>
          <p>
            Change, clear, or reset the global shortcuts used for page creation and navigation. Browser and
            system-reserved combinations are still blocked.
          </p>
          <ShortcutEditor
            settings={settings}
            onUpdateShortcut={onUpdateShortcut}
            onResetShortcut={onResetShortcut}
            onResetAllShortcuts={onResetAllShortcuts}
          />
        </section>

        <section className="settings-category-card">
          <div className="settings-placeholder-head">
            <strong>Recent Pages</strong>
            <span className="search-result-badge">Automatic</span>
          </div>
          <p>
            Recent Pages updates automatically when pages are opened or edited. It currently keeps up to
            {' '}{RECENT_PAGES_LIMIT} recent pages and does not have a separate setting.
          </p>
        </section>

        <section className="settings-category-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Tags</strong>
            <span className="search-result-badge">Slash tags</span>
          </div>
          <p>
            Tags use slash syntax like <code>/school</code>. You can rename, delete, and merge tags across pages from
            the dedicated Tag Management tools.
          </p>
          <div className="backup-actions">
            <button type="button" className="secondary-button" onClick={() => onSelectSection('tagManagement')}>
              Open Tag Management
            </button>
          </div>
        </section>

        <section className="settings-category-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Backup &amp; Restore</strong>
            <span className="search-result-badge">Local data</span>
          </div>
          <p>
            LibNote stores data locally in this browser. Exporting creates a JSON backup, and importing replaces the
            current library after validation and confirmation.
          </p>
          <p className="settings-warning">
            Your notes are saved in this browser. Export backups regularly, especially before clearing browser data or
            switching devices.
          </p>
          <div className="backup-actions">
            <button type="button" className="secondary-button" onClick={() => onSelectSection('backup')}>
              Open Backup &amp; Restore
            </button>
          </div>
        </section>

        <section className="settings-category-card settings-info-card">
          <div className="settings-placeholder-head">
            <strong>App Info / Storage</strong>
            <span className="search-result-badge">Local-first</span>
          </div>
          <p>
            LibNote is local-first. Your library is stored in IndexedDB in this browser, with no cloud sync or account
            system yet. Production builds use PWA/service worker behavior for a more app-like experience.
          </p>
          <div className="settings-stat-grid" aria-label="Library storage summary">
            <div className="settings-stat">
              <strong>{storageStats.bookCount}</strong>
              <span>Books</span>
            </div>
            <div className="settings-stat">
              <strong>{storageStats.chapterCount}</strong>
              <span>Chapters</span>
            </div>
            <div className="settings-stat">
              <strong>{storageStats.pageCount}</strong>
              <span>Pages</span>
            </div>
            <div className="settings-stat">
              <strong>{storageStats.loosePageCount}</strong>
              <span>Loose Pages</span>
            </div>
            <div className="settings-stat">
              <strong>{storageStats.trashedItemCount}</strong>
              <span>Trash</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type TagManagementSort = 'alphabetical' | 'mostUsed';

function TagManagementSection({
  tagSummaries,
  onRenameTagEverywhere,
  onDeleteTagEverywhere,
  onMergeTags
}: Pick<
  AppMenuProps,
  'tagSummaries' | 'onRenameTagEverywhere' | 'onDeleteTagEverywhere' | 'onMergeTags'
>): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<TagManagementSort>('alphabetical');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [mergeSourceTag, setMergeSourceTag] = useState('');
  const [mergeTargetInput, setMergeTargetInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const normalizedSearch = searchQuery.trim().replace(/^\//, '').toLowerCase();
  const filteredTags = tagSummaries
    .filter((summary) => !normalizedSearch || summary.tag.includes(normalizedSearch))
    .sort((left, right) => {
      if (sortMode === 'mostUsed' && left.pageCount !== right.pageCount) {
        return right.pageCount - left.pageCount;
      }

      return left.tag.localeCompare(right.tag);
    });
  const knownTags = tagSummaries.map((summary) => summary.tag);

  function startRename(tag: string): void {
    setEditingTag(tag);
    setRenameInput(`/${tag}`);
    setFeedback(null);
  }

  function submitRename(tag: string): void {
    const targetTag = parseSingleTagInput(renameInput);

    if (!targetTag) {
      setFeedback('Use one slash tag, like /college.');
      return;
    }

    if (targetTag === tag) {
      setEditingTag(null);
      setRenameInput('');
      setFeedback(null);
      return;
    }

    onRenameTagEverywhere(tag, targetTag);
    setEditingTag(null);
    setRenameInput('');
    setFeedback(`Renamed /${tag} to /${targetTag}.`);
  }

  function deleteTag(tag: string): void {
    const summary = tagSummaries.find((item) => item.tag === tag);
    const count = summary?.pageCount ?? 0;

    if (!window.confirm(`Remove /${tag} from ${formatPageCount(count)}? Pages will not be deleted.`)) {
      return;
    }

    onDeleteTagEverywhere(tag);
    if (mergeSourceTag === tag) {
      setMergeSourceTag('');
    }
    setFeedback(`Removed /${tag} from all pages.`);
  }

  function submitMerge(): void {
    const sourceTag = parseSingleTagInput(mergeSourceTag);
    const targetTag = parseSingleTagInput(mergeTargetInput);

    if (!sourceTag || !targetTag) {
      setFeedback('Choose a source tag and enter one target slash tag.');
      return;
    }

    if (sourceTag === targetTag) {
      setFeedback('Choose two different tags to merge.');
      return;
    }

    const sourceSummary = tagSummaries.find((summary) => summary.tag === sourceTag);
    const count = sourceSummary?.pageCount ?? 0;

    if (!window.confirm(`Merge /${sourceTag} into /${targetTag} across ${formatPageCount(count)}?`)) {
      return;
    }

    onMergeTags(sourceTag, targetTag);
    setMergeSourceTag('');
    setMergeTargetInput('');
    setFeedback(`Merged /${sourceTag} into /${targetTag}.`);
  }

  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Tag Management</h2>
        <p>
          Review slash tags currently used by pages, then rename, delete, or merge them across the library.
          Tags are derived from page metadata, so unused tags naturally disappear when no page uses them.
        </p>
      </section>

      <section className="menu-card tag-management-card">
        <div className="tag-management-toolbar">
          <label className="tag-management-search">
            <span>Find tag</span>
            <input
              type="search"
              className="tag-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="/school"
            />
          </label>

          <div className="settings-choice-row" role="group" aria-label="Sort tags">
            <button
              type="button"
              className={`settings-choice-button ${sortMode === 'alphabetical' ? 'is-active' : ''}`}
              onClick={() => setSortMode('alphabetical')}
            >
              Alphabetical
            </button>
            <button
              type="button"
              className={`settings-choice-button ${sortMode === 'mostUsed' ? 'is-active' : ''}`}
              onClick={() => setSortMode('mostUsed')}
            >
              Most used
            </button>
          </div>
        </div>

        {tagSummaries.length === 0 ? (
          <div className="empty-state tag-management-empty">
            <h2>No tags yet.</h2>
            <p>Add tags to pages using /tagname.</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="empty-state tag-management-empty">
            <h2>No matching tags.</h2>
            <p>Try a shorter tag name or clear the filter.</p>
          </div>
        ) : (
          <div className="tag-management-list">
            {filteredTags.map((summary) => (
              <article key={summary.tag} className="tag-management-row">
                <div className="tag-management-main">
                  <span className="tag-pill tag-management-pill">/{summary.tag}</span>
                  <span className="tag-management-count">{formatPageCount(summary.pageCount)}</span>
                </div>

                {editingTag === summary.tag ? (
                  <form
                    className="tag-management-inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitRename(summary.tag);
                    }}
                  >
                    <input
                      type="text"
                      className="tag-input"
                      value={renameInput}
                      onChange={(event) => setRenameInput(event.target.value)}
                      autoFocus
                      aria-label={`Rename /${summary.tag}`}
                    />
                    <button type="submit" className="primary-button">
                      Save
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setEditingTag(null);
                        setRenameInput('');
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="tag-management-actions">
                    <button type="button" className="secondary-button" onClick={() => startRename(summary.tag)}>
                      Rename
                    </button>
                    <button type="button" className="danger-button" onClick={() => deleteTag(summary.tag)}>
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {tagSummaries.length > 0 ? (
        <section className="menu-card tag-management-card">
          <h2>Merge Tags</h2>
          <div className="tag-management-merge">
            <label>
              <span>Merge</span>
              <select value={mergeSourceTag} onChange={(event) => setMergeSourceTag(event.target.value)}>
                <option value="">Select tag</option>
                {knownTags.map((tag) => (
                  <option key={tag} value={tag}>
                    /{tag}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Into</span>
              <input
                type="text"
                className="tag-input"
                value={mergeTargetInput}
                onChange={(event) => setMergeTargetInput(event.target.value)}
                placeholder="/college"
              />
            </label>

            <button type="button" className="primary-button" onClick={submitMerge}>
              Merge
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <section className="menu-card backup-status-card is-info" aria-live="polite">
          <h2>Tag Update</h2>
          <p>{feedback}</p>
        </section>
      ) : null}
    </div>
  );
}

function formatPageCount(pageCount: number): string {
  return pageCount === 1 ? '1 page' : `${pageCount} pages`;
}

function BackupSection({
  settings,
  backupStatus,
  onExportLibrary,
  onImportLibrary
}: Pick<AppMenuProps, 'settings' | 'backupStatus' | 'onExportLibrary' | 'onImportLibrary'>): JSX.Element {
  const [isImporting, setIsImporting] = useState(false);
  const reminderState = getBackupReminderState(settings.lastBackupExportedAt);
  const reminderTone = reminderState.type === 'current' ? 'success' : reminderState.type === 'stale' ? 'warning' : 'info';
  const reminderMessage =
    reminderState.type === 'current'
      ? 'Backup is up to date.'
      : reminderState.type === 'stale'
        ? `Last backup was ${reminderState.daysSinceBackup} days ago. Consider exporting a new backup.`
        : 'Backup recommended - your notes are saved only in this browser.';

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      await onImportLibrary(file);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Backup &amp; Restore</h2>
        <p>
          LibNote stores your notes locally in this browser. Export backups regularly so you can recover your library
          if browser data is cleared, you switch devices, or you want a copy before making big changes.
        </p>
      </section>

      <section className={`menu-card backup-reminder-card is-${reminderTone}`} aria-live="polite">
        <div className="settings-placeholder-head">
          <h2>Backup Reminder</h2>
          <span className="search-result-badge">{reminderState.type === 'current' ? 'Current' : 'Recommended'}</span>
        </div>
        <p className="backup-last-export">{formatLastBackupTime(settings.lastBackupExportedAt)}</p>
        <p>{reminderMessage}</p>
        <p>
          Your notes are saved in this browser. Export backups regularly, especially before clearing browser data,
          switching devices, or importing another library.
        </p>
      </section>

      <section className="menu-card settings-card-grid">
        <article className="settings-placeholder-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Full Library Backup</strong>
            <span className="search-result-badge">Local only</span>
          </div>
          <p>
            Download one <code>.json</code> file containing your books, chapters, pages, loose pages, page tags, page
            text sizes, recent pages, books-per-row setting, and custom shortcuts. Your browser may ask where to save
            the file, or it may place it directly in your Downloads folder.
          </p>
          <div className="backup-actions">
            <button type="button" className="primary-button" onClick={onExportLibrary}>
              Export Library
            </button>
          </div>
        </article>

        <article className="settings-placeholder-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Restore from Backup</strong>
            <span className="search-result-badge">Replaces current library</span>
          </div>
          <p>
            Import a previously exported JSON backup. Restore replaces the current library and saved settings in this
            browser with the contents of the backup; it does not merge the two libraries. Export a backup first if you
            want to keep a copy of the current library.
          </p>
          <label className="backup-import-label">
            <input
              type="file"
              accept=".json,application/json"
              className="backup-file-input"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
            <span className="secondary-button">{isImporting ? 'Importing…' : 'Import Library'}</span>
          </label>
        </article>
      </section>

      {backupStatus ? (
        <section className={`menu-card backup-status-card is-${backupStatus.tone}`} aria-live="polite">
          <h2>Backup Status</h2>
          <p>{backupStatus.message}</p>
        </section>
      ) : null}
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

  useEffect(() => {
    if (!capturingAction) {
      return;
    }

    function handleCaptureKeyDown(event: KeyboardEvent): void {
      if (!capturingAction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'Escape') {
        setCapturingAction(null);
        setError(capturingAction, null);
        return;
      }

      const binding = bindingFromKeyboardEvent(event);
      const validationMessage = validateShortcutBinding(capturingAction, binding, settings.shortcuts);

      if (validationMessage) {
        setError(capturingAction, validationMessage);
        return;
      }

      onUpdateShortcut(capturingAction, binding);
      setCapturingAction(null);
      setError(capturingAction, null);
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    return () => window.removeEventListener('keydown', handleCaptureKeyDown, true);
  }, [capturingAction, onUpdateShortcut, settings.shortcuts]);

  function handleShortcutFieldKeyDown(action: ShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (capturingAction === action) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setCapturingAction(action);
      setError(action, null);
    }
  }

  function startCapture(action: ShortcutAction): void {
    setCapturingAction(action);
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
                <span>Click the shortcut field to edit.</span>
              )}
              {errors[action] ? (
                <p className="shortcut-error" id={`shortcut-error-${action}`}>
                  {errors[action]}
                </p>
              ) : null}
            </div>

            <div className="shortcut-editor-controls">
              <button
                type="button"
                className={`shortcut-field ${isCapturing ? 'is-capturing' : ''} ${errors[action] ? 'has-error' : ''}`}
                aria-label={`Edit shortcut for ${SHORTCUT_ACTION_LABELS[action]}`}
                aria-describedby={errors[action] ? `shortcut-error-${action}` : undefined}
                autoFocus={isCapturing}
                onClick={() => startCapture(action)}
                onKeyDown={(event) => handleShortcutFieldKeyDown(action, event)}
              >
                {isCapturing ? 'Press shortcut...' : formatShortcut(currentBinding)}
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
          LibNote is a lightweight writing and knowledge-organizing workspace for books, chapters, loose pages, tags,
          links, backlinks, and local backups.
        </p>
        <p>
          Built with React, TypeScript, and Vite, with browser storage for the local library data.
        </p>
      </section>
    </div>
  );
}
