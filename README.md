# LibNote

LibNote is a local-first, library-inspired note app for organizing writing into Books, Chapters, Pages, and Loose Pages.

It is built with React, TypeScript, Vite, IndexedDB, a Web App Manifest, and a production service worker. The app currently runs entirely in the browser: there is no backend, account system, cloud sync, collaboration layer, URL router, or full editor framework.

## What LibNote Is

LibNote is a personal writing and knowledge-organizing workspace. Books contain chapters, chapters contain pages, and Loose Pages act like an inbox for notes that have not been filed into a chapter yet.

Your library is stored locally in the current browser profile. Backup and restore tools are available for moving or protecting data, but syncing across devices is not implemented.

## Current Features

### Library Organization

- Create, rename, reorder, and move books to Trash.
- Create, rename, reorder, move between books, and move chapters to Trash.
- Create, rename, reorder, move between chapters, and move pages to Trash.
- Create, rename, open, and move Loose Pages to Trash.
- Move Loose Pages into existing chapters.
- Inline title editing for books, chapters, and pages.
- Drag-based reordering in supported book, chapter, and page lists.
- Recent Pages in the sidebar, automatically tracking up to 4 recently opened pages.

### Trash

- Deleting a book, chapter, page, or Loose Page moves it to Trash first.
- Trash supports restore, delete forever, and empty Trash.
- Restoring a book also restores its chapters and pages.
- Restoring a chapter also restores its pages.
- Restoring a page tries to return it to its original chapter. If that chapter is unavailable, the page is restored as a Loose Page.
- Delete Forever and Empty Trash are permanent.

### Navigation

- Sidebar navigation for Books, Chapters, Pages, Loose Pages, Trash, and Recent Pages.
- A collapsible sidebar that opens by default on wider screens and can be toggled from the top bar or shortcut.
- Top-bar controls for Home, Back, sidebar toggle, global search, breadcrumbs/context, and the top-left App Menu.
- Breadcrumb/context behavior is derived from the current in-memory view state.
- Navigation is handled in React state, not URL routing, so pages do not have shareable deep links.
- The App Menu opens the Library Guide.

### Search and Slash Tags

- Global search from the top bar across live book titles, chapter titles, page titles, and page content.
- Search result cards show type labels, paths/context, and snippets for page content matches.
- Search filters for all results, pages, books, chapters, Loose Pages, and Trash.
- Slash-tag search uses `/tag` syntax, such as `/history`.
- Multiple slash tags use AND filtering, such as `/history /mythology`.
- Mixed text-plus-tag search is supported, such as `zeus /mythology /school`; the text must match page title or content, and every slash tag must be present.
- Tag suggestions/autocomplete appear in the search bar, page tag fields, tag result filters, and editor slash-tag suggestions.
- Pages have explicit tag fields under the title.
- Tags are normalized and displayed as slash-style pills.
- Clicking page, metadata, or result tag pills opens or narrows tag filtering.

### Tag Management

Tag Management is available in the App Menu / Library Guide.

- Review existing page tags.
- Filter the tag list.
- Sort tags alphabetically or by use count.
- Rename a tag across all pages.
- Delete a tag from all pages without deleting the pages.
- Merge one tag into another.
- Tags are derived from page metadata, so unused tags disappear when no page uses them.

### Page Editing

- A lightweight rich-text editing foundation built on `contentEditable`.
- Edit and Preview modes.
- Formatting toolbar for text size presets, bold, italic, underline, highlight, headings, bullet lists, numbered lists, and checkbox/task lists.
- Keyboard formatting shortcuts for bold, italic, underline, highlight, bullet lists, and numbered lists.
- Checkbox/task list items can be checked and unchecked in the editor.
- Page content is saved as rich HTML locally; search, backlinks, and text export use plain-text conversion helpers.
- Debounced autosave to IndexedDB, plus a `pagehide` flush to protect recent changes when the tab closes or backgrounds.
- Save status indicator with saving, saved with last saved time, and failed/retry states.
- Individual page export as `.txt`.
- Inline page title editing.

### Links, Backlinks, and Page Info

- Wiki-style page links use `[[Page Title]]`.
- Link resolution is case-insensitive and whitespace-normalized.
- Page-link autocomplete appears when typing `[[` in the editor.
- Preview mode renders resolved wiki links as clickable page-link text.
- Broken wiki links can create/open a new page from the link target.
- Backlinks are derived from existing page content rather than stored separately.
- Page Info shows basics, location, created/updated timestamps, writing stats, tags, outgoing links, backlinks, and broken links.
- Duplicate page titles currently resolve to the first matching page, so wiki-link destinations can be ambiguous.

### App Menu / Library Guide

The top-left App Menu opens the Library Guide with these sections:

- Help
- Shortcuts
- Settings
- Themes
- Tag Management
- Backup & Restore
- Credits

### Settings and Customization

- Books per row: 2, 3, 4, or 5.
- Shelf style options: Shelf Rows, Simple Grid, Compact Shelf, and Large Cover View.
- Theme selection: Classic Library, Modern Minimal, Warm Study, Dark Archive, and Light Paper.
- Customizable global shortcuts for New Loose Page, New Page in Current Chapter, Toggle Sidebar, Go Home, and Go Back.
- Shortcuts can be changed, cleared, reset individually, or reset all at once.
- Browser and system-reserved shortcut combinations are blocked.
- Recent Pages are automatic, limited to 4, and not configurable yet.

### Backup, Restore, and Export

- Full-library JSON export.
- Full-library JSON import.
- Import validates the backup, reports warnings when recoverable data needs repair/defaults, and asks for confirmation before replacing the current library.
- Restore replaces the current browser library and settings; it does not merge libraries.
- Backups include books, chapters, pages, Loose Pages, trash metadata, page tags, page text sizes, recent pages, library view settings, theme, custom shortcuts, and backup timestamp settings.
- Individual pages can be exported as plain `.txt` files.
- Data remains local to the browser/device unless manually exported and imported.

### PWA and Offline Shell

- `public/manifest.webmanifest` provides the web app manifest.
- `public/sw.js` provides the production service worker.
- In production, the service worker precaches the app shell and caches same-origin GET assets as they are fetched.
- Navigation requests fall back to cached `index.html` when available.
- Offline behavior depends on cached assets and local browser storage.
- Development mode unregisters existing service workers and clears matching `note-library-*` caches to avoid stale local builds.

## How Data Is Stored

LibNote stores user data locally in IndexedDB. The library is persisted as a normalized snapshot containing books, chapters, and pages. App settings are stored separately in the same IndexedDB database.

There is no backend service, account system, or cloud sync in the current implementation. Notes belong to the current browser profile and device unless they are manually exported and imported with the backup tools. Clearing browser storage can delete the local library.

## Current Limitations

- No cloud sync.
- No account system.
- No collaboration or multi-user editing.
- No browser URL routing, shareable page URLs, or deep links.
- Local browser data can be lost if browser storage is cleared.
- Recent Pages are fixed at 4 and are not configurable.
- The editor is useful but still a lightweight custom editor, not a full Notion- or Google Docs-level editor.
- Duplicate page titles can make wiki-link resolution ambiguous because the first matching page is used.
- Offline behavior depends on what the production service worker has cached.
- Mobile behavior exists, but mobile polish can still improve.

## Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
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

`npm run build` runs TypeScript project checks with `tsc -b` before creating the Vite production build.

## Project Structure

```text
src/
  App.tsx                 Main application shell and view rendering
  main.tsx                React entry point and service worker registration/cleanup
  components/            Shared UI components, editor, sidebar, menu, search, tags, metadata
  hooks/                 Application controller hook
  layouts/               App layout wrapper
  views/                 Screen-level views for books, chapters, loose pages, trash, and root
  store/                 Library mutations, selectors, hydration, and persistence helpers
  db/                    IndexedDB read/write layer
  types/                 Domain types for books, chapters, pages, settings, and views
  utils/                 Search, tags, backup, shortcuts, page links, rich text, settings, themes
  styles.css             Application styling

public/
  manifest.webmanifest   PWA manifest
  sw.js                  Production service worker
  icon.svg               App icon

package.json             Scripts and dependencies
vite.config.ts           Vite configuration
tsconfig*.json           TypeScript configuration
```

## Tech Stack

- React 18
- TypeScript
- Vite
- IndexedDB
- Web App Manifest
- Service Worker
