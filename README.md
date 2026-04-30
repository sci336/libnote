# iNote

`iNote` is a local-first note app built around a library metaphor. It runs entirely in the browser, stores data locally on the device, and organizes notes into Books, Chapters, Pages, and Loose Pages.

This README reflects the current implementation in the codebase today.

## Overview

- Books are the top-level containers.
- Chapters belong to books.
- Pages belong to chapters.
- Loose Pages are standalone pages that are not inside a chapter.
- The app is local-first: there is no backend, account system, or cloud sync.
- Full-library backups can be exported to local JSON files and restored later on the same browser or another browser.
- Navigation is handled with in-memory app state rather than URL-based routing.

## Current Features

### Library Structure

- Create, rename, open, and delete books.
- Create, rename, open, and delete chapters inside books.
- Create, rename, open, and delete pages inside chapters.
- Create, rename, open, and delete loose pages.
- Deleting a book deletes its chapters and the pages inside those chapters.
- Deleting a chapter deletes the pages inside that chapter.
- Books are shown in recent-activity order, based on `updatedAt`.
- Loose Pages are shown in recent-update order.

### Navigation

- Sidebar-based navigation for books, chapters, pages, and loose pages.
- Breadcrumb-style location display in the top bar.
- Back / up-one-level navigation in the top bar.
- Navigation between these views:
  - root library view
  - book view
  - chapter view
  - page view
  - loose pages view
  - search results view
  - tag results view
- Search and tag views remember where you came from, so going back returns to the previous context.
- The app does not use React Router or URL routes. View changes are handled with in-memory `ViewState`.

### Sidebar Behavior

- The sidebar is context-aware and changes based on the active view.
- Root, search, tag, loose-page, and loose-pages flows show Books and Loose Pages.
- Book view shows the active book's chapters.
- Chapter view shows sibling chapters and the active chapter's pages.
- Page view shows the surrounding chapter/page context for chapter pages, or the Books and Loose Pages sections for loose pages.
- Sidebar actions change with context:
  - `+ New Chapter` appears when a book is active.
  - `+ New Page` appears when a chapter is active.
  - `+ New` for Loose Pages appears in loose-page contexts.
  - `View All` appears for Loose Pages when you are not already in the Loose Pages view.
- The sidebar is collapsible.
- On wider screens it opens automatically; on smaller screens it behaves like a mobile drawer with a backdrop and closes after navigation.
- Chapters and pages can be reordered directly from reorderable sidebar sections when the current context supports it.

### Page Editing

- Pages use a plain-text editor.
- Page titles are editable inline.
- Page content auto-saves by updating in-memory state immediately and persisting to IndexedDB with a short debounce.
- A `pagehide` flush is used to reduce the chance of losing the last few edits when the tab closes.
- Each page has its own text size slider, from `14px` to `24px`.
- Newly created pages and loose pages auto-focus into the editor.
- Page content has two modes:
  - edit mode with a `<textarea>`
  - preview mode with rendered internal links

### Search

- Global search lives in the top bar.
- Text search searches page titles and page content.
- Search results are page-based.
- Results include:
  - page title
  - page path (`Book / Chapter` or `Loose Pages`)
  - a snippet or preview
  - a match label
- Search highlights matching words or phrases in result titles and snippets.
- Text search is case-insensitive and whitespace-normalized.
- Search does not index book titles or chapter titles as standalone searchable items.
- Books and chapters appear in search only as path context for matching pages.

### Tags

- Pages have stored tags as a per-page array of strings.
- Tags are added from the page editor using the tag input under the page title and pressing `Enter`.
- Tags entered in the editor are lowercased before storage.
- Clicking a tag on a page opens tag filtering for that tag.
- The dedicated tag-search syntax is slash-based in the search bar, for example `/history`.
- Multiple slash tags can be combined, for example `/history /mythology`.
- Multi-tag filtering uses AND logic: a page must contain every selected tag.
- There is a dedicated Tagged Pages view for tag filtering.
- The tag results view lets you:
  - remove active tags
  - add another tag
  - click recent tags
  - click tags on matching result cards to refine the filter
- Recent tags are tracked in memory during the current app session and surfaced in the tag results view.

Tag behavior to be aware of:

- Search/filter input is slash-based, like `/tagname`.
- Tag pills in the UI are currently displayed with a `#tag` visual label.
- Tags are not hashtag-parsed from page body text.
- Tags are added explicitly through the page editor, not by typing `#tag` into note content.

### Wiki Links and Backlinks

- Pages support wiki-style links written as `[[Page Title]]`.
- In preview mode, resolved links become clickable inline buttons.
- Clicking a resolved page link opens the linked page.
- If a link does not resolve, it stays visible as an unresolved link instead of disappearing.
- Backlinks are derived automatically from current page content.
- When the current page is referenced by other pages, the editor shows a `Referenced by` section with backlink navigation.
- Link resolution is case-insensitive and whitespace-normalized.
- If multiple pages share the same title, the first matching page wins.

### Reordering and Moving

- Drag-and-drop reordering of chapters within a book is implemented.
- Drag-and-drop reordering of pages within a chapter is implemented.
- Chapters can be moved between books.
- Chapter pages can be moved between chapters.
- Loose pages can be moved into an existing chapter from the page editor.
- Moving a loose page into a chapter converts it into a normal chapter page.
- There is no drag-and-drop move between containers; moves between books/chapters use explicit move panels and selectors.

### Menu, Help, and Shortcuts

- The top-left hamburger menu opens an app menu overlay.
- The app menu includes these sections:
  - Help
  - Shortcuts
  - Settings
  - Backup & Restore
  - Credits
- The Help section explains the current library, search, tag, and link model.
- The Shortcuts section currently documents inline-edit commit/cancel, tag-entry `Enter`, and menu-close `Esc`.
- The Settings section includes library layout controls and shortcut customization.
- The Backup & Restore section lets you export the full library to a local JSON backup and import that backup later.
- The Credits section is informational.

### Settings

Current implemented settings are:

- Root library books-per-row layout.
- Global keyboard shortcuts.
- Recent pages.
- Per-page text size is implemented in the page editor and saved on each page.

### Backup and Restore

- The app can export the full library to a local `.json` backup file.
- Backups include books, chapters, pages, loose pages, and current saved settings.
- Importing a backup replaces the current in-browser library after a confirmation prompt.
- Invalid backup files are rejected without modifying existing data.
- Individual pages can also be exported as plain `.txt` files from the page editor.
- Because notes are stored locally in the browser, regular manual backups are strongly recommended.

Not currently implemented as app-wide settings:

- books-per-row controls
- dynamic book sizing controls
- global display preferences
- global editor preferences
- shared sidebar/search behavior settings

### Local-First and PWA Behavior

- Library data is persisted in IndexedDB.
- The app stores the library as a single local snapshot in the browser.
- App settings are also stored locally in IndexedDB.
- A web app manifest is present at [public/manifest.webmanifest](/Users/matthewcampbell/Documents/note%20app/public/manifest.webmanifest).
- A service worker is present at [public/sw.js](/Users/matthewcampbell/Documents/note%20app/public/sw.js) and is registered in production builds.
- In production, the service worker caches the app shell and same-origin assets it fetches.
- In development, existing service workers and matching caches are cleaned up on load to avoid stale-cache behavior.

Practical limitation:

- Notes are local to the current browser profile/device unless you export and import backups manually.

## Tech Stack

- React 18
- TypeScript
- Vite
- IndexedDB for persistence
- Web App Manifest + service worker for the PWA shell
- No external state-management or routing library is currently used
- No editor framework is currently used; page editing is plain textarea-based

## Development

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

These commands come from [package.json](/Users/matthewcampbell/Documents/note%20app/package.json).

## Current Limitations

- No cloud sync.
- No account system or authentication.
- No multi-user collaboration.
- No multi-device sync beyond whatever the browser itself keeps locally.
- Search is page-focused and does not search books or chapters as standalone records.
- Mixed text-plus-tag queries are not supported as one combined search mode; the search bar currently treats input as either text search or slash-tag filtering.
- The editor is plain text only; there is no rich text, Markdown toolbar, or block editor.
- App-wide settings are mostly not implemented yet.
- Tag UI is slightly split:
  - filtering uses slash syntax like `/history`
  - visible tag pills are rendered with `#history`
- Tag entry in the page editor is explicit input-based rather than body-text parsing.
- Wiki links resolve by page title, and duplicate page titles can lead to ambiguous destinations.
- Offline behavior depends on what the service worker has already cached in the current browser.

## Roadmap / Future Ideas

Ideas that are not implemented in the current codebase:

- export/import tools for moving notes between browsers or devices
- sync across devices
- richer editor capabilities
- more complete app-wide settings
- stronger keyboard-driven navigation and shortcuts
- better handling for duplicate wiki-link targets
- broader search scope or more advanced filtering

## Project Notes

- The app is intentionally structured as a personal note library, not a cloud workspace.
- Navigation, search, backlinks, and tag results are derived from one local in-memory data graph.
- Persistence is browser-local, so cloning the repo does not give you another user's notes.
