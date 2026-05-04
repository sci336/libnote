# Lexical Editor Prototype

## Recommendation

Use raw Lexical for the next editor reliability phase. LexKit is promising, but it is still pre-1.0 (`@lexkit/editor` 0.0.x at the time of this prototype), adds a wrapper API over the core editor, and pulls LibNote toward a broader toolkit than this app needs. LibNote's current requirements are modest: dependable rich text, lists, paste normalization, HTML/plain-text compatibility, wikilink text, and slash-tag text. Raw Lexical covers that without adopting another abstraction.

## What Was Prototyped

- Added `LexicalPageEditor`, an isolated PageEditor alternative behind `USE_LEXICAL_EDITOR = false`.
- Added a raw Lexical command layer for bold, italic, underline, heading, bullet list, and numbered list.
- Added Lexical HTML loading/export helpers for LibNote's current safe content subset.
- Kept `Page.content` as HTML for the prototype so existing notes, backups, search, preview, and `.txt` export continue to use the existing data path.
- Added paste sanitization before Lexical import using LibNote's existing rich-text sanitizer.

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
- Bold, italic, underline, bullet lists, numbered lists, and headings serialize to HTML.
- Search, backup/restore, `.txt` export, wikilinks, and slash-tag detection continue to work from serialized output.
- Plain and rich paste go through LibNote's existing sanitizer before insertion.
- The current production editor remains the default.

## Not Production-Ready Yet

- The Lexical path is prototype-only and intentionally disabled.
- It does not yet implement the current editor's full autocomplete behavior for `[[Page Title]]` and `/tag` inside the editor surface.
- Highlight and checkbox/task-list toolbar actions are not implemented in the Lexical prototype.
- The Lexical page shell mirrors the important data flows, but it has not received full manual mobile QA.
- True wikilink/tag nodes, autocomplete menus, and richer paste edge cases should be added after the basic HTML bridge has more soak time.

## Later Custom Nodes

Custom Lexical nodes are not necessary for this phase because `[[Page Title]]` and `/tag` remain typed text and existing parsers can detect them. Later, custom wikilink or tag nodes would need import/export rules for HTML and Lexical JSON, keyboard/autocomplete behavior, deletion semantics, and fallback plain-text serialization so search and backups never depend on editor-only state.
