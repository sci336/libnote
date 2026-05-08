# LibNote Updated Roadmap

This roadmap reflects the current codebase as of May 8, 2026. It replaces older assumptions about editor prototypes or broad productivity features with a focused path for making LibNote a dependable local-first personal library app.

LibNote should keep the home/library shelf dominant. Future work should strengthen Books -> Chapters -> Pages, Loose Pages, reliable local storage, rich writing, search, tags, links, and recovery. It should not drift into a dashboard, database, or Notion-style workspace.

## Current State Summary

LibNote already has a coherent library-first product shape. The app organizes notes as books, chapters, pages, and loose pages; stores the library locally in IndexedDB; autosaves changes; supports Trash, restore, backup export/import preview, search, slash tags, wikilinks, backlinks, rich text editing, app settings, themes, book covers, and a production PWA shell.

The main implementation is concentrated in `src/hooks/useLibraryApp.ts`, `src/store/libraryStore.ts`, `src/store/librarySelectors.ts`, `src/components/LexicalPageEditor.tsx`, and the utility modules under `src/utils/`. The README is mostly current and accurately describes Lexical as the default editor. The old contentEditable `PageEditor` remains as a fallback path behind `USE_LEXICAL_EDITOR = false`.

The project also has useful regression coverage: store tests, selector tests, search/tag/link/backup/rich-text tests, Lexical compatibility tests, component accessibility tests, persistence failure tests, Trash tests, and focused Playwright coverage for the default Lexical editor.

## Completed / Mostly Complete

- Books, chapters, chapter pages, and loose pages: create, rename, reorder, move, trash, restore, and delete forever are implemented.
- Local IndexedDB storage: the app stores one library snapshot and app settings in `src/db/indexedDb.ts`.
- Autosave/save status: debounced library persistence, `pagehide` flush, failure state, retry, and before-unload warning are implemented.
- Backup/export/import restore preview: backup payloads, validation, repair warnings, summary preview, restore, pre-restore safety backup, page `.txt` export, and last-backup reminder are implemented.
- Trash system: soft delete, cascade trash, restore behavior, delete forever, empty trash, original-location labels, and destructive copy are implemented.
- Search: live books, chapters, pages, loose pages, and separate trash results are indexed lazily and ranked with snippets.
- Slash tags: page metadata tags, slash-tag search, multi-tag AND filtering, mixed text plus tags, suggestions, tag results, and tag management are implemented.
- Wikilinks/backlinks: `[[Page Title]]` parsing, resolved/missing/ambiguous states, autocomplete, preview actions, outgoing links, backlinks, broken links, and duplicate-title awareness are implemented.
- Rich text editing: Lexical is the default editor path, not a prototype. It supports common formatting, text-size spans, lists, checklist items, paste sanitization, preview, page info, wikilink autocomplete, slash-tag autocomplete, and HTML compatibility.
- App menu/settings/help: Library Guide, shortcuts, settings, themes, tag management, backup/restore, credits, shortcut customization, storage stats, and focus management are implemented.
- Themes and covers: app theme packs, shelf style options, books-per-row settings, built-in CSS book cover templates, and a cover picker are implemented.
- PWA shell: manifest, app icon, production service worker install/activate/fetch behavior, visible offline/update status, and dev service worker cleanup are present.
- Existing tests: Vitest and Playwright cover many current core behaviors.

## Still Fragile / Needs Hardening

- Storage writes are coarse-grained whole-library snapshots. This is simple, but failed writes, quota limits, interrupted restores, and large snapshots need stronger end-to-end confidence.
- Restore replaces the entire library. The preview/validation path and pre-restore safety backup are good, but manual restore QA in clean profiles and more automated restore failure tests are still important.
- Autosave is debounced and has a `pagehide` flush, but there is no durable persisted journal or full last-known-good recovery layer if a write fails after many edits.
- Lexical is default, but mobile/narrow/touch behavior still needs QA. The editor still stores HTML as the canonical page content, so import/export compatibility must remain heavily tested.
- `docs/lexical-editor-history.md` preserves historical editor notes. Future public-facing docs should keep describing Lexical as the default editor.
- `PageEditor.tsx` is still a legacy fallback. That is useful for rollback, but it doubles QA surface and should be treated as compatibility code, not the main editor.
- Slash-tag input now rejects leading `#` in typed tag fields while preserving legacy saved prefixes through defensive normalization. Public UI and docs should continue keeping `/tag` as the only visible syntax.
- Wikilinks resolve by normalized title. Duplicate page titles are marked ambiguous, but there is no stable page-id link syntax or rename assistance.
- Derived selectors and lazy search indexing help scaling, but there is no virtualization, explicit search result cap, or documented stress-test size target.
- Accessibility is improving, but modals, cover picker, sidebar, autocomplete, keyboard reordering, Escape behavior, focus return, and mobile sidebar flows need wider regression coverage.
- PWA behavior is basic. Visible offline and update-ready status exists, but install/offline/update QA still needs to be repeated before releases.

## Roadmap Phases

### Phase 1: Reliability and Data Safety

**Goal:** Make local data feel trustworthy before adding more capability.

**Why this phase matters:** LibNote is local-first. If users do not trust autosave, restore, Trash, and backup, no later feature matters.

**What to build/fix:**

- Harden IndexedDB load/save error handling, including quota, unavailable storage, transaction aborts, and retry behavior.
- Keep the implemented pre-restore safety snapshot covered by tests and manual QA.
- Improve backup restore confirmation copy and make restore failure states more recoverable.
- Consider a durable persisted recovery journal or full last-known-good layer for failures that happen outside the current tab/session.
- Add backup reminder and export/import manual QA to the release checklist.
- Confirm Trash restore behavior for nested trashed books/chapters/pages and missing parent cases.
- Add tests for interrupted or failed restore writes and for recent-page cleanup after permanent deletion.

**What not to build:** Cloud sync, accounts, collaboration, merge import, dashboard recovery widgets, or duplicate backup controls outside App Menu.

**Why now:** This is the foundation for every future editor, search, and library workflow.

**Likely files/components affected:** `src/db/indexedDb.ts`, `src/hooks/useLibraryApp.ts`, `src/store/libraryStore.ts`, `src/store/librarySelectors.ts`, `src/utils/backup.ts`, `src/utils/storageError.ts`, `src/utils/backupReminder.ts`, `src/components/AppMenu.tsx`, `src/components/SaveStatusIndicator.tsx`, `src/views/TrashView.tsx`.

**Risks to watch for:** Accidental data replacement, stale save status after failed writes, safety backups existing only in the current restore flow, restoring settings that reference missing pages, Trash cascades deleting live children, and backup validation becoming too strict for older backups.

**Manual QA checklist:**

- Create a book, chapter, page, and loose page; edit content; reload; confirm persistence.
- Simulate or force a save failure; confirm failed save copy, retry, and before-unload warning.
- Export a full backup and confirm the downloaded JSON contains books, chapters, pages, tags, settings, and trashed items.
- Restore that backup in a clean browser profile and confirm counts, content, tags, wikilinks, settings, and Trash.
- Move a book, chapter, page, and loose page to Trash; restore each; delete forever; empty Trash.

**Automated tests to add/update:** `src/hooks/useLibraryApp.test.tsx`, `src/utils/backup.test.ts`, `src/store/libraryStore.test.ts`, `src/views/TrashView.test.tsx`, `src/components/SaveStatusIndicator.test.tsx`, plus a Playwright backup/export smoke test if file downloads are reliable in CI.

### Phase 2: Lexical Editor Hardening

**Goal:** Treat Lexical as the core default editor and reduce content corruption or editing regressions.

**Why this phase matters:** The editor is where user data is created. The default Lexical path needs soak time, sharper tests, and cleanup of old prototype framing.

**What to build/fix:**

- Verify text-size behavior for selected text, collapsed cursor typing, mixed-size content, and old HTML.
- Harden underline, highlight, headings, bullet lists, numbered lists, checklist items, and toolbar active states.
- Expand paste QA for Google Docs, Word/Pages, browser articles, plain text, nested lists, and strange inline styles.
- Keep saved HTML compatible with search, preview, backlinks, `.txt` export, backup, restore, and old `PageEditor` fallback.
- Improve Lexical autocomplete behavior in long scrolled pages, narrow layouts, and touch scenarios.
- Rename public-facing docs away from “prototype” language while preserving historical notes where useful.

**What not to build:** A block database, embedded tables, custom object blocks, Markdown conversion, or Lexical JSON as canonical storage until HTML compatibility is proven boring.

**Why now:** Once storage safety is stronger, the next highest-risk surface is editor correctness.

**Likely files/components affected:** `src/components/LexicalPageEditor.tsx`, `src/components/EditorToolbar.tsx`, `src/components/PageEditor.tsx`, `src/config/editorFlags.ts`, `src/utils/lexicalRichText.ts`, `src/utils/richText.ts`, `src/components/WikiLinkPreview.tsx`, `docs/lexical-manual-qa-checklist.md`, historical `docs/lexical-editor-history.md`.

**Risks to watch for:** HTML sanitizer stripping useful content, Lexical serializing unexpected markup, toolbar state desync, task checkbox state loss, text-size spans applying too broadly, autocomplete menus appearing offscreen, and fallback editor incompatibility.

**Manual QA checklist:**

- Run the full Lexical manual QA checklist in Safari and Chrome.
- Test real paste sources, not only representative HTML snippets.
- Edit long pages at desktop, tablet, and phone widths.
- Confirm Preview, Page Info, search, backlinks, backup export, and fallback editor still read Lexical-authored pages.
- Confirm slash-tag autocomplete inserts `/tag` text and does not introduce hashtag-style UI.

**Automated tests to add/update:** `src/utils/lexicalRichText.test.ts`, `src/utils/richText.test.ts`, `src/utils/search.test.ts`, `src/utils/pageLinks.test.ts`, `e2e/lexical-editor.spec.ts`, plus focused component tests for toolbar state if practical.

### Phase 3: Search, Tags, and Wikilinks

**Goal:** Make retrieval and cross-page navigation reliable without turning pages into a database.

**Why this phase matters:** A personal library becomes valuable when users can find, connect, and revisit writing safely.

**What to build/fix:**

- Improve search result limits, empty states, snippets, and tag/text mixed-search clarity.
- Keep slash-tag syntax consistent everywhere as `/tag`.
- Keep rejecting leading `#` in tag entry so hashtag syntax is not reintroduced.
- Harden tag rename/delete/merge edge cases with trashed pages, duplicate names, empty input, and recent tag state.
- Improve wikilink rename and duplicate-title handling, including clearer ambiguous-link choices.
- Add navigation polish from backlinks, broken links, tag results, and search results.

**What not to build:** Hashtag tags, relational databases, formula fields, properties tables, graph dashboards, or pinned/favorite pages.

**Why now:** Search, tags, and links depend on stable storage and stable editor serialization, so they should follow reliability/editor hardening.

**Likely files/components affected:** `src/utils/search.ts`, `src/utils/tags.ts`, `src/utils/pageLinks.ts`, `src/components/SearchResultsView.tsx`, `src/components/TagResultsView.tsx`, `src/components/PageMetadataPanel.tsx`, `src/components/LexicalPageEditor.tsx`, `src/components/TopBar.tsx`, `src/hooks/useLibraryApp.ts`.

**Risks to watch for:** Search indexing trashed items incorrectly, mixed tag/text searches hiding expected results, tag management touching trashed data unexpectedly, ambiguous wikilinks silently resolving to the wrong page, and navigation history becoming confusing.

**Manual QA checklist:**

- Run `docs/search-manual-qa.md`.
- Search books, chapters, pages, loose pages, and Trash with text-only queries.
- Search `/tag`, `/tag-a /tag-b`, and `text /tag-a /tag-b`.
- Rename, delete, and merge tags across multiple pages, then confirm search and Page Info update.
- Create duplicate page titles and confirm wikilinks are ambiguous rather than silently wrong.
- Create a missing wikilink from Preview and confirm the new page lands in the expected location.

**Automated tests to add/update:** `src/utils/search.test.ts`, `src/utils/tags.test.ts`, `src/utils/pageLinks.test.ts`, `src/hooks/useLibraryApp.test.tsx`, and component tests for search/tag result interactions.

### Phase 4: Performance and Large Library Scaling

**Goal:** Keep the app responsive as a personal library grows.

**Why this phase matters:** LibNote already derives maps/groups and lazily builds search indexes, but large libraries need measurable targets and UI safeguards.

**What to build/fix:**

- Define stress targets, such as thousands of pages across hundreds of chapters.
- Add generated-library performance tests for selectors, search indexing, tag summaries, backlinks, and Trash item derivation.
- Add search result caps or progressive rendering if result lists become too large.
- Consider virtualization for long chapter/page/sidebar/search/tag lists only when profiling shows it is needed.
- Avoid unnecessary re-renders in editor, sidebar, search, and root shelf views.

**What not to build:** Database-style views, complex query builders, dashboards, or analytics widgets.

**Why now:** Performance work is more useful after core behavior is stable enough to benchmark.

**Likely files/components affected:** `src/store/librarySelectors.ts`, `src/utils/search.ts`, `src/utils/pageLinks.ts`, `src/utils/tags.ts`, `src/components/Sidebar.tsx`, `src/components/SearchResultsView.tsx`, `src/components/TagResultsView.tsx`, `src/views/RootView.tsx`, `src/components/ReorderableList.tsx`.

**Risks to watch for:** Premature virtualization harming accessibility, expensive backlink/search rebuilds during typing, very long lists causing jank, and stress tests becoming brittle on slower machines.

**Manual QA checklist:**

- Load a large generated library in a QA profile.
- Open root, book, chapter, page, loose pages, search, tag results, and Trash.
- Search common and rare terms; confirm result lists remain usable.
- Reorder books, chapters, and pages in large lists.
- Edit a long page and confirm typing remains responsive.

**Automated tests to add/update:** Existing large-library cases in `src/store/librarySelectors.test.ts` and `src/utils/search.test.ts`, new generated-library tests for backlinks/tags/trash, and optional browser performance smoke checks.

### Phase 5: Accessibility and Mobile/Keyboard UX

**Goal:** Make LibNote usable through keyboard, screen readers, small screens, and touch without changing the library-first model.

**Why this phase matters:** Reliability includes interaction reliability. Users need predictable focus, keyboard controls, and mobile behavior.

**What to build/fix:**

- Audit modal focus traps and focus return for App Menu, cover picker, move panels, autocomplete, and restore preview.
- Improve Escape behavior across dialogs, dropdowns, autocomplete, inline title editing, and sidebar.
- Strengthen keyboard reordering and drag-handle labeling.
- Improve sidebar behavior on narrow screens and touch devices.
- Add screen-reader labels for icon/text controls where needed.
- Test Lexical toolbar and autocomplete at narrow/mobile widths.

**What not to build:** A separate mobile dashboard, pinned page strip, favorite shortcuts, or duplicate quick-action surfaces.

**Why now:** Accessibility and mobile work should happen after the main data and editor flows are less likely to churn.

**Likely files/components affected:** `src/hooks/useModalFocus.ts`, `src/components/AppMenu.tsx`, `src/components/Sidebar.tsx`, `src/components/ReorderableList.tsx`, `src/components/InlineEditableText.tsx`, `src/components/LexicalPageEditor.tsx`, `src/components/TagSuggestionsDropdown.tsx`, `src/components/TopBar.tsx`, `src/views/RootView.tsx`, `src/styles.css`.

**Risks to watch for:** Focus getting trapped incorrectly, keyboard shortcuts firing while typing, mobile sidebar covering editor state, touch autocomplete becoming hard to dismiss, and text overlapping controls.

**Manual QA checklist:**

- Navigate the app using only keyboard.
- Open/close App Menu, cover picker, move panels, autocomplete, and restore preview with expected focus return.
- Reorder books, chapters, and pages using keyboard controls.
- Test 375px, 768px, and desktop widths.
- Test screen-reader labels for top bar, sidebar, toolbar, search filters, and destructive actions.

**Automated tests to add/update:** `src/components/AppMenu.test.tsx`, `src/components/ReorderableList.test.tsx`, `src/components/MoveTargetPanel.test.tsx`, `src/components/SaveStatusIndicator.test.tsx`, `src/views/TrashView.test.tsx`, and Playwright keyboard/mobile viewport tests.

### Phase 6: Library Experience, Themes, and Covers

**Goal:** Polish the bookshelf/library experience while keeping it dominant.

**Why this phase matters:** LibNote’s identity is the personal library. Visual polish should deepen that metaphor rather than replace it with dashboards.

**What to build/fix:**

- Refine shelf/card density, cover readability, hover/focus states, and title fitting.
- Improve cover picker organization as cover templates grow.
- Expand app theme packs carefully while preserving contrast and readability.
- Add a future larger set of CSS-based book cover templates with stable IDs and backup compatibility.
- Consider cover template categories or simple filters only if the cover list becomes large.

**What not to build:** Dashboard widgets, pinned/favorite pages, activity panels, productivity metrics, or duplicate quick-create areas that compete with the shelf.

**Why now:** Visual expansion is valuable after core reliability, retrieval, scaling, and accessibility are stronger.

**Likely files/components affected:** `src/views/RootView.tsx`, `src/utils/bookCovers.ts`, `src/utils/appThemes.ts`, `src/utils/appSettings.ts`, `src/components/AppMenu.tsx`, `src/styles.css`, `README.md`.

**Risks to watch for:** One-note palettes, low contrast themes, cover IDs breaking restored backups, oversized controls crowding the shelf, and polish work making the app feel less like a library.

**Manual QA checklist:**

- Check every shelf style and books-per-row setting with short and long book titles.
- Check every app theme for contrast in root, editor, sidebar, search, tag results, Trash, and App Menu.
- Change covers, export a backup, restore it, and confirm selected covers survive.
- Test cover picker keyboard and focus behavior.

**Automated tests to add/update:** Tests for `normalizeBookCoverId`, backup validation of cover IDs, settings normalization, and optional component tests for cover picker selection.

### Phase 7: PWA, Documentation, and Release Polish

**Goal:** Make releases understandable, installable, and easier to verify.

**Why this phase matters:** The app already has a PWA shell and strong README. Release polish should make local-first behavior, backups, and limitations clear.

**What to build/fix:**

- Keep the implemented visible offline and update-ready messaging covered by release QA.
- Improve install behavior and manifest metadata if needed.
- Keep README aligned with actual features and limitations.
- Replace or rename public-facing prototype docs so Lexical is consistently described as default.
- Keep GitHub Pages `/libnote/` base-path docs aligned with `vite.config.ts`, the manifest, and service-worker registration.
- Maintain manual QA checklists for backup/restore, Lexical, search, PWA/offline, accessibility, and release readiness.
- Add changelog/release-note discipline around backup format, storage changes, and editor changes.

**What not to build:** Remote sync promises, account language, collaboration docs, or marketing copy that hides local-only storage responsibility.

**Why now:** Documentation and PWA polish should trail the product decisions they describe.

**Likely files/components affected:** `README.md`, `CHANGELOG.md`, `docs/`, `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx`, `src/components/AppMenu.tsx`, `src/utils/backup.ts`.

**Risks to watch for:** Stale service worker caches, docs overstating offline safety, users confusing local storage with cloud backup, and old roadmap/prototype docs contradicting the current app.

**Manual QA checklist:**

- Build production, preview it, and verify service worker install/offline shell behavior.
- Confirm development mode unregisters stale service workers and clears matching caches.
- Install the PWA where supported and check icon/name/start URL under the deployed path.
- Trigger an update-ready service-worker state and confirm LibNote waits for the user to choose Reload.
- Read README and Library Guide against the current UI.
- Run release checklist before tagging.

**Automated tests to add/update:** Build verification, optional service worker smoke tests, backup format tests, and doc-link checks if a docs tool is added later.

## Recommended Next Step

Start with Phase 1 by hardening restore-failure coverage around the existing pre-restore safety snapshot, then evaluate whether LibNote needs a durable persisted recovery journal or full last-known-good layer. This is still the best first implementation area because restore replaces the whole local library, and recovery confidence matters more than adding new product surface.

## Things to Avoid

- Do not add pinned/favorite pages.
- Do not add a dashboard that takes space away from the library shelf.
- Do not duplicate controls already available elsewhere.
- Do not reintroduce hashtag tag syntax.
- Do not describe Lexical as a prototype if it is now the default editor.
- Do not chase advanced database/block-editor features before the core app is stable.
- Do not add cloud sync, collaboration, or accounts unless the local-first recovery story is already excellent and the product direction is deliberately revisited.
