interface TopBarProps {
  showBack: boolean;
  parentLabel?: string;
  currentLabel: string;
  searchValue: string;
  onToggleSidebar: () => void;
  onGoBack: () => void;
  onParentClick?: () => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
}

export function TopBar({
  showBack,
  parentLabel,
  currentLabel,
  searchValue,
  onToggleSidebar,
  onGoBack,
  onParentClick,
  onSearchChange,
  onSearchFocus
}: TopBarProps): JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button type="button" className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          ☰
        </button>
        {showBack ? (
          <button type="button" className="icon-button" onClick={onGoBack} aria-label="Go up one level">
            ←
          </button>
        ) : null}
      </div>

      <div className="breadcrumb" aria-label="Current location">
        {parentLabel ? (
          <>
            <button type="button" className="breadcrumb-parent" onClick={onParentClick}>
              {parentLabel}
            </button>
            <span className="breadcrumb-separator">|</span>
          </>
        ) : null}
        <span className="breadcrumb-current">{currentLabel}</span>
      </div>

      <label className="search-shell">
        <span className="search-icon" aria-hidden="true">
          Search
        </span>
        <input
          type="search"
          className="search-input"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={onSearchFocus}
          placeholder="Search pages by title or phrase..."
          aria-label="Search pages"
        />
      </label>
    </header>
  );
}
