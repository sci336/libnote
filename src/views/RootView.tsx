import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import { ReorderableList } from '../components/ReorderableList';
import type { Book, LibraryBooksPerRow, LibraryShelfStyle } from '../types/domain';
import { BOOK_COVER_TEMPLATES, getBookCoverTemplate } from '../utils/bookCovers';
import { formatTimestamp } from '../utils/date';
import { useModalFocus } from '../hooks/useModalFocus';

interface RootViewProps {
  books: Book[];
  getChapterCountForBook: (bookId: string) => number;
  onCreateBook: () => void;
  onOpenBook: (bookId: string) => void;
  onReorderBooks: (orderedBookIds: string[]) => void;
  onCreateChapter: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onRenameBook: (bookId: string, title: string) => void;
  onUpdateBookCover: (bookId: string, coverId: string) => void;
  onOpenLoosePages: () => void;
  booksPerRow: LibraryBooksPerRow;
  shelfStyle: LibraryShelfStyle;
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
  onUpdateBookCover,
  onOpenLoosePages,
  booksPerRow,
  shelfStyle
}: RootViewProps): JSX.Element {
  const [coverPickerBookId, setCoverPickerBookId] = useState<string | null>(null);
  const coverPickerPanelRef = useRef<HTMLElement | null>(null);
  const coverPickerTitleRef = useRef<HTMLHeadingElement | null>(null);
  const coverPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const coverPickerBook = books.find((book) => book.id === coverPickerBookId);

  useEffect(() => {
    if (!coverPickerBookId) {
      return;
    }

    if (!coverPickerBook) {
      setCoverPickerBookId(null);
    }
  }, [coverPickerBook, coverPickerBookId]);

  useModalFocus({
    isOpen: Boolean(coverPickerBook),
    containerRef: coverPickerPanelRef,
    initialFocusRef: coverPickerTitleRef,
    returnFocusRef: coverPickerTriggerRef,
    onClose: () => setCoverPickerBookId(null)
  });

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

  const selectedCoverTemplate = coverPickerBook ? getBookCoverTemplate(coverPickerBook) : null;

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
        <div
          className="book-gallery-shell"
          data-books-per-row={booksPerRow}
          data-shelf-style={shelfStyle}
          style={galleryStyle}
        >
          <ReorderableList
            items={books}
            onReorder={onReorderBooks}
            getItemLabel={(book) => book.title || 'Untitled Book'}
            listClassName="book-gallery"
            itemClassName="reorder-card"
            itemDraggingClassName="is-dragging"
            itemDropTopClassName="drop-top"
            itemDropBottomClassName="drop-bottom"
            isEnabled={books.length > 1}
            renderItem={(book, reorderControls) => {
              const chapterCount = getChapterCountForBook(book.id);
              const coverTemplate = getBookCoverTemplate(book);

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
                      <div className={`book-card-cover ${coverTemplate.className}`}>
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
                        className="secondary-button"
                        onClick={(event) => {
                          coverPickerTriggerRef.current = event.currentTarget;
                          setCoverPickerBookId(book.id);
                        }}
                      >
                        Change Cover
                      </button>
                      <button
                        type="button"
                        className="danger-button subtle"
                        aria-label={`Move ${book.title || 'Untitled Book'} and all of its chapters and pages to Trash`}
                        onClick={() => onDeleteBook(book.id)}
                      >
                        Move to Trash
                      </button>
                      {reorderControls}
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

      {coverPickerBook && selectedCoverTemplate ? (
        <div className="cover-picker-layer" role="dialog" aria-modal="true" aria-labelledby="cover-picker-title">
          <div
            className="cover-picker-backdrop"
            aria-hidden="true"
            onClick={() => setCoverPickerBookId(null)}
          />
          <section className="cover-picker-panel" ref={coverPickerPanelRef} tabIndex={-1}>
            <div className="cover-picker-header">
              <div>
                <p className="eyebrow">Book Cover</p>
                <h2 id="cover-picker-title" ref={coverPickerTitleRef} tabIndex={-1}>Choose a Cover</h2>
                <p className="cover-picker-subtitle">{coverPickerBook.title || 'Untitled Book'}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCoverPickerBookId(null)}
                aria-label="Close cover picker"
              >
                ×
              </button>
            </div>

            <div className="cover-picker-grid">
              {BOOK_COVER_TEMPLATES.map((template) => {
                const isSelected = template.id === selectedCoverTemplate.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`cover-picker-option ${isSelected ? 'is-selected' : ''}`}
                    aria-label={`Use ${template.label} cover`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onUpdateBookCover(coverPickerBook.id, template.id);
                      setCoverPickerBookId(null);
                    }}
                  >
                    <span className={`book-card-cover cover-picker-preview-cover ${template.className}`} aria-hidden="true">
                      <span className="book-card-label">Book</span>
                      <span className="cover-picker-preview-lines" />
                    </span>
                    <span className="cover-picker-option-label">{template.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
