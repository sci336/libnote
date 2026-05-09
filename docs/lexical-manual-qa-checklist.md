# Lexical Manual QA Checklist

Use this checklist to run real-world Lexical QA in normal browsers. Lexical is now the default desktop-first editor path, while the old `PageEditor` remains available by setting `USE_LEXICAL_EDITOR = false`.

## A. Setup

1. Confirm the production flag is on before starting desktop-first QA:

   ```ts
   // src/config/editorFlags.ts
   export const USE_LEXICAL_EDITOR = true;
   ```

2. To verify the old fallback path, temporarily set the flag off in a safe local run:

   ```ts
   export const USE_LEXICAL_EDITOR = false;
   ```

3. Start the app:

   ```sh
   npm run dev
   ```

4. Open the local Vite URL in Safari and Chrome. Test both browsers if possible.

5. Avoid deleting existing local app data. Recommended safe options:

   - Use a separate browser profile dedicated to QA.
   - Use one browser for QA and keep your normal browser untouched.
   - Use clearly named QA data only, such as `Lexical QA Book`, and do not use Trash cleanup during the test.
   - Export a backup from the current browser before importing any backup.

6. After fallback testing, restore the default flag:

   ```ts
   export const USE_LEXICAL_EDITOR = true;
   ```

7. Reload the app with Lexical off before restoring the flag and confirm the old production editor still opens Lexical-created content.

## Current Default And Rollback

- Lexical is default for desktop-first use with `USE_LEXICAL_EDITOR = true`.
- The old `PageEditor` fallback remains in code and can be restored by setting `USE_LEXICAL_EDITOR = false`.
- Mobile, touch, and narrow viewport behavior remains incomplete and should be covered in a future QA pass.
- The desktop QA evidence before defaulting covered creating/editing pages, save status/persistence, page switching, preview rendering, search, tags, wikilinks, duplicate-title pages, outside-source paste coverage, backup export, and backup restore in safe test data.

Rollback:

```ts
export const USE_LEXICAL_EDITOR = false;
```

Then run:

```sh
npm test
npm run typecheck
npm run build
```

This returns the app to the old production editor path while preserving saved content compatibility.

## B. Seed Content

Create this exact structure manually through the app UI:

- Book: `Lexical QA Book`
- Chapter: `Formatting and Links`
- Pages:
  - `Long Form Editing`
  - `Lists and Nesting`
  - `Wikilink Target`
  - `Duplicate Title`
  - `Duplicate Title`
  - `Paste Sink`
- Loose page:
  - `Loose Lexical QA Page`

Add page tags to at least two pages:

- `/research`
- `/draft`
- `/mobile`

## C. Formatting Checklist

In `Long Form Editing`, create several screens of content and verify:

- [ ] Paragraphs can be typed, edited, saved, and reopened.
- [ ] Headings can be applied and toggled back to normal paragraphs.
- [ ] Bold text works and survives page switching.
- [ ] Italic text works and survives page switching.
- [ ] Underline text works and survives page switching.
- [ ] Bullet lists can be created, edited, saved, and reopened.
- [ ] Numbered lists can be created, edited, saved, and reopened.
- [ ] Nested lists can be created or pasted, saved, reopened, and are not flattened unexpectedly.
- [ ] Switching from `Long Form Editing` to another page and back preserves content.
- [ ] Leaving the chapter/book and returning preserves content.
- [ ] Preview renders headings, inline formatting, lists, wikilinks, and tags correctly.
- [ ] Save status moves through saving/saved states and does not get stuck.
- [ ] Reloading the browser keeps the content.
- [ ] Restoring `USE_LEXICAL_EDITOR = false` lets the old `PageEditor` open the same content.

## D. Wikilink Checklist

Use `Long Form Editing`, `Wikilink Target`, and the two `Duplicate Title` pages.

- [ ] Type `[[` and confirm the suggestion menu opens near the caret.
- [ ] Type `[[Wiki` and select `Wikilink Target` by keyboard.
- [ ] Type `[[Dup` and select one `Duplicate Title` suggestion by mouse.
- [ ] Confirm duplicate-title suggestions include enough path/context to distinguish them.
- [ ] Type a broken wikilink such as `[[Missing Lexical QA Page]]`.
- [ ] Switch pages and return; confirm wikilink text persists.
- [ ] Open Preview; confirm resolved links are clickable.
- [ ] Open Preview; confirm broken links show the missing/create behavior.
- [ ] Open Preview or Page Info; confirm duplicate-title links are marked ambiguous or offer resolution.
- [ ] Open Page Info if available; confirm outgoing links, broken links, ambiguous links, and backlinks make sense.
- [ ] Search for `Wikilink Target`; confirm linked content/search behavior is still sane.
- [ ] Search for text near the wikilinks; confirm Lexical-authored HTML is searchable.

## E. Tag Checklist

Use existing page tags plus inline slash-tag text.

- [ ] Type `/` in the editor and confirm tag suggestions appear when known tags exist.
- [ ] Type `/dr` and select `/draft` by keyboard.
- [ ] Type `/re` and select `/research` by mouse or touch.
- [ ] Type a new slash tag in content, such as `/newlexicaltag`.
- [ ] Add the same tag through the page tag input and confirm stored page tags dedupe.
- [ ] Search/filter by `/research` and confirm expected pages appear.
- [ ] Search/filter by multiple tags, such as `/research /draft`, and confirm results narrow correctly.
- [ ] Confirm repeated autocomplete use does not encourage visible duplicate tag clutter.

## F. Paste Checklist

Use `Paste Sink`. For every paste source below, record the source, browser, and result in the pass/fail table.

Paste sources:

- Google Docs heading + paragraph + bold + italic + list.
- Google Docs nested list.
- Microsoft Word or Pages equivalent, if available.
- Browser article rich text copied from a normal web page.
- Plain text copied from a text editor.
- Weird styled text if available, such as colored spans, highlighted spans, odd fonts, or copied content with many classes/styles.

For each paste test, verify:

- [ ] Source name recorded.
- [ ] Browser recorded.
- [ ] Reasonable formatting is preserved.
- [ ] Unwanted external styling, classes, fonts, and colors do not appear in saved HTML or visible output.
- [ ] Nested lists survive when the source has nested lists.
- [ ] Pasted text is searchable.
- [ ] Preview renders pasted content correctly.
- [ ] Page switching preserves pasted content.
- [ ] Browser reload preserves pasted content.
- [ ] Restoring `USE_LEXICAL_EDITOR = false` lets the old editor open the pasted content.

Suggested paste result table:

| Source | Browser | Formatting Preserved | Unwanted Styling Removed | Nested Lists Survived | Search Works | Preview Works | Page Switch Preserves | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google Docs basic | Safari |  |  |  |  |  |  |  |
| Google Docs nested list | Safari |  |  |  |  |  |  |  |
| Word or Pages | Safari |  |  |  |  |  |  |  |
| Browser article | Safari |  |  |  |  |  |  |  |
| Plain text | Safari |  |  |  |  |  |  |  |
| Google Docs basic | Chrome |  |  |  |  |  |  |  |
| Google Docs nested list | Chrome |  |  |  |  |  |  |  |
| Word or Pages | Chrome |  |  |  |  |  |  |  |
| Browser article | Chrome |  |  |  |  |  |  |  |
| Plain text | Chrome |  |  |  |  |  |  |  |

## G. Backup, Export, And Import Checklist

Run this in a safe QA browser profile or separate browser. Restore replaces the current library in that browser.

- [ ] Create Lexical content in the seeded QA structure.
- [ ] Open App Menu > Backup & Restore.
- [ ] Export a full library backup.
- [ ] Confirm the browser reports a completed download.
- [ ] Confirm the backup file appears in the browser downloads list.
- [ ] Confirm the backup file appears in the filesystem downloads folder.
- [ ] Note the exact backup filename.
- [ ] In a clean QA browser profile or separate browser, start the app with Lexical enabled.
- [ ] Open App Menu > Backup & Restore.
- [ ] Select the exported backup file with Import Library.
- [ ] Confirm restore preview counts make sense for books, chapters, pages, loose pages, tags, and trashed items.
- [ ] Restore the backup.
- [ ] Confirm `Lexical QA Book` exists.
- [ ] Confirm `Formatting and Links` exists.
- [ ] Confirm all seeded pages and the loose page exist.
- [ ] Confirm tags survive.
- [ ] Confirm wikilinks, broken links, duplicate-title links, backlinks, previews, and rich text survive.
- [ ] Confirm search finds Lexical-authored and pasted text.
- [ ] Restore `USE_LEXICAL_EDITOR = false`, reload, and confirm the old editor still opens restored content.

## H. Narrow And Mobile Checklist

Use browser responsive mode and, if possible, an actual touch device.

- [ ] Test a narrow viewport around 375 px wide.
- [ ] Test a tablet-like viewport around 768 px wide.
- [ ] Confirm the automated mobile Playwright flows still pass before manual touch QA: sidebar navigation, narrow Lexical editing/persistence, wikilink autocomplete, and slash-tag autocomplete.
- [ ] Type `[[` near the top of a page and confirm autocomplete placement.
- [ ] Type `[[` near the middle of a long scrolled page and confirm autocomplete placement.
- [ ] Type `[[` near the bottom of a long scrolled page and confirm autocomplete placement.
- [ ] Type `/` near the top, middle, and bottom of a long page and confirm tag menu placement.
- [ ] Use keyboard selection in narrow layout.
- [ ] Use touch selection on autocomplete suggestions if touch is available.
- [ ] Press Escape and tap outside the editor with an autocomplete trigger still present; confirm suggestions stay dismissed until the trigger changes.
- [ ] Scroll while the menu is open and confirm it remains usable or closes safely.
- [ ] Resize the browser while the menu is open and confirm placement updates or fails harmlessly.
- [ ] Confirm the toolbar remains usable and does not overlap important editor text.
- [ ] Confirm long page editing remains comfortable enough for repeated use.

## I. Pass/Fail Template

Use one row per issue or checklist area.

| Browser/Device | Area | Pass/Fail | Issue Found | Reproduction Steps | Screenshot/File Notes | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| Safari desktop | Formatting |  |  |  |  |  |
| Safari desktop | Wikilinks |  |  |  |  |  |
| Safari desktop | Tags |  |  |  |  |  |
| Safari desktop | Paste |  |  |  |  |  |
| Safari desktop | Backup/restore |  |  |  |  |  |
| Safari responsive/mobile | Narrow/mobile |  |  |  |  |  |
| Chrome desktop | Formatting |  |  |  |  |  |
| Chrome desktop | Wikilinks |  |  |  |  |  |
| Chrome desktop | Tags |  |  |  |  |  |
| Chrome desktop | Paste |  |  |  |  |  |
| Chrome desktop | Backup/restore |  |  |  |  |  |
| Chrome responsive/mobile | Narrow/mobile |  |  |  |  |  |

Severity guide:

- `P0`: Data loss, crash, restore failure, or content corruption.
- `P1`: Major editing, persistence, paste, backup, or autocomplete blocker.
- `P2`: Noticeable bug with a workaround.
- `P3`: Polish issue or minor inconsistency.

## J. Desktop-First Default Maintenance Criteria

Lexical can remain default for desktop-first use while these stay true:

- [ ] No data loss in Safari or Chrome.
- [ ] No persistence failures after page switching, browser reload, and old-editor fallback.
- [ ] No backup export/import/restore failures.
- [ ] No major paste corruption from Google Docs, Word/Pages, browser article rich text, or plain text.
- [ ] Nested lists are not flattened unexpectedly in normal editing or paste.
- [ ] No major autocomplete placement or selection blockers in desktop flows.
- [ ] Broken and duplicate-title wikilinks remain understandable in Preview and Page Info.
- [ ] Tags remain normalized, searchable, and not duplicated as stored page tags.
- [ ] The old `PageEditor` fallback remains intact with `USE_LEXICAL_EDITOR = false`.
- [ ] `USE_LEXICAL_EDITOR` remains `true` for the desktop-first default unless a rollback is needed.
- [ ] Mobile, narrow viewport, and touch behavior remain tracked as follow-up QA.
- [ ] Verification passes:

   ```sh
   npm test
   npm run typecheck
   npm run build
   git diff --check
   ```
