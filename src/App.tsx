import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './components/EmptyState';
import { InlineEditableText } from './components/InlineEditableText';
import { MoveTargetPanel } from './components/MoveTargetPanel';
import { PageEditor } from './components/PageEditor';
import { ReorderableList } from './components/ReorderableList';
import { SearchResultsView } from './components/SearchResultsView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AppLayout } from './layouts/AppLayout';
import type { LibraryData, Page, ViewState } from './types/domain';
import {
  createBook,
  createChapter,
  createPage,
  deleteBook,
  deleteChapter,
  deletePage,
  getBook,
  getChapter,
  getChaptersForBook,
  getLoosePages,
  getPage,
  getPagesForChapter,
  hydrateLibraryData,
  moveChapterToBook,
  movePageToChapter,
  moveLoosePageToChapter,
  persistLibraryData,
  reorderChaptersInBook,
  reorderPagesInChapter,
  updateBook,
  updateChapter,
  updatePage
} from './store/libraryStore';
import { formatTimestamp } from './utils/date';
import { buildSearchIndex, normalizeSearchQuery, searchPages } from './utils/search';

export default function App(): JSX.Element {
  const [data, setData] = useState<LibraryData | null>(null);
  const [view, setView] = useState<ViewState>({ type: 'root' });
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 920);
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOriginView, setSearchOriginView] = useState<ViewState>({ type: 'root' });

  useEffect(() => {
    hydrateLibraryData().then(setData).catch(console.error);
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }

    persistLibraryData(data).catch(console.error);
  }, [data]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 920) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (view.type === 'page' && shouldAutoFocusEditor) {
      setShouldAutoFocusEditor(false);
    }
  }, [view, shouldAutoFocusEditor]);

  useEffect(() => {
    setMovingChapterId(null);
    setMovingPageId(null);
  }, [view]);

  const books = useMemo(
    () => (data ? [...data.books].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : []),
    [data]
  );

  const loosePages = useMemo(() => (data ? getLoosePages(data) : []), [data]);
  const searchIndex = useMemo(
    () => (data ? buildSearchIndex(data) : null),
    [data]
  );
  const searchResults = useMemo(
    () => (searchIndex ? searchPages(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );

  const activeBook = useMemo(() => {
    if (!data || view.type !== 'book') {
      return undefined;
    }
    return getBook(data, view.bookId);
  }, [data, view]);

  const activeChapter = useMemo(() => {
    if (!data || view.type !== 'chapter') {
      return undefined;
    }
    return getChapter(data, view.chapterId);
  }, [data, view]);

  const activePage = useMemo(() => {
    if (!data || view.type !== 'page') {
      return undefined;
    }
    return getPage(data, view.pageId);
  }, [data, view]);

  const derivedBookForChapter = useMemo(() => {
    if (!data || !activeChapter) {
      return undefined;
    }
    return getBook(data, activeChapter.bookId);
  }, [activeChapter, data]);

  const derivedChapterForPage = useMemo(() => {
    if (!data || !activePage?.chapterId) {
      return undefined;
    }
    return getChapter(data, activePage.chapterId);
  }, [activePage, data]);

  const derivedBookForPage = useMemo(() => {
    if (!data || !derivedChapterForPage) {
      return undefined;
    }
    return getBook(data, derivedChapterForPage.bookId);
  }, [data, derivedChapterForPage]);

  const sidebarChapterId =
    view.type === 'chapter'
      ? activeChapter?.id
      : view.type === 'page' && activePage?.chapterId
        ? activePage.chapterId
        : undefined;

  const sidebarBookId =
    activeBook?.id ??
    derivedBookForChapter?.id ??
    derivedBookForPage?.id;

  const chapterList = useMemo(() => {
    if (!data) {
      return [];
    }

    if (view.type === 'book' && activeBook) {
      return getChaptersForBook(data, activeBook.id);
    }

    if (view.type === 'chapter' && activeChapter) {
      return getChaptersForBook(data, activeChapter.bookId);
    }

    if (view.type === 'page' && derivedBookForPage) {
      return getChaptersForBook(data, derivedBookForPage.id);
    }

    return [];
  }, [activeBook, activeChapter, data, derivedBookForPage, view.type]);

  const pageList = useMemo(() => {
    if (!data) {
      return [];
    }

    if (view.type === 'chapter' && activeChapter) {
      return getPagesForChapter(data, activeChapter.id);
    }

    if (view.type === 'page' && derivedChapterForPage) {
      return getPagesForChapter(data, derivedChapterForPage.id);
    }

    return [];
  }, [activeChapter, data, derivedChapterForPage, view.type]);

  if (!data) {
    return <div className="loading-screen">Loading note library...</div>;
  }

  const nav = getNavigationState(view, data!);

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 920) {
      setSidebarOpen(false);
    }
  }

  function updateData(nextData: LibraryData) {
    setData(nextData);
  }

  function handleCreateBook() {
    const result = createBook(data!);
    updateData(result.data);
    setView({ type: 'book', bookId: result.book.id });
    closeSidebarOnMobile();
  }

  function handleCreateChapter(bookId: string) {
    const result = createChapter(data!, bookId);
    updateData(result.data);
    setView({ type: 'chapter', chapterId: result.chapter.id });
    closeSidebarOnMobile();
  }

  function handleCreatePage(chapterId: string) {
    const result = createPage(data!, { chapterId, isLoose: false });
    updateData(result.data);
    setShouldAutoFocusEditor(true);
    setView({ type: 'page', pageId: result.page.id });
    closeSidebarOnMobile();
  }

  function handleCreateLoosePage() {
    const result = createPage(data!, { chapterId: null, isLoose: true });
    updateData(result.data);
    setShouldAutoFocusEditor(true);
    setView({ type: 'page', pageId: result.page.id });
    closeSidebarOnMobile();
  }

  function handleDeleteBook(bookId: string) {
    if (!window.confirm('Delete this book and all of its chapters and pages?')) {
      return;
    }

    updateData(deleteBook(data!, bookId));
    setView({ type: 'root' });
  }

  function handleDeleteChapter(chapterId: string, bookId: string) {
    if (!window.confirm('Delete this chapter and all of its pages?')) {
      return;
    }

    updateData(deleteChapter(data!, chapterId));
    setView({ type: 'book', bookId });
  }

  function handleDeletePage(page: Page) {
    if (!window.confirm('Delete this page?')) {
      return;
    }

    updateData(deletePage(data!, page.id));

    if (page.isLoose) {
      setView({ type: 'loosePages' });
      return;
    }

    if (page.chapterId) {
      setView({ type: 'chapter', chapterId: page.chapterId });
    } else {
      setView({ type: 'root' });
    }
  }

  function goUpOneLevel() {
    setView(getParentView(view, data!, searchOriginView));
    closeSidebarOnMobile();
  }

  function handleReorderChapters(bookId: string, orderedChapterIds: string[]) {
    updateData(reorderChaptersInBook(data!, bookId, orderedChapterIds));
  }

  function handleReorderPages(chapterId: string, orderedPageIds: string[]) {
    updateData(reorderPagesInChapter(data!, chapterId, orderedPageIds));
  }

  function handleMoveChapter(chapterId: string, destinationBookId: string) {
    updateData(moveChapterToBook(data!, chapterId, destinationBookId));
    setMovingChapterId(null);
  }

  function handleMovePage(pageId: string, destinationChapterId: string) {
    updateData(movePageToChapter(data!, pageId, destinationChapterId));
    setMovingPageId(null);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    const normalizedQuery = normalizeSearchQuery(value);

    if (normalizedQuery) {
      if (view.type !== 'search') {
        setSearchOriginView(view);
      }
      setView({ type: 'search', query: value });
      return;
    }

    if (view.type === 'search') {
      setView({ type: 'search', query: '' });
    }
  }

  function handleSearchFocus() {
    if (view.type !== 'search') {
      setSearchOriginView(view);
      setView({ type: 'search', query: searchQuery });
    }
  }

  return (
    <AppLayout
      topBar={
        <TopBar
          showBack={nav.showBack}
          parentLabel={nav.parentLabel}
          currentLabel={nav.currentLabel}
          searchValue={searchQuery}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onGoBack={goUpOneLevel}
          onParentClick={() => {
            setView(getParentView(view, data!, searchOriginView));
            closeSidebarOnMobile();
          }}
          onSearchChange={handleSearchChange}
          onSearchFocus={handleSearchFocus}
        />
      }
      sidebar={
        <Sidebar
          isOpen={sidebarOpen}
          currentView={view}
          books={books}
          chapters={chapterList}
          pages={pageList}
          loosePages={loosePages}
          activeBookId={activeBook?.id ?? derivedBookForChapter?.id ?? derivedBookForPage?.id}
          activeChapterId={activeChapter?.id ?? derivedChapterForPage?.id}
          activePageId={activePage?.id}
          onNavigateRoot={() => {
            setView({ type: 'root' });
            closeSidebarOnMobile();
          }}
          onNavigateLoosePages={() => {
            setView({ type: 'loosePages' });
            closeSidebarOnMobile();
          }}
          onNavigateBook={(bookId) => {
            setView({ type: 'book', bookId });
            closeSidebarOnMobile();
          }}
          onNavigateChapter={(chapterId) => {
            setView({ type: 'chapter', chapterId });
            closeSidebarOnMobile();
          }}
          onNavigatePage={(pageId) => {
            setView({ type: 'page', pageId });
            closeSidebarOnMobile();
          }}
          onCreateChapterInContext={() => {
            if (sidebarBookId) {
        handleCreateChapter(sidebarBookId);
            }
          }}
          onCreatePageInContext={() => {
            if (sidebarChapterId) {
              handleCreatePage(sidebarChapterId);
            }
          }}
          onReorderChapters={
            sidebarBookId && chapterList.length > 1
              ? (orderedChapterIds) => handleReorderChapters(sidebarBookId, orderedChapterIds)
              : undefined
          }
          onReorderPages={
            sidebarChapterId && pageList.length > 1
              ? (orderedPageIds) => handleReorderPages(sidebarChapterId, orderedPageIds)
              : undefined
          }
          onCreateLoosePageInContext={handleCreateLoosePage}
          onClose={() => setSidebarOpen(false)}
        />
      }
    >
      {renderMainContent()}
    </AppLayout>
  );

  function renderMainContent(): JSX.Element {
    if (view.type === 'root') {
      return (
        <section className="content-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Library</p>
              <h1>Books</h1>
            </div>
            <div className="section-actions">
              <button type="button" className="secondary-button" onClick={() => setView({ type: 'loosePages' })}>
                Loose Pages
              </button>
              <button type="button" className="primary-button" onClick={handleCreateBook}>
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
                      onSave={(title) => updateData(updateBook(data!, book.id, title))}
                      className="book-card-title"
                      inputClassName="inline-input block-input"
                    />
                    <span className="book-card-meta">{getChaptersForBook(data!, book.id).length} chapters</span>
                    <span className="book-card-meta">Updated {formatTimestamp(book.updatedAt)}</span>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="primary-button" onClick={() => setView({ type: 'book', bookId: book.id })}>
                      Open Book
                    </button>
                    <button type="button" className="secondary-button" onClick={() => handleCreateChapter(book.id)}>
                      Add Chapter
                    </button>
                    <button type="button" className="danger-button subtle" onClick={() => handleDeleteBook(book.id)}>
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
              onAction={handleCreateBook}
            />
          )}
        </section>
      );
    }

    if (view.type === 'search') {
      return (
        <SearchResultsView
          query={searchQuery}
          results={searchResults}
          onOpenPage={(pageId) => {
            setView({ type: 'page', pageId });
            closeSidebarOnMobile();
          }}
        />
      );
    }

    if (view.type === 'book') {
      const book = getBook(data!, view.bookId);
      if (!book) {
        return invalidState();
      }

      const chapters = getChaptersForBook(data!, book.id);

      return (
        <section className="content-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Book</p>
              <InlineEditableText
                value={book.title}
                onSave={(title) => updateData(updateBook(data!, book.id, title))}
                className="heading-edit-button"
                inputClassName="heading-input"
              />
            </div>
            <div className="section-actions">
              <button type="button" className="primary-button" onClick={() => handleCreateChapter(book.id)}>
                New Chapter
              </button>
              <button type="button" className="danger-button subtle" onClick={() => handleDeleteBook(book.id)}>
                Delete Book
              </button>
            </div>
          </div>

          {chapters.length > 0 ? (
            <ReorderableList
              items={chapters}
              onReorder={(orderedChapterIds) => handleReorderChapters(book.id, orderedChapterIds)}
              listClassName="stack-list"
              itemClassName="reorder-card"
              itemDraggingClassName="is-dragging"
              itemDropTopClassName="drop-top"
              itemDropBottomClassName="drop-bottom"
              isEnabled={chapters.length > 1}
              renderItem={(chapter) => (
                <article className="list-card">
                  <div className="list-card-main">
                    <div className="list-card-row">
                      <span className="drag-handle" aria-hidden="true">
                        ::
                      </span>
                      <InlineEditableText
                        value={chapter.title}
                        onSave={(title) => updateData(updateChapter(data!, chapter.id, title))}
                        className="list-card-title"
                        inputClassName="inline-input block-input"
                      />
                    </div>
                    <p>{getPagesForChapter(data!, chapter.id).length} pages</p>
                    <p>Updated {formatTimestamp(chapter.updatedAt)}</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="primary-button" onClick={() => setView({ type: 'chapter', chapterId: chapter.id })}>
                      Open Chapter
                    </button>
                    <button type="button" className="secondary-button" onClick={() => handleCreatePage(chapter.id)}>
                      Add Page
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setMovingChapterId((currentId) => (currentId === chapter.id ? null : chapter.id))
                      }
                    >
                      Move to...
                    </button>
                    <button
                      type="button"
                      className="danger-button subtle"
                      onClick={() => handleDeleteChapter(chapter.id, book.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {movingChapterId === chapter.id ? (
                    <MoveTargetPanel
                      title="Move Chapter to Book"
                      options={books.map((item) => ({ id: item.id, label: item.title }))}
                      currentTargetId={chapter.bookId}
                      submitLabel="Move Chapter"
                      onConfirm={(destinationBookId) =>
                        handleMoveChapter(chapter.id, destinationBookId)
                      }
                      onCancel={() => setMovingChapterId(null)}
                    />
                  ) : null}
                </article>
              )}
            />
          ) : (
            <EmptyState
              title="No chapters yet"
              message="Break this book into chapters to keep related pages together."
              actionLabel="Create Chapter"
              onAction={() => handleCreateChapter(book.id)}
            />
          )}
        </section>
      );
    }

    if (view.type === 'chapter') {
      const chapter = getChapter(data!, view.chapterId);
      if (!chapter) {
        return invalidState();
      }

      const book = getBook(data!, chapter.bookId);
      const pages = getPagesForChapter(data!, chapter.id);

      return (
        <section className="content-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">{book?.title ?? 'Book'}</p>
              <InlineEditableText
                value={chapter.title}
                onSave={(title) => updateData(updateChapter(data!, chapter.id, title))}
                className="heading-edit-button"
                inputClassName="heading-input"
              />
            </div>
            <div className="section-actions">
              <button type="button" className="primary-button" onClick={() => handleCreatePage(chapter.id)}>
                New Page
              </button>
              <button
                type="button"
                className="danger-button subtle"
                onClick={() => handleDeleteChapter(chapter.id, chapter.bookId)}
              >
                Delete Chapter
              </button>
            </div>
          </div>

          {pages.length > 0 ? (
            <ReorderableList
              items={pages}
              onReorder={(orderedPageIds) => handleReorderPages(chapter.id, orderedPageIds)}
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
                        onSave={(title) => updateData(updatePage(data!, page.id, { title }))}
                        className="list-card-title"
                        inputClassName="inline-input block-input"
                      />
                    </div>
                    <p>{page.content.trim() ? `${page.content.trim().slice(0, 90)}${page.content.length > 90 ? '...' : ''}` : 'Plain text note'}</p>
                    <p>Updated {formatTimestamp(page.updatedAt)}</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="primary-button" onClick={() => setView({ type: 'page', pageId: page.id })}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setMovingPageId((currentId) => (currentId === page.id ? null : page.id))
                      }
                    >
                      Move to...
                    </button>
                    <button type="button" className="danger-button subtle" onClick={() => handleDeletePage(page)}>
                      Delete
                    </button>
                  </div>
                  {movingPageId === page.id ? (
                    <MoveTargetPanel
                      title="Move Page to Chapter"
                      options={data!.chapters.map((item) => ({
                        id: item.id,
                        label: `${getBook(data!, item.bookId)?.title ?? 'Book'} / ${item.title}`
                      }))}
                      currentTargetId={page.chapterId ?? undefined}
                      submitLabel="Move Page"
                      onConfirm={(destinationChapterId) =>
                        handleMovePage(page.id, destinationChapterId)
                      }
                      onCancel={() => setMovingPageId(null)}
                    />
                  ) : null}
                </article>
              )}
            />
          ) : (
            <EmptyState
              title="No pages yet"
              message="Add a plain text page and it will auto-save as you write."
              actionLabel="Create Page"
              onAction={() => handleCreatePage(chapter.id)}
            />
          )}
        </section>
      );
    }

    if (view.type === 'loosePages') {
      return (
        <section className="content-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Library</p>
              <h1>Loose Pages</h1>
            </div>
            <div className="section-actions">
              <button type="button" className="primary-button" onClick={handleCreateLoosePage}>
                New Loose Page
              </button>
            </div>
          </div>

          {loosePages.length > 0 ? (
            <div className="stack-list">
              {loosePages.map((page) => (
                <article key={page.id} className="list-card">
                  <div className="list-card-main">
                    <InlineEditableText
                      value={page.title}
                      onSave={(title) => updateData(updatePage(data!, page.id, { title }))}
                      className="list-card-title"
                      inputClassName="inline-input block-input"
                    />
                    <p>{page.content.trim() ? `${page.content.trim().slice(0, 90)}${page.content.length > 90 ? '...' : ''}` : 'Plain text note'}</p>
                    <p>Updated {formatTimestamp(page.updatedAt)}</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="primary-button" onClick={() => setView({ type: 'page', pageId: page.id })}>
                      Open
                    </button>
                    <button type="button" className="danger-button subtle" onClick={() => handleDeletePage(page)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No loose pages yet"
              message="Loose pages live outside books and stay easy to reach from the sidebar."
              actionLabel="Create Loose Page"
              onAction={handleCreateLoosePage}
            />
          )}
        </section>
      );
    }

    if (view.type === 'page') {
      const page = getPage(data!, view.pageId);
      if (!page) {
        return invalidState();
      }

      const moveBookId = books[0]?.id ?? '';

      return (
        <PageEditor
          page={page}
          books={books}
          chapters={data!.chapters}
          initialMoveBookId={moveBookId}
          shouldAutoFocus={shouldAutoFocusEditor}
          onChangeTitle={(title) => updateData(updatePage(data!, page.id, { title }))}
          onChangeContent={(content) => updateData(updatePage(data!, page.id, { content }))}
          onChangeTextSize={(textSize) => updateData(updatePage(data!, page.id, { textSize }))}
          onDelete={() => handleDeletePage(page)}
          onMoveLoosePage={({ bookId, chapterId, newChapterTitle }) => {
            const result = moveLoosePageToChapter(data!, page.id, bookId, { chapterId, newChapterTitle });
            updateData(result.data);
            if (result.chapterId) {
              setView({ type: 'chapter', chapterId: result.chapterId });
            }
          }}
        />
      );
    }

    return invalidState();
  }
}

function getNavigationState(view: ViewState, data: LibraryData): {
  showBack: boolean;
  parentLabel?: string;
  currentLabel: string;
} {
  if (view.type === 'root') {
    return { showBack: false, currentLabel: 'Books' };
  }

  if (view.type === 'book') {
    const book = getBook(data, view.bookId);
    return {
      showBack: true,
      parentLabel: 'Books',
      currentLabel: book?.title ?? 'Book'
    };
  }

  if (view.type === 'search') {
    return {
      showBack: true,
      parentLabel: 'Library',
      currentLabel: 'Search Results'
    };
  }

  if (view.type === 'chapter') {
    const chapter = getChapter(data, view.chapterId);
    const book = chapter ? getBook(data, chapter.bookId) : undefined;
    return {
      showBack: true,
      parentLabel: book?.title ?? 'Book',
      currentLabel: chapter?.title ?? 'Chapter'
    };
  }

  if (view.type === 'loosePages') {
    return {
      showBack: true,
      parentLabel: 'Books',
      currentLabel: 'Loose Pages'
    };
  }

  const page = getPage(data, view.pageId);
  if (!page) {
    return { showBack: true, parentLabel: 'Books', currentLabel: 'Page' };
  }

  if (page.isLoose || !page.chapterId) {
    return {
      showBack: true,
      parentLabel: 'Loose Pages',
      currentLabel: page.title
    };
  }

  const chapter = getChapter(data, page.chapterId);
  return {
    showBack: true,
    parentLabel: chapter?.title ?? 'Chapter',
    currentLabel: page.title
  };
}

function getParentView(view: ViewState, data: LibraryData, searchOriginView: ViewState): ViewState {
  if (view.type === 'book') {
    return { type: 'root' };
  }

  if (view.type === 'search') {
    return searchOriginView.type === 'search' ? { type: 'root' } : searchOriginView;
  }

  if (view.type === 'chapter') {
    const chapter = getChapter(data, view.chapterId);
    return chapter ? { type: 'book', bookId: chapter.bookId } : { type: 'root' };
  }

  if (view.type === 'page') {
    const page = getPage(data, view.pageId);
    if (!page) {
      return { type: 'root' };
    }

    if (page.isLoose || !page.chapterId) {
      return { type: 'loosePages' };
    }

    return { type: 'chapter', chapterId: page.chapterId };
  }

  if (view.type === 'loosePages') {
    return { type: 'root' };
  }

  return { type: 'root' };
}

function invalidState(): JSX.Element {
  return (
    <EmptyState
      title="This item no longer exists"
      message="It may have been deleted. Jump back to the library to keep going."
      actionLabel="Back to Books"
      onAction={() => window.location.reload()}
    />
  );
}
