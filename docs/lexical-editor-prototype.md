# Lexical Editor Prototype

## Recommendation

Use raw Lexical for the next editor reliability phase. LexKit is promising, but it is still pre-1.0 (`@lexkit/editor` 0.0.x at the time of this prototype), adds a wrapper API over the core editor, and pulls LibNote toward a broader toolkit than this app needs. LibNote's current requirements are modest: dependable rich text, lists, paste normalization, HTML/plain-text compatibility, wikilink text, and slash-tag text. Raw Lexical covers that without adopting another abstraction.

## What Was Prototyped

- Added `LexicalPageEditor`, an isolated PageEditor alternative behind `USE_LEXICAL_EDITOR = false`.
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
- Highlight serializes as `<mark>`, and legacy/background-color highlight markup is normalized into the same readable safe subset.
- Task lists serialize using the current editor's HTML shape: `<ul data-list-type="task">` with checked state on list items, so preview and `.txt` export continue to work.
- Undo/redo are surfaced in the shared toolbar. The production editor still remains the default path.
- Search, backup/restore, `.txt` export, wikilinks, and slash-tag detection continue to work from serialized output.
- Plain and rich paste go through LibNote's existing sanitizer before insertion, including normalized highlight markup and current-app task-list attributes.
- Typing `[[` in the Lexical editor opens page-title suggestions. Filtering is case-insensitive, exact and starts-with matches rank ahead of contains matches, and duplicate page titles show path context where LibNote has it.
- Typing `/` or `/partial` in normal text opens existing normalized tag suggestions. Selected tags insert as plain slash-tag text with a trailing space when the cursor is not already before whitespace.
- Wikilinks and slash tags still remain ordinary typed text in saved HTML, so existing parsing, search, backup/restore, export, and preview flows keep reading the same `[[Page Title]]` and `/tag` syntax.
- The current production editor remains the default.

## Not Production-Ready Yet

- The Lexical path is prototype-only and intentionally disabled.
- Text size is still represented by LibNote's existing page-level `textSize` setting rather than a new Lexical-native inline font system.
- The autocomplete menu is anchored predictably near the editor surface rather than precisely to the caret. That avoids fragile DOM measurement while the prototype is still gated.
- The Lexical page shell mirrors the important data flows, but it still needs full manual mobile QA, duplicate-title QA, mouse/touch QA, and long-form editing soak time.
- True wikilink/tag nodes and richer paste edge cases should be added only after the basic HTML bridge has more soak time.
- The editor should stay behind `USE_LEXICAL_EDITOR = false` until the new autocomplete behavior completes manual QA and longer persistence testing.

## Later Custom Nodes

Custom Lexical nodes are not necessary for this phase because `[[Page Title]]` and `/tag` remain typed text and existing parsers can detect them. Later, custom wikilink or tag nodes would need import/export rules for HTML and Lexical JSON, keyboard/autocomplete behavior, deletion semantics, and fallback plain-text serialization so search and backups never depend on editor-only state.

## Current Readiness

Autocomplete parity moves the raw Lexical editor closer to a QA/defaulting pass, but it should remain prototype-only for now. The next decision point should come after the manual checklist covers keyboard selection, mouse/touch insertion, duplicate titles, no-match behavior, narrow layouts, save/reopen persistence, backlink detection, tag search, and export readability with `USE_LEXICAL_EDITOR` temporarily enabled only for local testing.
