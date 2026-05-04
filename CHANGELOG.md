# LibNote Development Story

This document summarizes LibNote's progression from the Git history. It is written as a product changelog rather than a commit-by-commit dump, so related changes are grouped into the way the app actually evolved.

## Current Snapshot

LibNote is now a local-first browser note app organized around a personal library metaphor: Books contain Chapters, Chapters contain Pages, and Loose Pages hold quick notes before they are filed. The app includes local IndexedDB persistence, rich text editing, slash tags, wiki links, backlinks, search filters, trash/restore, backup/export, themes, book covers, shelf layouts, keyboard shortcuts, and PWA shell support.

## Timeline

### April 8, 2026: First App Foundation

The project began as a note app with the first working application scaffold. The earliest work established the basic app shell and build setup, then cleaned up generated build/cache files so the repository could remain focused on source code.

At this point, the product was still an early note-taking foundation rather than the fuller library system it would become.

### April 9, 2026: Structure and Persistence Take Shape

The next wave focused on turning the initial app into a more maintainable application:

- App behavior was extracted into a dedicated hook.
- Views were separated into clearer pieces.
- Persistence and internal state handling were improved.
- The app's organization started moving toward a structured note library instead of a single flat interface.

This was the first major architectural pass. It gave later features a place to live without crowding the main app component.

### April 10, 2026: Tags and Linking Begin

The app started gaining discovery and connection features:

- Page tags were added.
- Slash-tag search began working.
- Multi-tag filtering arrived for tagged page views.
- Page-linking UI behavior was fixed and stabilized.

This was the point where LibNote began to feel less like a basic editor and more like a personal knowledge system.

### April 11, 2026: Library Browsing, Search, and Navigation Mature

April 11 was a major product-shaping day. The app's library metaphor became more concrete and navigable:

- Tag query behavior was unified between search and tag filtering.
- Tag browsing gained quick filters and recent tags.
- Slash-tag autocomplete and shared tag suggestions were introduced.
- Books could be manually reordered and displayed as compact clickable gallery cards.
- Library view settings were added.
- Unified search and navigation shortcuts were introduced.
- The README was rewritten and expanded to explain the app's current behavior.

This phase made the app more ergonomic. Users could browse books visually, filter through tag relationships, and navigate more quickly through the library.

### April 20, 2026: Shortcut Customization and Layout Polish

After a short pause in the history, development picked back up with refinement work:

- Keyboard shortcuts became customizable.
- Shortcut editing was hardened with validation and typing guards.
- Shortcut fields became directly editable.
- Temporary key listeners were added to capture shortcut edits.
- Book gallery cards were adjusted to fill the selected row layout.
- Recent Pages moved below Loose Pages and became limited to four items.

This work improved day-to-day use. The app became more personal and predictable, especially for keyboard-driven navigation.

### April 29-30, 2026: Safety, Recovery, and Rich Editing

The end of April added several features that made LibNote feel more durable and full-featured:

- Backup and restore support was added.
- Backup download compatibility was improved.
- Trash management was introduced for safer deletion.
- The page editor gained a formatting toolbar.
- The plain textarea editor was replaced with a rich `contentEditable` editor.
- Rich-text typing state was stabilized.
- A Page Metadata panel was added.
- Library guide copy and mobile menu layout were updated.

This was a major transformation. LibNote moved from structured note storage toward a safer writing environment with recoverability, richer editing, and better page context.

### May 1, 2026: Product Polish and Knowledge Features

May 1 was the largest visible expansion of the app. The work touched navigation, editing, settings, search, appearance, and metadata:

- Loose Pages were kept visible in the sidebar.
- Inline font size styling was applied in the rich text editor.
- The Page Info panel layout was refined.
- Wiki-link preview mode was added.
- Tag Management was added to settings.
- App menu scrolling was refined.
- A save status indicator was added to the editor.
- Settings were reorganized into a fuller control center.
- Backup reminder status was added to settings.
- Blank page content was allowed during backup imports.
- Sidebar sections became collapsible.
- Breadcrumbs became clickable across library views.
- Library shelf book covers and themes were refined.
- Wiki and tag autocomplete were added to the editor.
- Mixed text and tag search was supported.
- Search result filters were added.
- Saved book covers were persisted.
- More book cover templates and app themes were added.
- Shelf style options were added for the library home view.

This is where LibNote became recognizably itself: a customizable personal library with rich editing, structured organization, durable data tools, and knowledge-linking features.

### May 2, 2026: Backup Hardening

Backup restore validation was strengthened, with clearer warnings around potentially unsafe or invalid imports.

This was a quality and trust pass. The app already had backup/restore, but this work made that feature more careful.

### May 3, 2026: Stabilization, Search Performance, and Documentation

The latest work focused on polish, correctness, and performance:

- Stale LibNote copy was updated.
- Dead editor helpers were removed.
- Ambiguous wiki-link destinations were handled.
- Rich-text paste input was sanitized.
- Large-library selectors and search were optimized.
- The README was refreshed for current app behavior.

This phase tightened the app around larger libraries and richer content. It reduced confusing wiki-link behavior, made pasted content safer, and improved derived library data/search performance.

## Feature Evolution

### From Notes to a Library

LibNote started as a note app, then quickly adopted a stronger organizing model: Books, Chapters, Pages, and Loose Pages. Over time, the UI reinforced that model with book gallery cards, shelf layouts, cover styles, breadcrumbs, sidebar sections, recent pages, and move/reorder flows.

### From Simple Text to Rich Writing

The editor evolved from basic content entry into a rich writing surface. Formatting controls, font sizes, preview mode, wiki-link rendering, editor autocomplete, sanitized paste handling, autosave, and save status all arrived across the later commits.

### From Search to Knowledge Navigation

Search began with text and tag filtering, then expanded into multi-tag logic, mixed text-plus-tag queries, result filters, tag suggestions, wiki links, ambiguous link handling, backlinks, and page metadata. The app's navigation shifted from finding notes by title to exploring relationships between pages.

### From Local Storage to Safer Local-First Data

The app has remained local-first, with no backend or account system. But its data story became more serious over time: IndexedDB persistence, backup/export, restore validation, trash, restore flows, backup reminders, and large-library derived selectors all made the local model more reliable.

### From Utility to Personal Workspace

Customization grew steadily. Users gained configurable shortcuts, collapsible sidebar sections, themes, book covers, shelf styles, settings organization, and app-menu help. These changes made LibNote feel less like a demo and more like a personal writing environment.

## Major Milestones

- **Initial app:** April 8, 2026
- **Refactored app structure and persistence:** April 9, 2026
- **Tags and slash-tag search:** April 10, 2026
- **Library browsing and search/navigation polish:** April 11, 2026
- **Custom shortcuts and layout refinement:** April 20, 2026
- **Backup, trash, rich text, and page metadata:** April 29-30, 2026
- **Settings center, wiki links, themes, covers, and advanced search:** May 1, 2026
- **Backup validation:** May 2, 2026
- **Paste safety, ambiguous links, and large-library performance:** May 3, 2026

## Overall Arc

The history shows a steady progression from a basic local note-taking app into a personal library workspace. The first commits created structure. The middle commits made the hierarchy navigable and searchable. The later commits made the app safer, richer, more customizable, and more scalable.

The clearest product direction is local-first knowledge management with a library feel: private writing, organized collections, recoverable data, rich page editing, and lightweight relationships through tags and wiki links.
