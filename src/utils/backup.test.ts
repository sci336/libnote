import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../types/domain';
import { DEFAULT_APP_SETTINGS } from './appSettings';
import { createBackupPayload, validateBackupPayload } from './backup';

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
    expect(validated.settingsStatus).toBe('defaulted');
    expect(validated.warnings).toContain('Backup settings were missing or invalid, so safe defaults were used.');
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
