import type { Book } from '../types/domain';

export interface BookCoverTemplate {
  id: string;
  label: string;
  className: string;
}

export const BOOK_COVER_TEMPLATES: BookCoverTemplate[] = [
  { id: 'ivory', label: 'Ivory', className: 'cover-theme-ivory' },
  { id: 'sage', label: 'Sage', className: 'cover-theme-sage' },
  { id: 'blue-mountain', label: 'Blue Mountain', className: 'cover-theme-blue-mountain' },
  { id: 'terracotta', label: 'Terracotta', className: 'cover-theme-terracotta' },
  { id: 'lavender', label: 'Lavender', className: 'cover-theme-lavender' },
  { id: 'sand', label: 'Sand', className: 'cover-theme-sand' },
  { id: 'misty-blue', label: 'Misty Blue', className: 'cover-theme-misty-blue' },
  { id: 'taupe', label: 'Taupe', className: 'cover-theme-taupe' },
  { id: 'midnight', label: 'Midnight', className: 'cover-theme-midnight' },
  { id: 'claret', label: 'Claret', className: 'cover-theme-claret' }
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
