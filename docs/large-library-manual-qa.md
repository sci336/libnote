# Large Library Manual QA

Phase 4 targets realistic personal libraries rather than enterprise-scale data: hundreds of books, hundreds of chapters, several thousand pages, long rich-text content, many slash tags, many wikilinks/backlinks, duplicate page titles, recent pages, and a busy Trash.

## Prepare a Large Library

1. Use a disposable browser profile or export your current library first.
2. Load or restore a generated large-library backup that includes books, chapters, chapter pages, loose pages, duplicate titles, rich text, tags, wikilinks, recent pages, and Trash.
3. Confirm the app reaches the root Books view without long blocking pauses.

## Navigation Checks

1. Open the root Books view and scroll through the shelf.
2. Open a book with many chapters.
3. Open a chapter with many pages.
4. Open a chapter page.
5. Open Loose Pages.
6. Open Search, Tag Results, and Trash.
7. Confirm the sidebar updates active book/chapter/page context and remains usable.

## Search Checks

1. Search a common term such as `research`.
2. Confirm the view stays responsive and, if many matches exist, explains that the first capped set is shown.
3. Search a rare term such as `needle`.
4. Search `/research`.
5. Search `needle /research`.
6. Search for trashed-only text, then use the Trash filter.
7. Confirm live and trashed results remain separated.

## Tags And Links

1. Open a tag with many pages.
2. Add another existing tag to narrow the result set.
3. Open a page containing many `[[wikilinks]]`.
4. Show Page Info.
5. Confirm outgoing links, ambiguous duplicate-title links, broken links, and backlinks render correctly.
6. Rename, move, trash, restore, and permanently delete linked pages, then confirm backlinks update from live pages only.

## Long List Interaction

1. Reorder books in a large root shelf.
2. Reorder chapters in a large book.
3. Reorder pages in a large chapter.
4. Use keyboard reorder controls as well as drag-and-drop.
5. Confirm no list jumps, lost focus, or broken ordering after save.

## Long Rich Text Editing

1. Open a long rich-text page.
2. Type continuously for at least 30 seconds.
3. Add formatting, lists, tags, and wikilinks.
4. Switch between edit and preview.
5. Confirm autosave status updates and typing remains responsive.

## Backup And Restore

1. Export the large library backup.
2. Restore that backup into a disposable profile.
3. Confirm root, book, chapter, page, loose pages, search, tag results, Trash, Page Info, recent pages, and settings match the exported library.
