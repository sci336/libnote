import { useState } from 'react';

interface MobileBottomNavProps {
  canCreateChapter: boolean;
  canCreatePage: boolean;
  onGoLibrary: () => void;
  onOpenSearch: () => void;
  onOpenTags: () => void;
  onOpenTrash: () => void;
  onCreateBook: () => void;
  onCreateLoosePage: () => void;
  onCreateChapter?: () => void;
  onCreatePage?: () => void;
}

export function MobileBottomNav({
  canCreateChapter,
  canCreatePage,
  onGoLibrary,
  onOpenSearch,
  onOpenTags,
  onOpenTrash,
  onCreateBook,
  onCreateLoosePage,
  onCreateChapter,
  onCreatePage
}: MobileBottomNavProps): JSX.Element {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  function choose(action: () => void): void {
    action();
    setIsNewMenuOpen(false);
  }

  return (
    <>
      {isNewMenuOpen ? (
        <div className="mobile-new-menu-layer">
          <button
            type="button"
            className="mobile-new-menu-backdrop"
            aria-label="Close creation menu"
            onClick={() => setIsNewMenuOpen(false)}
          />
          <div className="mobile-new-menu" role="menu" aria-label="Create new">
            <button type="button" role="menuitem" className="mobile-new-menu-item" onClick={() => choose(onCreateBook)}>
              <span className="mobile-new-menu-icon" aria-hidden="true">▭</span>
              <span><strong>New Book</strong><small>Create a new book</small></span>
            </button>
            <button type="button" role="menuitem" className="mobile-new-menu-item" onClick={() => choose(onCreateLoosePage)}>
              <span className="mobile-new-menu-icon" aria-hidden="true">□</span>
              <span><strong>New Loose Page</strong><small>Create a standalone page</small></span>
            </button>
            {canCreateChapter && onCreateChapter ? (
              <button type="button" role="menuitem" className="mobile-new-menu-item" onClick={() => choose(onCreateChapter)}>
                <span className="mobile-new-menu-icon" aria-hidden="true">☰</span>
                <span><strong>New Chapter</strong><small>Add a chapter to this book</small></span>
              </button>
            ) : null}
            {canCreatePage && onCreatePage ? (
              <button type="button" role="menuitem" className="mobile-new-menu-item" onClick={() => choose(onCreatePage)}>
                <span className="mobile-new-menu-icon" aria-hidden="true">▤</span>
                <span><strong>New Page</strong><small>Add a page to this chapter</small></span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        <button type="button" className="mobile-nav-item" onClick={onGoLibrary}>
          <span aria-hidden="true">▥</span>
          <span>Library</span>
        </button>
        <button type="button" className="mobile-nav-item" onClick={onOpenSearch}>
          <span aria-hidden="true">⌕</span>
          <span>Search</span>
        </button>
        <button
          type="button"
          className="mobile-nav-new"
          aria-expanded={isNewMenuOpen}
          onClick={() => setIsNewMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">＋</span>
          <span>New</span>
        </button>
        <button type="button" className="mobile-nav-item" onClick={onOpenTags}>
          <span aria-hidden="true">◇</span>
          <span>Tags</span>
        </button>
        <button type="button" className="mobile-nav-item" onClick={onOpenTrash}>
          <span aria-hidden="true">♲</span>
          <span>Trash</span>
        </button>
      </nav>
    </>
  );
}
