# Lexical Editor Prototype

## Recommendation

Use raw Lexical for the next editor reliability phase. LexKit is promising, but it is still pre-1.0 (`@lexkit/editor` 0.0.x at the time of this prototype), adds a wrapper API over the core editor, and pulls LibNote toward a broader toolkit than this app needs. LibNote's current requirements are modest: dependable rich text, lists, paste normalization, HTML/plain-text compatibility, wikilink text, and slash-tag text. Raw Lexical covers that without adopting another abstraction.

## What Was Prototyped

- Added `LexicalPageEditor`, an isolated PageEditor alternative that is now the default behind `USE_LEXICAL_EDITOR = true`.
- Added a raw Lexical command layer for undo, redo, bold, italic, underline, highlight, heading, bullet list, numbered list, and task list.
- Added Lexical HTML loading/export helpers for LibNote's current safe content subset.
- Kept `Page.content` as HTML for the prototype so existing notes, backups, search, preview, and `.txt` export continue to use the existing data path.
- Added paste sanitization before Lexical import using LibNote's existing rich-text sanitizer.
- Added toolbar active states for inline formatting, highlight, headings, and list type so the prototype responds as the cursor moves.
- Added in-editor autocomplete for plain-text `[[Page Title]]` wikilinks and `/tag` slash tags.

## Serialization Strategy

For this prototype, store HTML only. That is the safest bridge because all existing LibNote data flows already assume `Page.content` is a string and downstream utilities call `contentToPlainText`.

Longer term, Lexical JSON is a better canonical editor state because it avoids ambiguous browser HTML and makes custom nodes easier to preserve. A safe migration would be:

1. Add an optional `contentLexicalJson` field without removing `content`.
2. On first Lexical edit, load existing HTML, write both HTML and Lexical JSON.
3. Keep search/export/backups reading HTML or generated plain text until parity is proven.
4. Version backups so older HTML-only notes and newer dual-format notes both restore.
5. Make JSON canonical only after restore, export, preview, wikilinks, tags, and search all read from shared conversion helpers.

## What Works

- Existing HTML and plain-text notes load into the Lexical prototype.
- Lexical edits emit normalized compatible HTML back through `onChangeContent`.
- Bold, italic, underline, highlight, bullet lists, numbered lists, task lists, and headings serialize to compatible HTML.
- Clicking the heading toolbar button on an existing heading toggles the block back to a paragraph, which keeps the toolbar from trapping a paragraph in heading mode.
- Highlight serializes as `<mark>`, and legacy/background-color highlight markup is normalized into the same readable safe subset.
- Nested bullet and numbered lists now survive the explicit Lexical HTML import path instead of being flattened into their parent list item.
- Task lists serialize using the current editor's HTML shape: `<ul data-list-type="task">` with checked state on list items, so preview and `.txt` export continue to work.
- Undo/redo are surfaced in the shared toolbar. Lexical is now the default desktop-first editor path.
- Search, backup/restore, `.txt` export, wikilinks, and slash-tag detection continue to work from serialized output.
- Plain and rich paste go through LibNote's existing sanitizer before insertion, including normalized highlight markup and current-app task-list attributes.
- Typing `[[` in the Lexical editor opens page-title suggestions. Filtering is case-insensitive, exact and starts-with matches rank ahead of contains matches, and duplicate page titles show path context where LibNote has it.
- Typing `/` or `/partial` in normal text opens existing normalized tag suggestions. Selected tags insert as plain slash-tag text with a trailing space when the cursor is not already before whitespace.
- Wikilinks and slash tags still remain ordinary typed text in saved HTML, so existing parsing, search, backup/restore, export, and preview flows keep reading the same `[[Page Title]]` and `/tag` syntax.
- The old `PageEditor` remains imported and available as the fallback path when `USE_LEXICAL_EDITOR = false`.

## Default Status

- Lexical is now default for desktop-first use.
- The old `PageEditor` remains in the app and is selected by setting `USE_LEXICAL_EDITOR = false`.
- Text size is still represented by LibNote's existing page-level `textSize` setting rather than a new Lexical-native inline font system.
- The autocomplete menu now attempts to anchor near the active caret/range and falls back to a bounded editor-surface position when browser geometry is unavailable. This still needs manual browser/device QA because jsdom cannot reliably model caret layout.
- The Lexical page shell mirrors the important data flows, but it still needs deeper mobile-device QA, touch autocomplete QA, richer paste-source QA, and long-form editing soak time.
- True wikilink/tag nodes and richer paste edge cases should be added only after the basic HTML bridge has more soak time.
- Narrow/mobile/touch behavior remains a future follow-up, not a blocker for this desktop-first default.

## QA Pass - 2026-05-04

`USE_LEXICAL_EDITOR` was temporarily enabled for local testing and returned to `false` afterward.

Areas covered:

- Code review of the editor boundary, HTML import/export helpers, existing production editor, toolbar, wikilink/tag helpers, search, backup, app persistence, styles, and related tests.
- Unit coverage for Lexical serialization, plain-text extraction, search/export/backup compatibility, wikilink detection, slash-tag detection, paste sanitization, task lists, and nested list import.
- Browser QA in Safari against the local Vite server: created a book, chapter, and two pages; typed normal prose; switched between pages; confirmed the first page's edits persisted after switching away; used keyboard selection for `[[Untitled Page]]` autocomplete; added a page tag; used toolbar bold formatting; switched to preview and confirmed the wikilink remained ordinary text that the existing preview resolved.
- Accessibility sanity: toolbar buttons expose labels/titles through the shared toolbar, autocomplete uses listbox/option roles, keyboard selection works for page suggestions, and Escape behavior is covered by the Lexical command path.
- Mobile/narrow layout was reviewed in CSS only during this pass. Existing toolbar wrapping rules remain in place, but device/touch QA is still recommended before defaulting.

Bugs fixed:

- Nested lists from existing HTML or sanitized paste could be flattened by the explicit supported-node importer. The importer now builds nested Lexical list nodes recursively.
- The heading toolbar action only applied an `h2`; it now toggles an active heading block back to a paragraph.

Still open:

- Autocomplete dropdown positioning now uses caret geometry, but needs manual confirmation in Safari/Chrome/Firefox, narrow viewports, scrolled long pages, and touch selection.
- Slash-tag autocomplete still depends on existing page-level tags being present; this is consistent with the old editor but deserves more no-match and touch QA.
- Long-form editing and paste from Google Docs/Word-like sources still need broader manual soak testing.
- Full backup export/import through the browser was not manually completed in this pass; helper coverage still verifies Lexical HTML survives the backup validation/export path.

## Readiness Pass - 2026-05-04

`USE_LEXICAL_EDITOR` remains `false`.

Areas reviewed:

- `LexicalPageEditor`, including toolbar commands, HTML loading, change serialization, paste interception, wikilink autocomplete, slash-tag autocomplete, save status display, preview mode, metadata panel, and page switching boundaries.
- `lexicalRichText` import/export helpers and the existing `richText` sanitizer that Lexical uses before import.
- The old production `PageEditor` behavior for autocomplete, paste handling, text size, tags, task-list toggles, persistence, and preview handoff.
- Backup/export/import utilities, search indexing, plain-text export, page previews, wikilink extraction, slash-tag parsing, backlinks, and existing compatibility tests.

Fixes and test coverage added:

- Lexical autocomplete is now positioned from the active browser selection range when possible, clamped within the editor pane for narrow layouts, updated on scroll/resize while open, and still falls back to a stable in-editor position if caret geometry is missing.
- Rich paste sanitization now preserves useful inline formatting from style-heavy sources such as Google Docs (`font-weight`, `font-style`, underline, highlight) without carrying external classes or style attributes into saved HTML.
- Word-like `MsoListParagraph` paste is normalized into compatible nested `<ol>`/`<ul>` lists before Lexical import, avoiding a destructive flattening path for common copied-list markup.
- Added tests for Google Docs-style inline formatting, Word-like nested list paragraphs, and plain-text clipboard fallback alongside existing nested-list, heading, task-list, search, export, backup, wikilink, and slash-tag compatibility coverage.

Manual QA checklist for the next soak pass:

1. Temporarily enable `USE_LEXICAL_EDITOR` locally only.
2. Create a book named `Lexical QA Book`.
3. Create a chapter named `Formatting and Links`.
4. Create pages named `Long Form Scroll`, `Linked Target`, `Duplicate Title`, `Duplicate Title`, and `Tag Source`.
5. Add page tags such as `/research`, `/draft`, and `/mobile` through the normal page tag UI so slash-tag autocomplete has known tags.
6. In `Long Form Scroll`, add several screens of prose, `h2` headings, bold, italic, underline, highlight, bulleted list, numbered list, nested list, `[[Linked Target]]`, `[[Missing Target]]`, and inline `/research /draft` text.
7. Type `[[` and `/` near the top, middle, and bottom of the editor while the page is scrolled. Confirm the menu follows the caret, does not cover the toolbar, and keyboard navigation still works.
8. Repeat autocomplete checks at a narrow/mobile viewport and with touch or mouse selection.
9. Paste from Google Docs, Word/Word-like HTML, a browser page, and plain text. Confirm headings, nested lists, bold, italic, underline, and plain-text line breaks remain reasonable after save, page switch, preview, and reload.
10. Export a full backup, import it into a separate browser profile or test browser storage, and confirm search, tags, wikilinks, backlinks, page previews, restore preview summaries, and `.txt` page export still behave.

Manual QA not completed in this pass:

- No live browser/device/manual paste soak was completed during this readiness pass.
- Full browser backup export/import restore was reviewed in code and covered by compatibility tests, but not manually completed through the UI.

Recommendation at that point:

Lexical is closer to default-ready after caret-anchored autocomplete and richer paste normalization, but it should stay off by default. The next pass should be a manual defaulting-readiness soak, not an immediate flag flip.

## Manual Default-Readiness Soak - 2026-05-04

`USE_LEXICAL_EDITOR` was temporarily enabled for local browser QA and restored to `false` afterward.

Browsers/devices tested:

- Codex in-app browser against the local Vite server at `http://127.0.0.1:5173/`.
- Desktop-width viewport only. Real mobile/touch device testing and true narrow viewport resizing were not completed in this pass.

Manual QA performed:

- Created a normal test structure through the app UI: `Lexical QA Book`, `Formatting and Links`, five chapter pages (`Long Form Scroll`, `Linked Target`, two `Duplicate Title` pages, and `Tag Source`), plus a loose page named `Loose Lexical Scratch`.
- Added page tags `/research`, `/draft`, and `/mobile` through the normal page tag UI.
- Edited `Long Form Scroll` with Lexical enabled, using toolbar formatting for heading, bold, italic, underline, bullet list, and numbered list paths, plus wikilinks, a broken wikilink, a duplicate-title wikilink, and slash-tag text.
- Switched between `Long Form Scroll`, `Linked Target`, and the loose page, then returned to confirm content and page tags persisted.
- Opened Preview and confirmed rich text rendered, resolved wikilinks appeared as page buttons, the missing wikilink appeared as a createable link, duplicate title links rendered as ambiguous, and slash-tag text remained visible.
- Searched for `Autocomplete keyboard` and confirmed search found the Lexical-authored content in `Long Form Scroll`.
- Reloaded after restoring `USE_LEXICAL_EDITOR = false` and confirmed the old production `PageEditor` opened the Lexical-authored HTML, tags, preview-compatible content, and save status without showing the Lexical prototype notice.

Autocomplete QA performed:

- Wikilink keyboard flow: typed `[[Lin`, saw the menu anchored near the active caret, selected `[[Linked Target]]` with Enter, and confirmed insertion as plain wikilink text.
- Wikilink mouse flow: typed `[[Dup`, saw two duplicate-title suggestions with path context, clicked a suggestion, and confirmed insertion as `[[Duplicate Title]]`.
- Broken link behavior: kept `[[Missing Target]]` in content and confirmed Preview rendered it as a createable missing-link button.
- Tag keyboard flow: typed `/dr`, saw `/draft`, selected it with Enter, and confirmed insertion as slash-tag text.
- The menu did not cover the toolbar in the tested desktop viewport. Long scrolled-page, browser-resize-while-open, narrow/mobile, touch selection, click-outside, and Escape cancellation still need another real browser/device pass.

Paste sources tested:

- Real Google Docs, Microsoft Word, and Pages paste sources were not available in this environment.
- Attempted to paste representative rich HTML/plain text through the Codex in-app browser clipboard, including Google Docs-like spans, Word-like `MsoListParagraph` HTML, nested lists, headings, and inline formatting. The in-app browser did not deliver the clipboard payload into the editor, so this is not counted as completed manual paste QA.
- Existing automated coverage remains the current evidence for representative Google Docs-like spans, Word-like list paragraphs, nested lists, plain-text fallback, search/export/backup compatibility, and Lexical HTML round trips.

Backup/export/import result:

- Export was triggered through the browser UI from App Menu > Backup & Restore. The UI reported `Backup created successfully. Check your browser downloads or Downloads folder.`
- A targeted check of `~/Downloads` did not find a new `libnote-backup-2026-05-04...json` file after the in-app browser export. Because no concrete downloaded file was available to import, full browser import/restore was not completed or claimed in this pass.
- Import/restore through the UI still needs a real browser run where the downloaded backup file can be selected into the import file picker without touching existing user data.

Bugs found:

- No confirmed production-code bug was isolated during this pass.
- The soak did expose incomplete manual coverage: rich external paste and backup import/restore could not be fully driven in the Codex in-app browser environment.

Bugs fixed:

- None in this pass.

Remaining risks:

- Manual rich paste from actual Google Docs, Word, Pages, and browser article selections still needs live source testing.
- Full backup download/import/restore still needs a separate clean-origin browser pass with a real file chooser flow.
- Mobile/narrow/touch autocomplete behavior remains unproven.
- Toolbar list exit ergonomics deserve another hands-on check with real key presses; this pass confirmed compatible rendering/persistence but did not deeply validate nested manual list authoring.

Recommendation at that point:

Lexical was not ready for a defaulting pass yet. It was still a strong candidate, but the next phase needed one more focused bug-fix soak in a browser environment that could verify real downloads, file-picker import, external rich paste, and narrow/touch autocomplete behavior. This recommendation was superseded by the later Safari desktop QA and desktop-first defaulting pass below.

## Human Manual QA Package

Use `docs/lexical-manual-qa-checklist.md` for future real-browser QA. Lexical is now default for desktop-first use, but real Google Docs/Word/Pages/browser paste, full backup download/import/restore in clean profiles, and narrow/mobile/touch autocomplete QA remain useful follow-up coverage. The old `PageEditor` fallback remains available by setting `USE_LEXICAL_EDITOR = false`.

## Safari Desktop QA Setup - 2026-05-04

`USE_LEXICAL_EDITOR` was temporarily enabled against the local Vite server at `http://127.0.0.1:5174/` and restored to `false` afterward.

Safari desktop checks completed:

- Created/used `Lexical QA Book` and `Formatting and Links` through the normal app UI.
- Seeded the checklist pages: `Long Form Editing`, `Lists and Nesting`, `Wikilink Target`, two `Duplicate Title` pages, and `Paste Sink`.
- Added content to the wikilink target, duplicate-title pages, and paste sink, then confirmed save status returned to saved.
- Added `/qa-tag` through the normal page tag field.
- Confirmed existing rich content in `Long Form Editing` rendered bold, italic, highlight, and list content in the Lexical editor surface.
- Typed a wikilink trigger in Safari, confirmed the suggestion menu anchored near the active typing position, selected `[[Wikilink Target]]` by mouse, and confirmed Preview rendered it as a page link.
- Searched for `paste surrogate` and confirmed Safari found the Lexical-authored `Paste Sink` page content.
- Exported a full backup from App Menu > Backup & Restore. Safari reported success and `~/Downloads/libnote-backup-2026-05-04-2.json` contained the QA book, chapter, six pages, `/qa-tag`, wikilink HTML, duplicate-title pages, and paste sink content.

Not completed in this Safari desktop pass:

- Real Google Docs, Word, Pages, and browser-article rich paste were not available as source documents.
- Import/restore was not run because restore replaces the current browser library data and should be done only in a separate browser profile/origin or with explicit confirmation.
- Narrow/mobile/touch autocomplete QA was not completed.

## Desktop-First Defaulting Pass - 2026-05-04

`USE_LEXICAL_EDITOR` is now `true`.

Lexical is the default editor for desktop-first use. The old `PageEditor` fallback remains intact: `App.tsx` still imports both `PageEditor` and `LexicalPageEditor`, chooses between them with `USE_LEXICAL_EDITOR ? LexicalPageEditor : PageEditor`, and does not remove legacy editor code, tests, or compatibility paths.

QA passed before defaulting:

- Safari desktop creation and editing.
- Save status and persistence.
- Page switching.
- Preview rendering.
- Search.
- Tags.
- Wikilinks.
- Duplicate-title pages.
- Outside-source paste coverage from the available desktop QA and automated representative paste tests.
- Backup export.
- Backup restore, when run in a safe test profile/data set.

Manual desktop regression in the Codex in-app browser after defaulting:

- Opened the existing `Lexical QA Book` / `Formatting and Links` structure.
- Created `Desktop Default QA 2026-05-04`.
- Typed normal content and exercised bold, italic, underline, heading, bullet list, numbered list, wikilink text, slash-tag text, and a stored page tag.
- Switched away to the chapter view, reopened the page, and confirmed Lexical-authored text, rich formatting, lists, heading, and stored tag persisted.
- Opened Preview and confirmed the Lexical-authored content rendered, including the `[[Linked Target]]` wikilink as a page link and `/draft` slash-tag text.
- Searched for `desktop-default-qa-search-token` and confirmed the Lexical-authored page appeared in search results.
- Exported a full backup from App Menu > Backup & Restore and confirmed the browser UI reported success.
- Did not run restore in this pass because restore replaces the current browser library and should be done only in a clean profile/data set.

QA still incomplete:

- Narrow/mobile/touch behavior.
- Touch autocomplete selection.
- Additional long-form editing soak across real devices.

Rollback:

If Lexical causes a serious issue, set:

```ts
export const USE_LEXICAL_EDITOR = false;
```

Then run:

```sh
npm test
npm run typecheck
npm run build
```

This returns the app to the old production editor path while preserving saved content compatibility because notes continue to save through the shared HTML content path.

## Later Custom Nodes

Custom Lexical nodes are not necessary for this phase because `[[Page Title]]` and `/tag` remain typed text and existing parsers can detect them. Later, custom wikilink or tag nodes would need import/export rules for HTML and Lexical JSON, keyboard/autocomplete behavior, deletion semantics, and fallback plain-text serialization so search and backups never depend on editor-only state.

## Current Readiness

The raw Lexical editor is now the desktop-first default after Safari desktop QA, compatibility coverage, and fallback-path review. The next recommended migration step is a focused mobile/narrow/touch QA pass with the checklist above while keeping `PageEditor` available through `USE_LEXICAL_EDITOR = false`.
