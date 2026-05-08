# LibNote

LibNote is a local-first note app built around a personal library metaphor. Instead of a generic note list, the app organizes writing as **Books -> Chapters -> Pages**, with **Loose Pages** for drafts, quick notes, and anything that has not been filed into a chapter yet.

The current app runs entirely in the browser. Notes, app settings, recent pages, and most preferences are saved locally, so LibNote is useful for private writing, research notes, study material, worldbuilding, project notebooks, and other collections that benefit from feeling like a small digital library.

LibNote has no backend, account system, cloud sync, collaboration, or server-side storage in the current codebase. Production builds include PWA/offline shell support, and the library itself is stored locally in IndexedDB. The home screen stays centered on the bookshelf/library concept instead of a dashboard-style workspace.

## Current Features

### Library Organization

- Create, rename, reorder, and move books to Trash.
- Choose from built-in book cover styles for each book.
- Create, rename, reorder, move, and trash chapters inside books.
- Create, rename, reorder, move, and trash pages inside chapters.
- Create, rename, open, and trash Loose Pages.
- Move a Loose Page into an existing chapter.
- Move chapters between books.
- Move chapter pages between chapters.
- Inline title editing for books, chapters, and pages.
- Recent Pages in the sidebar, automatically tracking the last 4 live pages opened.

### Navigation and Views

- Library home view for books.
- Book view for a book's chapters.
- Chapter view for a chapter's pages.
- Page editor view.
- Loose Pages view.
- Search results view.
- Tagged Pages view for slash-tag filtering.
- Trash view.
- Top-bar controls for App Menu, sidebar toggle, Back, Home, breadcrumbs, and search.
- Breadcrumbs show the current location, such as `Books > Book Title > Chapter Title > Page Title`.
- Navigation is app state, not URL routing, so individual notes do not have shareable deep links.

### Sidebar

- Sidebar sections for Books, Loose Pages, context-specific Chapters, context-specific Pages, Trash, and Recent Pages.
- Sidebar opens automatically on wider screens and can be toggled from the top bar or keyboard shortcut.
- On smaller screens, navigation actions close the sidebar after selection.
- Sidebar sections can be collapsed; that collapsed/expanded state is stored in `localStorage`.
- Loose Pages shows a short list by default, with a "Show more" control when there are more than 3 loose pages.
- Books, chapters, and chapter pages can be reordered from sidebar lists when their section is active.

### Search

- Global search from the top bar.
- Text search covers live book titles, chapter titles, page titles, and page content.
- Search also has a Trash filter that searches trashed books, chapters, pages, and loose pages.
- Tag-only and mixed text-plus-tag searches return pages; normal text search can also return books and chapters.
- Search result cards show type badges, paths/context, and page snippets when content exists.
- Result filters include All, Pages, Books, Chapters, Loose Pages, and Trash.
- Text matches are ranked with title matches first, then content phrase/token matches, with stable type/title ordering for ties.

### Slash Tags

- Pages have explicit tag metadata under the page title.
- Tags are displayed as slash tags, such as `/history`.
- Tags are normalized to lowercase and deduplicated.
- Search supports tag-only queries, such as `/history`.
- Multi-tag filtering uses AND logic, such as `/history /mythology`.
- Mixed text-plus-tag search is supported, such as `zeus /mythology /school`.
- Tag suggestions appear in the top search bar, the page tag field, the tag results add-tag field, and editor slash-tag autocomplete.
- Clicking a tag pill opens or narrows the tag filter.
- Tag Management can rename, delete, or merge tags across all pages.
- Tag Management normalizes names to `/tag` syntax, collapses duplicates created by case or spacing differences, and keeps recent tag shortcuts aligned after global edits.

### Wikilinks and Backlinks

- Wiki-style links use `[[Page Title]]` syntax.
- Link matching is case-insensitive and whitespace-normalized.
- Typing `[[` in the editor opens page-title autocomplete.
- Preview mode renders resolved wiki links as clickable page links.
- Missing wiki links can create a new page with that title.
- Ambiguous wiki links, usually caused by duplicate page titles, are marked as ambiguous. Preview mode and Page Info let the user choose a destination.
- Backlinks are derived from page content at render time rather than stored separately.
- Page Info shows outgoing links, backlinks, broken links, and ambiguous links.

### Page Editing

- Rich text editing with the Lexical editor.
- Edit and Preview modes. Pages open in Edit mode by default; Preview mode renders wikilinks and sanitized rich content for reading.
- Formatting toolbar for text size, bold, italic, underline, highlight, heading, bullet list, numbered list, and checkbox/task list.
- Text size presets: Small, Normal, Large, Extra Large, and Huge.
- Editor shortcuts for bold, italic, underline, highlight, bullet lists, and numbered lists.
- Checkbox/task list items can be checked and unchecked in the editor.
- Pasted HTML is sanitized; pasted plain text is converted into safe editable HTML.
- Page content is stored as rich HTML, while search, export, backlinks, and wiki-link parsing use plain-text conversion helpers.
- Debounced autosave to IndexedDB, plus a `pagehide` flush when the tab closes or backgrounds.
- Save status indicator with saving, saved, failed, and retry states.
- Single-page export as a plain `.txt` file.

### Page Info

The Page Info panel includes:

- Title, created date, last edited date, and location.
- Parent book and chapter for chapter pages.
- Writing stats: words, characters, estimated reading time, and lines.
- Page tags.
- Outgoing links.
- Ambiguous links.
- Backlinks.
- Broken links with a "Create page" action.

### Trash

- Deleting books, chapters, pages, and loose pages moves them to Trash first.
- Trash shows type, deletion time, and original location when available.
- Restore returns books, chapters, and pages when possible.
- Restoring a book restores its chapters and pages.
- Restoring a chapter restores its pages. If the parent book is trashed, restoring the chapter restores the book too.
- Restoring a page tries to return it to its original live chapter. If that chapter is unavailable, it becomes a Loose Page.
- Delete Forever and Empty Trash permanently remove data.

### App Menu, Settings, and Help

The top-left App Menu opens the Library Guide with these sections:

- Help
- Shortcuts
- Settings
- Themes
- Tag Management
- Backup & Restore
- Credits

Current settings include:

- Books per row: 2, 3, 4, or 5.
- Shelf style: Shelf Rows, Simple Grid, Compact Shelf, or Large Cover View.
- App theme: Classic Library, Modern Minimal, Warm Study, Dark Archive, or Light Paper.
- Custom global shortcuts for New Loose Page, New Page in Current Chapter, Toggle Sidebar, Go Home, and Go Back.
- Shortcut reset, clear, and duplicate/reserved-combination validation.

The menu also shows local library storage counts and a backup reminder based on the last successful export.

### Keyboard Shortcuts

Default global shortcuts:

- New Loose Page: `Cmd+Option+N` on macOS, equivalent primary-modifier behavior on non-Mac platforms.
- New Page in Current Chapter: `Cmd+Shift+N`.
- Toggle Sidebar: `Cmd+\`.
- Go Home: `Cmd+Shift+H`.
- Go Back: `Cmd+Left Arrow`.

Editor shortcuts:

- Bold: `Ctrl/Cmd+B`.
- Italic: `Ctrl/Cmd+I`.
- Underline: `Ctrl/Cmd+U`.
- Highlight: `Ctrl/Cmd+Shift+H`.
- Bullet list: `Ctrl/Cmd+Shift+8`.
- Numbered list: `Ctrl/Cmd+Shift+7`.

Inline title editing uses `Enter` to save and `Esc` to cancel. Tag and autocomplete fields support arrow keys, `Enter`, `Tab` where implemented, and `Esc`.

### PWA and Offline Shell

- `public/manifest.webmanifest` defines the installable app metadata.
- `public/sw.js` provides the production service worker.
- The Vite production build is currently configured with `base: '/libnote/'` for the GitHub Pages project URL.
- In production, the service worker precaches the app shell under its registration scope, including the scoped root, `index.html`, `manifest.webmanifest`, and app icons.
- Same-origin GET assets are cached as they are fetched.
- Navigation requests fall back to cached `index.html` when available.
- Development mode unregisters service workers and clears matching `note-library-*` and `libnote-*` caches to avoid stale local builds.
- LibNote shows a small offline indicator when the browser is offline.
- When a new service worker is waiting, LibNote shows a small update-ready message and waits for the user to choose Reload.

Offline support means the app shell can load from cache after it has been cached, and your library data remains in local browser storage. It does not mean cloud sync or remote backup.

## Large Library Performance

LibNote builds reusable derived in-memory library data from the stored book, chapter, and page arrays. This lets the UI read prepared lists, maps, groups, counts, and summaries instead of repeatedly filtering and sorting the full library during rendering.

Derived library data currently includes:

- Live and trashed books, chapters, and pages.
- Lookup maps for books, chapters, and pages, including live-only maps.
- Chapters grouped by book.
- Pages grouped by chapter.
- Loose pages sorted for quick access.
- Tag summaries and the full live tag list.
- Chapter counts per book, page counts per chapter, loose-page counts, and trash counts.
- Trash items with original-location labels.

Search also builds lightweight normalized/indexed records for books, chapters, pages, and trash only when search is active or a query has been typed. Those records store flattened titles/content, normalized tags, parent context, and loose-page/trash metadata so larger libraries stay responsive while searching.

## How the Library Organization Works

LibNote's main hierarchy is:

```text
Book
  Chapter
    Page
```

A **Book** is the top-level container. It has a title, cover style, order on the library shelf, timestamps, and chapters.

A **Chapter** belongs to one book. It groups related pages and can be reordered inside its book or moved to another book.

A **Page** belongs to one chapter unless it is a loose page. Chapter pages can be reordered inside a chapter and moved to another chapter.

A **Loose Page** is a page with no chapter. Loose Pages are for notes that should stay easy to capture before you know where they belong. They appear in their own Loose Pages view and sidebar section. When ready, a Loose Page can be moved into an existing book chapter.

Users navigate through the top bar, breadcrumbs, sidebar, and result cards. The app keeps view state internally, so browser URLs do not change for each book, chapter, or page.

## Search, Tags, and Linking

### Text Search

Use the top search bar for normal text:

```text
history notes
zeus
chapter draft
```

Text search can match:

- Book titles.
- Chapter titles.
- Chapter page titles.
- Loose Page titles.
- Plain text extracted from page content.

The All filter shows live library results. The Trash filter searches matching trashed books, chapters, pages, and loose pages separately.

Text results are ranked at a high level by exact title matches, title phrase matches, title token matches, exact content phrase matches, and partial content token matches. Ties are ordered consistently by result type, title, and ID. Page results include content snippets when there is content to show, and matching title/snippet text is highlighted in the result card.

### Slash Tags

Tags are stored on pages and shown with slash syntax:

```text
/history
/mythology
/school
```

Tag-only search:

```text
/history
```

Multi-tag search:

```text
/history /mythology
```

Multi-tag searches require every selected tag. A page tagged only `/history` will not appear for `/history /mythology`.

Tag names are normalized to lowercase and trimmed when saved. The visible app syntax is `/tag`; tag inputs display saved tags that way even when forgiving input is normalized.

Mixed text and tags:

```text
zeus /mythology /school
```

For mixed search, the text portion must match the page title or page content, and the page must include every slash tag.

Mixed text-plus-tag search returns matching live pages, including Loose Pages. The Trash filter can also show matching trashed pages with the same text-plus-tag behavior.

### Wikilinks

Use double brackets to link to another page by title:

```text
See [[Greek Mythology Notes]] for the source list.
```

In Preview mode, resolved links open the matching page. Missing links offer to create a new page. If more than one page has the same normalized title, the link is treated as ambiguous and the app asks which destination to open.

Backlinks are automatic. If Page A links to `[[Page B]]`, Page B's Page Info panel lists Page A under Backlinks.

Backlinks are derived from the current live page set. Renaming a target page changes which title links resolve, moving a page updates its path labels, and trashed or permanently deleted source pages are excluded from backlink lists.

## Storage and Data Persistence

LibNote stores data locally in the browser using IndexedDB:

- Database name: `note-library-db`.
- Object store: `app-state`.
- Library snapshot key: `library`.
- Settings key: `settings`.

The library snapshot contains normalized arrays of books, chapters, and pages. Settings are stored separately and include theme, library view options, shortcut bindings, recent page IDs, and last backup export time.

"Local-first" means your data is saved on the device/browser profile where you use the app. The current app does not send notes to a server and does not sync between devices. Library and settings writes are debounced by about 300 ms, and the app also attempts a final flush on `pagehide` when the tab closes or backgrounds. If browser storage is cleared, a browser profile is deleted, private/incognito storage is discarded, or a device is lost, local data can be lost unless you have exported a backup.

## Backup and Restore

### Export

Backup & Restore can export a full-library JSON file named like:

```text
libnote-backup-YYYY-MM-DD.json
```

The backup includes:

- Backup metadata: app name, backup version, and export timestamp.
- Books, including cover IDs, sort order, timestamps, and trash metadata.
- Chapters, including parent book IDs, sort order, timestamps, and trash metadata.
- Pages and Loose Pages, including content, tags, text size, sort order, timestamps, and trash metadata.
- App settings, including theme, library view settings, custom shortcuts, recent pages, and last backup timestamp.

Individual pages can also be exported as plain `.txt` files. Page text export includes the page title and visible plain text converted from rich content.

### Restore

Restore imports a selected JSON backup file, validates it, shows a Restore Preview, and asks for confirmation before changing the current library.

Restore behavior:

- Restore replaces the current browser library and settings. It does not merge libraries.
- Invalid JSON is rejected.
- Unsupported backup versions are rejected.
- LibNote creates an in-memory pre-restore safety backup before replacing the library. If the restore write fails, the previous library is kept active in the current tab and the safety backup can be downloaded.
- The preview shows backup type, app metadata, backup date, version, and counts for books, chapters, pages, loose pages, trashed items, and unique tags.
- Missing or invalid metadata can be repaired with warnings.
- Missing titles, timestamps, invalid tags, invalid settings, missing parent chapters, and similar recoverable issues are repaired or skipped with warnings where possible.
- Validation and repair warnings are shown in the preview and again after restore if applicable.
- Backups from legacy `iNote` metadata are recognized by the importer.
- If backup settings are missing or invalid, safe default settings are used.

Export a current backup before restoring another file if you want to keep the current browser library.

## Install LibNote as an App

LibNote can be installed as a Progressive Web App when it is served from a production HTTPS site. After installation, users open it from an icon like an app; they should not need npm commands, a terminal, a Vite dev server, or a browser tab workflow.

Install flow for normal users:

- Desktop Chrome or Edge: open the deployed LibNote site and use the browser install button when it appears in the address bar or app menu.
- iPhone or iPad: open the deployed site in Safari, use Share, then choose Add to Home Screen.
- Android: open the deployed site and use the browser menu or install prompt where supported.

Install support depends on the browser and platform. LibNote does not currently ship through the App Store, Play Store, or any native store.

### Local-First Data Warning

LibNote stores books, chapters, pages, loose pages, settings, and recent pages locally in browser/app storage. Installing the PWA does not create cloud backup, accounts, or sync. Clearing site data, deleting a browser profile, private/incognito storage cleanup, or losing a device can delete the local library. Export backups regularly from App Menu -> Backup & Restore.

### Development, Production, and Installed PWA

- Development mode: `npm install` and `npm run dev` are for contributors working on the app. Development mode unregisters LibNote service workers and clears matching app-shell caches to avoid stale local builds.
- Production build: `npm run build` creates the static app in `dist/`. `npm run preview` serves that production build locally for verification.
- Installed PWA: normal users install once from the deployed HTTPS site, then open LibNote from the installed icon.

Normal PWA installation requires HTTPS. Browsers allow `localhost` as a development/testing exception.

### Deploying So Users Can Install

LibNote is compatible with static hosts that can serve the Vite `dist/` output over HTTPS, such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or another static host.

The current Vite setup uses `base: '/libnote/'` for the GitHub Pages project URL `https://sci336.github.io/libnote/`. Built assets, the manifest, icons, and service worker are expected to load from that subpath. The manifest uses relative `start_url` and `scope` values (`"."`) so installed launches stay inside the deployed subpath.

If LibNote is moved to a root deployment or a different project path, update `vite.config.ts` first, then verify the manifest, service worker registration scope, icons, offline reload, and installed launch URL from that exact hosted URL.

See `docs/deploy-installable-pwa.md` and `docs/pwa-manual-qa.md` for deployment notes and manual install/offline/update checks.

## Setup and Development

This project uses npm, React, TypeScript, Vite, Lexical, Vitest, and Playwright.

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run the focused browser editor checks:

```bash
npm run test:e2e
```

Run TypeScript checks:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## GitHub Pages Deployment

This repo is configured for GitHub Pages at:

```text
https://sci336.github.io/libnote/
```

Deployment is handled by `.github/workflows/deploy-pages.yml`. In GitHub, set Settings -> Pages -> Build and deployment -> Source to GitHub Actions, then push to `main`. The workflow runs typecheck, tests, builds the Vite app, and publishes `dist/`.

The Vite base path is `/libnote/` so assets, the manifest, icons, and service worker load correctly from the GitHub Pages project URL.

See `docs/github-pages-deployment.md` for the full deployment and verification checklist.

There is no lint script in the current `package.json`.

Exact npm scripts:

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite` | Start the Vite development server. |
| `test` | `vitest run` | Run the Vitest test suite once. |
| `test:e2e` | `playwright test` | Run focused browser checks for the default editor. |
| `typecheck` | `tsc -b --pretty false` | Run TypeScript project-reference checks. |
| `build` | `tsc -b && vite build` | Typecheck and create a production build in `dist/`. |
| `preview` | `vite preview` | Serve the production build locally after building. |

## Tech Stack

- React 18.
- TypeScript.
- Vite.
- Lexical for the default rich text editor.
- IndexedDB for local persistence.
- Web App Manifest.
- Production service worker for the PWA/offline shell.
- Vitest with jsdom for tests.
- Playwright for browser-level Lexical editor checks.

The app intentionally keeps runtime dependencies focused. The current runtime dependencies are React, React DOM, and the Lexical packages used by the default editor.

## Project Structure

```text
src/
  App.tsx                 Main app composition, derived page/link/tag state, and view rendering
  main.tsx                React entry point plus service worker registration/cleanup
  styles.css             App-wide styling, themes, responsive layout, editor, sidebar, and menu styles

  components/            Shared UI components
    AppMenu.tsx          Library Guide, settings, themes, tag management, backup/restore, credits
    Sidebar.tsx          Collapsible library navigation and recent pages
    TopBar.tsx           App menu, breadcrumbs, navigation, and search
    LexicalPageEditor.tsx
                          Default Lexical editor, tags, move/export/delete actions, Page Info toggle
    PageEditor.tsx       Legacy contentEditable editor fallback behind the editor flag
    PageMetadataPanel.tsx
                          Writing stats, tags, outgoing links, backlinks, broken and ambiguous links
    SearchResultsView.tsx
                          Search result rendering and filters
    TagResultsView.tsx   Multi-tag result view and tag refinement

  views/                 Screen-level views
    RootView.tsx         Book shelf/home view and cover picker
    BookView.tsx         Chapter list for a book
    ChapterView.tsx      Page list for a chapter
    LoosePagesView.tsx   Unfiled pages
    TrashView.tsx        Restore and permanent deletion

  hooks/
    useLibraryApp.ts     Main application controller: routing, persistence, actions, search, tags, backup
    useDebouncedEffect.ts
                          Debounced persistence helper

  store/
    libraryStore.ts      Library mutations, normalization, trash, reorder, move, tag management
    librarySelectors.ts  Derived active items, sidebar context, breadcrumbs, parent navigation

  db/
    indexedDb.ts         IndexedDB load/save helpers for library and settings

  utils/
    backup.ts            Backup export/import, validation, repair, summaries, downloads
    search.ts            Search indexing, ranking, snippets, result labels
    tags.ts              Slash-tag parsing, normalization, suggestions, tag result helpers
    pageLinks.ts         Wikilink parsing, resolution, backlinks, ambiguity handling
    lexicalRichText.ts   Lexical HTML import/export and paste compatibility helpers
    richText.ts          Rich text sanitizing and plain-text conversion
    shortcuts.ts         Shortcut defaults, formatting, validation, matching
    appSettings.ts       Default and normalized persisted settings
    appThemes.ts         Theme definitions
    bookCovers.ts        Built-in cover templates and fallback cover selection
    pageStats.ts         Word, character, reading-time, and line counts

  types/
    domain.ts            Core app, library, settings, trash, shortcut, and view types

public/
  manifest.webmanifest   PWA manifest
  sw.js                  Production service worker
  icon.svg               App icon
  icon-192.png           Install icon
  icon-512.png           Install icon
  apple-touch-icon.png   iOS home-screen icon

docs/
  deploy-installable-pwa.md
                          Deployment notes for installable HTTPS hosting
  pwa-manual-qa.md       Manual QA for install, offline, update, and backup reminders
  search-manual-qa.md    Manual QA notes for text, tag, mixed, and loose-page search
  lexical-manual-qa-checklist.md
                          Manual QA checklist for Lexical editor coverage

e2e/
  lexical-editor.spec.ts Browser coverage for key default Lexical editor flows
```

## Tests

The current test suite covers core utility and store behavior:

- Backup validation/export helpers.
- Library store mutations, trash, restore, reorder, and move flows.
- Library selectors and derived navigation/sidebar data.
- Page links and backlinks.
- Search behavior.
- Rich text conversion/sanitization.
- Lexical rich-text import/export compatibility.
- Tag parsing and filtering.

Tests run with:

```bash
npm test
```

Type checking and production build verification run with:

```bash
npm run typecheck
npm run build
```

There is also a focused Playwright browser test for key default Lexical editor behavior:

```bash
npm run test:e2e
```

`docs/search-manual-qa.md` contains manual QA notes for text, tag, mixed, and Loose Page search. `docs/lexical-manual-qa-checklist.md` contains broader manual QA coverage for Lexical, including fallback-editor checks and browser/device scenarios that are not fully automated.

## Current Limitations and Notes

- Data is local to the browser profile unless exported and imported manually.
- There is no cloud sync, account system, server storage, encryption layer, or collaboration.
- Clearing browser storage can remove the local library.
- Restore replaces the current library; it does not merge two libraries.
- Restore creates a pre-restore safety backup for failed restore writes, but there is no durable persisted recovery journal or full last-known-good recovery layer.
- Navigation does not use URL routes, so books, chapters, and pages do not have shareable deep links.
- Recent Pages is fixed at 4 pages and is not currently configurable.
- The page editor uses Lexical by default and saves compatible rich HTML for search, export, backlinks, backup, and restore. The older contentEditable editor remains as a code fallback behind `USE_LEXICAL_EDITOR = false`.
- Large libraries use derived data and lazy search indexing, but there is no list virtualization or documented stress-test target for very large browser libraries.
- Offline behavior depends on the production service worker cache and local browser storage.
- The PWA shell is production-only; development mode unregisters service workers and clears matching app caches.
- Automated coverage is mostly unit/jsdom plus focused Playwright checks for the default Lexical editor. Broader browser rendering, accessibility, mobile/touch editor behavior, and PWA behavior still need manual verification.
- Ambiguous wiki links require the user to choose between duplicate page-title matches.
