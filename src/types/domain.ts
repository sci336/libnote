export type ID = string;

export interface DeletedFrom {
  bookId?: ID;
  chapterId?: ID;
  wasLoose?: boolean;
}

export interface Trashable {
  deletedAt?: string | null;
  deletedFrom?: DeletedFrom | null;
}

/**
 * The app persists a normalized library graph instead of nested book objects.
 * Relationships are reconstructed through ids so books, chapters, pages, search,
 * and move flows can all derive context from one shared source of truth.
 */
export interface Book extends Trashable {
  id: ID;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter extends Trashable {
  id: ID;
  bookId: ID;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page extends Trashable {
  id: ID;
  chapterId: ID | null;
  title: string;
  content: string;
  tags: string[];
  textSize: number;
  isLoose: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryData {
  books: Book[];
  chapters: Chapter[];
  pages: Page[];
}

export type TrashItemType = 'book' | 'chapter' | 'page' | 'loosePage';

export interface TrashItem {
  id: ID;
  type: TrashItemType;
  title: string;
  deletedAt: string;
  originalLocation?: string;
}

export type LibraryBooksPerRow = 2 | 3 | 4 | 5;

export interface LibraryViewSettings {
  booksPerRow: LibraryBooksPerRow;
}

export type ShortcutAction =
  | 'newLoosePage'
  | 'newChapterPage'
  | 'toggleSidebar'
  | 'goHome'
  | 'goBack';

export interface ShortcutBinding {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutSettings = Record<ShortcutAction, ShortcutBinding | null>;

export interface AppSettings {
  libraryView: LibraryViewSettings;
  shortcuts: ShortcutSettings;
  recentPageIds: ID[];
  lastBackupExportedAt: string | null;
}

export type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; lastSavedAt: number }
  | { state: 'failed'; error?: string };

export type AppMenuSection = 'help' | 'shortcuts' | 'settings' | 'tagManagement' | 'backup' | 'credits';

/**
 * ViewState acts as the app's lightweight router.
 * Components and selectors derive the current book/chapter/page context from here
 * instead of pushing navigation rules down into each view.
 */
export type ViewState =
  | { type: 'root' }
  | { type: 'book'; bookId: ID }
  | { type: 'chapter'; chapterId: ID }
  | { type: 'page'; pageId: ID }
  | { type: 'loosePages' }
  | { type: 'trash' }
  | { type: 'tag'; tags: string[] }
  | { type: 'search'; query: string };
