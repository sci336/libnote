import { useCallback, useMemo } from 'react';
import { AppMenu } from './components/AppMenu';
import { EmptyState } from './components/EmptyState';
import { PageEditor } from './components/PageEditor';
import { SearchResultsView } from './components/SearchResultsView';
import { Sidebar, type RecentSidebarPage } from './components/Sidebar';
import { TagResultsView } from './components/TagResultsView';
import { TopBar } from './components/TopBar';
import { useLibraryApp } from './hooks/useLibraryApp';
import { AppLayout } from './layouts/AppLayout';
import { getChapterCountForBook, getPageCountForChapter } from './store/librarySelectors';
import type { Book, Chapter, Page } from './types/domain';
import { isLoosePage } from './utils/pageState';
import { buildBacklinkIndex, buildPageTitleLookup, parseContentIntoSegments } from './utils/pageLinks';
import type { SearchResult } from './utils/search';
import { getAllTags, getTagResults } from './utils/tags';
import { BookView } from './views/BookView';
import { ChapterView } from './views/ChapterView';
import { LoosePagesView } from './views/LoosePagesView';
import { RootView } from './views/RootView';
import { TrashView } from './views/TrashView';

export default function App(): JSX.Element {
  const app = useLibraryApp();
  const data = app.data;
  const liveBooks = useMemo(() => (data?.books ?? []).filter((book) => !book.deletedAt), [data]);
  const liveChapters = useMemo(() => (data?.chapters ?? []).filter((chapter) => !chapter.deletedAt), [data]);
  const allPages = useMemo(() => (data?.pages ?? []).filter((page) => !page.deletedAt), [data]);
  const pageById = useMemo(() => new Map(allPages.map((page) => [page.id, page])), [allPages]);
  const chapterById = useMemo(
    () => new Map(liveChapters.map((chapter) => [chapter.id, chapter])),
    [liveChapters]
  );
  const bookById = useMemo(() => new Map(liveBooks.map((book) => [book.id, book])), [liveBooks]);
  const pageTitleLookup = useMemo(() => buildPageTitleLookup(allPages), [allPages]);
  const backlinkIndex = useMemo(() => buildBacklinkIndex(allPages), [allPages]);
  // Page-link parsing is derived in the shell so the editor stays focused on UI
  // concerns while still receiving resolved links and backlinks as ready-to-render data.
  const activePageSegments = useMemo(
    () => (app.activePage ? parseContentIntoSegments(app.activePage.content, pageTitleLookup) : []),
    [app.activePage, pageTitleLookup]
  );
  const activePageBacklinks = useMemo(() => {
    if (!app.activePage) {
      return [];
    }

    const backlinkPageIds = backlinkIndex[app.activePage.id] ?? [];

    return backlinkPageIds
      .map((pageId) => pageById.get(pageId))
      .filter((page): page is NonNullable<typeof page> => Boolean(page))
      .map((page) => ({
        pageId: page.id,
        title: page.title,
        path: getPagePathLabel(page, chapterById, bookById)
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [app.activePage, backlinkIndex, bookById, chapterById, pageById]);
  const tagResults = useMemo(
    () => (app.view.type === 'tag' ? getTagResults(allPages, liveChapters, liveBooks, app.view.tags) : []),
    [allPages, app.view, liveBooks, liveChapters]
  );
  const availableTags = useMemo(() => getAllTags(allPages), [allPages]);
  const recentPages = useMemo<RecentSidebarPage[]>(
    () =>
      app.recentPageIds
        .map((pageId) => pageById.get(pageId))
        .filter((page): page is Page => Boolean(page))
        .map((page) => ({
          id: page.id,
          title: page.title,
          contextLabel: getPagePathLabel(page, chapterById, bookById)
        })),
    [app.recentPageIds, bookById, chapterById, pageById]
  );

  const openPageById = useCallback(
    (pageId: string) => {
      const page = pageById.get(pageId);
      if (!page) {
        return;
      }

      if (isLoosePage(page)) {
        app.handleOpenPage(page.id);
        return;
      }

      if (page.chapterId) {
        app.handleOpenPage(page.id);
      }
    },
    [app.handleOpenPage, pageById]
  );
  const openSearchResult = useCallback(
    (result: SearchResult) => {
      if (result.type === 'book') {
        app.handleOpenBook(result.id);
        return;
      }

      if (result.type === 'chapter') {
        app.handleOpenChapter(result.id);
        return;
      }

      openPageById(result.id);
    },
    [app.handleOpenBook, app.handleOpenChapter, openPageById]
  );

  if (!data) {
    return <div className="loading-screen">Loading note library...</div>;
  }

  const sidebarBookId = app.sidebarBookId;
  const sidebarChapterId = app.sidebarChapterId;
  const sidebarCreateChapter =
    sidebarBookId === undefined
      ? undefined
      : () => app.handleCreateChapter(sidebarBookId);
  const sidebarCreatePage =
    sidebarChapterId === undefined
      ? undefined
      : () => app.handleCreatePage(sidebarChapterId);
  const sidebarReorderBooks =
    app.books.length <= 1
      ? undefined
      : (orderedBookIds: string[]) => app.handleReorderBooks(orderedBookIds);
  const sidebarReorderChapters =
    sidebarBookId === undefined || app.chapterList.length <= 1
      ? undefined
      : (orderedChapterIds: string[]) => app.handleReorderChapters(sidebarBookId, orderedChapterIds);
  const sidebarReorderPages =
    sidebarChapterId === undefined || app.pageList.length <= 1
      ? undefined
      : (orderedPageIds: string[]) => app.handleReorderPages(sidebarChapterId, orderedPageIds);

  return (
    <AppLayout
      topBar={
        <TopBar
          showBack={app.nav.showBack}
          parentLabel={app.nav.parentLabel}
          currentLabel={app.nav.currentLabel}
          searchValue={app.searchQuery}
          availableTags={availableTags}
          onGoHome={app.navigateHome}
          onOpenAppMenu={() => app.openAppMenu()}
          onToggleSidebar={() => app.setSidebarOpen((open) => !open)}
          onGoBack={app.navigateBack}
          onParentClick={app.goToParentView}
          onSearchChange={app.handleSearchChange}
          onSearchFocus={app.handleSearchFocus}
        />
      }
      sidebar={
        <Sidebar
          isOpen={app.sidebarOpen}
          currentView={app.view}
          books={app.books}
          chapters={app.chapterList}
          pages={app.pageList}
          loosePages={app.loosePages}
          recentPages={recentPages}
          activeBookId={app.sidebarBookId}
          activeChapterId={app.activeChapter?.id ?? app.derivedChapterForPage?.id}
          activePageId={app.activePage?.id}
          onNavigateRoot={app.navigateHome}
          onNavigateLoosePages={app.handleOpenLoosePages}
          onNavigateTrash={app.handleOpenTrash}
          onNavigateBook={app.handleOpenBook}
          onNavigateChapter={app.handleOpenChapter}
          onNavigatePage={openPageById}
          onCreateChapterInContext={sidebarCreateChapter}
          onCreatePageInContext={sidebarCreatePage}
          onReorderBooks={sidebarReorderBooks}
          onReorderChapters={sidebarReorderChapters}
          onReorderPages={sidebarReorderPages}
          onCreateLoosePageInContext={app.handleCreateLoosePage}
          onClose={() => app.setSidebarOpen(false)}
        />
      }
    >
      {renderMainContent(app, data, {
        openPageById,
        openSearchResult,
        activePageSegments,
        activePageBacklinks,
        tagResults,
        availableTags
      })}
      <AppMenu
        isOpen={app.appMenuOpen}
        activeSection={app.appMenuSection}
        settings={app.settings}
        backupStatus={app.backupStatus}
        onUpdateLibraryBooksPerRow={app.handleUpdateLibraryBooksPerRow}
        onUpdateShortcut={app.handleUpdateShortcut}
        onResetShortcut={app.handleResetShortcut}
        onResetAllShortcuts={app.handleResetAllShortcuts}
        onExportLibrary={app.handleExportLibrary}
        onImportLibrary={app.handleImportLibrary}
        onClose={app.closeAppMenu}
        onSelectSection={app.navigateAppMenu}
      />
    </AppLayout>
  );
}

function renderMainContent(
  app: ReturnType<typeof useLibraryApp>,
  data: NonNullable<ReturnType<typeof useLibraryApp>['data']>,
  pageLinkState: {
    openPageById: (pageId: string) => void;
    openSearchResult: (result: SearchResult) => void;
    activePageSegments: ReturnType<typeof parseContentIntoSegments>;
    activePageBacklinks: Array<{ pageId: string; title: string; path: string }>;
    tagResults: ReturnType<typeof getTagResults>;
    availableTags: string[];
  }
): JSX.Element {
  // Keep route-to-view branching centralized here so individual view components
  // remain mostly presentational and the app hook owns navigation behavior.
  if (app.view.type === 'root') {
    return (
      <RootView
        books={app.books}
        getChapterCountForBook={(bookId) => getChapterCountForBook(data, bookId)}
        onCreateBook={app.handleCreateBook}
        onOpenBook={app.handleOpenBook}
        onReorderBooks={app.handleReorderBooks}
        onCreateChapter={app.handleCreateChapter}
        onDeleteBook={app.handleDeleteBook}
        onRenameBook={app.handleRenameBook}
        onOpenLoosePages={app.handleOpenLoosePages}
        booksPerRow={app.settings.libraryView.booksPerRow}
      />
    );
  }

  if (app.view.type === 'search') {
    return (
      <SearchResultsView
        query={app.searchQuery}
        mode={app.searchMode}
        results={app.searchResults}
        onOpenResult={pageLinkState.openSearchResult}
      />
    );
  }

  if (app.view.type === 'tag') {
    return (
      <TagResultsView
        tags={app.view.tags}
        results={pageLinkState.tagResults}
        availableTags={pageLinkState.availableTags}
        recentTags={app.recentTags}
        onOpenPage={pageLinkState.openPageById}
        onOpenTag={app.handleOpenTag}
        onRemoveTag={app.handleRemoveActiveTag}
      />
    );
  }

  if (app.view.type === 'trash') {
    return (
      <TrashView
        items={app.trashItems}
        onRestore={app.handleRestoreTrashItem}
        onDeleteForever={app.handleDeleteTrashItemForever}
        onEmptyTrash={app.handleEmptyTrash}
      />
    );
  }

  if (app.view.type === 'book') {
    if (!app.activeBook) {
      return invalidState();
    }

    const activeBook = app.activeBook;

    return (
      <BookView
        book={activeBook}
        chapters={app.chapterList}
        books={app.books}
        movingChapterId={app.movingChapterId}
        getPageCountForChapter={(chapterId) => getPageCountForChapter(data, chapterId)}
        onRenameBook={app.handleRenameBook}
        onCreateChapter={app.handleCreateChapter}
        onDeleteBook={app.handleDeleteBook}
        onOpenChapter={app.handleOpenChapter}
        onCreatePage={app.handleCreatePage}
        onRenameChapter={app.handleRenameChapter}
        onDeleteChapter={app.handleDeleteChapter}
        onToggleMoveChapter={(chapterId) =>
          app.setMovingChapterId((currentId) => (currentId === chapterId ? null : chapterId))
        }
        onConfirmMoveChapter={app.handleMoveChapter}
        onCancelMoveChapter={() => app.setMovingChapterId(null)}
        onReorderChapters={(orderedChapterIds) => app.handleReorderChapters(activeBook.id, orderedChapterIds)}
      />
    );
  }

  if (app.view.type === 'chapter') {
    if (!app.activeChapter) {
      return invalidState();
    }

    const activeChapter = app.activeChapter;

    return (
      <ChapterView
        chapter={activeChapter}
        book={app.derivedBookForChapter}
        pages={app.pageList}
        chapters={app.allChapters}
        books={app.books}
        movingPageId={app.movingPageId}
        onRenameChapter={app.handleRenameChapter}
        onCreatePage={app.handleCreatePage}
        onDeleteChapter={app.handleDeleteChapter}
        onOpenPage={pageLinkState.openPageById}
        onRenamePage={app.handleRenamePage}
        onDeletePage={app.handleDeletePage}
        onToggleMovePage={(pageId) =>
          app.setMovingPageId((currentId) => (currentId === pageId ? null : pageId))
        }
        onConfirmMovePage={app.handleMovePage}
        onCancelMovePage={() => app.setMovingPageId(null)}
        onReorderPages={(orderedPageIds) => app.handleReorderPages(activeChapter.id, orderedPageIds)}
      />
    );
  }

  if (app.view.type === 'loosePages') {
    return (
      <LoosePagesView
        loosePages={app.loosePages}
        onCreateLoosePage={app.handleCreateLoosePage}
        onOpenPage={pageLinkState.openPageById}
        onRenamePage={app.handleRenamePage}
        onDeletePage={app.handleDeletePage}
      />
    );
  }

  if (app.view.type === 'page') {
    if (!app.activePage) {
      return invalidState();
    }

    const activePage = app.activePage;

    return (
      <PageEditor
        page={activePage}
        books={app.books}
        chapters={app.allChapters}
        parentBook={app.derivedBookForPage}
        parentChapter={app.derivedChapterForPage}
        initialMoveBookId={app.initialMoveBookId}
        contentSegments={pageLinkState.activePageSegments}
        backlinks={pageLinkState.activePageBacklinks}
        shouldAutoFocus={app.shouldAutoFocusEditor}
        onChangeTitle={(title) => app.handleRenamePage(activePage.id, title)}
        onChangeContent={(content) => app.handleUpdatePageContent(activePage.id, content)}
        onChangeTextSize={(textSize) => app.handleUpdatePageTextSize(activePage.id, textSize)}
        onChangeTags={(tags) => app.handleUpdatePageTags(activePage.id, tags)}
        onDelete={() => app.handleDeletePage(activePage)}
        onMoveLoosePage={(payload) => app.handleMoveLoosePage(activePage.id, payload)}
        onOpenPage={pageLinkState.openPageById}
        onExportPage={() => app.handleExportPage(activePage.id)}
        onOpenTagSearch={app.handleOpenTag}
      />
    );
  }

  return invalidState();
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

function getPagePathLabel(
  page: Page,
  chapterById: Map<string, Chapter>,
  bookById: Map<string, Book>
): string {
  if (isLoosePage(page)) {
    return 'Loose Pages';
  }

  const chapter = page.chapterId ? chapterById.get(page.chapterId) : undefined;
  if (!chapter) {
    return 'Loose Pages';
  }

  const book = bookById.get(chapter.bookId);
  return book ? `${book.title} / ${chapter.title}` : chapter.title;
}
