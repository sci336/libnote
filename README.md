# LibNote

LibNote is a local-first, library-inspired note app built with React, TypeScript, and Vite. It runs in the browser and organizes notes around four core concepts:

- Books
- Chapters
- Pages
- Loose Pages

The app is designed as a personal writing and knowledge-organizing workspace. Books contain chapters, chapters contain pages, and Loose Pages act like an inbox for standalone notes that have not been moved into a chapter yet.

## Current Features

### Library Organization

- Create, rename, reorder, and move books to Trash.
- Create, rename, reorder, move, and move chapters to Trash.
- Create, rename, reorder, move, and move pages to Trash.
- Create, rename, open, and move Loose Pages to Trash.
- Move chapters between books.
- Move chapter pages between chapters.
- Move Loose Pages into an existing chapter.
- Restore trashed books, chapters, pages, and Loose Pages.
- Permanently delete individual trashed items or empty Trash.
- Recently opened pages appear in the sidebar.

### Navigation

- Sidebar navigation for Books, Chapters, Pages, Loose Pages, Trash, and Recent Pages.
- Contextual sidebar sections that change based on the active view.
- Collapsible sidebar with wider-screen and smaller-screen behavior.
- Top-bar navigation with Home, Back, sidebar toggle, and breadcrumb-style context.
- In-memory view state for navigation. Browser URL routing and deep links are not implemented yet.

### Search and Tags

- Global search from the top bar.
- Search across book titles, chapter titles, page titles, and page content.
- Search result cards show the result type, path context, and snippets for page content matches.
- Slash-based tag filtering, such as `/history`.
- Multiple slash tags can be combined, such as `/history /mythology`.
- Multi-tag filtering uses AND logic, so pages must include every selected tag.
- Tag suggestions are available while typing slash tags.
- Pages have explicit tag fields under the title.
- Tags are normalized to lowercase and displayed as tag pills.
- Clicking a page tag opens tag filtering.
- Recent tags are tracked during the current app session.

### Page Editing

- Rich-text editing foundation built on a `contentEditable` editor.
- Formatting toolbar for bold, italic, underline, highlight, heading, text size, bullet lists, numbered lists, and checkbox/task lists.
- Keyboard formatting shortcuts for common editor actions, including bold, italic, underline, bullet lists, and numbered lists.
- Inline title editing for books, chapters, and pages.
- Auto-save through debounced IndexedDB persistence.
- `pagehide` persistence flush to reduce the chance of losing recent edits when the tab closes.
- Inline text size presets for selected text or newly typed text.
- Individual page export as `.txt`.

### Links, Backlinks, and Metadata

- Wiki-style page links written as `[[Page Title]]`.
- Link resolution is case-insensitive and whitespace-normalized.
- The page metadata panel shows basics, location, created/updated timestamps, writing stats, tags, outgoing links, backlinks, and broken links.
- Backlinks are derived from existing `[[Page Title]]` links.
- Duplicate page titles currently resolve to the first matching page.

### Backup, Settings, and Shortcuts

- Full-library JSON export.
- Full-library JSON import with validation and confirmation before replacing the current library.
- Backups include books, chapters, pages, Loose Pages, and saved settings.
- Settings are stored locally.
- Root library books-per-row setting.
- Customizable global shortcuts for:
  - New Loose Page
  - New Page in Current Chapter
  - Toggle Sidebar
  - Go Home
  - Go Back
- Reset controls for individual shortcuts and all shortcuts.

### PWA and Offline Shell

- Web app manifest in `public/manifest.webmanifest`.
- Production service worker in `public/sw.js`.
- The service worker precaches the app shell and caches same-origin GET assets as they are fetched.
- Development mode unregisters existing service workers and removes matching app caches to avoid stale local builds.

## How Data Is Stored

LibNote stores user data locally in the browser using IndexedDB. The library is persisted as a normalized local snapshot containing books, chapters, and pages. App settings are also stored in IndexedDB.

There is no backend service, account system, or cloud sync in the current implementation. Notes belong to the current browser profile and device unless they are manually exported and imported with the backup tools. Clearing browser storage can delete the local library.

## Current Limitations

- No cloud sync yet.
- No account system or authentication yet.
- No browser URL routing, shareable page URLs, or deep links yet.
- Local browser data can be lost if browser storage is cleared.
- Collaboration and multi-user editing are not implemented.
- The editor has useful rich-text basics, but it is still a lightweight custom editor rather than a full editor framework.
- There is no explicit save status indicator beyond updated timestamps and local persistence behavior.
- Mixed text-plus-tag queries are not combined into one search mode. The search bar currently handles normal text search or slash-tag filtering.
- Full tag management is not implemented yet. Tags are managed per page and through filtering surfaces.
- Backlink handling is useful but basic; duplicate page titles can create ambiguous wiki-link destinations.
- Offline behavior depends on what the production service worker has cached in the current browser.
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

## Roadmap

These are planned or future ideas, not current implemented features:

- More complete Trash and restore workflows
- More capable page metadata panel
- Better backlink view
- Full tag management
- Better settings page
- Better search filters
- Browser URL routing and deep links
- Better mobile layout
- Visual design polish
- Sync across devices
- Version history
- Templates
- Attachments and images

## Tech Stack

- React 18
- TypeScript
- Vite
- IndexedDB
- Web App Manifest
- Service Worker

LibNote intentionally avoids a backend, external state-management library, routing library, and editor framework in the current codebase.
