import type { CSSProperties, KeyboardEvent, SyntheticEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import { ReorderableList } from '../components/ReorderableList';
import type { Book, LibraryBooksPerRow } from '../types/domain';
import { formatTimestamp } from '../utils/date';

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
            renderItem={(book) => (
              <article className="book-card">
                <div
                  className="book-card-surface"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${book.title || 'Untitled'}`}
                  onClick={() => onOpenBook(book.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, book.id)}
                >
                  <div className="book-card-cover">
                    <span className="book-card-label">Book</span>
                    <span className="book-card-meta">{getChapterCountForBook(book.id)} chapters</span>
                    <span className="book-card-meta">Updated {formatTimestamp(book.updatedAt)}</span>
                    <span className="book-card-open-hint">Open book</span>
                  </div>
                </div>
                <div className="book-card-footer">
                  <div className="book-card-heading" onClick={stopCardOpen}>
                    <span className="drag-handle" aria-hidden="true">
                      ::
                    </span>
                    <div className="book-card-title-wrap" onClick={stopCardOpen}>
                      <InlineEditableText
                        value={book.title}
                        onSave={(title) => onRenameBook(book.id, title)}
                        className="book-card-title"
                        inputClassName="inline-input block-input"
                      />
                    </div>
                  </div>
                </div>
                <div
                  className="card-actions book-card-actions"
                  onClick={stopCardOpen}
                >
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
              </article>
            )}
          />
        </div>
      ) : (
        <EmptyState
          title="No books yet"
          message="Create your first book to start organizing chapters and pages."
          actionLabel="Create Book"
          onAction={onCreateBook}
        />
      )}
    </section>
  );
}
