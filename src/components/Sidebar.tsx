import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Book, Chapter, Page, ViewState } from '../types/domain';
import { ReorderableList } from './ReorderableList';
import { isLoosePage } from '../utils/pageState';

export interface RecentSidebarPage {
  id: string;
  title: string;
  contextLabel: string;
}

type SidebarSectionId =
  | 'books'
  | 'loosePages'
  | 'recentPages'
  | 'trash'
  | 'currentBookChapters'
  | 'currentChapterPages';

type CollapsedSidebarSections = Partial<Record<SidebarSectionId, boolean>>;

const COLLAPSED_SIDEBAR_SECTIONS_KEY = 'libnote:collapsedSidebarSections';

interface SidebarProps {
  isOpen: boolean;
  currentView: ViewState;
  books: Book[];
  chapters: Chapter[];
  pages: Page[];
  loosePages: Page[];
  recentPages: RecentSidebarPage[];
  activeBookId?: string;
  activeChapterId?: string;
  activePageId?: string;
  onNavigateRoot: () => void;
  onNavigateLoosePages: () => void;
  onNavigateTrash: () => void;
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
    recentPages,
    activeBookId,
    activeChapterId,
    activePageId,
    onNavigateRoot,
    onNavigateLoosePages,
    onNavigateTrash,
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
    currentView.type === 'trash' ||
    currentView.type === 'loosePages' ||
    isViewingLoosePage;

  const showsChapters =
    currentView.type === 'book' ||
    currentView.type === 'chapter' ||
    (currentView.type === 'page' && !isViewingLoosePage);

  const showsPages =
    (currentView.type === 'page' && !isViewingLoosePage) ||
    currentView.type === 'chapter';

  const isTrashActive = currentView.type === 'trash';

  const visibleChapters = activeBookId ? chapters : [];
  const [isLoosePagesExpanded, setIsLoosePagesExpanded] = useState(false);
  const visibleLoosePages = isLoosePagesExpanded ? loosePages : loosePages.slice(0, 3);
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState<CollapsedSidebarSections>(() =>
    loadCollapsedSidebarSections()
  );

  useEffect(() => {
    saveCollapsedSidebarSections(collapsedSidebarSections);
  }, [collapsedSidebarSections]);

  const toggleSidebarSection = (sectionId: SidebarSectionId): void => {
    setCollapsedSidebarSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId]
    }));
  };

  const isSectionCollapsed = (sectionId: SidebarSectionId): boolean => collapsedSidebarSections[sectionId] === true;

  const loosePagesSection = (
    <CollapsibleSidebarSection
      sectionId="loosePages"
      title="Loose Pages"
      isCollapsed={isSectionCollapsed('loosePages')}
      isActive={currentView.type === 'loosePages'}
      onToggle={toggleSidebarSection}
      actions={
        <>
          {loosePages.length > 3 && !isSectionCollapsed('loosePages') ? (
            <button
              type="button"
              className="sidebar-link-button"
              onClick={() => setIsLoosePagesExpanded((expanded) => !expanded)}
            >
              {isLoosePagesExpanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
          {currentView.type === 'loosePages' ? null : (
            <button type="button" className="sidebar-link-button" onClick={onNavigateLoosePages}>
              View All
            </button>
          )}
          {onCreateLoosePageInContext ? (
            <button type="button" className="sidebar-link-button" onClick={onCreateLoosePageInContext}>
              + New
            </button>
          ) : null}
        </>
      }
    >
      <div className={`sidebar-list ${isLoosePagesExpanded ? 'sidebar-list-scrollable' : ''}`}>
        {visibleLoosePages.length > 0 ? (
          visibleLoosePages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`sidebar-item ${page.id === activePageId ? 'is-active' : ''}`}
              onClick={() => {
                onNavigatePage(page.id);
                onClose();
              }}
            >
              {page.title}
            </button>
          ))
        ) : (
          <p className="sidebar-empty">Nothing here yet.</p>
        )}
      </div>
    </CollapsibleSidebarSection>
  );

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        {/* Global and contextual sections are kept separate so loose pages stay
            reachable even while book/chapter/page context changes below. */}
        {showsBooks && (
          <SidebarSection
            sectionId="books"
            title="Books"
            actionLabel="All Books"
            onAction={onNavigateRoot}
            isCollapsed={isSectionCollapsed('books')}
            onToggle={toggleSidebarSection}
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

        {/* LOOSE PAGES */}
        {loosePagesSection}

        {/* CHAPTERS */}
        {showsChapters && (
          <SidebarSection
            sectionId="currentBookChapters"
            title="Chapters"
            actionLabel={onCreateChapterInContext ? '+ New Chapter' : undefined}
            onAction={onCreateChapterInContext}
            isCollapsed={isSectionCollapsed('currentBookChapters')}
            onToggle={toggleSidebarSection}
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
            sectionId="currentChapterPages"
            title="Pages"
            actionLabel={onCreatePageInContext ? '+ New Page' : undefined}
            onAction={onCreatePageInContext}
            isCollapsed={isSectionCollapsed('currentChapterPages')}
            onToggle={toggleSidebarSection}
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

        <CollapsibleSidebarSection
          sectionId="trash"
          title="Trash"
          isCollapsed={isSectionCollapsed('trash')}
          onToggle={toggleSidebarSection}
        >
          <div className="sidebar-list">
            <button
              type="button"
              className={`sidebar-item ${isTrashActive ? 'is-active' : ''}`}
              onClick={() => {
                onNavigateTrash();
                onClose();
              }}
            >
              Open Trash
            </button>
          </div>
        </CollapsibleSidebarSection>

        {recentPages.length > 0 ? (
          <CollapsibleSidebarSection
            sectionId="recentPages"
            title="Recent Pages"
            isCollapsed={isSectionCollapsed('recentPages')}
            onToggle={toggleSidebarSection}
          >
            <div className="sidebar-list">
              {recentPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`sidebar-item sidebar-item-stacked ${page.id === activePageId ? 'is-active' : ''}`}
                  onClick={() => {
                    onNavigatePage(page.id);
                    onClose();
                  }}
                >
                  <span className="sidebar-item-label">{page.title}</span>
                  <span className="sidebar-item-secondary">{page.contextLabel}</span>
                </button>
              ))}
            </div>
          </CollapsibleSidebarSection>
        ) : null}
      </aside>
    </>
  );
}

function SidebarSection({
  sectionId,
  title,
  actionLabel,
  onAction,
  isCollapsed,
  onToggle,
  items,
  onReorder
}: {
  sectionId: SidebarSectionId;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  isCollapsed: boolean;
  onToggle: (sectionId: SidebarSectionId) => void;
  items: Array<{
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }>;
  onReorder?: (orderedIds: string[]) => void;
}): JSX.Element {
  return (
    <CollapsibleSidebarSection
      sectionId={sectionId}
      title={title}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      actions={
        actionLabel && onAction ? (
          <button
            type="button"
            className="sidebar-link-button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : undefined
      }
    >
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
    </CollapsibleSidebarSection>
  );
}

function CollapsibleSidebarSection({
  sectionId,
  title,
  isCollapsed,
  isActive = false,
  onToggle,
  actions,
  children
}: {
  sectionId: SidebarSectionId;
  title: string;
  isCollapsed: boolean;
  isActive?: boolean;
  onToggle: (sectionId: SidebarSectionId) => void;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const contentId = `sidebar-section-${sectionId}`;

  return (
    <section className="sidebar-section">
      <div className="sidebar-section-header">
        <h2>
          <button
            type="button"
            className={`sidebar-section-toggle ${isActive ? 'is-active' : ''}`}
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            onClick={() => onToggle(sectionId)}
          >
            <span className={`sidebar-section-chevron ${isCollapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
              ▾
            </span>
            <span className="sidebar-section-title">{title}</span>
          </button>
        </h2>
        {actions ? <div className="sidebar-section-actions">{actions}</div> : null}
      </div>

      <div id={contentId} className="sidebar-section-content" hidden={isCollapsed}>
        {children}
      </div>
    </section>
  );
}

function loadCollapsedSidebarSections(): CollapsedSidebarSections {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(COLLAPSED_SIDEBAR_SECTIONS_KEY);
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {};
    }

    return SIDEBAR_SECTION_IDS.reduce<CollapsedSidebarSections>((sections, sectionId) => {
      if ((parsedValue as Record<string, unknown>)[sectionId] === true) {
        sections[sectionId] = true;
      }

      return sections;
    }, {});
  } catch {
    return {};
  }
}

function saveCollapsedSidebarSections(sections: CollapsedSidebarSections): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const collapsedSections = SIDEBAR_SECTION_IDS.reduce<CollapsedSidebarSections>((nextSections, sectionId) => {
      if (sections[sectionId] === true) {
        nextSections[sectionId] = true;
      }

      return nextSections;
    }, {});

    window.localStorage.setItem(COLLAPSED_SIDEBAR_SECTIONS_KEY, JSON.stringify(collapsedSections));
  } catch {
    // Collapse state is a convenience preference; the sidebar still works without persistence.
  }
}

const SIDEBAR_SECTION_IDS: SidebarSectionId[] = [
  'books',
  'loosePages',
  'recentPages',
  'trash',
  'currentBookChapters',
  'currentChapterPages'
];

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
