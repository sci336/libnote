import { normalizeLibraryData, DEFAULT_TEXT_SIZE } from '../store/libraryStore';
import type { AppSettings, Book, Chapter, LibraryData, Page } from '../types/domain';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings } from './appSettings';
import { nowIso } from './date';

const BACKUP_APP_NAME = 'LibNote';
const LEGACY_BACKUP_APP_NAMES = new Set(['LibNote', 'iNote']);
const BACKUP_VERSION = 1;

export interface LibraryBackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  data: LibraryData;
  settings?: AppSettings;
}

export interface ValidatedBackupPayload {
  payload: LibraryBackupPayload;
  data: LibraryData;
  settings: AppSettings;
  settingsStatus: 'restored' | 'defaulted';
}

export function createBackupPayload(data: LibraryData, settings: AppSettings): LibraryBackupPayload {
  return {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    data,
    settings
  };
}

export function validateBackupPayload(input: unknown): ValidatedBackupPayload {
  if (!isRecord(input)) {
    throw new Error('Backup file must contain a JSON object.');
  }

  if (typeof input.app !== 'string' || !LEGACY_BACKUP_APP_NAMES.has(input.app)) {
    throw new Error('This backup file is not recognized as a LibNote library backup.');
  }

  if (input.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(input.version)}.`);
  }

  if (typeof input.exportedAt !== 'string' || input.exportedAt.trim().length === 0) {
    throw new Error('Backup file is missing an exportedAt timestamp.');
  }

  const data = parseLibraryData(input.data);
  const settings =
    input.settings === undefined || !isRecord(input.settings)
      ? DEFAULT_APP_SETTINGS
      : filterRecentPageIdsForLibrary(normalizeAppSettings(input.settings), data.pages.map((page) => page.id));

  return {
    payload: {
      app: BACKUP_APP_NAME,
      version: BACKUP_VERSION,
      exportedAt: input.exportedAt,
      data,
      settings
    },
    data,
    settings,
    settingsStatus: input.settings === undefined || !isRecord(input.settings) ? 'defaulted' : 'restored'
  };
}

export async function readBackupFile(file: File): Promise<unknown> {
  let text: string;

  try {
    text = await file.text();
  } catch {
    throw new Error('Failed to read the selected backup file.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  downloadBlob(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function downloadPlainTextFile(filename: string, content: string): void {
  downloadBlob(filename, content, 'text/plain;charset=utf-8');
}

export function sanitizeFileName(value: string, fallback = 'libnote-backup'): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .slice(0, 120)
    .trim();

  return sanitized.length > 0 ? sanitized : fallback;
}

export function createBackupFileName(exportedAt: string): string {
  const timestamp = exportedAt.replace(/[:.]/g, '-');
  return `${sanitizeFileName(`libnote-backup-${timestamp}`)}.json`;
}

export function createPageExportFile(page: Page): { filename: string; content: string } {
  const safeTitle = sanitizeFileName(page.title, page.isLoose ? 'untitled-loose-page' : 'untitled-page');

  return {
    filename: `${safeTitle}.txt`,
    content: `${page.title || 'Untitled Page'}\n\n${page.content}`
  };
}

function parseLibraryData(input: unknown): LibraryData {
  if (!isRecord(input)) {
    throw new Error('Backup file is missing the library data block.');
  }

  const books = parseBooks(input.books);
  const chapters = parseChapters(input.chapters);
  const pages = parsePages(input.pages);

  const bookIds = new Set(books.map((book) => book.id));
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  for (const chapter of chapters) {
    if (!bookIds.has(chapter.bookId)) {
      throw new Error(`Chapter "${chapter.title}" points to a missing book.`);
    }
  }

  for (const page of pages) {
    if (page.chapterId !== null && !chapterIds.has(page.chapterId)) {
      throw new Error(`Page "${page.title}" points to a missing chapter.`);
    }
  }

  return normalizeLibraryData({ books, chapters, pages });
}

function parseBooks(input: unknown): Book[] {
  if (!Array.isArray(input)) {
    throw new Error('Backup data.books must be an array.');
  }

  const seenIds = new Set<string>();

  return input.map((item, index) => {
    const record = ensureRecord(item, `Book ${index + 1}`);
    const book = {
      id: requireString(record.id, `Book ${index + 1} id`),
      title: requireString(record.title, `Book ${index + 1} title`),
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt: requireString(record.createdAt, `Book ${index + 1} createdAt`),
      updatedAt: requireString(record.updatedAt, `Book ${index + 1} updatedAt`)
    };

    assertUniqueId(seenIds, book.id, `book "${book.title}"`);
    return book;
  });
}

function parseChapters(input: unknown): Chapter[] {
  if (!Array.isArray(input)) {
    throw new Error('Backup data.chapters must be an array.');
  }

  const seenIds = new Set<string>();

  return input.map((item, index) => {
    const record = ensureRecord(item, `Chapter ${index + 1}`);
    const chapter = {
      id: requireString(record.id, `Chapter ${index + 1} id`),
      bookId: requireString(record.bookId, `Chapter ${index + 1} bookId`),
      title: requireString(record.title, `Chapter ${index + 1} title`),
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt: requireString(record.createdAt, `Chapter ${index + 1} createdAt`),
      updatedAt: requireString(record.updatedAt, `Chapter ${index + 1} updatedAt`)
    };

    assertUniqueId(seenIds, chapter.id, `chapter "${chapter.title}"`);
    return chapter;
  });
}

function parsePages(input: unknown): Page[] {
  if (!Array.isArray(input)) {
    throw new Error('Backup data.pages must be an array.');
  }

  const seenIds = new Set<string>();

  return input.map((item, index) => {
    const record = ensureRecord(item, `Page ${index + 1}`);
    const chapterId = parseChapterId(record.chapterId, index);
    const page = {
      id: requireString(record.id, `Page ${index + 1} id`),
      chapterId,
      title: requireString(record.title, `Page ${index + 1} title`),
      content: requireString(record.content, `Page ${index + 1} content`),
      tags: parseTags(record.tags),
      textSize: optionalFiniteNumber(record.textSize) ?? DEFAULT_TEXT_SIZE,
      isLoose: chapterId === null,
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt: requireString(record.createdAt, `Page ${index + 1} createdAt`),
      updatedAt: requireString(record.updatedAt, `Page ${index + 1} updatedAt`)
    };

    assertUniqueId(seenIds, page.id, `page "${page.title}"`);
    return page;
  });
}

function parseTags(input: unknown): string[] {
  if (input === undefined) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error('Page tags must be an array when present.');
  }

  return input
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function parseChapterId(input: unknown, index: number): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`Page ${index + 1} chapterId must be a string or null.`);
  }

  return input;
}

function requireString(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return input;
}

function optionalFiniteNumber(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return undefined;
  }

  return input;
}

function ensureRecord(input: unknown, label: string): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new Error(`${label} must be an object.`);
  }

  return input;
}

function assertUniqueId(seenIds: Set<string>, id: string, label: string): void {
  if (seenIds.has(id)) {
    throw new Error(`The backup contains a duplicate id for ${label}.`);
  }

  seenIds.add(id);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
