import type { LibraryData } from '../types/domain';

export interface LargeLibraryFixture {
  data: LibraryData;
  recentPageIds: string[];
  ids: {
    rareTitlePageId: string;
    rareContentPageId: string;
    looseRarePageId: string;
    duplicatePageIds: string[];
    backlinkTargetPageId: string;
    backlinkSourcePageIds: string[];
    trashedPageId: string;
    trashedBookId: string;
    trashedChapterId: string;
  };
}

export interface LargeLibraryOptions {
  bookCount?: number;
  chaptersPerBook?: number;
  pagesPerChapter?: number;
  loosePageCount?: number;
  trashedPageCount?: number;
  linkSourceCount?: number;
}

const DEFAULT_OPTIONS: Required<LargeLibraryOptions> = {
  bookCount: 60,
  chaptersPerBook: 6,
  pagesPerChapter: 14,
  loosePageCount: 160,
  trashedPageCount: 80,
  linkSourceCount: 40
};

/**
 * Phase 4 stress target: personal-scale large libraries, not enterprise data.
 * Keep generated fixtures in the range of hundreds of books/chapters, several
 * thousand pages, long rich-text content, many slash tags, many wikilinks and
 * backlinks, duplicate titles, recent pages, and a busy Trash.
 */
export function buildLargeLibraryFixture(options: LargeLibraryOptions = {}): LargeLibraryFixture {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const books: LibraryData['books'] = [];
  const chapters: LibraryData['chapters'] = [];
  const pages: LibraryData['pages'] = [];
  const duplicatePageIds = ['duplicate-page-a', 'duplicate-page-b'];
  const backlinkSourcePageIds: string[] = [];
  const rareTitlePageId = 'rare-title-page';
  const rareContentPageId = 'rare-content-page';
  const looseRarePageId = 'loose-rare-page';
  const backlinkTargetPageId = 'backlink-target-page';

  for (let bookIndex = 0; bookIndex < config.bookCount; bookIndex += 1) {
    const bookId = `book-${bookIndex}`;
    books.push({
      id: bookId,
      title: bookIndex === 12 ? 'Volume 12 Field Archive' : `Volume ${bookIndex}`,
      sortOrder: bookIndex,
      createdAt: timestamp(bookIndex),
      updatedAt: timestamp(bookIndex + 1)
    });

    for (let chapterIndex = 0; chapterIndex < config.chaptersPerBook; chapterIndex += 1) {
      const chapterId = `chapter-${bookIndex}-${chapterIndex}`;
      chapters.push({
        id: chapterId,
        bookId,
        title: `Section ${bookIndex} ${chapterIndex}`,
        sortOrder: chapterIndex,
        createdAt: timestamp(chapterIndex),
        updatedAt: timestamp(chapterIndex + 1)
      });

      for (let pageIndex = 0; pageIndex < config.pagesPerChapter; pageIndex += 1) {
        const specialId = getSpecialPageId(bookIndex, chapterIndex, pageIndex);
        const id = specialId ?? `page-${bookIndex}-${chapterIndex}-${pageIndex}`;
        const isBacklinkSource = backlinkSourcePageIds.length < config.linkSourceCount && pageIndex === 0 && id !== backlinkTargetPageId;

        if (isBacklinkSource) {
          backlinkSourcePageIds.push(id);
        }

        pages.push({
          id,
          chapterId,
          title: getPageTitle(id, bookIndex, chapterIndex, pageIndex),
          content: getPageContent(id, isBacklinkSource),
          tags: getPageTags(id, pageIndex),
          textSize: 16,
          isLoose: false,
          sortOrder: pageIndex,
          createdAt: timestamp(pageIndex),
          updatedAt: timestamp(80 - pageIndex)
        });
      }
    }
  }

  for (let pageIndex = 0; pageIndex < config.loosePageCount; pageIndex += 1) {
    const id = pageIndex === 0 ? looseRarePageId : `loose-${pageIndex}`;
    pages.push({
      id,
      chapterId: null,
      title: id === looseRarePageId ? 'Loose Keyword Index' : `Loose Page ${pageIndex}`,
      content: id === looseRarePageId ? 'loose keyword lives here with /inbox notes.' : longRichText(pageIndex),
      tags: id === looseRarePageId ? ['inbox', 'research'] : ['inbox', `loose-${pageIndex % 12}`],
      textSize: 16,
      isLoose: true,
      sortOrder: pageIndex,
      createdAt: timestamp(pageIndex),
      updatedAt: timestamp(120 - pageIndex)
    });
  }

  const trashedBookId = 'trash-book-1';
  const trashedChapterId = 'trash-chapter-1';
  const trashedPageId = 'trash-needle-page';

  books.push({
    id: trashedBookId,
    title: 'Trashed Field Book',
    sortOrder: 999,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    deletedAt: '2026-04-01T00:00:00.000Z'
  });
  chapters.push({
    id: trashedChapterId,
    bookId: 'book-0',
    title: 'Trashed Field Chapter',
    sortOrder: 999,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    deletedAt: '2026-04-02T00:00:00.000Z',
    deletedFrom: { bookId: 'book-0' }
  });

  for (let pageIndex = 0; pageIndex < config.trashedPageCount; pageIndex += 1) {
    const id = pageIndex === 0 ? trashedPageId : `trash-page-${pageIndex}`;
    pages.push({
      id,
      chapterId: 'chapter-0-0',
      title: id === trashedPageId ? 'Trashed Needle Page' : `Trashed Page ${pageIndex}`,
      content: id === trashedPageId ? 'graveyardonly rare trashed text' : `trashed content ${pageIndex}`,
      tags: pageIndex % 2 === 0 ? ['archive', 'deleted'] : ['deleted'],
      textSize: 16,
      isLoose: false,
      sortOrder: 1000 + pageIndex,
      createdAt: timestamp(pageIndex),
      updatedAt: timestamp(pageIndex),
      deletedAt: `2026-04-${String((pageIndex % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      deletedFrom: { bookId: 'book-0', chapterId: 'chapter-0-0', wasLoose: false }
    });
  }

  return {
    data: { books, chapters, pages },
    recentPageIds: [
      rareTitlePageId,
      rareContentPageId,
      looseRarePageId,
      backlinkTargetPageId,
      trashedPageId,
      'missing-recent-page'
    ],
    ids: {
      rareTitlePageId,
      rareContentPageId,
      looseRarePageId,
      duplicatePageIds,
      backlinkTargetPageId,
      backlinkSourcePageIds,
      trashedPageId,
      trashedBookId,
      trashedChapterId
    }
  };
}

function getSpecialPageId(bookIndex: number, chapterIndex: number, pageIndex: number): string | null {
  if (bookIndex === 12 && chapterIndex === 3 && pageIndex === 4) {
    return 'rare-title-page';
  }

  if (bookIndex === 12 && chapterIndex === 3 && pageIndex === 5) {
    return 'rare-content-page';
  }

  if (bookIndex === 1 && chapterIndex === 1 && pageIndex === 1) {
    return 'duplicate-page-a';
  }

  if (bookIndex === 2 && chapterIndex === 1 && pageIndex === 1) {
    return 'duplicate-page-b';
  }

  if (bookIndex === 3 && chapterIndex === 1 && pageIndex === 1) {
    return 'backlink-target-page';
  }

  return null;
}

function getPageTitle(id: string, bookIndex: number, chapterIndex: number, pageIndex: number): string {
  if (id === 'rare-title-page') {
    return 'Needle Field Notes';
  }

  if (id === 'duplicate-page-a' || id === 'duplicate-page-b') {
    return 'Duplicate Field Note';
  }

  if (id === 'backlink-target-page') {
    return 'Backlink Target';
  }

  return `Page ${bookIndex}-${chapterIndex}-${pageIndex}`;
}

function getPageContent(id: string, isBacklinkSource: boolean): string {
  if (id === 'rare-content-page') {
    return '<h2>Plain Title</h2><p>This ordinary rich page contains the needle phrase and [[Backlink Target]].</p>';
  }

  if (isBacklinkSource) {
    return `<p>Cross reference [[Backlink Target]], [[Duplicate Field Note]], and [[Missing Field Note]].</p>${longRichText(1)}`;
  }

  return longRichText(id.length);
}

function getPageTags(id: string, pageIndex: number): string[] {
  if (id === 'rare-title-page' || id === 'rare-content-page') {
    return ['focus', 'research', 'shared'];
  }

  const tags = [`topic-${pageIndex % 24}`];
  if (pageIndex % 2 === 0) {
    tags.push('research');
  }
  if (pageIndex % 5 === 0) {
    tags.push('archive');
  }

  return tags;
}

function longRichText(seed: number): string {
  return [
    `<h2>Observation ${seed}</h2>`,
    `<p><strong>Research</strong> note ${seed} with /topic-${seed % 24} context and repeated library text.</p>`,
    '<ul><li>First detail</li><li>Second detail</li></ul>',
    '<p>Long form personal notes stay readable while search and backlinks extract plain text.</p>'
  ].join('');
}

function timestamp(offset: number): string {
  return `2026-03-${String((offset % 28) + 1).padStart(2, '0')}T00:00:00.000Z`;
}
