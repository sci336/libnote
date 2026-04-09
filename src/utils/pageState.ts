import type { Page } from '../types/domain';

export function isLoosePage(page: Page): boolean {
  return page.isLoose === true || page.chapterId === null;
}

export function isChapterPage(page: Page): boolean {
  return !isLoosePage(page);
}

export function getPagePreview(page: Page): string {
  const trimmed = page.content.trim();
  if (!trimmed) {
    return 'Plain text note';
  }

  return `${trimmed.slice(0, 90)}${trimmed.length > 90 ? '...' : ''}`;
}
