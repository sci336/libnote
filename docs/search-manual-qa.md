# Search Manual QA

Use pages in both Loose Pages and inside at least one Book > Chapter. Confirm every result card still shows title, path/context, and snippet when page content exists.

## Text-Only Search

- Query: `zeus`
- Expected: Existing text search behavior is unchanged. Matching books, chapters, and pages can appear, ranked by the existing title/content scoring.

## Tag-Only Search

- Query: `/mythology /school`
- Expected: The app stays in tag-filter mode and returns only pages that include both tags.

## Mixed Text + One Tag

- Query: `history notes /school`
- Expected: Results are pages whose title/content matches `history notes` and whose tags include `/school`.

## Mixed Text + Multiple Tags

- Query: `zeus /mythology /school`
- Expected: Results are pages whose title/content matches `zeus` and whose tags include both `/mythology` and `/school`.

## No Results

- Query: `definitelymissing /school`
- Expected: The search view shows no matches, even if pages with `/school` exist, because the text portion does not match.

## Loose Pages

- Query: use text from a loose page plus one of its tags.
- Expected: The loose page appears with `Loose Pages` as its path/context.

## Pages Inside Books/Chapters

- Query: use text from a page inside a chapter plus one or more of its tags.
- Expected: The page appears with `Book Title / Chapter Title` as its path/context.
