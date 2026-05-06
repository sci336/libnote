import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import { DEFAULT_APP_SETTINGS } from './appSettings';
import { createBackupPayload, createBackupSummary, createSafetyBackupSnapshot, validateBackupPayload } from './backup';

const data: LibraryData = {
  books: [
    {
      id: 'book-1',
      title: 'Book One',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    }
  ],
  chapters: [
    {
      id: 'chapter-1',
      bookId: 'book-1',
      title: 'Chapter One',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    }
  ],
  pages: [
    {
      id: 'page-1',
      chapterId: 'chapter-1',
      title: 'Page One',
      content: 'Backup content',
      tags: ['history'],
      textSize: 16,
      isLoose: false,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    }
  ]
};

describe('backup', () => {
  it('creates a LibNote backup payload with duplicated top-level arrays for compatibility', () => {
    const payload = createBackupPayload(data, DEFAULT_APP_SETTINGS);

    expect(payload).toMatchObject({
      app: 'LibNote',
      appName: 'LibNote',
      version: 2,
      backupVersion: 2,
      data,
      books: data.books,
      chapters: data.chapters,
      pages: data.pages,
      settings: DEFAULT_APP_SETTINGS
    });
    expect(Number.isNaN(new Date(payload.exportedAt).getTime())).toBe(false);
  });

  it('creates a compatible safety backup snapshot before restore', () => {
    const snapshot = createSafetyBackupSnapshot(data, DEFAULT_APP_SETTINGS);
    const validated = validateBackupPayload(snapshot.payload);

    expect(snapshot.filename).toMatch(/^libnote-safety-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(snapshot.payload).toMatchObject({
      app: 'LibNote',
      backupVersion: 2,
      data,
      books: data.books,
      chapters: data.chapters,
      pages: data.pages,
      settings: DEFAULT_APP_SETTINGS
    });
    expect(snapshot.summary).toMatchObject({
      backupType: 'LibNote library backup',
      bookCount: 1,
      chapterCount: 1,
      pageCount: 1
    });
    expect(validated.data.pages[0].title).toBe('Page One');
  });

  it('validates current backup payloads and restores settings', () => {
    const validated = validateBackupPayload(createBackupPayload(data, DEFAULT_APP_SETTINGS));

    expect(validated.data.books[0].title).toBe('Book One');
    expect(validated.settingsStatus).toBe('restored');
    expect(validated.warnings).toEqual([]);
  });

  it('supports legacy app names when required data is present', () => {
    const validated = validateBackupPayload({
      app: 'iNote',
      version: 1,
      exportedAt: '2026-01-03T00:00:00.000Z',
      books: data.books,
      chapters: data.chapters,
      pages: data.pages
    });

    expect(validated.data.pages[0].id).toBe('page-1');
    expect(createBackupSummary(validated)).toMatchObject({
      appName: 'iNote',
      backupType: 'Legacy iNote library backup',
      backupVersion: 1,
      exportedAt: '2026-01-03T00:00:00.000Z',
      bookCount: 1,
      chapterCount: 1,
      pageCount: 1,
      loosePageCount: 0,
      trashedItemCount: 0,
      tagCount: 1
    });
    expect(validated.settingsStatus).toBe('defaulted');
    expect(validated.warnings).toContain('Backup settings were missing or invalid, so safe defaults were used.');
  });

  it('summarizes normal backups with loose pages and unique tags', () => {
    const validated = validateBackupPayload(
      createBackupPayload(
        {
          ...data,
          pages: [
            data.pages[0],
            {
              id: 'page-loose',
              chapterId: null,
              title: 'Loose Page',
              content: 'Loose content',
              tags: ['history', 'ideas'],
              textSize: 16,
              isLoose: true,
              sortOrder: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z'
            }
          ]
        },
        DEFAULT_APP_SETTINGS
      )
    );

    expect(createBackupSummary(validated)).toMatchObject({
      appName: 'LibNote',
      backupType: 'LibNote library backup',
      backupVersion: 2,
      bookCount: 1,
      chapterCount: 1,
      pageCount: 2,
      loosePageCount: 1,
      trashedItemCount: 0,
      tagCount: 2
    });
  });

  it('summarizes trashed books, chapters, and pages', () => {
    const validated = validateBackupPayload(
      createBackupPayload(
        {
          books: [{ ...data.books[0], deletedAt: '2026-01-04T00:00:00.000Z' }],
          chapters: [{ ...data.chapters[0], deletedAt: '2026-01-04T00:00:00.000Z' }],
          pages: [{ ...data.pages[0], deletedAt: '2026-01-04T00:00:00.000Z' }]
        },
        DEFAULT_APP_SETTINGS
      )
    );

    expect(createBackupSummary(validated).trashedItemCount).toBe(3);
  });

  it('summarizes a large backup with books, chapters, pages, loose pages, trash, and unique tags', () => {
    const largeData = buildLargeBackupLibrary();
    const validated = validateBackupPayload(createBackupPayload(largeData, DEFAULT_APP_SETTINGS));

    expect(createBackupSummary(validated)).toMatchObject({
      bookCount: 21,
      chapterCount: 121,
      pageCount: 1221,
      loosePageCount: 21,
      trashedItemCount: 3,
      tagCount: 5
    });
  });

  it('repairs recoverable malformed page data during validation', () => {
    const validated = validateBackupPayload({
      app: 'LibNote',
      version: 2,
      exportedAt: '2026-01-03T00:00:00.000Z',
      data: {
        books: data.books,
        chapters: data.chapters,
        pages: [
          {
            id: 'page-repaired',
            chapterId: 'missing-chapter',
            title: '',
            content: 42,
            tags: 'not-tags',
            isLoose: true
          }
        ]
      }
    });

    expect(validated.data.pages[0]).toMatchObject({
      id: 'page-repaired',
      chapterId: null,
      title: 'Untitled Page',
      content: '',
      tags: [],
      isLoose: true,
      textSize: 16
    });
    expect(validated.warnings).toEqual(
      expect.arrayContaining([
        'Page 1 was missing content and was restored with blank content.',
        'Page 1 was missing a title and was restored as "Untitled Page."',
        'Page 1 had invalid tags and was restored with no tags.'
      ])
    );
  });

  it('rejects clearly invalid backup data', () => {
    expect(() => validateBackupPayload(null)).toThrow('This does not look like a LibNote backup file.');
    expect(() =>
      validateBackupPayload({
        app: 'LibNote',
        version: 999,
        books: [],
        chapters: [],
        pages: []
      })
    ).toThrow('This backup was created by an unsupported version of LibNote.');
    expect(() =>
      validateBackupPayload({
        app: 'LibNote',
        version: 2,
        books: [],
        chapters: [],
        pages: []
      })
    ).toThrow('This backup does not contain any restorable books, chapters, or pages.');
  });
});

function buildLargeBackupLibrary(): LibraryData {
  const books: LibraryData['books'] = [];
  const chapters: LibraryData['chapters'] = [];
  const pages: LibraryData['pages'] = [];

  for (let bookIndex = 0; bookIndex < 20; bookIndex += 1) {
    books.push({
      id: `book-${bookIndex}`,
      title: `Book ${bookIndex}`,
      sortOrder: bookIndex,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    });

    for (let chapterIndex = 0; chapterIndex < 6; chapterIndex += 1) {
      const chapterId = `chapter-${bookIndex}-${chapterIndex}`;
      chapters.push({
        id: chapterId,
        bookId: `book-${bookIndex}`,
        title: `Chapter ${bookIndex}.${chapterIndex}`,
        sortOrder: chapterIndex,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      });

      for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
        pages.push({
          id: `page-${bookIndex}-${chapterIndex}-${pageIndex}`,
          chapterId,
          title: `Page ${bookIndex}.${chapterIndex}.${pageIndex}`,
          content: 'Backup scale note',
          tags: pageIndex % 2 === 0 ? ['project', 'research'] : ['archive'],
          textSize: 16,
          isLoose: false,
          sortOrder: pageIndex,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        });
      }
    }
  }

  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    pages.push({
      id: `loose-${pageIndex}`,
      chapterId: null,
      title: `Loose ${pageIndex}`,
      content: 'Loose backup note',
      tags: ['inbox'],
      textSize: 16,
      isLoose: true,
      sortOrder: pageIndex,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    });
  }

  books.push({
    id: 'trash-book',
    title: 'Trashed Book',
    sortOrder: 999,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-01-03T00:00:00.000Z'
  });
  chapters.push({
    id: 'trash-chapter',
    bookId: 'book-0',
    title: 'Trashed Chapter',
    sortOrder: 999,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-01-03T00:00:00.000Z',
    deletedFrom: { bookId: 'book-0' }
  });
  pages.push({
    id: 'trash-page',
    chapterId: null,
    title: 'Trashed Loose Page',
    content: 'Deleted backup note',
    tags: ['deleted'],
    textSize: 16,
    isLoose: true,
    sortOrder: 999,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-01-03T00:00:00.000Z',
    deletedFrom: { wasLoose: true }
  });

  return { books, chapters, pages };
}
