export type ID = string;

export interface Book {
  id: ID;
  title: string;
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

export type ViewState =
  | { type: 'root' }
  | { type: 'book'; bookId: ID }
  | { type: 'chapter'; chapterId: ID }
  | { type: 'page'; pageId: ID }
  | { type: 'loosePages' }
  | { type: 'search'; query: string };
