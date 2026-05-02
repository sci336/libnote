import { normalizeLibraryData, DEFAULT_TEXT_SIZE } from '../store/libraryStore';
import type { AppSettings, Book, Chapter, LibraryData, Page } from '../types/domain';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings } from './appSettings';
import { isValidBookCoverId } from './bookCovers';
import { nowIso } from './date';
import { contentToPlainText } from './richText';

const BACKUP_APP_NAME = 'LibNote';
const LEGACY_BACKUP_APP_NAMES = new Set(['LibNote', 'iNote']);
const BACKUP_VERSION = 2;
const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2]);

export interface LibraryBackupPayload {
  app: string;
  appName: string;
  version: number;
  backupVersion: number;
  exportedAt: string;
  data: LibraryData;
  books: Book[];
  chapters: Chapter[];
  pages: Page[];
  settings?: AppSettings;
}

export interface ValidatedBackupPayload {
  payload: LibraryBackupPayload;
  data: LibraryData;
  settings: AppSettings;
  settingsStatus: 'restored' | 'defaulted';
  warnings: string[];
}

export function createBackupPayload(data: LibraryData, settings: AppSettings): LibraryBackupPayload {
  return {
    app: BACKUP_APP_NAME,
    appName: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    backupVersion: BACKUP_VERSION,
    exportedAt: nowIso(),
    data,
    books: data.books,
    chapters: data.chapters,
    pages: data.pages,
    settings
  };
}

export function validateBackupPayload(input: unknown): ValidatedBackupPayload {
  const warnings: string[] = [];

  if (!isRecord(input)) {
    throw new Error('This does not look like a LibNote backup file.');
  }

  const appName = typeof input.app === 'string' ? input.app : typeof input.appName === 'string' ? input.appName : null;
  const hasLibraryArrays = hasArrayLibraryData(input) || (isRecord(input.data) && hasArrayLibraryData(input.data));

  if (!appName || !LEGACY_BACKUP_APP_NAMES.has(appName)) {
    if (!hasLibraryArrays) {
      throw new Error('This does not look like a LibNote backup file.');
    }

    warnings.push('Backup metadata was missing, so this was treated as an older LibNote backup.');
  }

  const version = getBackupVersion(input);
  if (version !== null && !SUPPORTED_BACKUP_VERSIONS.has(version)) {
    throw new Error('This backup was created by an unsupported version of LibNote.');
  }

  if (version === null) {
    warnings.push('Backup version metadata was missing; data was restored using the current importer.');
  }

  const exportedAt =
    typeof input.exportedAt === 'string' && input.exportedAt.trim().length > 0 ? input.exportedAt : nowIso();

  if (exportedAt !== input.exportedAt) {
    warnings.push('Backup export timestamp was missing and was repaired.');
  }

  const data = parseLibraryData(getLibraryDataBlock(input), warnings);
  const settings =
    input.settings === undefined || !isRecord(input.settings)
      ? DEFAULT_APP_SETTINGS
      : filterRecentPageIdsForLibrary(normalizeAppSettings(input.settings), data.pages.map((page) => page.id));

  if (input.settings === undefined || !isRecord(input.settings)) {
    warnings.push('Backup settings were missing or invalid, so safe defaults were used.');
  }

  return {
    payload: {
      app: BACKUP_APP_NAME,
      appName: BACKUP_APP_NAME,
      version: BACKUP_VERSION,
      backupVersion: BACKUP_VERSION,
      exportedAt,
      data,
      books: data.books,
      chapters: data.chapters,
      pages: data.pages,
      settings
    },
    data,
    settings,
    settingsStatus: input.settings === undefined || !isRecord(input.settings) ? 'defaulted' : 'restored',
    warnings
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
    throw new Error('This file is not valid JSON.');
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
  const date = Number.isNaN(new Date(exportedAt).getTime()) ? nowIso().slice(0, 10) : exportedAt.slice(0, 10);
  return `${sanitizeFileName(`libnote-backup-${date}`)}.json`;
}

export function createPageExportFile(page: Page): { filename: string; content: string } {
  const safeTitle = sanitizeFileName(page.title, page.isLoose ? 'untitled-loose-page' : 'untitled-page');

  return {
    filename: `${safeTitle}.txt`,
    content: `${page.title || 'Untitled Page'}\n\n${contentToPlainText(page.content)}`
  };
}

function parseLibraryData(input: unknown, warnings: string[]): LibraryData {
  if (!isRecord(input)) {
    throw new Error('This backup is missing required library data.');
  }

  if (!Array.isArray(input.books) || !Array.isArray(input.chapters) || !Array.isArray(input.pages)) {
    throw new Error('This backup is missing required library data.');
  }

  const timestamp = nowIso();
  const books = parseBooks(input.books, timestamp, warnings);
  const chapters = parseChapters(input.chapters, timestamp, warnings);
  const pages = parsePages(input.pages, timestamp, warnings);

  const bookIds = new Set(books.map((book) => book.id));
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  const validChapters = chapters.filter((chapter) => {
    if (!bookIds.has(chapter.bookId)) {
      warnings.push(`Chapter "${chapter.title}" was skipped because its book was missing.`);
      return false;
    }

    return true;
  });

  const validChapterIds = new Set(validChapters.map((chapter) => chapter.id));

  const validPages = pages.map((page) => {
    if (page.chapterId !== null && !validChapterIds.has(page.chapterId)) {
      if (chapterIds.has(page.chapterId) || page.isLoose) {
        warnings.push(`Page "${page.title}" was restored as a loose page because its chapter was unavailable.`);
        return { ...page, chapterId: null, isLoose: true };
      }

      warnings.push(`Page "${page.title}" was skipped because its chapter was missing.`);
      return null;
    }

    return page;
  }).filter((page): page is Page => page !== null);

  if (books.length === 0 && validChapters.length === 0 && validPages.length === 0) {
    throw new Error('This backup does not contain any restorable books, chapters, or pages.');
  }

  return normalizeLibraryData({ books, chapters: validChapters, pages: validPages });
}

function parseBooks(input: unknown[], fallbackTimestamp: string, warnings: string[]): Book[] {
  const seenIds = new Set<string>();
  const books: Book[] = [];

  input.forEach((item, index) => {
    const record = ensureRecord(item);
    if (!record) {
      warnings.push(`Book ${index + 1} was skipped because it was not a valid object.`);
      return;
    }

    const id = requireString(record.id);
    if (!id || seenIds.has(id)) {
      warnings.push(`Book ${index + 1} was skipped because its id was missing or duplicated.`);
      return;
    }

    const title = optionalTrimmedString(record.title) ?? 'Untitled Book';
    if (title === 'Untitled Book') {
      warnings.push(`Book ${index + 1} was missing a title and was restored as "Untitled Book."`);
    }

    const createdAt = parseTimestamp(record.createdAt, fallbackTimestamp);
    const updatedAt = parseTimestamp(record.updatedAt, createdAt);
    if (createdAt !== record.createdAt || updatedAt !== record.updatedAt) {
      warnings.push(`Book "${title}" was missing timestamps and was repaired.`);
    }

    const book = {
      id,
      title,
      coverId: isValidBookCoverId(record.coverId) ? record.coverId : undefined,
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt,
      updatedAt,
      ...parseTrashable(record)
    };

    seenIds.add(book.id);
    books.push(book);
  });

  return books;
}

function parseChapters(input: unknown[], fallbackTimestamp: string, warnings: string[]): Chapter[] {
  const seenIds = new Set<string>();
  const chapters: Chapter[] = [];

  input.forEach((item, index) => {
    const record = ensureRecord(item);
    if (!record) {
      warnings.push(`Chapter ${index + 1} was skipped because it was not a valid object.`);
      return;
    }

    const id = requireString(record.id);
    const bookId = requireString(record.bookId);
    if (!id || !bookId || seenIds.has(id)) {
      warnings.push(`Chapter ${index + 1} was skipped because a required id was missing or duplicated.`);
      return;
    }

    const title = optionalTrimmedString(record.title) ?? 'Untitled Chapter';
    if (title === 'Untitled Chapter') {
      warnings.push(`Chapter ${index + 1} was missing a title and was restored as "Untitled Chapter."`);
    }

    const createdAt = parseTimestamp(record.createdAt, fallbackTimestamp);
    const updatedAt = parseTimestamp(record.updatedAt, createdAt);
    if (createdAt !== record.createdAt || updatedAt !== record.updatedAt) {
      warnings.push(`Chapter "${title}" was missing timestamps and was repaired.`);
    }

    const chapter = {
      id,
      bookId,
      title,
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt,
      updatedAt,
      ...parseTrashable(record)
    };

    seenIds.add(chapter.id);
    chapters.push(chapter);
  });

  return chapters;
}

function parsePages(input: unknown[], fallbackTimestamp: string, warnings: string[]): Page[] {
  const seenIds = new Set<string>();
  const pages: Page[] = [];

  input.forEach((item, index) => {
    const record = ensureRecord(item);
    if (!record) {
      warnings.push(`Page ${index + 1} was skipped because it was not a valid object.`);
      return;
    }

    const id = requireString(record.id);
    if (!id || seenIds.has(id)) {
      warnings.push(`Page ${index + 1} was skipped because its id was missing or duplicated.`);
      return;
    }

    const chapterId = parseChapterId(record.chapterId);
    const content = normalizePageContent(record.content);
    if (content === '' && typeof record.content !== 'string') {
      warnings.push(`Page ${index + 1} was missing content and was restored with blank content.`);
    }

    const title = optionalTrimmedString(record.title) ?? 'Untitled Page';
    if (title === 'Untitled Page') {
      warnings.push(`Page ${index + 1} was missing a title and was restored as "Untitled Page."`);
    }

    const isLoose = typeof record.isLoose === 'boolean' ? record.isLoose || chapterId === null : chapterId === null;
    const createdAt = parseTimestamp(record.createdAt, fallbackTimestamp);
    const updatedAt = parseTimestamp(record.updatedAt, createdAt);
    if (createdAt !== record.createdAt || updatedAt !== record.updatedAt) {
      warnings.push(`Page "${title}" was missing timestamps and was repaired.`);
    }

    const page = {
      id,
      chapterId: isLoose ? null : chapterId,
      title,
      content,
      tags: parseTags(record.tags, `Page ${index + 1}`, warnings),
      textSize: optionalFiniteNumber(record.textSize) ?? DEFAULT_TEXT_SIZE,
      isLoose,
      sortOrder: optionalFiniteNumber(record.sortOrder) ?? index,
      createdAt,
      updatedAt,
      ...parseTrashable(record)
    };

    seenIds.add(page.id);
    pages.push(page);
  });

  return pages;
}

function parseTags(input: unknown, label: string, warnings: string[]): string[] {
  if (input === undefined || input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    warnings.push(`${label} had invalid tags and was restored with no tags.`);
    return [];
  }

  return input
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function normalizePageContent(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

function parseChapterId(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  return typeof input === 'string' && input.trim().length > 0 ? input : null;
}

function requireString(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }

  return input;
}

function optionalTrimmedString(input: unknown): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseTimestamp(input: unknown, fallback: string): string {
  if (typeof input !== 'string' || input.trim().length === 0 || Number.isNaN(new Date(input).getTime())) {
    return fallback;
  }

  return input;
}

function optionalFiniteNumber(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return undefined;
  }

  return input;
}

function ensureRecord(input: unknown): Record<string, unknown> | null {
  return isRecord(input) ? input : null;
}

function parseTrashable(record: Record<string, unknown>): Pick<Book, 'deletedAt' | 'deletedFrom'> {
  const deletedAt = typeof record.deletedAt === 'string' && record.deletedAt.trim().length > 0 ? record.deletedAt : null;
  const deletedFrom = isRecord(record.deletedFrom) ? record.deletedFrom : null;

  if (!deletedAt && !deletedFrom) {
    return {};
  }

  return {
    deletedAt,
    deletedFrom: deletedFrom
      ? {
          bookId: typeof deletedFrom.bookId === 'string' ? deletedFrom.bookId : undefined,
          chapterId: typeof deletedFrom.chapterId === 'string' ? deletedFrom.chapterId : undefined,
          wasLoose: typeof deletedFrom.wasLoose === 'boolean' ? deletedFrom.wasLoose : undefined
        }
      : null
  };
}

function getBackupVersion(input: Record<string, unknown>): number | null {
  const version = optionalFiniteNumber(input.version) ?? optionalFiniteNumber(input.backupVersion);
  return version === undefined ? null : version;
}

function getLibraryDataBlock(input: Record<string, unknown>): unknown {
  if (isRecord(input.data)) {
    return input.data;
  }

  if (hasArrayLibraryData(input)) {
    return input;
  }

  return null;
}

function hasArrayLibraryData(input: Record<string, unknown>): boolean {
  return Array.isArray(input.books) && Array.isArray(input.chapters) && Array.isArray(input.pages);
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
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
