import { useEffect, useMemo, useRef, useState } from 'react';
import { TagSuggestionsDropdown } from './TagSuggestionsDropdown';
import { SearchIcon } from './MobileIcons';
import type { BreadcrumbItem } from '../types/domain';
import { getActiveSlashTagToken, getTagSuggestions, replaceSlashTagToken } from '../utils/tags';

interface MobileTopHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  showBack: boolean;
  searchValue: string;
  availableTags: string[];
  isSearchRoute: boolean;
  onOpenAppMenu: () => void;
  onGoBack: () => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
}

export function MobileTopHeader({
  breadcrumbs,
  showBack,
  searchValue,
  availableTags,
  isSearchRoute,
  onOpenAppMenu,
  onGoBack,
  onSearchChange,
  onSearchFocus
}: MobileTopHeaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(searchValue) || isSearchRoute);
  const [caretPosition, setCaretPosition] = useState(searchValue.length);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
  const parentCrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : undefined;
  const title = currentCrumb?.label ?? 'Library';
  const activeToken = useMemo(
    () => getActiveSlashTagToken(searchValue, caretPosition),
    [caretPosition, searchValue]
  );
  const suggestions = useMemo(
    () => (activeToken ? getTagSuggestions(availableTags, activeToken.normalizedQuery) : []),
    [activeToken, availableTags]
  );
  const shouldShowSuggestions = suggestionsVisible && suggestions.length > 0;

  useEffect(() => {
    if (isSearchRoute || searchValue) {
      setIsSearchExpanded(true);
    }
  }, [isSearchRoute, searchValue]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [searchValue]);

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [activeSuggestionIndex, suggestions.length]);

  function openSearch(): void {
    setIsSearchExpanded(true);
    onSearchFocus();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closeSearch(): void {
    if (searchValue) {
      onSearchChange('');
    }
    setSuggestionsVisible(false);
    setIsSearchExpanded(false);
    inputRef.current?.blur();
  }

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
    <header className="mobile-top-header">
      <div className="mobile-header-row">
        <button type="button" className="mobile-icon-button" onClick={onOpenAppMenu} aria-label="Open app menu">
          ☰
        </button>
        <div className="mobile-title-block" aria-label="Current location">
          <span className="mobile-title">{title}</span>
          {parentCrumb ? <span className="mobile-subtitle">{parentCrumb.label}</span> : null}
        </div>
        {showBack ? (
          <button type="button" className="mobile-icon-button" onClick={onGoBack} aria-label="Go back">
            ←
          </button>
        ) : null}
        <button type="button" className="mobile-icon-button mobile-search-button" onClick={openSearch} aria-label="Open search">
          <SearchIcon className="mobile-header-search-icon" />
        </button>
      </div>

      {isSearchExpanded ? (
        <label className="mobile-search-shell">
          <span className="sr-only">Mobile search books, chapters, pages, or slash tags</span>
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
            onKeyUp={(event) => setCaretPosition(event.currentTarget.selectionStart ?? searchValue.length)}
            onBlur={() => window.setTimeout(() => setSuggestionsVisible(false), 120)}
            onKeyDown={(event) => {
              if (!shouldShowSuggestions) {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  closeSearch();
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

              if (event.key === 'Enter' && suggestions[activeSuggestionIndex]) {
                event.preventDefault();
                applySuggestion(suggestions[activeSuggestionIndex]);
                return;
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setSuggestionsVisible(false);
              }
            }}
            placeholder="Search books, pages, or /tags..."
            aria-label="Mobile search books, chapters, pages, or slash tags"
          />
          <button type="button" className="mobile-search-close" onClick={closeSearch} aria-label="Close search">
            ×
          </button>
          <TagSuggestionsDropdown
            suggestions={shouldShowSuggestions ? suggestions : []}
            activeIndex={activeSuggestionIndex}
            onSelect={applySuggestion}
          />
        </label>
      ) : null}
    </header>
  );
}
