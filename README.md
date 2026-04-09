# Note Library

An offline-first note app built with React, TypeScript, and Vite.

The app is organized like a personal library:

- `Books` are top-level topics.
- `Chapters` live inside books.
- `Pages` live inside chapters and hold the actual note content.
- `Loose Pages` are standalone notes outside the book hierarchy.

There is no backend, no authentication, and no URL routing. Everything runs locally in the browser and persists across refreshes and browser restarts.

## Project Overview

This is a structured notes app, not a collaborative workspace and not an AI tool.

The current app supports:

- books, chapters, pages, and loose pages
- internal state navigation with a persistent top bar
- a context-aware sidebar
- inline title editing for books, chapters, and pages
- plain-text page editing with auto-save
- local persistence with IndexedDB
- installable/offline PWA shell support
- manual drag-and-drop ordering for chapters within books
- manual drag-and-drop ordering for pages within chapters
- moving chapters between books
- moving pages between chapters
- moving loose pages into a book/chapter
- global page search with dedicated search results

## Current Features

- Full CRUD for:
  - books
  - chapters
  - chapter pages
  - loose pages
- Page editor:
  - plain text only
  - auto-save on change
  - adjustable text size
  - delete action
- Inline title editing behavior:
  - click to edit
  - `Enter` saves
  - blur saves
  - `Escape` cancels
- New page creation autofocus:
  - when a new page or loose page is created, the editor textarea is focused automatically

## Library Structure / Data Model

The app stores three main entity types:

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
  - `textSize`
  - `isLoose`
  - `sortOrder`
  - `createdAt`
  - `updatedAt`

The `sortOrder` field is used for persistent manual ordering inside a parent:

- chapters are ordered within a book
- pages are ordered within a chapter

## Navigation and Sidebar Behavior

Navigation uses internal React state only.

Top bar:

- always visible
- includes:
  - sidebar toggle
  - one-level-up back button when applicable
  - breadcrumb-like `Parent | Current` location display
  - global search input

Primary views:

- `Books` root view
- single `Book` view
- single `Chapter` view
- single `Page` editor view
- `Loose Pages` view
- dedicated `Search Results` view

Sidebar behavior is context-aware:

- root view shows books and recent loose pages
- book/chapter/page flows show the relevant book/chapter/page lists for the current context
- search view still keeps the library-oriented sidebar visible
- loose page contexts show loose pages

Sidebar contextual actions:

- create chapter from book-related context
- create page from chapter-related context
- create loose page from loose-page context
- drag-and-drop reorder chapters in the sidebar
- drag-and-drop reorder pages in the sidebar

Loose pages in the sidebar:

- the loose pages section shows the 3 most recent loose pages outside the full loose-pages screen
- a separate loose-pages view shows the full list

## Editing Experience

Page editing is plain text only.

Current behavior:

- page content auto-saves as state changes
- text size is adjustable with a range control
- page title is inline-editable
- loose pages can be converted into a book/chapter location
- new pages auto-focus the textarea when created from book/chapter or loose-page flows

## Organization Actions

### Reordering

Manual ordering is persistent and synchronized between the sidebar and main content.

Implemented today:

- drag-and-drop reorder chapters within a book
- drag-and-drop reorder pages within a chapter
- reordering works in:
  - sidebar
  - main content lists
- both surfaces stay in sync immediately because they read from the same ordered store data

### Moving Chapters and Pages

Implemented today:

- move a chapter from one book to another
- move a page from one chapter to another
- move a loose page into an existing chapter
- move a loose page into a newly created chapter inside a selected book

Behavior:

- moved chapters get a new valid `sortOrder` in the destination book
- moved pages get a new valid `sortOrder` in the destination chapter
- unaffected siblings keep valid order
- chapter pages move with their chapter automatically because pages remain attached to the chapter id
- source and destination views update immediately

Current movement UI:

- chapter cards in book view expose a `Move to...` action
- page cards in chapter view expose a `Move to...` action
- loose pages are moved from the page editor via `Convert to Book/Chapter`

## Search

The app has a global search bar in the top bar.

Current search behavior:

- searches pages, not books
- includes:
  - page title
  - page content
- covers:
  - chapter pages
  - loose pages
- matching is case-insensitive
- search query whitespace is normalized
- empty queries do not return noisy results

Current ranking strategy:

1. exact phrase in page title
2. exact phrase in page content
3. all search words present in page title
4. all search words present in page content
5. weaker partial matches

Search results view:

- dedicated `Search Results` screen
- shows the current query
- returns page-based results
- includes:
  - page title
  - path (`Book / Chapter` or `Loose Pages`)
  - short match-aware snippet
  - match label such as `Exact phrase in title`

Search is literal and phrase-based. There is no semantic search, typo correction, AI ranking, embedding search, or “did you mean” behavior.

## Persistence

Persistence uses browser-native IndexedDB.

- a single library snapshot is stored in IndexedDB under `note-library-db`
- data survives refreshes and browser restarts
- no backend services are involved

On load, stored data is normalized so older records without ordering fields still get valid `sortOrder` values.

## Offline / PWA Behavior

- note data is stored locally in IndexedDB
- a small service worker caches the app shell
- the app includes a web manifest and can be installed as a PWA

This is an offline-first local app, but the service worker is only caching the app shell. The note content itself persists because it is stored in IndexedDB.

## Important Implementation Notes

Current project structure:

- `src/components/`
  - top bar, sidebar, editor, move panels, reorderable lists, search results
- `src/layouts/`
  - app shell layout
- `src/store/`
  - domain helpers for creation, updates, reordering, movement, and normalization
- `src/db/`
  - IndexedDB persistence helpers
- `src/types/`
  - shared domain types
- `src/utils/`
  - ids, dates, and search/ranking helpers

Notable implementation details reflected in the code:

- list ordering is stored explicitly with `sortOrder`
- reordering and movement logic live in store helpers, not inside UI components
- search/ranking logic is separated into a utility module instead of living in the main app component

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Known Limitations / Obvious Next Improvements

The current app is functional, but a few limitations are visible from the code:

- books themselves are not manually reorderable
- chapter movement and page movement are currently initiated from main content cards, not from the sidebar
- regular page movement is not exposed from the page editor UI itself
- loose pages are sorted by recency rather than a manual order model
- there is no backend sync, collaboration, or auth
- there is no rich text editing, attachments, or markdown rendering
- there is no URL-based routing

These are limitations of the current implementation, not hidden features.
