import type { Book } from '../types/domain';

export interface BookCoverTemplate {
  id: string;
  label: string;
  className: string;
}

export const BOOK_COVER_TEMPLATES: BookCoverTemplate[] = [
  { id: 'ivory', label: 'Classic Leather', className: 'cover-theme-ivory' },
  { id: 'sage', label: 'Forest Study', className: 'cover-theme-sage' },
  { id: 'blue-mountain', label: 'Blue Archive', className: 'cover-theme-blue-mountain' },
  { id: 'terracotta', label: 'Terracotta Journal', className: 'cover-theme-terracotta' },
  { id: 'lavender', label: 'Lavender Notes', className: 'cover-theme-lavender' },
  { id: 'sand', label: 'Sandstone Paper', className: 'cover-theme-sand' },
  { id: 'misty-blue', label: 'Misty Blue', className: 'cover-theme-misty-blue' },
  { id: 'taupe', label: 'Warm Taupe', className: 'cover-theme-taupe' },
  { id: 'midnight', label: 'Midnight Library', className: 'cover-theme-midnight' },
  { id: 'olive', label: 'Olive Field Notes', className: 'cover-theme-olive' },
  { id: 'claret', label: 'Burgundy Reference', className: 'cover-theme-claret' },
  { id: 'slate', label: 'Slate Minimal', className: 'cover-theme-slate' }
];

const BOOK_COVER_TEMPLATE_IDS = new Set(BOOK_COVER_TEMPLATES.map((template) => template.id));

export function getBookCoverTemplate(book: Pick<Book, 'id' | 'createdAt' | 'coverId'>): BookCoverTemplate {
  return (
    BOOK_COVER_TEMPLATES.find((template) => template.id === book.coverId) ??
    getBookCoverTemplateById(getFallbackBookCoverId(book))
  );
}

export function getBookCoverTemplateById(coverId: string): BookCoverTemplate {
  return BOOK_COVER_TEMPLATES.find((template) => template.id === coverId) ?? BOOK_COVER_TEMPLATES[0];
}

export function normalizeBookCoverId(book: Pick<Book, 'id' | 'createdAt' | 'coverId'>): string {
  return isValidBookCoverId(book.coverId) ? book.coverId : getFallbackBookCoverId(book);
}

export function getFallbackBookCoverId(book: Pick<Book, 'id' | 'createdAt'>): string {
  const hashInput = `${book.id}:${book.createdAt}`;
  return BOOK_COVER_TEMPLATES[hashString(hashInput) % BOOK_COVER_TEMPLATES.length].id;
}

export function isValidBookCoverId(coverId: unknown): coverId is string {
  return typeof coverId === 'string' && BOOK_COVER_TEMPLATE_IDS.has(coverId);
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
