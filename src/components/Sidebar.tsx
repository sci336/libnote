import type { Book, Chapter, Page, ViewState } from '../types/domain';
import { ReorderableList } from './ReorderableList';
import { isLoosePage } from '../utils/pageState';

interface SidebarProps {
  isOpen: boolean;
  currentView: ViewState;
  books: Book[];
  chapters: Chapter[];
  pages: Page[];
  loosePages: Page[];
  activeBookId?: string;
  activeChapterId?: string;
  activePageId?: string;
  onNavigateRoot: () => void;
  onNavigateLoosePages: () => void;
  onNavigateBook: (bookId: string) => void;
  onNavigateChapter: (chapterId: string) => void;
  onNavigatePage: (pageId: string) => void;
  onCreatePageInContext?: () => void;
  onCreateLoosePageInContext?: () => void;
  onCreateChapterInContext?: () => void;
  onReorderBooks?: (orderedBookIds: string[]) => void;
  onReorderChapters?: (orderedChapterIds: string[]) => void;
  onReorderPages?: (orderedPageIds: string[]) => void;
  onClose: () => void;
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const {
    isOpen,
    currentView,
    books,
    chapters,
    pages,
    loosePages,
    activeBookId,
    activeChapterId,
    activePageId,
    onNavigateRoot,
    onNavigateLoosePages,
    onNavigateBook,
    onNavigateChapter,
    onNavigatePage,
    onCreatePageInContext,
    onCreateLoosePageInContext,
    onCreateChapterInContext,
    onReorderBooks,
    onReorderChapters,
    onReorderPages,
    onClose
  } = props;

  const isViewingLoosePage = isLoosePageView(currentView, activePageId, loosePages);

  const showsBooks =
    currentView.type === 'root' ||
    currentView.type === 'book' ||
    currentView.type === 'search' ||
    currentView.type === 'tag' ||
    currentView.type === 'loosePages' ||
    isViewingLoosePage;

  const showsChapters =
    currentView.type === 'book' ||
    currentView.type === 'chapter' ||
    (currentView.type === 'page' && !isViewingLoosePage);

  const showsPages =
    (currentView.type === 'page' && !isViewingLoosePage) ||
    currentView.type === 'chapter';

  const showsLoose =
    currentView.type === 'root' ||
    currentView.type === 'search' ||
    currentView.type === 'tag' ||
    currentView.type === 'loosePages' ||
    isViewingLoosePage;

  const visibleChapters = activeBookId
    ? chapters.filter((chapter) => chapter.bookId === activeBookId)
    : [];

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        {/* The sidebar intentionally changes shape with the current route so
            root/search/tag/loose-page flows all keep nearby navigation visible. */}
        {showsBooks && (
          <SidebarSection
            title="Books"
            actionLabel="All Books"
            onAction={onNavigateRoot}
            items={books.map((book) => ({
              id: book.id,
              label: book.title,
              isActive: book.id === activeBookId,
              onClick: () => {
                onNavigateBook(book.id);
                onClose();
              }
            }))}
            onReorder={onReorderBooks}
          />
        )}

        {/* CHAPTERS */}
        {showsChapters && (
          <SidebarSection
            title="Chapters"
            actionLabel={onCreateChapterInContext ? '+ New Chapter' : undefined}
            onAction={onCreateChapterInContext}
            items={visibleChapters.map((chapter) => ({
              id: chapter.id,
              label: chapter.title,
              isActive: chapter.id === activeChapterId,
              onClick: () => {
                onNavigateChapter(chapter.id);
                onClose();
              }
            }))}
            onReorder={onReorderChapters}
          />
        )}

        {/* PAGES (only in chapter/page context, never at book level) */}
        {showsPages && (
          <SidebarSection
            title="Pages"
            actionLabel={onCreatePageInContext ? '+ New Page' : undefined}
            onAction={onCreatePageInContext}
            items={pages.map((page) => ({
              id: page.id,
              label: page.title,
              isActive: page.id === activePageId,
              onClick: () => {
                onNavigatePage(page.id);
                onClose();
              }
            }))}
            onReorder={onReorderPages}
          />
        )}

        {/* LOOSE PAGES */}
        {showsLoose && (
          <SidebarSection
            title="Loose Pages"
            actionLabel={
              onCreateLoosePageInContext
                ? '+ New'
                : currentView.type === 'loosePages'
                  ? undefined
                  : 'View All'
            }
            onAction={
              onCreateLoosePageInContext
                ? onCreateLoosePageInContext
                : currentView.type === 'loosePages'
                  ? undefined
                  : onNavigateLoosePages
            }
            items={(currentView.type === 'loosePages'
              ? loosePages
              : loosePages.slice(0, 3)
            ).map((page) => ({
              id: page.id,
              label: page.title,
              isActive: page.id === activePageId,
              onClick: () => {
                onNavigatePage(page.id);
                onClose();
              }
            }))}
          />
        )}
      </aside>
    </>
  );
}

function SidebarSection({
  title,
  actionLabel,
  onAction,
  items,
  onReorder
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  items: Array<{
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }>;
  onReorder?: (orderedIds: string[]) => void;
}): JSX.Element {
  return (
    <section className="sidebar-section">
      <div className="sidebar-section-header">
        <h2>{title}</h2>
        {actionLabel && onAction && (
          <button
            type="button"
            className="sidebar-link-button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="sidebar-list">
        {items.length > 0 ? (
          onReorder ? (
            <ReorderableList
              items={items}
              onReorder={onReorder}
              listClassName="sidebar-reorder-list"
              itemClassName="sidebar-reorder-item"
              itemDraggingClassName="is-dragging"
              itemDropTopClassName="drop-top"
              itemDropBottomClassName="drop-bottom"
              renderItem={(item) => (
                <button
                  type="button"
                  className={`sidebar-item ${item.isActive ? 'is-active' : ''}`}
                  onClick={item.onClick}
                >
                  <span className="drag-handle" aria-hidden="true">
                    ::
                  </span>
                  <span className="sidebar-item-label">{item.label}</span>
                </button>
              )}
            />
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${item.isActive ? 'is-active' : ''}`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))
          )
        ) : (
          <p className="sidebar-empty">Nothing here yet.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Detects whether the current page route should be treated like the loose-page
 * inbox. The route alone only tells us "page", so we consult the loose page list
 * to decide which sidebar sections stay visible.
 */
function isLoosePageView(
  currentView: ViewState,
  activePageId: string | undefined,
  loosePages: Page[]
): boolean {
  return (
    currentView.type === 'page' &&
    !!activePageId &&
    loosePages.some((page) => page.id === activePageId && isLoosePage(page))
  );
}
