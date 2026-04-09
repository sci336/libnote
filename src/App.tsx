import { EmptyState } from './components/EmptyState';
import { PageEditor } from './components/PageEditor';
import { SearchResultsView } from './components/SearchResultsView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useLibraryApp } from './hooks/useLibraryApp';
import { AppLayout } from './layouts/AppLayout';
import { BookView } from './views/BookView';
import { ChapterView } from './views/ChapterView';
import { LoosePagesView } from './views/LoosePagesView';
import { RootView } from './views/RootView';

export default function App(): JSX.Element {
  const app = useLibraryApp();

  if (!app.data) {
    return <div className="loading-screen">Loading note library...</div>;
  }

  return (
    <AppLayout
      topBar={
        <TopBar
          showBack={app.nav.showBack}
          parentLabel={app.nav.parentLabel}
          currentLabel={app.nav.currentLabel}
          searchValue={app.searchQuery}
          onToggleSidebar={() => app.setSidebarOpen((open) => !open)}
          onGoBack={app.goUpOneLevel}
          onParentClick={app.goUpOneLevel}
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
          activeBookId={app.sidebarBookId}
          activeChapterId={app.activeChapter?.id ?? app.derivedChapterForPage?.id}
          activePageId={app.activePage?.id}
          onNavigateRoot={() => {
            app.setView({ type: 'root' });
            app.closeSidebarOnMobile();
          }}
          onNavigateLoosePages={app.handleOpenLoosePages}
          onNavigateBook={app.handleOpenBook}
          onNavigateChapter={app.handleOpenChapter}
          onNavigatePage={app.handleOpenPage}
          onCreateChapterInContext={
            app.sidebarBookId ? () => app.handleCreateChapter(app.sidebarBookId!) : undefined
          }
          onCreatePageInContext={
            app.sidebarChapterId ? () => app.handleCreatePage(app.sidebarChapterId!) : undefined
          }
          onReorderChapters={
            app.sidebarBookId && app.chapterList.length > 1
              ? (orderedChapterIds) => app.handleReorderChapters(app.sidebarBookId!, orderedChapterIds)
              : undefined
          }
          onReorderPages={
            app.sidebarChapterId && app.pageList.length > 1
              ? (orderedPageIds) => app.handleReorderPages(app.sidebarChapterId!, orderedPageIds)
              : undefined
          }
          onCreateLoosePageInContext={app.handleCreateLoosePage}
          onClose={() => app.setSidebarOpen(false)}
        />
      }
    >
      {renderMainContent(app)}
    </AppLayout>
  );
}

function renderMainContent(app: ReturnType<typeof useLibraryApp>): JSX.Element {
  if (app.view.type === 'root') {
    return (
      <RootView
        books={app.books}
        getChapterCountForBook={(bookId) =>
          app.data ? app.data.chapters.filter((chapter) => chapter.bookId === bookId).length : 0
        }
        onCreateBook={app.handleCreateBook}
        onOpenBook={app.handleOpenBook}
        onCreateChapter={app.handleCreateChapter}
        onDeleteBook={app.handleDeleteBook}
        onRenameBook={app.handleRenameBook}
        onOpenLoosePages={app.handleOpenLoosePages}
      />
    );
  }

  if (app.view.type === 'search') {
    return (
      <SearchResultsView
        query={app.searchQuery}
        results={app.searchResults}
        onOpenPage={app.handleOpenPage}
      />
    );
  }

  if (app.view.type === 'book') {
    if (!app.activeBook) {
      return invalidState();
    }

    return (
      <BookView
        book={app.activeBook}
        chapters={app.chapterList}
        books={app.books}
        movingChapterId={app.movingChapterId}
        getPageCountForChapter={(chapterId) =>
          app.data ? app.data.pages.filter((page) => page.chapterId === chapterId && !page.isLoose).length : 0
        }
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
        onReorderChapters={(orderedChapterIds) =>
          app.handleReorderChapters(app.activeBook!.id, orderedChapterIds)
        }
      />
    );
  }

  if (app.view.type === 'chapter') {
    if (!app.activeChapter) {
      return invalidState();
    }

    return (
      <ChapterView
        chapter={app.activeChapter}
        book={app.derivedBookForChapter}
        pages={app.pageList}
        chapters={app.allChapters}
        books={app.books}
        movingPageId={app.movingPageId}
        onRenameChapter={app.handleRenameChapter}
        onCreatePage={app.handleCreatePage}
        onDeleteChapter={app.handleDeleteChapter}
        onOpenPage={app.handleOpenPage}
        onRenamePage={app.handleRenamePage}
        onDeletePage={app.handleDeletePage}
        onToggleMovePage={(pageId) =>
          app.setMovingPageId((currentId) => (currentId === pageId ? null : pageId))
        }
        onConfirmMovePage={app.handleMovePage}
        onCancelMovePage={() => app.setMovingPageId(null)}
        onReorderPages={(orderedPageIds) =>
          app.handleReorderPages(app.activeChapter!.id, orderedPageIds)
        }
      />
    );
  }

  if (app.view.type === 'loosePages') {
    return (
      <LoosePagesView
        loosePages={app.loosePages}
        onCreateLoosePage={app.handleCreateLoosePage}
        onOpenPage={app.handleOpenPage}
        onRenamePage={app.handleRenamePage}
        onDeletePage={app.handleDeletePage}
      />
    );
  }

  if (app.view.type === 'page') {
    if (!app.activePage) {
      return invalidState();
    }

    return (
      <PageEditor
        page={app.activePage}
        books={app.books}
        chapters={app.allChapters}
        initialMoveBookId={app.initialMoveBookId}
        shouldAutoFocus={app.shouldAutoFocusEditor}
        onChangeTitle={(title) => app.handleRenamePage(app.activePage!.id, title)}
        onChangeContent={(content) => app.handleUpdatePageContent(app.activePage!.id, content)}
        onChangeTextSize={(textSize) => app.handleUpdatePageTextSize(app.activePage!.id, textSize)}
        onDelete={() => app.handleDeletePage(app.activePage!)}
        onMoveLoosePage={(payload) => app.handleMoveLoosePage(app.activePage!.id, payload)}
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
