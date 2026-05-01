import type { CSSProperties, KeyboardEvent, SyntheticEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import { ReorderableList } from '../components/ReorderableList';
import type { Book, LibraryBooksPerRow } from '../types/domain';
import { formatTimestamp } from '../utils/date';

const COVER_THEMES = [
  'cover-theme-ivory',
  'cover-theme-sage',
  'cover-theme-blue-mountain',
  'cover-theme-terracotta',
  'cover-theme-lavender',
  'cover-theme-sand',
  'cover-theme-misty-blue',
  'cover-theme-taupe'
] as const;

interface RootViewProps {
  books: Book[];
  getChapterCountForBook: (bookId: string) => number;
  onCreateBook: () => void;
  onOpenBook: (bookId: string) => void;
  onReorderBooks: (orderedBookIds: string[]) => void;
  onCreateChapter: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onRenameBook: (bookId: string, title: string) => void;
  onOpenLoosePages: () => void;
  booksPerRow: LibraryBooksPerRow;
}

type CoverTheme = (typeof COVER_THEMES)[number];

function getBookCoverTheme(bookIdOrTitle: string): CoverTheme {
  let hash = 0;

  for (let index = 0; index < bookIdOrTitle.length; index += 1) {
    hash = (hash * 31 + bookIdOrTitle.charCodeAt(index)) >>> 0;
  }

  return COVER_THEMES[hash % COVER_THEMES.length];
}

export function RootView({
  books,
  getChapterCountForBook,
  onCreateBook,
  onOpenBook,
  onReorderBooks,
  onCreateChapter,
  onDeleteBook,
  onRenameBook,
  onOpenLoosePages,
  booksPerRow
}: RootViewProps): JSX.Element {
  function stopCardOpen(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function handleCardKeyDown(
    event: KeyboardEvent<HTMLElement>,
    bookId: string
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenBook(bookId);
    }
  }

  const galleryStyle = {
    '--books-per-row': String(booksPerRow)
  } as CSSProperties;

  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Books</h1>
        </div>
        <div className="section-actions">
          <button type="button" className="secondary-button" onClick={onOpenLoosePages}>
            Loose Pages
          </button>
          <button type="button" className="primary-button" onClick={onCreateBook}>
            New Book
          </button>
        </div>
      </div>

      {books.length > 0 ? (
        <div className="book-gallery-shell" style={galleryStyle}>
          <ReorderableList
            items={books}
            onReorder={onReorderBooks}
            listClassName="book-gallery"
            itemClassName="reorder-card"
            itemDraggingClassName="is-dragging"
            itemDropTopClassName="drop-top"
            itemDropBottomClassName="drop-bottom"
            isEnabled={books.length > 1}
            renderItem={(book) => {
              const chapterCount = getChapterCountForBook(book.id);
              const themeClassName = getBookCoverTheme(`${book.id}:${book.title}:${book.createdAt}`);

              return (
                <article className="book-card">
                  <div className="book-card-cover-frame">
                    <div
                      className="book-card-surface"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${book.title || 'Untitled'}`}
                      onClick={() => onOpenBook(book.id)}
                      onKeyDown={(event) => handleCardKeyDown(event, book.id)}
                    >
                      <div className={`book-card-cover ${themeClassName}`}>
                        <span className="book-card-label">Book</span>
                        <div className="book-card-cover-spacer" aria-hidden="true" />
                        <div className="book-card-cover-meta">
                          <span className="book-card-meta">
                            {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'}
                          </span>
                          <span className="book-card-meta">Updated {formatTimestamp(book.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="book-card-title-wrap book-card-title-on-cover" onClick={stopCardOpen}>
                      <InlineEditableText
                        value={book.title}
                        onSave={(title) => onRenameBook(book.id, title)}
                        className="book-card-title"
                        inputClassName="inline-input block-input book-card-title-input"
                      />
                    </div>
                  </div>
                  <div className="book-card-footer" onClick={stopCardOpen}>
                    <span className="drag-handle" aria-label="Drag to reorder books" title="Drag to reorder">
                      ::
                    </span>
                    <div className="card-actions book-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onCreateChapter(book.id)}
                      >
                        Add Chapter
                      </button>
                      <button
                        type="button"
                        className="danger-button subtle"
                        onClick={() => onDeleteBook(book.id)}
                      >
                        Move to Trash
                      </button>
                    </div>
                  </div>
                </article>
              );
            }}
          />
        </div>
      ) : (
        <EmptyState
          title="Your shelves are empty."
          message="Create your first book to start building your library."
          actionLabel="Create Book"
          onAction={onCreateBook}
        />
      )}
    </section>
  );
}
