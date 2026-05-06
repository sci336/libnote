# Search, Tags, and Wikilinks Manual QA

Use pages in both Loose Pages and at least one Book > Chapter. Include one rich text page with headings, formatted text, `/tags`, and `[[wikilinks]]`.

## Text-Only Search

- Query: `zeus`
- Expected: Matching live books, chapters, page titles, loose page titles, and page content can appear. Result cards show a title, result type, path/context when relevant, and a snippet for page content.

## /Tag Search

- Query: `/mythology`
- Expected: The app enters tag-filter mode and shows only live pages tagged `/mythology`. Tags are displayed with `/tag` syntax.

## Multiple-Tag Search

- Query: `/mythology /school`
- Expected: Results include only pages that have both tags. Pages with only one of the tags are excluded.

## Mixed Text + Tag Search

- Query: `history notes /school`
- Expected: Results are pages whose title/content matches `history notes` and whose tags include `/school`.

## Mixed Text + Multiple Tags

- Query: `zeus /mythology /school`
- Expected: Results are pages whose title/content matches `zeus` and whose tags include both `/mythology` and `/school`.

## Empty and No-Result States

- Query: empty search field.
- Expected: The search view invites the user to start a search.
- Query: `/`
- Expected: The search view asks for a tag after `/`.
- Query: `definitelymissing /school`
- Expected: No matches are shown, even if pages with `/school` exist, because the text portion does not match.

## Search in Trash

- Put a book, chapter page, loose page, and page with tags in Trash.
- Query: use text and `/tags` from trashed items, then switch to the Trash filter.
- Expected: Matching trashed items appear only under Trash. Trashed pages show their original context when available.

## Tag Rename, Delete, and Merge

- Rename `/school` to `/class`.
- Expected: All page tag pills, tag search, recent tag shortcuts, and Tag Management use `/class`.
- Delete `/class`.
- Expected: The tag is removed from all pages and no longer appears in recent tag shortcuts.
- Merge `/draft` into `/project`.
- Expected: Pages formerly tagged `/draft` now use `/project`, duplicate tag names collapse, and recent tag shortcuts do not show both names.

## Duplicate Page Titles

- Create two live pages with the same title, then write `[[Duplicate Title]]` on another page.
- Expected: Preview and Page Info mark the link as ambiguous. The app does not silently choose the first matching page.

## Broken Wikilinks

- Write `[[Missing Research Page]]` on a page.
- Expected: Preview offers to create the missing page. Page Info lists it under Broken Links with a Create Page action.

## Backlinks After Page Changes

- Create Page A linking to `[[Page B]]`.
- Rename Page B.
- Expected: The old title link no longer creates a backlink until Page A is updated to the new title.
- Move Page B between chapters or from Loose Pages into a chapter.
- Expected: Backlinks still resolve because the title is unchanged, and labels show the new path.
- Trash Page A, restore it, then delete it forever.
- Expected: Page B loses the backlink while Page A is trashed or permanently deleted, and the backlink returns after restore.

## Creating a Missing Page from a Wikilink

- From Preview or Page Info, create a page from `[[Missing Research Page]]`.
- Expected: The new page opens immediately. If the source page is loose, the new page is loose; otherwise it is created in the source page's chapter.

## Rich Text Tags and Wikilinks

- Add formatted rich text containing `/research`, `[[Existing Page]]`, `[[Missing Page]]`, and a duplicate-title link.
- Expected: Search snippets use readable plain text, `/tag` searches still work from page tags, resolved wikilinks open pages, broken links can create pages, and duplicate-title links remain ambiguous.
