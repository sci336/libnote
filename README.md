# iNote

`iNote` is a local-first notes app organized like a small personal library.

Instead of a flat list of notes, the app uses a simple hierarchy:

- Books
- Chapters inside books
- Pages inside chapters
- Loose pages that are not assigned to a chapter yet

The current UI is library-oriented rather than document-oriented. Navigation is built around a persistent top bar, a context-aware sidebar, and screen-level views for the root library, books, chapters, pages, search results, tag results, and loose pages.

The app is designed for browsing and organizing notes through structure first:

- the root screen acts like a library shelf
- books act as top-level collections
- chapters group related pages inside a book
- loose pages work like an inbox or staging area for notes that have not been filed yet

## Overview

The app runs entirely in the browser with no backend, accounts, or sync layer. Data is stored locally in IndexedDB and the app uses internal view state instead of URL routing.

At a high level, the current implementation supports:

- Creating, renaming, and deleting books, chapters, pages, and loose pages
- Reordering books, chapters, and chapter pages with drag and drop
- Moving chapters between books
- Moving pages between chapters
- Moving loose pages into existing chapters
- Plain-text page editing with inline title editing
- Page tags and tag-based filtering
- Wiki-style links with derived backlinks
- Global page search
- A settings screen for library density (`Books per row`)
- An app menu with Help, Shortcuts, Settings, and Credits sections

The implementation is intentionally client-side and self-contained. `useLibraryApp` acts as the main orchestration layer, while store helpers handle mutation logic and selectors derive read-only views of the current library state.

## Current Features

### Library structure

- Books are the top-level containers.
- Chapters belong to a single book.
- Pages belong to a chapter.
- Loose pages are regular pages with no chapter assignment.
- Loose pages can be moved into an existing chapter from the page editor.
- Books, chapters, and pages all carry timestamps and persistent ordering information where applicable.
- The persisted data model is normalized rather than nested, so relationships are rebuilt from IDs instead of being stored as deeply nested objects.

### Navigation

- The top bar is always visible.
- Navigation is view-state based rather than URL based.
- The breadcrumb shows the current location and, when applicable, the parent location.
- A back/up control appears when the current view has a parent.
- The root screen presents books as gallery-style cards.
- Opening a book leads to its chapter list.
- Opening a chapter leads to its page list.
- Opening a page leads to the editor.

The app currently renders these main view states:

- root library view
- book view
- chapter view
- page view
- loose pages view
- search results view
- tagged pages view

The top bar includes:

- app menu button
- sidebar toggle button
- back/up button when relevant
- breadcrumb-style location display
- global search input

### Sidebar behavior

The sidebar changes with the current view instead of showing one static tree.

- Root view: Books and a short Loose Pages list
- Book view: Books plus chapters for the active book
- Chapter view: Chapters for the active book plus pages for the active chapter
- Chapter page view: Chapters for the parent book plus pages for the parent chapter
- Loose page view: Books plus the full Loose Pages list
- Search view: Books plus Loose Pages
- Tag view: Books plus Loose Pages

The sidebar also supports:

- Creating chapters in book context
- Creating pages in chapter context
- Creating loose pages in loose-page context
- Reordering books, chapters, and chapter pages where applicable

On smaller screens, the sidebar is toggleable instead of always visible. The app hook opens it automatically on desktop-width layouts and treats it as an overlay on narrower widths.

### Root library view

- The main books screen uses a shelf-like gallery layout.
- Clicking the main card surface opens the book.
- Inline rename, add chapter, delete, and book reordering are preserved on the card.
- The gallery density is controlled by the `Books per row` setting.
- Fewer books per row produce larger cards; more books per row produce more compact cards.
- Additional books wrap into new rows naturally and the main content scrolls vertically as shelves accumulate.

### Book and chapter organization

- Book view lists chapters for the active book.
- Chapter view lists pages for the active chapter.
- Both views support inline renaming from the list surface.
- Book view supports:
  - creating chapters
  - deleting the current book
  - moving chapters to a different book
  - drag-reordering chapters
- Chapter view supports:
  - creating pages
  - deleting the current chapter
  - moving pages to a different chapter
  - drag-reordering pages

### Loose pages

- Loose pages have a dedicated screen.
- The root/search/tag sidebar shows a short loose-page list by default.
- The loose-pages screen shows the full loose-page list.
- Loose pages can be opened, renamed, and deleted like chapter pages.
- Loose pages can be moved into an existing chapter from the page editor.

## Search and Tags

### Search

- Search lives in the top bar.
- Search indexes pages only, not books or chapters directly.
- Text search looks across page titles and page content.
- Results appear in a dedicated Search Results view.
- Search results show:
  - page title
  - path (`Book / Chapter` or `Loose Pages`)
  - a content snippet when available
  - a match label

Search matching is currently:

- case-insensitive
- whitespace-normalized
- phrase-aware, with token fallback

Current search scope and output are intentionally narrow:

- search returns pages only
- books and chapters are not returned as separate result types
- results are sorted by score, then by most recently updated page
- empty searches show an instructional empty state rather than an all-pages view

### Tag behavior

- Tags are stored in lowercase normalized form.
- Tags are added from the page editor by typing into the tag input and pressing `Enter`.
- Page editor tag pills support:
  - opening tag search
  - removing the tag from the page
- Clicking tags in tag results can refine the active filter.
- Recent tags are remembered in app state and surfaced as quick-add suggestions in the dedicated tag results view.

### Tag query syntax

There are two implemented tag flows:

1. Click-driven tag filtering

- Clicking a tag opens the dedicated Tagged Pages view.
- The tag view supports multiple active tags.
- Multiple active tags use AND logic: a page must contain every selected tag.
- Removing an active tag updates the result set immediately.

2. Slash-tag search from the top bar

- Search input beginning with slash-prefixed tags such as `/history /mythology` is parsed as tag search.
- Slash-tag search still renders through the Search Results screen rather than the dedicated Tagged Pages view.
- The top-bar search input includes slash-tag autocomplete with keyboard navigation.
- The top-bar autocomplete uses currently known tags and can be navigated with arrow keys and `Enter`.

## Editing Experience

The page editor is plain text and textarea-based.

- Page titles are editable inline.
- Page content is edited in a textarea.
- Clicking the content preview enters edit mode.
- Blurring the textarea exits edit mode and returns to preview mode.
- New pages and new loose pages auto-focus the editor after creation.
- Page text size is adjustable per page with a range control.
- The page screen includes inline title editing, tag editing, content editing, delete actions, and loose-page move actions in one place.
- The preview surface is also the entry point into edit mode, so the current experience is edit-in-place rather than split into separate read and edit screens.

### Links and backlinks

Pages support wiki-style links in the form:

- `[[Page Title]]`

Current behavior:

- Links are resolved from current page titles
- Matching is case-insensitive
- Extra whitespace inside brackets is ignored
- The first normalized title match wins if there are duplicate page titles
- Resolved links are clickable in preview mode
- Unresolved links remain visible but are not clickable

Backlinks are derived from current content and rendered in a `Referenced by` section on the page screen when present.

### Tags in the editor

- Tags are displayed as pills under the page title.
- Each tag pill can:
  - open tag filtering for that tag
  - remove the tag from the page
- The editor validates new tags before saving them and ignores duplicates.

## Organization Actions

### Reordering

The current implementation supports drag-and-drop reordering for:

- Books
- Chapters within a book
- Pages within a chapter

Reordering is available in both the main content area and the sidebar where those lists are shown.

The same shared `ReorderableList` primitive is used across these surfaces, so drag/drop behavior is consistent between sidebar lists and main content lists.

### Moving

The current implementation supports:

- Moving chapters to a different book
- Moving pages to a different chapter
- Moving loose pages into an existing chapter

Move flows are context-specific:

- chapter moves are initiated from book view
- page moves are initiated from chapter view
- loose-page moves are initiated from the page editor
- destination choices are constrained to valid books/chapters in the current data set

## Settings and App Menu

The app menu currently includes:

- Help
- Shortcuts
- Settings
- Credits

The implemented settings surface is still intentionally small. Right now it includes:

- `Books per row` for the root books gallery

The app menu is not just a placeholder shell anymore, but it is still lightweight. It currently functions as the home for:

- usage/help copy
- implemented keyboard shortcuts
- the root-library density setting
- a small project credits/about section

## Persistence and Technical Notes

- Library data is stored in IndexedDB under the `note-library-db` database.
- The app stores:
  - one snapshot for library data
- one snapshot for app settings
- Persistence is debounced during normal interaction.
- A `pagehide` flush attempts to save the latest library data and settings when the page is being left.
- Hydration normalizes persisted state defensively, including missing or invalid settings values.
- Current persistence is coarse-grained: the library graph is written as a whole snapshot rather than being synced entity-by-entity.

### Offline behavior

- In production, the app registers a service worker.
- The service worker caches the app shell and same-origin GET responses.
- In development, existing service workers and `note-library-*` caches are cleaned up on load to avoid stale cached shells.
- Note content still lives in IndexedDB rather than in the service worker cache.

## Keyboard Shortcuts and Implemented Key Controls

The current code clearly implements these keyboard interactions:

- `Enter` commits inline title edits
- `Escape` cancels inline title edits
- `Enter` adds a tag from the page editor tag input
- `Escape` closes the app menu
- Search and tag suggestion inputs support:
  - `ArrowDown`
  - `ArrowUp`
  - `Enter`
  - `Escape`

These are implemented as local interaction controls, not as a global command system. The app menu itself explicitly describes broader keyboard navigation as future work rather than current functionality.

## Project Structure

Key parts of the current codebase:

- `src/App.tsx`
  - main shell composition and route-to-view rendering
- `src/hooks/useLibraryApp.ts`
  - central app orchestration, view state, persistence, search, and actions
- `src/views/`
  - root, book, chapter, and loose-page screens
- `src/components/`
  - top bar, sidebar, app menu, page editor, search results, tag results, and shared UI pieces
- `src/store/`
  - library mutation helpers and selectors
- `src/utils/`
  - search, tags, links/backlinks, IDs, dates, and page-state helpers
- `src/db/indexedDb.ts`
  - IndexedDB persistence helpers

Contributors should look first at:

- `src/hooks/useLibraryApp.ts` for app behavior and screen transitions
- `src/store/libraryStore.ts` for mutations and persistence-facing data rules
- `src/store/librarySelectors.ts` for derived lists and contextual navigation data
- `src/utils/search.ts`, `src/utils/tags.ts`, and `src/utils/pageLinks.ts` for core derived behavior

## Development

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

The following limitations are clearly visible in the current implementation:

- Editing is plain text only; there is no rich text or block editor.
- Navigation is internal state only; there are no deep-linkable URL routes.
- There is no sync, collaboration, or authentication.
- Search operates on pages only, not books or chapters as first-class search entities.
- Clicked tag filters and typed slash-tag queries do not use the same result screen:
  - clicked tags use the dedicated Tagged Pages view
  - slash-tag queries render through Search Results
- Loose pages are shown by recency rather than manual ordering.
- Duplicate page titles can make link resolution ambiguous because the first normalized match wins.
- The settings surface is still narrow and currently exposes only library density for the root books screen.
- Search/tag behavior is useful but not fully unified into one filtering model.
