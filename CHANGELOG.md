# LibNote Development Story

This document summarizes LibNote's progression from the Git history. It is written as a product changelog rather than a commit-by-commit dump, so related changes are grouped into the way the app actually evolved.

## Current Snapshot

LibNote is now a coherent local-first browser note app organized around a personal library metaphor: Books contain Chapters, Chapters contain Pages, and Loose Pages hold quick notes before they are filed. The app includes IndexedDB persistence, a library bookshelf/home experience, book covers, themes/settings, Lexical rich text editing as the default editor path, slash tags, wiki links, backlinks, search filters, trash/restore, backup/export/import with merge-or-replace preview, app-menu guide areas, recent pages, keyboard shortcuts, and PWA shell support.

## Timeline

### Unreleased: Current Local-First Library App

The current codebase reflects LibNote as a usable local-first library note app rather than a prototype:

- Library data and app settings persist locally in IndexedDB, with debounced autosave, `pagehide` flush behavior, save status, and retry handling for failed saves.
- The library model supports Books, Chapters, Pages, and Loose Pages, including rename, reorder, move, trash, restore, permanent delete, and empty-trash flows.
- The Books home view is a bookshelf/library experience with configurable shelf layouts, books-per-row settings, persisted book covers, and a cover picker.
- The App Menu opens a Library Guide with Help, Shortcuts, Settings, Themes, Tag Management, Backup & Restore, and Credits sections.
- Themes/settings include app theme selection, library layout controls, customizable global shortcuts, local storage counts, and backup reminder status.
- Lexical is the default rich text editor path. It supports text size presets, headings, bold, italic, underline, highlight, bullet lists, numbered lists, checkbox/task lists, undo/redo, sanitized paste handling, edit/preview modes, page info, and plain-text page export from rich content.
- Slash tags are stored as page metadata, normalized, suggested in relevant inputs, searchable with `/tag` syntax, and manageable across pages through rename, delete, and merge tools.
- Tag search supports tag-only, multi-tag AND filtering, and mixed text-plus-tag page searches.
- Wikilinks use `[[Page Title]]` syntax with editor autocomplete, preview rendering, missing-link page creation, backlink derivation, broken-link reporting, and ambiguous-link handling for duplicate page titles.
- Search covers live book titles, chapter titles, page titles, page content, loose pages, and a separate Trash filter, with result types, context labels, snippets, and ranking.
- Backup & Restore exports full-library JSON backups, validates imported files, repairs or skips recoverable issues with warnings, shows an import preview, and lets users either replace the current library or merge a backup additively into the current library.
- Merge import matches by stable IDs first, then by unique normalized titles in safe parent locations. It appends missing books, chapters, pages, and loose pages, skips exact existing items, keeps conflicts as imported duplicates, ignores imported settings/recent pages, and skips imported Trash so current active data is not deleted.
- Production builds include a PWA manifest and service worker shell caching; development mode unregisters app service workers and clears matching caches.
- Large-library work added derived selector data, lazy search indexing, and capped search/tag result lists so bigger personal libraries stay more responsive.
- `useLibraryApp` was split into focused hooks for search/tags, tag actions, page actions, chapter actions, book actions, settings actions, App Menu state, shortcuts, backup actions, and trash helpers. View navigation and history intentionally remain in `useLibraryApp`.
- Navigation/history tests now protect book/chapter/page openings, Home, Back, Loose Pages, Trash, create flows, move flows, page trash fallback views, and search/tag result origin behavior.
- Automated coverage includes Vitest unit/jsdom tests across store, selectors, backup, search, tags, page links, rich-text helpers, save status, navigation/history, accessibility, PWA status, App Menu, and trash behavior, plus Playwright coverage for Lexical editor, Trash data-safety, and mobile/narrow viewport flows.

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
- The plain textarea editor was replaced with rich text page editing.
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

This round focused on polish, correctness, and performance:

- Stale LibNote copy was updated.
- Dead editor helpers were removed.
- Ambiguous wiki-link destinations were handled.
- Rich-text paste input was sanitized.
- Large-library selectors and search were optimized.
- Search and tag result lists gained a 200-result cap with guidance to narrow broad searches.
- `useLibraryApp` was refactored into smaller focused hooks while keeping navigation/history in the coordinator.
- Navigation/history regression tests were added for current Back/Home/search/tag/move/trash behavior.
- The README was refreshed for current app behavior.

This phase tightened the app around larger libraries and richer content. It reduced confusing wiki-link behavior, made pasted content safer, and improved derived library data/search performance.

### May 6, 2026: Recovery, Persistence, Accessibility, Scale, and PWA Support

May 6 was a broad reliability and platform pass:

- Backup restore gained safer pre-restore snapshots, recovery snapshot handling, safety-backup download paths, and manual QA coverage for failed restore writes.
- IndexedDB persistence was hardened with clearer storage exceptions, transaction error handling, settings/library read-write tests, and save-status recovery guidance.
- Search, tags, and wikilink navigation were tightened with stricter tag normalization, safer search/tag origin handling, improved page metadata link summaries, and broader regression tests.
- Large-library fixtures, scaling tests, capped result lists, and manual QA guidance were added for search, tag results, backlinks, and Trash result behavior at higher volumes.
- Accessibility, keyboard, and mobile UX improvements landed across editable titles, reorderable lists, sidebar controls, top-bar controls, search/tag result affordances, focus states, and manual QA docs.
- Sidebar reorder controls were simplified by removing visible arrow controls from normal sidebar rows.
- PWA install/offline support improved with manifest/icon updates, service worker shell caching, a visible PWA status component, install/offline documentation, and manual QA coverage.
- The old Lexical prototype doc was renamed into Lexical editor history, and deployment/install documentation was expanded.

This was the point where LibNote's local-first safety story became more robust: failed writes were easier to understand, restore recovery became recoverable after refresh, and app installation/offline behavior became a first-class documented path.

### May 7, 2026: GitHub Pages Deployment Setup

Deployment support was added for publishing the static app:

- GitHub Pages deployment workflow configuration was introduced.
- Deployment documentation was added for the installable PWA build.
- Custom-domain setup was exercised through CNAME changes.

This made the browser-only app easier to ship and verify outside a local development server.

### May 8, 2026: Browser Coverage, Autosave Hardening, and Tag Input Rules

May 8 expanded end-to-end confidence and tightened several user-facing safety paths:

- Autosave failure handling was hardened with retry warnings, before-unload protection, failed-save export guidance, and tests for recovery behavior.
- Tag input was restricted to slash-only syntax so tag creation and filtering stay consistent with LibNote's `/tag` model.
- Lexical editor Playwright coverage was expanded for core editor behavior, paste/formatting paths, wikilinks, slash tags, and mobile-relevant interactions.
- Trash restore/delete flows gained Playwright coverage for safer browser-level regression testing.
- Mobile sidebar and editor autocomplete flows gained Playwright coverage.
- PWA, restore, Lexical, accessibility/mobile, and search manual QA docs were refreshed.
- Local Codex worktree artifacts were removed from the repository.

This day moved more of LibNote's risky local-first workflows from "works in unit tests" into browser-level verification.

### May 9, 2026: Safe Backup Merge Import

May 9 combined architecture cleanup, mobile shell work, editor/tag polish, and a new backup import mode.

Architecture and regression coverage:

- `useLibraryApp` was split further into dedicated hooks for trash actions, shortcut handling, search/tag routing, backup actions, page actions, tag actions, chapter actions, book actions, app settings, App Menu state, and global shortcuts.
- App Menu backup/settings/shortcut sections moved into focused components to reduce the main menu component's responsibility.
- Navigation history regression tests were added for book/chapter/page openings, Back/Home, Loose Pages, Trash, create flows, move flows, page trash fallback views, and search/tag result origin behavior.
- Restore recovery tests were hardened, and service worker cache cleanup behavior was tightened.

Mobile and editor polish:

- The mobile app shell was redesigned with dedicated top and bottom mobile navigation, safe-area handling, responsive layout updates, and mobile-focused E2E adjustments.
- Mobile page editor layout, toolbar spacing, icons, bottom navigation, and header spacing were refined.
- Tag submission was fixed, dark selection contrast was improved, and the extra tag add button was removed to keep slash-tag entry cleaner.

Backup import gained a second mode alongside full restore:

- The existing destructive restore path was preserved as **Replace current library**.
- A new **Merge into current library** path was added for additive imports.
- Merge uses stable IDs first, then unique normalized title matches for books, chapters within matched books, and pages within matched chapters or Loose Pages.
- Missing imported books, chapters, pages, and loose pages are appended after existing sibling items without disrupting current sort order.
- Matching pages with different content are treated as conflicts and imported as suffixed duplicates such as `(Imported)` instead of overwriting current content.
- Imported settings and recent pages are ignored during merge; replace remains the only mode that restores settings.
- Imported Trash is skipped during merge so it cannot delete or override current active items.
- Import preview now includes merge counts for additions, skipped existing items, duplicated conflicts, ambiguous names, Trash handling, settings, and recent pages.
- Merge uses the same safety snapshot/recovery path as restore where practical, so failed writes keep the previous library available.
- README and manual QA docs now explain merge vs. replace and call out that merge is not the same as sync.

The overall result is a cleaner app-controller architecture, a more app-like mobile experience, and safer backup movement between browser libraries without forcing a full restore.

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
- **Restore recovery, IndexedDB hardening, accessibility, scale, and PWA install/offline:** May 6, 2026
- **GitHub Pages deployment:** May 7, 2026
- **E2E coverage, autosave recovery, and slash-only tag input:** May 8, 2026
- **Hook/component architecture cleanup and mobile app shell:** May 9, 2026
- **Safe backup merge import:** May 9, 2026

## Overall Arc

The history shows a steady progression from a basic local note-taking app into a personal library workspace. The first commits created structure. The middle commits made the hierarchy navigable and searchable. The later commits made the app safer, richer, more customizable, and more scalable.

The clearest product direction is local-first knowledge management with a library feel: private writing, organized collections, recoverable data, rich page editing, and lightweight relationships through tags and wiki links.
