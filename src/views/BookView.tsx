import { InlineEditableText } from '../components/InlineEditableText';
import { MoveTargetPanel } from '../components/MoveTargetPanel';
import { ReorderableList } from '../components/ReorderableList';
import type { Book, Chapter } from '../types/domain';
import { formatTimestamp } from '../utils/date';

interface BookViewProps {
  book: Book;
  chapters: Chapter[];
  books: Book[];
  movingChapterId: string | null;
  getPageCountForChapter: (chapterId: string) => number;
  onRenameBook: (bookId: string, title: string) => void;
  onCreateChapter: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onOpenChapter: (chapterId: string) => void;
  onCreatePage: (chapterId: string) => void;
  onRenameChapter: (chapterId: string, title: string) => void;
  onDeleteChapter: (chapterId: string, bookId: string) => void;
  onToggleMoveChapter: (chapterId: string) => void;
  onConfirmMoveChapter: (chapterId: string, destinationBookId: string) => void;
  onCancelMoveChapter: () => void;
  onReorderChapters: (orderedChapterIds: string[]) => void;
}

export function BookView({
  book,
  chapters,
  books,
  movingChapterId,
  getPageCountForChapter,
  onRenameBook,
  onCreateChapter,
  onDeleteBook,
  onOpenChapter,
  onCreatePage,
  onRenameChapter,
  onDeleteChapter,
  onToggleMoveChapter,
  onConfirmMoveChapter,
  onCancelMoveChapter,
  onReorderChapters
}: BookViewProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Book</p>
          <InlineEditableText
            value={book.title}
            onSave={(title) => onRenameBook(book.id, title)}
            className="heading-edit-button"
            inputClassName="heading-input"
          />
        </div>
        <div className="section-actions">
          <button type="button" className="primary-button" onClick={() => onCreateChapter(book.id)}>
            New Chapter
          </button>
          <button
            type="button"
            className="danger-button subtle"
            aria-label={`Move ${book.title || 'Untitled Book'} and all of its chapters and pages to Trash`}
            onClick={() => onDeleteBook(book.id)}
          >
            Move Book to Trash
          </button>
        </div>
      </div>

      {chapters.length > 0 ? (
        <ReorderableList
          items={chapters}
          onReorder={onReorderChapters}
          getItemLabel={(chapter) => chapter.title || 'Untitled Chapter'}
          listClassName="stack-list"
          itemClassName="reorder-card"
          itemDraggingClassName="is-dragging"
          itemDropTopClassName="drop-top"
          itemDropBottomClassName="drop-bottom"
          isEnabled={chapters.length > 1}
          renderItem={(chapter, reorderControls) => (
            <article className="list-card">
              <div className="list-card-main">
                <div className="list-card-row">
                  <span className="drag-handle" aria-hidden="true">
                    ::
                  </span>
                  <InlineEditableText
                    value={chapter.title}
                    onSave={(title) => onRenameChapter(chapter.id, title)}
                    className="list-card-title"
                    inputClassName="inline-input block-input"
                  />
                </div>
                <p>{getPageCountForChapter(chapter.id)} pages</p>
                <p>Updated {formatTimestamp(chapter.updatedAt)}</p>
              </div>
              <div className="card-actions">
                <button type="button" className="primary-button" onClick={() => onOpenChapter(chapter.id)}>
                  Open Chapter
                </button>
                <button type="button" className="secondary-button" onClick={() => onCreatePage(chapter.id)}>
                  Add Page
                </button>
                <button type="button" className="secondary-button" onClick={() => onToggleMoveChapter(chapter.id)}>
                  Move to...
                </button>
                <button
                  type="button"
                  className="danger-button subtle"
                  aria-label={`Move ${chapter.title || 'Untitled Chapter'} and all of its pages to Trash`}
                  onClick={() => onDeleteChapter(chapter.id, book.id)}
                >
                  Move to Trash
                </button>
                {reorderControls}
              </div>
              {movingChapterId === chapter.id ? (
                <MoveTargetPanel
                  title="Move Chapter to Book"
                  options={books.map((item) => ({ id: item.id, label: item.title }))}
                  currentTargetId={chapter.bookId}
                  submitLabel="Move Chapter"
                  onConfirm={(destinationBookId) => onConfirmMoveChapter(chapter.id, destinationBookId)}
                  onCancel={onCancelMoveChapter}
                />
              ) : null}
            </article>
          )}
        />
      ) : (
        <div className="empty-state">
          <h2>No chapters yet</h2>
          <p>Break this book into chapters to keep related pages together.</p>
          <button type="button" className="primary-button" onClick={() => onCreateChapter(book.id)}>
            Create Chapter
          </button>
        </div>
      )}
    </section>
  );
}
