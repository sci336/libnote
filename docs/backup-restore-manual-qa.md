# Backup & Restore Manual QA

Use a disposable browser profile when possible. LibNote is local-first, and restore replaces the current local library.

## Export Current Library

1. Open App Menu -> Backup & Restore.
2. Choose Export Library.
3. Confirm the downloaded JSON contains books, chapters, pages, loose pages, tags, settings, wikilinks in page content, and trashed items when present.

## Restore Valid Backup

1. Select a known-good LibNote backup JSON.
2. Confirm Restore Preview appears with backup date, version, counts, loose pages, Trash, and tags.
3. Confirm the preview copy says restore replaces the current local library and offers Export Current Library First.
4. Choose Export Current Library First.
5. Choose Restore Backup.
6. Confirm the restored library is active and the success status is shown.
7. Confirm restored content, tags, settings, wikilinks, backlinks, text sizes, book covers, recent-page cleanup, and Trash contents.

## Restore Malformed or Repairable Backup

1. Select a backup with repairable missing metadata, timestamps, invalid tags, or unavailable page parents.
2. Confirm Restore Preview still appears.
3. Confirm repair warnings are visible.
4. Restore the backup.
5. Confirm repaired items are present as described by the warnings and the restore status says it completed with warnings.

## Cancel Restore After Preview

1. Select a valid backup.
2. Confirm Restore Preview appears.
3. Choose Cancel.
4. Confirm the current library remains active and Backup Status says restore was canceled.

## Simulate Failed Restore Write

1. In a development browser, open DevTools and temporarily make IndexedDB writes fail if possible, such as by blocking storage, using a private/storage-restricted context, or injecting a failing `indexedDB` wrapper before restore.
2. Select a valid backup and proceed to Restore Backup.
3. Confirm Backup Status shows restore failed while saving.
4. Confirm the previous library remains active in the current tab.
5. Confirm Download Safety Backup appears and downloads the pre-restore library copy.
6. Refresh only after exporting or downloading the safety backup, then confirm whether browser storage kept the old library or needs recovery from the safety backup.

## Successful Restore Content Checks

After a successful restore, verify:

- Books, chapters, chapter pages, and loose pages have the expected titles and order.
- Page content renders correctly, including rich text, wikilinks, and slash tags.
- Settings such as theme, shelf style, books per row, custom shortcuts, and text size are restored or safely defaulted.
- Trash shows restored backup Trash contents, and items can still be restored or deleted forever.
- Search finds restored page titles, content, tags, wikilinks, and Trash results.
