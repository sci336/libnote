import type { Page } from '../types/domain';
import { contentToPreviewText } from './richText';

/**
 * Loose pages are modeled redundantly on purpose: older snapshots may rely on
 * `chapterId === null`, while newer writes also set `isLoose`. Treat either as
 * authoritative so hydration and move logic stay backward compatible.
 */
export function isLoosePage(page: Page): boolean {
  return page.isLoose === true || page.chapterId === null;
}

export function isChapterPage(page: Page): boolean {
  return !isLoosePage(page);
}

/**
 * Returns a short preview for list views without parsing links or markdown.
 * Keeping this lossy on purpose prevents list rows from depending on editor-only
 * formatting behavior.
 */
export function getPagePreview(page: Page): string {
  return contentToPreviewText(page.content, { maxLength: 90, emptyText: 'Empty page' });
}
