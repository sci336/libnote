import { describe, expect, it } from 'vitest';
import type { AppSettings, Book, Chapter, LibraryData, Page } from '../types/domain';
import { DEFAULT_APP_SETTINGS } from './appSettings';
import {
  createBackupPayload,
  createBackupSummary,
  createSafetyBackupSnapshot,
  mergeBackupIntoLibrary,
  validateBackupPayload
} from './backup';

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

  it('merges a backup with a new book into an existing library', () => {
    const current = buildMergeLibrary({ bookTitle: 'Current', chapterTitle: 'Notes', pageTitle: 'Home' });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Imported',
      chapterTitle: 'Ideas',
      pageTitle: 'Draft'
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.books.map((book) => book.title)).toEqual(['Current', 'Imported']);
    expect(result.report).toMatchObject({
      booksAdded: 1,
      chaptersAdded: 1,
      pagesAdded: 1,
      skippedExisting: 0
    });
  });

  it('merges same-title books by adding missing chapters under the current book', () => {
    const current = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables' });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Math',
      chapterTitle: 'Photography',
      pageTitle: 'Light'
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.books.filter((book) => book.title === 'Math')).toHaveLength(1);
    expect(result.data.chapters.map((chapter) => chapter.title).sort()).toEqual(['Algebra', 'Photography']);
    expect(result.data.chapters.find((chapter) => chapter.title === 'Photography')?.bookId).toBe('current-book');
    expect(result.report).toMatchObject({
      booksAdded: 0,
      chaptersAdded: 1,
      pagesAdded: 1,
      skippedExisting: 1
    });
  });

  it('merges same-title chapters by adding missing pages under the current chapter', () => {
    const current = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables' });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Math',
      chapterTitle: 'Algebra',
      pageTitle: 'Equations'
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.chapters.filter((chapter) => chapter.title === 'Algebra')).toHaveLength(1);
    expect(result.data.pages.map((page) => page.title).sort()).toEqual(['Equations', 'Variables']);
    expect(result.data.pages.find((page) => page.title === 'Equations')?.chapterId).toBe('current-chapter');
    expect(result.report).toMatchObject({
      booksAdded: 0,
      chaptersAdded: 0,
      pagesAdded: 1,
      skippedExisting: 2
    });
  });

  it('merges loose pages additively', () => {
    const current = buildMergeLibrary({
      bookTitle: 'Current',
      chapterTitle: 'Notes',
      pageTitle: 'Home',
      loosePages: [page('current-loose', null, 'Inbox', 'keep', { isLoose: true, sortOrder: 0 })]
    });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Current',
      chapterTitle: 'Notes',
      pageTitle: 'Home',
      loosePages: [page('import-loose', null, 'Scratch', 'new loose', { isLoose: true, sortOrder: 0 })]
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.pages.filter((item) => item.isLoose).map((item) => item.title).sort()).toEqual(['Inbox', 'Scratch']);
    expect(result.data.pages.find((item) => item.title === 'Scratch')?.sortOrder).toBe(1);
    expect(result.report.loosePagesAdded).toBe(1);
  });

  it('does not duplicate imports when stable IDs and page content match', () => {
    const current = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables' });
    const imported = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables' });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.books).toHaveLength(1);
    expect(result.data.chapters).toHaveLength(1);
    expect(result.data.pages).toHaveLength(1);
    expect(result.report).toMatchObject({
      skippedExisting: 3,
      conflictsDuplicated: 0
    });
  });

  it('keeps same-title different-content page conflicts as imported duplicates', () => {
    const current = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables', content: 'current' });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Math',
      chapterTitle: 'Algebra',
      pageTitle: 'Variables',
      content: 'imported'
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.pages.map((item) => item.title).sort()).toEqual(['Variables', 'Variables (Imported)']);
    expect(result.data.pages.find((item) => item.title === 'Variables')?.content).toBe('current');
    expect(result.data.pages.find((item) => item.title === 'Variables (Imported)')?.content).toBe('imported');
    expect(result.report).toMatchObject({
      pagesAdded: 1,
      conflictsDuplicated: 1
    });
  });

  it('does not incorrectly merge ambiguous duplicate book, chapter, or page names', () => {
    const current: LibraryData = {
      books: [
        book('math-1', 'Math', 0),
        book('math-2', 'Math', 1),
        book('science', 'Science', 2),
        book('art', 'Art', 3)
      ],
      chapters: [
        chapter('science-dup-1', 'science', 'Dup', 0),
        chapter('science-dup-2', 'science', 'Dup', 1),
        chapter('art-chapter', 'art', 'Sketch', 0)
      ],
      pages: [
        page('art-topic-1', 'art-chapter', 'Topic', 'one', { sortOrder: 0 }),
        page('art-topic-2', 'art-chapter', 'Topic', 'two', { sortOrder: 1 })
      ]
    };
    const imported: LibraryData = {
      books: [book('import-math', 'Math', 0), book('science', 'Science', 1), book('art', 'Art', 2)],
      chapters: [
        chapter('import-math-chapter', 'import-math', 'Algebra', 0),
        chapter('import-science-dup', 'science', 'Dup', 0),
        chapter('art-chapter', 'art', 'Sketch', 0)
      ],
      pages: [
        page('import-math-page', 'import-math-chapter', 'Variables', 'imported'),
        page('import-science-page', 'import-science-dup', 'Cell', 'imported'),
        page('import-art-topic', 'art-chapter', 'Topic', 'imported')
      ]
    };

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.books.filter((item) => item.title === 'Math')).toHaveLength(3);
    expect(result.data.chapters.filter((item) => item.bookId === 'science' && item.title === 'Dup')).toHaveLength(3);
    expect(result.data.pages.filter((item) => item.chapterId === 'art-chapter' && item.title === 'Topic')).toHaveLength(3);
    expect(result.report.ambiguousItems).toBe(3);
  });

  it('does not overwrite current settings or recent pages during merge', () => {
    const currentSettings: AppSettings = { ...DEFAULT_APP_SETTINGS, recentPageIds: ['current-page'], theme: 'dark-archive' };
    const importedSettings: AppSettings = { ...DEFAULT_APP_SETTINGS, recentPageIds: ['import-page'], theme: 'warm-study' };
    const current = buildMergeLibrary({ bookTitle: 'Current', chapterTitle: 'Notes', pageTitle: 'Home' });
    const imported = buildMergeLibrary({ idPrefix: 'import', bookTitle: 'Imported', chapterTitle: 'Notes', pageTitle: 'Home' });

    const result = mergeBackupIntoLibrary(current, validateBackupPayload(createBackupPayload(imported, importedSettings)).data);

    expect(currentSettings).toMatchObject({ recentPageIds: ['current-page'], theme: 'dark-archive' });
    expect(result.report).toMatchObject({
      settingsIgnored: true,
      recentPagesUnchanged: true
    });
  });

  it('skips imported Trash without deleting active current-library content', () => {
    const current = buildMergeLibrary({ bookTitle: 'Math', chapterTitle: 'Algebra', pageTitle: 'Variables' });
    const imported = buildMergeLibrary({
      idPrefix: 'import',
      bookTitle: 'Archive',
      chapterTitle: 'Old',
      pageTitle: 'Deleted',
      deletedAt: '2026-01-03T00:00:00.000Z'
    });

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.data.books.map((item) => item.title)).toEqual(['Math']);
    expect(result.data.pages.map((item) => item.title)).toEqual(['Variables']);
    expect(result.report).toMatchObject({
      trashItemsSkipped: 3,
      booksAdded: 0,
      chaptersAdded: 0,
      pagesAdded: 0
    });
  });

  it('reports merge counts accurately for mixed additions, skips, conflicts, and trash', () => {
    const current = buildMergeLibrary({
      bookTitle: 'Math',
      chapterTitle: 'Algebra',
      pageTitle: 'Variables',
      content: 'current',
      loosePages: [page('loose-current', null, 'Inbox', 'same', { isLoose: true })]
    });
    const imported = {
      books: [book('import-book', 'Math', 0)],
      chapters: [
        chapter('import-chapter-same', 'import-book', 'Algebra', 0),
        chapter('import-chapter-new', 'import-book', 'Geometry', 1)
      ],
      pages: [
        page('import-page-conflict', 'import-chapter-same', 'Variables', 'changed'),
        page('import-page-new', 'import-chapter-new', 'Angles', 'new'),
        page('loose-import-skip', null, 'Inbox', 'same', { isLoose: true }),
        page('loose-import-new', null, 'Scratch', 'new loose', { isLoose: true }),
        page('trash-import', null, 'Trashed', 'trash', { isLoose: true, deletedAt: '2026-01-03T00:00:00.000Z' })
      ]
    };

    const result = mergeBackupIntoLibrary(current, imported);

    expect(result.report).toMatchObject({
      booksAdded: 0,
      chaptersAdded: 1,
      pagesAdded: 2,
      loosePagesAdded: 1,
      skippedExisting: 3,
      conflictsDuplicated: 1,
      ambiguousItems: 0,
      trashItemsSkipped: 1
    });
  });
});

function buildMergeLibrary(options: {
  idPrefix?: string;
  bookTitle: string;
  chapterTitle: string;
  pageTitle: string;
  content?: string;
  deletedAt?: string;
  loosePages?: Page[];
  extraBooks?: Book[];
  extraChapters?: Chapter[];
  extraPages?: Page[];
}): LibraryData {
  const prefix = options.idPrefix ?? 'current';
  const deletedAt = options.deletedAt;
  const mainBook = book(`${prefix}-book`, options.bookTitle, 0, deletedAt);
  const mainChapter = chapter(`${prefix}-chapter`, mainBook.id, options.chapterTitle, 0, deletedAt);
  const mainPage = page(`${prefix}-page`, mainChapter.id, options.pageTitle, options.content ?? 'same content', {
    sortOrder: 0,
    deletedAt
  });

  return {
    books: [mainBook, ...(options.extraBooks ?? [])],
    chapters: [mainChapter, ...(options.extraChapters ?? [])],
    pages: [mainPage, ...(options.loosePages ?? []), ...(options.extraPages ?? [])]
  };
}

function book(id: string, title: string, sortOrder: number, deletedAt?: string): Book {
  return {
    id,
    title,
    sortOrder,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...(deletedAt ? { deletedAt } : {})
  };
}

function chapter(id: string, bookId: string, title: string, sortOrder: number, deletedAt?: string): Chapter {
  return {
    id,
    bookId,
    title,
    sortOrder,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...(deletedAt ? { deletedAt, deletedFrom: { bookId } } : {})
  };
}

function page(
  id: string,
  chapterId: string | null,
  title: string,
  content: string,
  options: { isLoose?: boolean; sortOrder?: number; deletedAt?: string } = {}
): Page {
  const isLoose = options.isLoose ?? chapterId === null;
  return {
    id,
    chapterId: isLoose ? null : chapterId,
    title,
    content,
    tags: ['study/unit'],
    textSize: 16,
    isLoose,
    sortOrder: options.sortOrder ?? 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...(options.deletedAt ? { deletedAt: options.deletedAt, deletedFrom: { chapterId: chapterId ?? undefined, wasLoose: isLoose } } : {})
  };
}

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
