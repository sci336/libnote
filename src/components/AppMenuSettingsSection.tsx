import type {
  AppMenuSection,
  AppSettings,
  LibraryBooksPerRow,
  LibraryShelfStyle,
  ShortcutAction,
  ShortcutBinding
} from '../types/domain';
import { RECENT_PAGES_LIMIT } from '../utils/appSettings';
import { AppMenuShortcutEditor } from './AppMenuShortcutEditor';

const LIBRARY_ROW_OPTIONS: LibraryBooksPerRow[] = [2, 3, 4, 5];
const LIBRARY_SHELF_STYLE_OPTIONS: Array<{ value: LibraryShelfStyle; label: string }> = [
  { value: 'shelf-rows', label: 'Shelf Rows' },
  { value: 'simple-grid', label: 'Simple Grid' },
  { value: 'compact-shelf', label: 'Compact Shelf' },
  { value: 'large-cover', label: 'Large Cover View' }
];

interface StorageStats {
  bookCount: number;
  chapterCount: number;
  pageCount: number;
  loosePageCount: number;
  trashedItemCount: number;
}

interface AppMenuSettingsSectionProps {
  settings: AppSettings;
  storageStats: StorageStats;
  onUpdateLibraryBooksPerRow: (booksPerRow: LibraryBooksPerRow) => void;
  onUpdateLibraryShelfStyle: (shelfStyle: LibraryShelfStyle) => void;
  onUpdateShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetAllShortcuts: () => void;
  onSelectSection: (section: AppMenuSection) => void;
}

export function AppMenuSettingsSection({
  settings,
  storageStats,
  onUpdateLibraryBooksPerRow,
  onUpdateLibraryShelfStyle,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts,
  onSelectSection
}: AppMenuSettingsSectionProps): JSX.Element {
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
            Choose how the home library displays your books, then tune how many fit across each row.
          </p>

          <div className="settings-control-group">
            <div className="settings-control-copy">
              <strong>Shelf style</strong>
              <span>Changes only the home library book area.</span>
            </div>
            <div className="settings-choice-row" role="group" aria-label="Shelf style">
              {LIBRARY_SHELF_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-choice-button ${
                    settings.libraryView.shelfStyle === option.value ? 'is-active' : ''
                  }`}
                  aria-pressed={settings.libraryView.shelfStyle === option.value}
                  onClick={() => onUpdateLibraryShelfStyle(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

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
                  aria-pressed={settings.libraryView.booksPerRow === option}
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
            Pages use Lexical rich text editing with toolbar formatting for bold, italic, underline, highlight,
            headings, lists, and checkbox lists.
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
          <AppMenuShortcutEditor
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
