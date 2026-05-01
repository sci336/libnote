# LibNote

LibNote is a local-first, library-inspired note app for organizing writing into books, chapters, pages, and loose pages.

It is built with React, TypeScript, Vite, IndexedDB, a Web App Manifest, and a production service worker. It does not currently use a backend, account system, cloud sync, URL routing, external state-management library, routing library, or full editor framework.

## What LibNote Is

LibNote is a personal writing and knowledge-organizing workspace that runs in the browser. Books contain chapters, chapters contain pages, and Loose Pages act like an inbox for notes that have not been filed into a chapter yet.

The app stores your library locally in the current browser profile. Backup and restore tools are available, but syncing across devices is not implemented yet.

## Current Features

### Library Organization

- Create, rename, reorder, and move books to Trash.
- Create, rename, reorder, move between books, and move chapters to Trash.
- Create, rename, reorder, move between chapters, and move pages to Trash.
- Create, rename, open, and move Loose Pages to Trash.
- Move Loose Pages into an existing chapter.
- Inline title editing for books, chapters, and pages.

### Navigation

- Sidebar navigation for Books, Chapters, Pages, Loose Pages, Trash, and Recent Pages.
- Contextual sidebar sections that change based on the active view.
- Top-bar navigation with Home, Back, sidebar toggle, search, and breadcrumb-style context.
- Recent Pages is automatic and fixed at 4 recent pages.
- The App Menu opens a Library Guide with Help, Shortcuts, Settings, Tag Management, Backup & Restore, and Credits.

### Search and Slash Tags

- Search runs live from the top bar.
- Text search covers live book titles, chapter titles, page titles, and page content.
- Results show the result type, location/path context, and snippets for page content matches.
- Slash tag search uses `/tag` syntax, such as `/history`.
- Multiple slash tags use AND filtering, such as `/history /mythology`; results must include every selected tag.
- Tag suggestions appear while typing slash tags.
- Pages have tag fields under the title, tags are normalized to lowercase, and clicking a tag opens tag filtering.

### Tag Management

- Tag Management is implemented in the App Menu.
- Users can review existing slash tags, filter the tag list, sort alphabetically or by use count, rename tags across the library, delete a tag from all pages, and merge one tag into another.
- Tags are derived from page metadata, so unused tags disappear when no page uses them.

### Page Editing

- Pages use a custom lightweight rich text editor built on `contentEditable`.
- The editor has Edit and Preview modes.
- The formatting toolbar supports text size presets, bold, italic, underline, highlight, headings, bullet lists, numbered lists, and checkbox/task lists.
- Common editor shortcuts are available for bold, italic, underline, highlight, bullet lists, and numbered lists.
- Checkbox/task list items can be checked and unchecked in the editor.
- Page content is saved as rich HTML locally, while search, backlinks, and `.txt` export use plain-text conversion helpers.
- Edits persist through debounced IndexedDB writes, with a `pagehide` flush to help protect recent changes when the tab closes.

### Links, Backlinks, and Page Info

- Wiki-style page links use `[[Page Title]]`.
- Link matching is case-insensitive and whitespace-normalized.
- Duplicate page titles are resolved by first match, which can make destinations ambiguous.
- Preview mode renders resolved page links and lets users create pages for broken links.
- Page Info is implemented and shows location, created/updated information, writing stats, tags, outgoing wiki links, backlinks, and broken links.

### Trash

- Deleting a book, chapter, page, or Loose Page moves it to Trash first.
- Trash supports restore, delete forever, and empty Trash.
- Restoring a book also restores its chapters and pages.
- Restoring a chapter also restores its pages.
- Restoring a page tries to return it to its original chapter. If that chapter is unavailable, the page is restored as a Loose Page.
- Delete Forever and Empty Trash are permanent.

### Backup, Restore, and Export

- Full-library export creates a JSON backup.
- Backups include books, chapters, pages, loose pages, tags, page text sizes, recent pages, books-per-row settings, and custom shortcuts.
- Import reads a JSON backup, validates it, asks for confirmation, and then replaces the current library and saved settings. It does not merge libraries.
- Individual pages can be exported as plain `.txt` files.

### Settings and Shortcuts

- Settings are stored locally in the browser.
- The root library view has a books-per-row setting.
- Global shortcuts are customizable for New Loose Page, New Page in Current Chapter, Toggle Sidebar, Go Home, and Go Back.
- Shortcut settings can be cleared, reset individually, or reset all at once.
- Recent Pages is automatic and is not configurable yet.

### PWA/Offline Shell

- `public/manifest.webmanifest` provides the web app manifest.
- `public/sw.js` provides the production service worker.
- The service worker precaches the app shell and caches same-origin GET assets as they are fetched.
- Offline behavior depends on cached assets and local browser storage. Development mode unregisters existing service workers and clears matching app caches to avoid stale local builds.

## How Data Is Stored

LibNote stores user data locally in IndexedDB. The library is persisted as a normalized snapshot containing books, chapters, and pages. App settings are stored separately in the same IndexedDB object store.

There is no backend service, account system, or cloud sync in the current implementation. Notes belong to the current browser profile and device unless they are manually exported and imported with the backup tools. Clearing browser storage can delete the local library.

## Current Limitations

- No cloud sync yet.
- No account system/authentication yet.
- No browser URL routing, shareable page URLs, or deep links yet.
- Local browser data can be lost if browser storage is cleared.
- Collaboration and multi-user editing are not implemented.
- The editor is custom/lightweight and still not a full editor framework.
- No explicit save status indicator beyond timestamps and local persistence behavior.
- Mixed text-plus-tag queries are not combined into one search mode yet.
- Recent Pages is fixed at 4 and not configurable yet.
- Duplicate page titles can make wiki-link destinations ambiguous.
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

The build script runs TypeScript project checks before creating the Vite production build.

## Project Structure

```text
src/
  App.tsx                 Main application shell and view rendering
  main.tsx                React entry point and service worker registration
  components/            Shared UI components, editor, sidebar, menu, search, tags
  layouts/               App layout wrapper
  views/                 Screen-level views for books, chapters, loose pages, trash, and root
  hooks/                 Application controller hook
  store/                 Library mutations, selectors, hydration, persistence helpers
  db/                    IndexedDB read/write layer
  utils/                 Search, tags, backup, shortcuts, page links, rich text, settings
  types/                 Domain types for books, chapters, pages, settings, and views
  styles.css             Application styling

public/
  manifest.webmanifest   PWA manifest
  sw.js                  Production service worker
  icon.svg               App icon

package.json             Scripts and dependencies
vite.config.ts           Vite configuration
tsconfig*.json           TypeScript configuration
```

## Roadmap / Future Ideas

These are planned or possible future improvements, not current implemented features:

- Save status indicator
- Better settings page/layout polish
- More advanced search filters
- Browser URL routing/deep links
- Better mobile layout
- Design polish
- Sync across devices
- Version history
- Templates
- Attachments/images
- More robust editor foundation if needed later

## Tech Stack

- React 18
- TypeScript
- Vite
- IndexedDB
- Web App Manifest
- Service Worker
