import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  AppMenuSection,
  AppSettings,
  AppThemeId,
  LibraryBooksPerRow,
  LibraryShelfStyle,
  ShortcutAction,
  ShortcutBinding
} from '../types/domain';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTION_LABELS,
  SHORTCUT_ACTIONS,
  formatShortcut
} from '../utils/shortcuts';
import { APP_THEMES } from '../utils/appThemes';
import { RECENT_PAGES_LIMIT } from '../utils/appSettings';
import type { BackupImportPreview, BackupSafetySnapshot } from '../utils/backup';
import type { RestoreRecoverySnapshot } from '../db/indexedDb';
import { parseSingleTagInput, type TagSummary } from '../utils/tags';
import { useModalFocus } from '../hooks/useModalFocus';
import { AppMenuBackupSection } from './AppMenuBackupSection';
import { AppMenuSettingsSection } from './AppMenuSettingsSection';
import { BookIcon, LibraryIcon, PageIcon, SearchIcon, TagIcon, TrashIcon } from './MobileIcons';

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
  backupStatus: { tone: 'success' | 'error' | 'info' | 'warning'; message: string; warnings?: string[] } | null;
  tagSummaries: TagSummary[];
  storageStats: StorageStats;
  onUpdateTheme: (theme: AppThemeId) => void;
  onUpdateLibraryBooksPerRow: (booksPerRow: LibraryBooksPerRow) => void;
  onUpdateLibraryShelfStyle: (shelfStyle: LibraryShelfStyle) => void;
  onUpdateShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetAllShortcuts: () => void;
  onRenameTagEverywhere: (oldTag: string, newTag: string) => void;
  onDeleteTagEverywhere: (tag: string) => void;
  onMergeTags: (sourceTag: string, targetTag: string) => void;
  onExportLibrary: () => void;
  restoreSafetySnapshot: BackupSafetySnapshot | null;
  restoreRecoverySnapshot: RestoreRecoverySnapshot | null;
  onDownloadRestoreSafetySnapshot: () => void;
  onRecoverRestoreSnapshot: () => Promise<boolean>;
  onDismissRestoreRecoverySnapshot: () => Promise<boolean>;
  onPreviewBackupImport: (file: File | null) => Promise<BackupImportPreview | null>;
  onRestoreBackupImport: (validated: BackupImportPreview['validated']) => Promise<boolean>;
  onCancelBackupImport: () => void;
  onClose: () => void;
  onSelectSection: (section: AppMenuSection) => void;
  onNavigateLibrary?: () => void;
  onNavigateLoosePages?: () => void;
  onNavigateSearch?: () => void;
  onNavigateTrash?: () => void;
}

const MENU_SECTIONS: Array<{ id: AppMenuSection; label: string; summary: string }> = [
  { id: 'help', label: 'Help', summary: 'How the library, tags, search, and links work.' },
  { id: 'shortcuts', label: 'Shortcuts', summary: 'Current keyboard controls and customizable defaults.' },
  { id: 'settings', label: 'Settings', summary: 'Library density, shortcuts, and app behavior.' },
  { id: 'themes', label: 'Themes', summary: 'Choose the app-wide visual tone.' },
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
  onUpdateTheme,
  onUpdateLibraryBooksPerRow,
  onUpdateLibraryShelfStyle,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts,
  onRenameTagEverywhere,
  onDeleteTagEverywhere,
  onMergeTags,
  onExportLibrary,
  restoreSafetySnapshot,
  restoreRecoverySnapshot,
  onDownloadRestoreSafetySnapshot,
  onRecoverRestoreSnapshot,
  onDismissRestoreRecoverySnapshot,
  onPreviewBackupImport,
  onRestoreBackupImport,
  onCancelBackupImport,
  onClose,
  onSelectSection,
  onNavigateLibrary = () => undefined,
  onNavigateLoosePages = () => undefined,
  onNavigateSearch = () => undefined,
  onNavigateTrash = () => undefined
}: AppMenuProps): JSX.Element | null {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [mobileDetailSection, setMobileDetailSection] = useState<AppMenuSection | null>(null);

  useModalFocus({
    isOpen,
    containerRef: panelRef,
    initialFocusRef: titleRef,
    fallbackReturnFocusSelector: 'button[aria-label="Open app menu"]',
    onClose
  });

  useEffect(() => {
    if (!isOpen) {
      setMobileDetailSection(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function openMobileSection(section: AppMenuSection): void {
    onSelectSection(section);
    setMobileDetailSection(section);
  }

  function navigateFromMobileMenu(action: () => void): void {
    onClose();
    action();
  }

  const sectionProps = {
    settings,
    backupStatus,
    tagSummaries,
    storageStats,
    onUpdateTheme,
    onUpdateLibraryBooksPerRow,
    onUpdateLibraryShelfStyle,
    onUpdateShortcut,
    onResetShortcut,
    onResetAllShortcuts,
    onRenameTagEverywhere,
    onDeleteTagEverywhere,
    onMergeTags,
    onExportLibrary,
    restoreSafetySnapshot,
    restoreRecoverySnapshot,
    onDownloadRestoreSafetySnapshot,
    onRecoverRestoreSnapshot,
    onDismissRestoreRecoverySnapshot,
    onPreviewBackupImport,
    onRestoreBackupImport,
    onCancelBackupImport,
    onSelectSection
  };

  return (
    <div className="app-menu-layer" role="dialog" aria-modal="true" aria-labelledby="app-menu-title">
      <div
        className="app-menu-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <section className="app-menu-panel" ref={panelRef} tabIndex={-1}>
        <div className="app-menu-header">
          <div>
            <p className="eyebrow">App Menu</p>
            <h1 id="app-menu-title" ref={titleRef} tabIndex={-1}>Library Guide</h1>
            <p className="app-menu-subtitle">Find help, quick reference, settings, and project info in one place.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close app menu">
            ×
          </button>
        </div>

        <div className="mobile-app-menu">
          {mobileDetailSection ? (
            <div className="mobile-app-menu-detail">
              <div className="mobile-app-menu-detail-header">
                <button type="button" className="mobile-icon-button" onClick={() => setMobileDetailSection(null)} aria-label="Back to app menu">
                  ←
                </button>
                <h2>{getMenuSectionLabel(mobileDetailSection)}</h2>
              </div>
              <div className="mobile-app-menu-detail-body">
                {renderSection(mobileDetailSection, sectionProps)}
              </div>
            </div>
          ) : (
            <div className="mobile-app-menu-scroll">
              <div className="mobile-app-brand">
                <LibraryIcon className="mobile-app-brand-mark" />
                <div>
                  <strong>LibNote</strong>
                  <span>Your ideas, organized.</span>
                </div>
              </div>

              <div className="mobile-menu-list" role="list">
                <button type="button" className="mobile-menu-row is-primary" onClick={() => navigateFromMobileMenu(onNavigateLibrary)}>
                  <LibraryIcon className="mobile-menu-icon" />
                  <strong>Library</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => navigateFromMobileMenu(onNavigateLoosePages)}>
                  <PageIcon className="mobile-menu-icon" />
                  <strong>Loose Pages</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => navigateFromMobileMenu(onNavigateLibrary)}>
                  <BookIcon className="mobile-menu-icon" />
                  <strong>All Books</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => openMobileSection('tagManagement')}>
                  <TagIcon className="mobile-menu-icon" />
                  <strong>Tags</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => navigateFromMobileMenu(onNavigateSearch)}>
                  <SearchIcon className="mobile-menu-icon" />
                  <strong>Search</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => navigateFromMobileMenu(onNavigateTrash)}>
                  <TrashIcon className="mobile-menu-icon" />
                  <strong>Trash</strong>
                </button>
              </div>

              <div className="mobile-menu-list" role="list">
                <button type="button" className="mobile-menu-row" onClick={() => openMobileSection('settings')}>
                  <span aria-hidden="true">⚙</span>
                  <strong>Settings</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => openMobileSection('themes')}>
                  <span aria-hidden="true">◐</span>
                  <strong>Appearance</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => openMobileSection('backup')}>
                  <span aria-hidden="true">☁</span>
                  <strong>Backups</strong>
                </button>
                <button type="button" className="mobile-menu-row" onClick={() => openMobileSection('help')}>
                  <span aria-hidden="true">?</span>
                  <strong>Help / Library Guide</strong>
                </button>
              </div>
            </div>
          )}
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
            {renderSection(activeSection, sectionProps)}
          </div>
        </div>
      </section>
    </div>
  );
}

function getMenuSectionLabel(section: AppMenuSection): string {
  return MENU_SECTIONS.find((item) => item.id === section)?.label ?? 'Menu';
}

function renderSection(
  section: AppMenuSection,
  settingsProps: Pick<
    AppMenuProps,
    | 'settings'
    | 'backupStatus'
    | 'tagSummaries'
    | 'storageStats'
    | 'onUpdateTheme'
    | 'onUpdateLibraryBooksPerRow'
    | 'onUpdateLibraryShelfStyle'
    | 'onUpdateShortcut'
    | 'onResetShortcut'
    | 'onResetAllShortcuts'
    | 'onRenameTagEverywhere'
    | 'onDeleteTagEverywhere'
    | 'onMergeTags'
    | 'onExportLibrary'
    | 'restoreSafetySnapshot'
    | 'restoreRecoverySnapshot'
    | 'onDownloadRestoreSafetySnapshot'
    | 'onRecoverRestoreSnapshot'
    | 'onDismissRestoreRecoverySnapshot'
    | 'onPreviewBackupImport'
    | 'onRestoreBackupImport'
    | 'onCancelBackupImport'
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
    return <AppMenuSettingsSection {...settingsProps} />;
  }

  if (section === 'themes') {
    return <ThemesSection settings={settingsProps.settings} onUpdateTheme={settingsProps.onUpdateTheme} />;
  }

  if (section === 'tagManagement') {
    return <TagManagementSection {...settingsProps} />;
  }

  if (section === 'backup') {
    return <AppMenuBackupSection {...settingsProps} />;
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

      <GuideSection title="Install LibNote">
        <p>
          When LibNote is hosted from a production site, supported browsers can install it so it opens from an icon like
          an app. Install support depends on the browser and platform, and local data still stays in that browser or
          installed app storage.
        </p>
        <ul className="menu-list">
          <li><strong>Desktop Chrome or Edge:</strong> use the browser install button when it appears in the address bar or app menu.</li>
          <li><strong>iPhone or iPad:</strong> open LibNote in Safari, use Share, then choose Add to Home Screen.</li>
          <li><strong>Android:</strong> use the browser menu or install prompt when your browser offers it.</li>
        </ul>
        <p>
          Installed LibNote can reopen its app shell after it has loaded once, including while offline. This does not
          create cloud backup or sync. Clearing site data can delete the local library, so export backups regularly.
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
          Pages use the Lexical rich text editor. The toolbar can apply bold, italic, underline, highlight, heading,
          bullet list, numbered list, and checkbox list formatting. Formatting applies to selected text when text is
          selected, or to what you type next when the cursor is active.
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
          To add tags to a page, open that page and use the <strong>Add tag</strong> field under the title. Type a
          slash tag like <code>/history</code> and press Enter. Tags are stored in lowercase. Clicking a tag pill on a
          page or in Page Info opens a tag search for that tag.
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
          <li>Links and backlinks resolve from <code>[[Page Title]]</code> links. Duplicate page titles are treated as ambiguous so you can choose the intended page.</li>
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

function ThemesSection({
  settings,
  onUpdateTheme
}: Pick<AppMenuProps, 'settings' | 'onUpdateTheme'>): JSX.Element {
  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Themes</h2>
        <p>
          Choose the app-wide visual tone. Themes adjust surfaces, accents, and workspace color without changing saved
          book covers.
        </p>
      </section>

      <section className="settings-category-card settings-control-card themes-settings-card">
        <div className="settings-placeholder-head">
          <strong>App Theme</strong>
          <span className="search-result-badge">Live</span>
        </div>

        <div className="settings-theme-list" role="group" aria-label="App theme">
          {APP_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`settings-theme-option ${settings.theme === theme.id ? 'is-active' : ''}`}
              aria-pressed={settings.theme === theme.id}
              onClick={() => onUpdateTheme(theme.id)}
            >
              <span className={`settings-theme-swatch theme-swatch-${theme.id}`} aria-hidden="true" />
              <span className="settings-theme-copy">
                <strong>{theme.label}</strong>
                <span>{theme.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
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

    const targetAlreadyExists = knownTags.includes(targetTag);

    onRenameTagEverywhere(tag, targetTag);
    setEditingTag(null);
    setRenameInput('');
    setFeedback(
      targetAlreadyExists
        ? `Merged /${tag} into existing /${targetTag}.`
        : `Renamed /${tag} to /${targetTag}.`
    );
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
