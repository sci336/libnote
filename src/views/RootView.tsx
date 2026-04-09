import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import type { Book } from '../types/domain';
import { formatTimestamp } from '../utils/date';

interface RootViewProps {
  books: Book[];
  getChapterCountForBook: (bookId: string) => number;
  onCreateBook: () => void;
  onOpenBook: (bookId: string) => void;
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
        <div className="book-grid">
          {books.map((book) => (
            <article key={book.id} className="book-card">
              <div className="book-card-open">
                <span className="book-card-label">Book</span>
                <InlineEditableText
                  value={book.title}
                  onSave={(title) => onRenameBook(book.id, title)}
                  className="book-card-title"
                  inputClassName="inline-input block-input"
                />
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
          ))}
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
