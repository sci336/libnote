# Note Library

A local-first note app built with React, TypeScript, and Vite.

It organizes notes as a small personal library:

- Books hold broad topics
- Chapters sit inside books
- Pages hold the actual note content
- Loose Pages are pages that are not currently inside a chapter

There is no backend, no authentication, and no URL routing. Data is stored locally in the browser.

## Overview

Note Library is a structured notes app for personal knowledge organization. The app uses internal view state instead of URL routing and keeps the main library structure visible through a persistent top bar and context-aware sidebar.

The current app supports:

- Creating, renaming, and deleting books, chapters, pages, and loose pages
- Editing page content with auto-save
- Moving chapters between books
- Moving pages between chapters
- Converting loose pages into regular chapter pages
- Drag-and-drop reordering for chapters and pages
- Global phrase-based page search
- Local persistence with IndexedDB
- Installable PWA shell support

## Core Concept

The information architecture is:

- A `Book` contains `Chapters`
- A `Chapter` contains `Pages`
- A `Page` contains the note title and plain-text content
- A `Loose Page` is still a `Page`; it simply has no chapter yet

Important domain rule:

- Loose pages do not become chapters
- When a loose page is converted, it becomes a normal page inside a selected existing chapter

## Features

### Library Structure

- Books are the top-level containers
- Chapters live inside books
- Pages live inside chapters
- Loose Pages live outside the book/chapter hierarchy until moved into a chapter

### Creation and Editing

- Create books from the root library view
- Create chapters from book contexts
- Create pages from chapter contexts
- Create loose pages from loose-page contexts
- Rename books, chapters, and pages with inline editing
- Edit page content in a dedicated page editor
- Auto-save page content as you type
- Auto-focus the editor when a new page or loose page is created
- Adjust page text size with a built-in text-size control

### Organization

- Move chapters between books
- Move pages between chapters
- Convert a loose page into a regular page inside an existing chapter
- Preserve page content, title, text size, and valid ordering when items are moved

### Reordering

- Drag and drop chapters within a book
- Drag and drop pages within a chapter
- Reorder from both:
  - the sidebar
  - the main content area
- Keep sidebar and main content synchronized from the same ordered data
- Persist ordering across reloads

### Search

- Global search bar in the top bar
- Page-based results only
- Searches:
  - page title
  - page content
- Includes chapter pages and loose pages
- Case-insensitive matching with normalized whitespace
- Phrase-oriented ranking
- Dedicated search results view with:
  - page title
  - path (`Book / Chapter` or `Loose Pages`)
  - short snippet
  - match label

### Navigation and Sidebar

- Internal view-based navigation instead of URL routing
- Persistent top bar with:
  - sidebar toggle
  - back/up navigation when relevant
  - `Parent | Current` location display
  - global search input
- Context-aware sidebar that changes based on the current location
- Contextual sidebar actions for creating chapters, pages, or loose pages where appropriate
- Recent loose-page quick access in the sidebar, with a full Loose Pages view available separately

### Local-First / Offline

- IndexedDB persistence for the library data
- Data survives refreshes and browser restarts
- Service worker caches the app shell
- Web manifest supports installation as a PWA

## How It Works

The app keeps all library data in client-side React state and persists that data to IndexedDB.

High-level structure:

- `src/store/` contains library mutation helpers and pure selectors
- `src/hooks/` contains app orchestration and debounced persistence behavior
- `src/components/` contains reusable UI pieces like the top bar, sidebar, page editor, search results, and reorderable list
- `src/views/` contains the main screen-level views
- `src/utils/` contains focused helpers such as page-state helpers and search utilities
- `src/db/` contains the IndexedDB persistence helpers

Notable implementation details reflected in the current code:

- Chapters and pages use persistent `sortOrder` values for manual ordering
- Search uses a derived index plus phrase-based ranking and snippet generation
- Loose-page handling is explicit in the domain model rather than being treated as a different content type

## Tech Stack

- React
- TypeScript
- Vite
- IndexedDB for local persistence
- Native browser drag-and-drop for reordering
- Service worker + web manifest for the PWA shell

## Current Limitations

- Books themselves are not manually reorderable
- Chapter moves are initiated from book views, not from the sidebar
- Page moves between chapters are initiated from chapter views, not from the page editor for regular chapter pages
- Loose pages are shown by recency rather than by a manual ordering model
- Editing is plain text only; there is no rich text, markdown rendering, or attachments
- There is no sync, collaboration, or authentication
- Navigation is internal state-based only; there is no URL-deep-linking

## Future Improvements

Potential next steps that would fit the current architecture:

- Book reordering
- More polished collapsible sidebar sections
- Additional editor capabilities beyond plain text
- Optional sync/export features without changing the local-first model

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

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
