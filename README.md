# iNote

A local-first note app built with React, TypeScript, and Vite.

The app is organized as a personal library:

- Books contain chapters
- Chapters contain pages
- Pages hold the actual note content
- Loose pages are still pages, but they are not assigned to a chapter

There is no backend, no authentication, and no URL routing. The app runs entirely in the browser and persists its data locally.

## Project Overview

iNote is a structured note library rather than a collaborative workspace. It uses internal view state for navigation, a persistent top bar, a context-aware sidebar, and a dedicated page screen for editing and page-level navigation features.

The current codebase supports:

- Books, chapters, pages, and loose pages
- Inline title editing
- Plain-text page editing with auto-save
- Page tags
- Internal page links with `[[Page Title]]`
- Derived backlinks (`Referenced by`)
- Global text search
- Dedicated tag filtering views
- Reordering chapters and pages with drag and drop
- Moving chapters between books
- Moving pages between chapters
- Moving loose pages into existing chapters
- IndexedDB persistence
- PWA shell caching in production

## Current Feature Set

### Library Model

- Books are top-level containers.
- Chapters belong to a book.
- Pages belong to a chapter or exist as loose pages.
- Loose pages remain pages; they do not become chapters.
- Converting a loose page moves it into an existing chapter and turns it into a regular chapter page.

### CRUD and Organization

- Create, rename, and delete books
- Create, rename, and delete chapters
- Create, rename, and delete pages
- Create, rename, and delete loose pages
- Move chapters between books
- Move pages between chapters
- Move loose pages into chapters
- Reorder chapters within a book
- Reorder pages within a chapter

### Page Editing

- Plain-text editing only
- Auto-save through app state updates and debounced persistence
- Auto-focus when a new page or new loose page is created
- Adjustable text size
- Inline links rendered from `[[Page Title]]` when the page is not actively being edited
- Backlinks section shown when other pages reference the current page
- Page-level tags:
  - add by typing in the tag input and pressing `Enter`
  - remove from the page editor
  - click an existing tag to open or refine tag filtering

### Search and Tag Filtering

- Global search bar in the top bar
- Text search:
  - searches page titles and page content
  - uses case-insensitive, whitespace-normalized matching
  - shows a dedicated Search Results view
  - returns page-based results with path context and snippets
- Tag filtering:
  - uses the existing tag-view system rather than the generic search results screen
  - supports multiple active tags with AND logic
  - clicking tags adds to the active tag filter when already in tag view
  - removing tags updates results immediately

## Library Structure / Data Model

The core domain types are:

- `Book`
  - `id`
  - `title`
  - `createdAt`
  - `updatedAt`
- `Chapter`
  - `id`
  - `bookId`
  - `title`
  - `sortOrder`
  - `createdAt`
  - `updatedAt`
- `Page`
  - `id`
  - `chapterId` (`null` for loose pages)
  - `title`
  - `content`
  - `tags`
  - `textSize`
  - `isLoose`
  - `sortOrder`
  - `createdAt`
  - `updatedAt`

Important current behavior:

- `tags` are always normalized to an array during hydration.
- `sortOrder` persists manual ordering for chapters and chapter pages.
- Backlinks and internal page links are derived from current content and are not stored in persisted page data.

## Navigation Model

Navigation is entirely state-based.

The app uses these main view types:

- Books root
- Book view
- Chapter view
- Page view
- Loose Pages view
- Search Results view
- Tagged Pages view

The top bar is always visible and includes:

- sidebar toggle
- up-one-level/back control when relevant
- `Parent | Current` location display
- global search input

The app uses one shared page-opening path when opening pages from:

- sidebar page lists
- search results
- tag results
- backlinks
- inline page links

## Sidebar Behavior

The sidebar is context-aware.

### Root view

- Shows Books
- Shows recent Loose Pages

### Book view

- Shows Books
- Shows Chapters for the active book
- Allows creating a chapter in context
- Allows reordering chapters in the sidebar

### Chapter view

- Shows Chapters for the active book
- Shows Pages for the active chapter
- Allows creating a page in context
- Allows reordering pages in the sidebar

### Page view

- If the page belongs to a chapter:
  - shows Chapters for the parent book
  - shows Pages for the parent chapter
- If the page is loose:
  - shows Books
  - shows Loose Pages

### Loose Pages view

- Shows Books
- Shows the full Loose Pages list
- Allows creating a loose page in context

### Search view

- Keeps the library-oriented sidebar visible
- Shows Books and recent Loose Pages

### Tag view

- Behaves like the search shell rather than a chapter/book shell
- Shows Books and recent Loose Pages

## Search and Tag Filtering

There are currently two distinct search-related flows in the codebase:

### Standard text search

- Enter plain text in the top search bar
- The app opens the Search Results view
- Results are ranked using phrase-oriented text search over:
  - page title
  - page content
- Results include:
  - page title
  - path (`Book / Chapter` or `Loose Pages`)
  - snippet
  - match label

### Tag-specific filtering

- Clicking a tag pill opens the dedicated Tagged Pages view
- When already in tag view, clicking another tag adds it to the active filter
- Active tags use AND logic:
  - a page must include every active tag to appear
- Removing a tag updates results immediately
- Removing the last active tag exits tag view and returns to the root view

### Typed tag queries

The current app has mixed tag-query behavior:

- A query made entirely of space-separated `#tag` tokens is treated as a dedicated tag filter query and opens the Tagged Pages view.
  - Example: `#history #mythology`
- A query that starts with `/tag` still goes through the generic search path and is handled by the search utilities rather than the dedicated tag view.

This is the current implementation as it exists in code. The README reflects it as-is rather than smoothing it into one unified behavior.

## Editing Experience

The page screen is editing-first, but it also renders page relationships:

- Titles are editable inline.
- Content is plain text.
- Clicking the main content surface enters edit mode.
- Leaving the textarea exits edit mode and returns to the rendered view.
- In rendered mode:
  - `[[Page Title]]` references become clickable internal links when they resolve
  - unresolved references remain visible but are not clickable
- At the bottom of the page screen:
  - `Referenced by` appears only when backlinks exist
  - backlink rows are clickable and open the source page

Loose-page editing also includes a move flow:

- select a book
- select a chapter in that book
- move the loose page into that chapter

## Links and Backlinks

Internal links use double-bracket syntax:

- `[[Some Page Title]]`

Current behavior:

- Matching is based on page titles
- Matching is case-insensitive
- Extra whitespace inside the brackets is ignored
- The first normalized title match wins if there are duplicates
- Resolved links are clickable in rendered page content
- Unresolved links stay visible and safe

Backlinks are derived, not stored:

- If Page A contains `[[Page B]]`, then Page B can show Page A in `Referenced by`
- Repeated links from the same source page do not duplicate backlink rows

## Organization Actions

### Reordering

- Chapters can be drag-reordered within a book
- Pages can be drag-reordered within a chapter
- Reordering is available in:
  - the sidebar
  - the main content area
- Reordering is persisted via `sortOrder`

### Moving

- Chapters can be moved between books
- Pages can be moved between chapters
- Loose pages can be moved into chapters from the page editor
- Moved items receive valid ordering in their destination
- The source and destination views update immediately because the UI reads from the same store data

## Persistence / Offline Behavior

Persistence uses IndexedDB.

Current behavior:

- Data is stored in the `note-library-db` IndexedDB database
- The whole library snapshot is stored under a single key
- Stored data is normalized on hydration
  - missing tag arrays are backfilled to `[]`
  - chapter and page sort orders are normalized
- Persistence is debounced in the app hook
- A `pagehide` flush attempts to persist the latest state when the browser page is being left

Offline / PWA behavior:

- In production, a service worker caches the app shell
- In development, existing service workers and `note-library-*` caches are cleaned up on load to avoid stale-shell issues
- The app remains local-first because the actual note data is stored in IndexedDB, not in the service-worker cache

## Project Structure

Current top-level app structure:

- `src/hooks/`
  - app orchestration
  - debounced effects
- `src/views/`
  - root, book, chapter, and loose-page screen components
- `src/components/`
  - top bar
  - sidebar
  - page editor
  - search results
  - tag results
  - reorderable list
  - move panels
  - shared UI primitives
- `src/store/`
  - mutation helpers
  - selectors
- `src/utils/`
  - search
  - tags
  - page links/backlinks
  - page-state helpers
  - ids and dates
- `src/db/`
  - IndexedDB helpers

High-level architectural pattern:

- `useLibraryApp` is the main orchestration hook
- store functions own mutations
- selectors remain read-only
- `App.tsx` coordinates derived state and screen rendering
- derived features like backlinks and tag results are computed from current data rather than persisted separately

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Current Limitations

- Books are not manually reorderable
- The dedicated tag view and typed tag queries are not fully unified with slash-style tag input; the current code treats `#tag`-only queries as dedicated tag filters, while `/tag` still routes through the generic search path
- Tag display is not fully consistent across the app:
  - page editor tag pills render the raw stored tag text
  - tagged-pages navigation metadata and tag results currently render tags with `#`
- Regular chapter-page movement is initiated from chapter views, not from the page editor
- Chapter movement is initiated from book views, not from the sidebar
- Loose pages are shown by recency, not by manual ordering
- Editing is plain text only
- There is no sync, collaboration, or authentication
- Navigation is internal state only; there are no URL-deep-linkable pages or views
