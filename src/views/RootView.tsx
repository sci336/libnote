import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import { ReorderableList } from '../components/ReorderableList';
import type { Book } from '../types/domain';
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
  onOpenLoosePages
}: RootViewProps): JSX.Element {
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
        <ReorderableList
          items={books}
          onReorder={onReorderBooks}
          listClassName="stack-list"
          itemClassName="reorder-card"
          itemDraggingClassName="is-dragging"
          itemDropTopClassName="drop-top"
          itemDropBottomClassName="drop-bottom"
          isEnabled={books.length > 1}
          renderItem={(book) => (
            <article className="book-card">
              <div className="book-card-open">
                <div className="list-card-row">
                  <span className="drag-handle" aria-hidden="true">
                    ::
                  </span>
                  <InlineEditableText
                    value={book.title}
                    onSave={(title) => onRenameBook(book.id, title)}
                    className="book-card-title"
                    inputClassName="inline-input block-input"
                  />
                </div>
                <span className="book-card-label">Book</span>
                <span className="book-card-meta">{getChapterCountForBook(book.id)} chapters</span>
                <span className="book-card-meta">Updated {formatTimestamp(book.updatedAt)}</span>
              </div>
              <div className="card-actions">
                <button type="button" className="primary-button" onClick={() => onOpenBook(book.id)}>
                  Open Book
                </button>
                <button type="button" className="secondary-button" onClick={() => onCreateChapter(book.id)}>
                  Add Chapter
                </button>
                <button type="button" className="danger-button subtle" onClick={() => onDeleteBook(book.id)}>
                  Delete
                </button>
              </div>
            </article>
          )}
        />
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
