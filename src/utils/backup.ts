import { normalizeLibraryData, DEFAULT_TEXT_SIZE } from '../store/libraryStore';
import type { AppSettings, Book, Chapter, ID, LibraryData, Page } from '../types/domain';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings } from './appSettings';
import { isValidBookCoverId } from './bookCovers';
import { nowIso } from './date';
import { createId } from './ids';
import { isLoosePage } from './pageState';
import { contentToPlainText } from './richText';

const BACKUP_APP_NAME = 'LibNote';
const LEGACY_BACKUP_APP_NAMES = new Set(['LibNote', 'iNote']);
const BACKUP_VERSION = 2;
const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2]);

// Backups keep both a modern `data` block and top-level arrays so older exports
// can still be imported while new exports preserve settings and metadata.

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
  source: BackupSourceMetadata;
}

export interface BackupSourceMetadata {
  appName: string | null;
  backupVersion: number | null;
  exportedAt: string | null;
}

export interface BackupSummary {
  appName: string | null;
  backupType: string;
  exportedAt: string | null;
  backupVersion: number | null;
  bookCount: number;
  chapterCount: number;
  pageCount: number;
  loosePageCount: number;
  trashedItemCount: number;
  tagCount: number;
}

export interface BackupImportPreview {
  fileName: string;
  summary: BackupSummary;
  validated: ValidatedBackupPayload;
  warnings: string[];
  mergeReport?: BackupMergeReport;
}

export interface BackupMergeOptions {
  importTrash?: 'skip';
}

export interface BackupMergeReport {
  booksAdded: number;
  chaptersAdded: number;
  pagesAdded: number;
  loosePagesAdded: number;
  skippedExisting: number;
  conflictsDuplicated: number;
  ambiguousItems: number;
  trashItemsSkipped: number;
  settingsIgnored: boolean;
  recentPagesUnchanged: boolean;
  warnings: string[];
}

export interface BackupMergeResult {
  data: LibraryData;
  report: BackupMergeReport;
}

export interface BackupSafetySnapshot {
  filename: string;
  payload: LibraryBackupPayload;
  summary: BackupSummary;
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

export function createSafetyBackupSnapshot(data: LibraryData, settings: AppSettings): BackupSafetySnapshot {
  const payload = createBackupPayload(data, settings);
  const validated = validateBackupPayload(payload);

  return {
    filename: createSafetyBackupFileName(payload.exportedAt),
    payload,
    summary: createBackupSummary(validated)
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

    // Older LibNote-style backups may not have app metadata. Accept them only
    // when the required library arrays are present and warn before import.
    warnings.push('Backup metadata was missing, so this was treated as an older LibNote backup.');
  }

  const version = getBackupVersion(input);
  if (version !== null && !SUPPORTED_BACKUP_VERSIONS.has(version)) {
    throw new Error('This backup was created by an unsupported version of LibNote.');
  }

  if (version === null) {
    warnings.push('Backup version metadata was missing; data was restored using the current importer.');
  }

  const sourceExportedAt =
    typeof input.exportedAt === 'string' && input.exportedAt.trim().length > 0 ? input.exportedAt : null;
  const exportedAt = sourceExportedAt ?? nowIso();

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
    warnings,
    source: {
      appName,
      backupVersion: version,
      exportedAt: sourceExportedAt
    }
  };
}

export function createBackupSummary(validated: ValidatedBackupPayload): BackupSummary {
  const { data, source } = validated;
  const uniqueTags = new Set<string>();
  let loosePageCount = 0;
  let trashedItemCount = 0;

  for (const book of data.books) {
    if (book.deletedAt) {
      trashedItemCount += 1;
    }
  }

  for (const chapter of data.chapters) {
    if (chapter.deletedAt) {
      trashedItemCount += 1;
    }
  }

  for (const page of data.pages) {
    if (page.isLoose || page.chapterId === null) {
      loosePageCount += 1;
    }

    if (page.deletedAt) {
      trashedItemCount += 1;
    }

    for (const tag of page.tags) {
      uniqueTags.add(tag);
    }
  }

  return {
    appName: source.appName,
    backupType: getBackupTypeLabel(source.appName),
    exportedAt: source.exportedAt,
    backupVersion: source.backupVersion,
    bookCount: data.books.length,
    chapterCount: data.chapters.length,
    pageCount: data.pages.length,
    loosePageCount,
    trashedItemCount,
    tagCount: uniqueTags.size
  };
}

export function mergeBackupIntoLibrary(
  currentData: LibraryData,
  importedData: LibraryData,
  options: BackupMergeOptions = {}
): BackupMergeResult {
  const importTrash = options.importTrash ?? 'skip';
  const workingData: LibraryData = {
    books: currentData.books.map((book) => ({ ...book })),
    chapters: currentData.chapters.map((chapter) => ({ ...chapter })),
    pages: currentData.pages.map((page) => ({ ...page, tags: [...page.tags] }))
  };
  const report: BackupMergeReport = {
    booksAdded: 0,
    chaptersAdded: 0,
    pagesAdded: 0,
    loosePagesAdded: 0,
    skippedExisting: 0,
    conflictsDuplicated: 0,
    ambiguousItems: 0,
    trashItemsSkipped: countTrashedItems(importedData),
    settingsIgnored: true,
    recentPagesUnchanged: true,
    warnings: []
  };

  if (importTrash === 'skip' && report.trashItemsSkipped > 0) {
    report.warnings.push('Imported Trash items were skipped during merge and did not affect current active items.');
  }

  const importedLiveBookIds = new Set(importedData.books.filter(isLiveRecord).map((book) => book.id));
  const importedLiveChapterIds = new Set(
    importedData.chapters
      .filter((chapter) => isLiveRecord(chapter) && importedLiveBookIds.has(chapter.bookId))
      .map((chapter) => chapter.id)
  );
  const bookIdMap = new Map<ID, ID>();
  const chapterIdMap = new Map<ID, ID>();
  const usedIds = collectUsedIds(workingData);
  const currentLiveBooksById = new Map(workingData.books.filter(isLiveRecord).map((book) => [book.id, book]));
  const currentLiveChaptersById = new Map(workingData.chapters.filter(isLiveRecord).map((chapter) => [chapter.id, chapter]));
  const currentLivePagesById = new Map(workingData.pages.filter(isLiveRecord).map((page) => [page.id, page]));

  // Backup merge is intentionally additive. It avoids deleting local data
  // because imported files may be old, partial, or from another browser.
  for (const importedBook of importedData.books) {
    if (!isLiveRecord(importedBook)) {
      continue;
    }

    const existingById = currentLiveBooksById.get(importedBook.id);
    if (existingById) {
      bookIdMap.set(importedBook.id, existingById.id);
      report.skippedExisting += 1;
      continue;
    }

    const titleMatch = findUniqueTitleMatch(
      workingData.books.filter(isLiveRecord),
      importedData.books.filter(isLiveRecord),
      importedBook
    );
    if (titleMatch.status === 'matched') {
      bookIdMap.set(importedBook.id, titleMatch.item.id);
      report.skippedExisting += 1;
      continue;
    }

    if (titleMatch.status === 'ambiguous') {
      report.ambiguousItems += 1;
      report.warnings.push(`Book "${importedBook.title}" had an ambiguous title match and was imported as a separate book.`);
    }

    const addedBook = cloneBookForImport(importedBook, usedIds, getNextSortOrder(workingData.books.filter(isLiveRecord)));
    workingData.books.push(addedBook);
    currentLiveBooksById.set(addedBook.id, addedBook);
    bookIdMap.set(importedBook.id, addedBook.id);
    report.booksAdded += 1;
  }

  for (const importedChapter of importedData.chapters) {
    if (!isLiveRecord(importedChapter) || !importedLiveBookIds.has(importedChapter.bookId)) {
      continue;
    }

    const targetBookId = bookIdMap.get(importedChapter.bookId);
    if (!targetBookId) {
      continue;
    }

    const existingById = currentLiveChaptersById.get(importedChapter.id);
    if (existingById && existingById.bookId === targetBookId) {
      chapterIdMap.set(importedChapter.id, existingById.id);
      report.skippedExisting += 1;
      continue;
    }

    const currentSiblings = workingData.chapters.filter(
      (chapter) => isLiveRecord(chapter) && chapter.bookId === targetBookId
    );
    const importedSiblings = importedData.chapters.filter(
      (chapter) => isLiveRecord(chapter) && chapter.bookId === importedChapter.bookId
    );
    const titleMatch = findUniqueTitleMatch(currentSiblings, importedSiblings, importedChapter);
    if (titleMatch.status === 'matched') {
      chapterIdMap.set(importedChapter.id, titleMatch.item.id);
      report.skippedExisting += 1;
      continue;
    }

    if (titleMatch.status === 'ambiguous') {
      report.ambiguousItems += 1;
      report.warnings.push(
        `Chapter "${importedChapter.title}" had an ambiguous title match and was imported as a separate chapter.`
      );
    }

    const addedChapter = cloneChapterForImport(
      importedChapter,
      targetBookId,
      usedIds,
      getNextSortOrder(currentSiblings)
    );
    workingData.chapters.push(addedChapter);
    currentLiveChaptersById.set(addedChapter.id, addedChapter);
    chapterIdMap.set(importedChapter.id, addedChapter.id);
    report.chaptersAdded += 1;
  }

  for (const importedPage of importedData.pages) {
    if (!isLiveRecord(importedPage)) {
      continue;
    }

    const importedPageIsLoose = isLoosePage(importedPage);
    if (!importedPageIsLoose && (!importedPage.chapterId || !importedLiveChapterIds.has(importedPage.chapterId))) {
      continue;
    }

    const targetChapterId = importedPageIsLoose ? null : chapterIdMap.get(importedPage.chapterId ?? '') ?? null;
    if (!importedPageIsLoose && !targetChapterId) {
      continue;
    }

    const existingById = currentLivePagesById.get(importedPage.id);
    if (existingById && pageLocationsMatch(existingById, targetChapterId, importedPageIsLoose)) {
      if (pagesHaveSameUserContent(existingById, importedPage)) {
        report.skippedExisting += 1;
        continue;
      }

      addConflictPage(workingData, importedPage, targetChapterId, importedPageIsLoose, usedIds, report);
      continue;
    }

    const currentSiblings = workingData.pages.filter(
      (page) => isLiveRecord(page) && pageLocationsMatch(page, targetChapterId, importedPageIsLoose)
    );
    const importedSiblings = importedData.pages.filter((page) => {
      if (!isLiveRecord(page)) {
        return false;
      }
      if (importedPageIsLoose) {
        return isLoosePage(page);
      }
      return page.chapterId === importedPage.chapterId && !isLoosePage(page);
    });
    const titleMatch = findUniqueTitleMatch(currentSiblings, importedSiblings, importedPage);

    if (titleMatch.status === 'matched') {
      if (pagesHaveSameUserContent(titleMatch.item, importedPage)) {
        report.skippedExisting += 1;
      } else {
        addConflictPage(workingData, importedPage, targetChapterId, importedPageIsLoose, usedIds, report);
      }
      continue;
    }

    if (titleMatch.status === 'ambiguous') {
      report.ambiguousItems += 1;
      report.warnings.push(`Page "${importedPage.title}" had an ambiguous title match and was imported as a separate page.`);
    }

    const addedPage = clonePageForImport(
      importedPage,
      targetChapterId,
      importedPageIsLoose,
      importedPage.title,
      usedIds,
      getNextSortOrder(currentSiblings)
    );
    workingData.pages.push(addedPage);
    currentLivePagesById.set(addedPage.id, addedPage);
    if (importedPageIsLoose) {
      report.loosePagesAdded += 1;
    } else {
      report.pagesAdded += 1;
    }
  }

  return {
    data: normalizeLibraryData(workingData),
    report
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

type TitleMatch<T> = { status: 'matched'; item: T } | { status: 'none' } | { status: 'ambiguous' };

function findUniqueTitleMatch<T extends { title: string }>(
  currentSiblings: T[],
  importedSiblings: T[],
  importedItem: T
): TitleMatch<T> {
  const normalizedTitle = normalizeMatchTitle(importedItem.title);
  const currentMatches = currentSiblings.filter((item) => normalizeMatchTitle(item.title) === normalizedTitle);
  const importedMatches = importedSiblings.filter((item) => normalizeMatchTitle(item.title) === normalizedTitle);

  // Title matching is only trusted when both sides have a single candidate.
  // Duplicate titles stay separate so imports do not guess the wrong parent.
  if (currentMatches.length === 1 && importedMatches.length === 1) {
    return { status: 'matched', item: currentMatches[0] };
  }

  if (currentMatches.length > 0 || importedMatches.length > 1) {
    return { status: 'ambiguous' };
  }

  return { status: 'none' };
}

function addConflictPage(
  data: LibraryData,
  importedPage: Page,
  targetChapterId: ID | null,
  isLoose: boolean,
  usedIds: Set<ID>,
  report: BackupMergeReport
): void {
  const siblings = data.pages.filter((page) => isLiveRecord(page) && pageLocationsMatch(page, targetChapterId, isLoose));
  const title = createImportedTitle(importedPage.title, siblings.map((page) => page.title));
  // Same id/title with different content means both pages matter. Keep the
  // imported copy with a visible suffix instead of overwriting local writing.
  const addedPage = clonePageForImport(
    importedPage,
    targetChapterId,
    isLoose,
    title,
    usedIds,
    getNextSortOrder(siblings)
  );

  data.pages.push(addedPage);
  report.conflictsDuplicated += 1;
  if (isLoose) {
    report.loosePagesAdded += 1;
  } else {
    report.pagesAdded += 1;
  }
  report.warnings.push(`Page "${importedPage.title}" conflicted with an existing page and was imported as "${title}".`);
}

function cloneBookForImport(book: Book, usedIds: Set<ID>, sortOrder: number): Book {
  return {
    ...book,
    id: reserveImportId(book.id, 'book', usedIds),
    sortOrder,
    deletedAt: null,
    deletedFrom: null
  };
}

function cloneChapterForImport(chapter: Chapter, bookId: ID, usedIds: Set<ID>, sortOrder: number): Chapter {
  return {
    ...chapter,
    id: reserveImportId(chapter.id, 'chapter', usedIds),
    bookId,
    sortOrder,
    deletedAt: null,
    deletedFrom: null
  };
}

function clonePageForImport(
  page: Page,
  chapterId: ID | null,
  isLoose: boolean,
  title: string,
  usedIds: Set<ID>,
  sortOrder: number
): Page {
  return {
    ...page,
    id: reserveImportId(page.id, 'page', usedIds),
    chapterId: isLoose ? null : chapterId,
    title,
    tags: [...page.tags],
    isLoose,
    sortOrder,
    deletedAt: null,
    deletedFrom: null
  };
}

function reserveImportId(preferredId: ID, prefix: string, usedIds: Set<ID>): ID {
  if (!usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let id = createId(prefix);
  while (usedIds.has(id)) {
    id = createId(prefix);
  }
  usedIds.add(id);
  return id;
}

function collectUsedIds(data: LibraryData): Set<ID> {
  return new Set([
    ...data.books.map((book) => book.id),
    ...data.chapters.map((chapter) => chapter.id),
    ...data.pages.map((page) => page.id)
  ]);
}

function pagesHaveSameUserContent(left: Page, right: Page): boolean {
  return (
    left.title === right.title &&
    left.content === right.content &&
    left.textSize === right.textSize &&
    areStringArraysEqual(left.tags, right.tags)
  );
}

function pageLocationsMatch(page: Page, chapterId: ID | null, isLoose: boolean): boolean {
  if (isLoose) {
    return isLoosePage(page);
  }

  return !isLoosePage(page) && page.chapterId === chapterId;
}

function createImportedTitle(title: string, siblingTitles: string[]): string {
  const baseTitle = `${title} (Imported)`;
  const normalizedSiblingTitles = new Set(siblingTitles.map(normalizeMatchTitle));

  if (!normalizedSiblingTitles.has(normalizeMatchTitle(baseTitle))) {
    return baseTitle;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${title} (Imported ${index})`;
    if (!normalizedSiblingTitles.has(normalizeMatchTitle(candidate))) {
      return candidate;
    }
  }

  return `${title} (Imported ${Date.now()})`;
}

function getNextSortOrder<T extends { sortOrder: number }>(siblings: T[]): number {
  if (siblings.length === 0) {
    return 0;
  }

  return Math.max(...siblings.map((item) => item.sortOrder)) + 1;
}

function countTrashedItems(data: LibraryData): number {
  return [...data.books, ...data.chapters, ...data.pages].filter((item) => !isLiveRecord(item)).length;
}

function normalizeMatchTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function isLiveRecord(record: { deletedAt?: string | null }): boolean {
  return typeof record.deletedAt !== 'string' || record.deletedAt.length === 0;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

export function createSafetyBackupFileName(exportedAt: string): string {
  const date = Number.isNaN(new Date(exportedAt).getTime()) ? nowIso().slice(0, 10) : exportedAt.slice(0, 10);
  return `${sanitizeFileName(`libnote-safety-backup-${date}`)}.json`;
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
        // If a page references a chapter that existed in the file but could not
        // be restored, preserve the page as loose instead of dropping content.
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

function getBackupTypeLabel(appName: string | null): string {
  if (appName === 'iNote') {
    return 'Legacy iNote library backup';
  }

  if (appName === 'LibNote') {
    return 'LibNote library backup';
  }

  return 'Library backup';
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
