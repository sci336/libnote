import { useEffect, useMemo, useRef, useState } from 'react';
import { TagSuggestionsDropdown } from './TagSuggestionsDropdown';
import { getActiveSlashTagToken, getTagSuggestions, replaceSlashTagToken } from '../utils/tags';

interface TopBarProps {
  showBack: boolean;
  parentLabel?: string;
  currentLabel: string;
  searchValue: string;
  availableTags: string[];
  onGoHome: () => void;
  onOpenAppMenu: () => void;
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
  availableTags,
  onGoHome,
  onOpenAppMenu,
  onToggleSidebar,
  onGoBack,
  onParentClick,
  onSearchChange,
  onSearchFocus
}: TopBarProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [caretPosition, setCaretPosition] = useState(searchValue.length);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const activeToken = useMemo(
    () => getActiveSlashTagToken(searchValue, caretPosition),
    [caretPosition, searchValue]
  );
  const suggestions = useMemo(
    () =>
      activeToken
        ? getTagSuggestions(availableTags, activeToken.normalizedQuery)
        : [],
    [activeToken, availableTags]
  );
  const shouldShowSuggestions = suggestionsVisible && suggestions.length > 0;

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [searchValue]);

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [activeSuggestionIndex, suggestions.length]);

  function applySuggestion(tag: string): void {
    const input = inputRef.current;
    const nextCaret = input?.selectionStart ?? caretPosition;
    const tokenMatch = getActiveSlashTagToken(searchValue, nextCaret);
    const nextValue = replaceSlashTagToken(searchValue, nextCaret, tag);
    const replacementEnd = (tokenMatch?.start ?? nextCaret) + tag.length + 1;

    onSearchChange(nextValue);
    setSuggestionsVisible(false);
    setActiveSuggestionIndex(0);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(replacementEnd, replacementEnd);
      setCaretPosition(replacementEnd);
    });
  }

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button type="button" className="icon-button" onClick={onOpenAppMenu} aria-label="Open app menu">
          ☰
        </button>
        <button
          type="button"
          className="icon-button icon-button-label"
          onClick={onToggleSidebar}
          aria-label="Open library navigation"
        >
          Nav
        </button>
        {showBack ? (
          <button type="button" className="icon-button" onClick={onGoBack} aria-label="Go back">
            ←
          </button>
        ) : null}
        <button
          type="button"
          className="icon-button icon-button-label"
          onClick={onGoHome}
          aria-label="Go to library home"
        >
          Home
        </button>
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
          ref={inputRef}
          type="search"
          className="search-input"
          value={searchValue}
          onChange={(event) => {
            setCaretPosition(event.target.selectionStart ?? event.target.value.length);
            onSearchChange(event.target.value);
            setSuggestionsVisible(Boolean(getActiveSlashTagToken(event.target.value, event.target.selectionStart ?? event.target.value.length)));
          }}
          onFocus={(event) => {
            setCaretPosition(event.target.selectionStart ?? searchValue.length);
            onSearchFocus();
            setSuggestionsVisible(Boolean(getActiveSlashTagToken(searchValue, event.target.selectionStart ?? searchValue.length)));
          }}
          onClick={(event) => {
            setCaretPosition(event.currentTarget.selectionStart ?? searchValue.length);
            setSuggestionsVisible(Boolean(getActiveSlashTagToken(searchValue, event.currentTarget.selectionStart ?? searchValue.length)));
          }}
          onKeyUp={(event) => {
            setCaretPosition(event.currentTarget.selectionStart ?? searchValue.length);
          }}
          onBlur={() => {
            window.setTimeout(() => setSuggestionsVisible(false), 120);
          }}
          onKeyDown={(event) => {
            if (!shouldShowSuggestions) {
              if (event.key === 'Escape') {
                setSuggestionsVisible(false);
              }
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
              return;
            }

            if (event.key === 'Enter') {
              if (suggestions[activeSuggestionIndex]) {
                event.preventDefault();
                applySuggestion(suggestions[activeSuggestionIndex]);
              }
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setSuggestionsVisible(false);
            }
          }}
          placeholder="Search books, chapters, pages, or /tags..."
          aria-label="Search books, chapters, pages, or slash tags"
        />
        <TagSuggestionsDropdown
          suggestions={shouldShowSuggestions ? suggestions : []}
          activeIndex={activeSuggestionIndex}
          onSelect={applySuggestion}
        />
      </label>
    </header>
  );
}
