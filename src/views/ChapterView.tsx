import { InlineEditableText } from '../components/InlineEditableText';
import { MoveTargetPanel } from '../components/MoveTargetPanel';
import { ReorderableList } from '../components/ReorderableList';
import type { Book, Chapter, Page } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import { getPagePreview } from '../utils/pageState';

interface ChapterViewProps {
  chapter: Chapter;
  book?: Book;
  pages: Page[];
  chapters: Chapter[];
  books: Book[];
  movingPageId: string | null;
  onRenameChapter: (chapterId: string, title: string) => void;
  onCreatePage: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string, bookId: string) => void;
  onOpenPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (page: Page) => void;
  onToggleMovePage: (pageId: string) => void;
  onConfirmMovePage: (pageId: string, destinationChapterId: string) => void;
  onCancelMovePage: () => void;
  onReorderPages: (orderedPageIds: string[]) => void;
}

export function ChapterView({
  chapter,
  book,
  pages,
  chapters,
  books,
  movingPageId,
  onRenameChapter,
  onCreatePage,
  onDeleteChapter,
  onOpenPage,
  onRenamePage,
  onDeletePage,
  onToggleMovePage,
  onConfirmMovePage,
  onCancelMovePage,
  onReorderPages
}: ChapterViewProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">{book?.title ?? 'Book'}</p>
          <InlineEditableText
            value={chapter.title}
            onSave={(title) => onRenameChapter(chapter.id, title)}
            className="heading-edit-button"
            inputClassName="heading-input"
          />
        </div>
        <div className="section-actions">
          <button type="button" className="primary-button" onClick={() => onCreatePage(chapter.id)}>
            New Page
          </button>
          <button type="button" className="danger-button subtle" onClick={() => onDeleteChapter(chapter.id, chapter.bookId)}>
            Move Chapter to Trash
          </button>
        </div>
      </div>

      {pages.length > 0 ? (
        <ReorderableList
          items={pages}
          onReorder={onReorderPages}
          listClassName="stack-list"
          itemClassName="reorder-card"
          itemDraggingClassName="is-dragging"
          itemDropTopClassName="drop-top"
          itemDropBottomClassName="drop-bottom"
          isEnabled={pages.length > 1}
          renderItem={(page) => (
            <article className="list-card">
              <div className="list-card-main">
                <div className="list-card-row">
                  <span className="drag-handle" aria-hidden="true">
                    ::
                  </span>
                  <InlineEditableText
                    value={page.title}
                    onSave={(title) => onRenamePage(page.id, title)}
                    className="list-card-title"
                    inputClassName="inline-input block-input"
                  />
                </div>
                <p>{getPagePreview(page)}</p>
                <p>Updated {formatTimestamp(page.updatedAt)}</p>
              </div>
              <div className="card-actions">
                <button type="button" className="primary-button" onClick={() => onOpenPage(page.id)}>
                  Open
                </button>
                <button type="button" className="secondary-button" onClick={() => onToggleMovePage(page.id)}>
                  Move to...
                </button>
                <button type="button" className="danger-button subtle" onClick={() => onDeletePage(page)}>
                  Move to Trash
                </button>
              </div>
              {movingPageId === page.id ? (
                <MoveTargetPanel
                  title="Move Page to Chapter"
                  options={chapters.map((item) => ({
                    id: item.id,
                    label: `${books.find((bookItem) => bookItem.id === item.bookId)?.title ?? 'Book'} / ${item.title}`
                  }))}
                  currentTargetId={page.chapterId ?? undefined}
                  submitLabel="Move Page"
                  onConfirm={(destinationChapterId) => onConfirmMovePage(page.id, destinationChapterId)}
                  onCancel={onCancelMovePage}
                />
              ) : null}
            </article>
          )}
        />
      ) : (
        <div className="empty-state">
          <h2>No pages yet</h2>
          <p>Add a page and it will auto-save as you write.</p>
          <button type="button" className="primary-button" onClick={() => onCreatePage(chapter.id)}>
            Create Page
          </button>
        </div>
      )}
    </section>
  );
}
