export type ID = string;

/**
 * The app persists a normalized library graph instead of nested book objects.
 * Relationships are reconstructed through ids so books, chapters, pages, search,
 * and move flows can all derive context from one shared source of truth.
 */
export interface Book {
  id: ID;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: ID;
  bookId: ID;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
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

export type LibraryBooksPerRow = 2 | 3 | 4 | 5;

export interface LibraryViewSettings {
  booksPerRow: LibraryBooksPerRow;
}

export interface AppSettings {
  libraryView: LibraryViewSettings;
}

export type AppMenuSection = 'help' | 'shortcuts' | 'settings' | 'credits';

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
  | { type: 'tag'; tags: string[] }
  | { type: 'search'; query: string };
